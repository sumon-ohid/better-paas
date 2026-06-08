package paas

import (
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Rate limiting & brute-force protection
//
// Two layers protect the control plane:
//
//  1. A per-IP token-bucket limiter on every request, to blunt floods and
//     scraping (general DoS hygiene).
//  2. A stricter per-IP failure tracker for authentication attempts. After a
//     handful of bad tokens an IP is locked out with an escalating backoff,
//     which makes brute-forcing the 256-bit token hopeless in practice.
//
// State is in-memory (this is a single-node control plane). A background
// sweeper evicts idle entries so the maps don't grow unbounded.
// ---------------------------------------------------------------------------

// ---- General token-bucket limiter -----------------------------------------

type tokenBucket struct {
	tokens   float64
	lastSeen time.Time
}

type rateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*tokenBucket
	rate    float64 // tokens added per second
	burst   float64 // max tokens
}

func newRateLimiter(ratePerSec, burst float64) *rateLimiter {
	rl := &rateLimiter{
		buckets: make(map[string]*tokenBucket),
		rate:    ratePerSec,
		burst:   burst,
	}
	go rl.sweep()
	return rl
}

// allow reports whether a request from key may proceed, consuming one token.
func (rl *rateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	b, ok := rl.buckets[key]
	if !ok {
		rl.buckets[key] = &tokenBucket{tokens: rl.burst - 1, lastSeen: now}
		return true
	}

	// Refill based on elapsed time.
	elapsed := now.Sub(b.lastSeen).Seconds()
	b.tokens += elapsed * rl.rate
	if b.tokens > rl.burst {
		b.tokens = rl.burst
	}
	b.lastSeen = now

	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

func (rl *rateLimiter) sweep() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		for k, b := range rl.buckets {
			if time.Since(b.lastSeen) > 10*time.Minute {
				delete(rl.buckets, k)
			}
		}
		rl.mu.Unlock()
	}
}

// ---- Auth brute-force tracker ----------------------------------------------

type authFailures struct {
	mu      sync.Mutex
	entries map[string]*failEntry
}

type failEntry struct {
	count       int
	lockedUntil time.Time
	lastSeen    time.Time
}

func newAuthFailures() *authFailures {
	af := &authFailures{entries: make(map[string]*failEntry)}
	go af.sweep()
	return af
}

const (
	authFreeAttempts = 5               // failures allowed before lockout kicks in
	authBaseLockout  = 2 * time.Second // doubles each failure past the threshold
	authMaxLockout   = 15 * time.Minute
)

// retryAfter returns >0 (the wait duration) if key is currently locked out.
func (af *authFailures) retryAfter(key string) time.Duration {
	af.mu.Lock()
	defer af.mu.Unlock()
	e, ok := af.entries[key]
	if !ok {
		return 0
	}
	if d := time.Until(e.lockedUntil); d > 0 {
		return d
	}
	return 0
}

// recordFailure registers a failed attempt and applies an escalating lockout.
func (af *authFailures) recordFailure(key string) {
	af.mu.Lock()
	defer af.mu.Unlock()
	now := time.Now()
	e, ok := af.entries[key]
	if !ok {
		e = &failEntry{}
		af.entries[key] = e
	}
	e.count++
	e.lastSeen = now
	if e.count > authFreeAttempts {
		// Exponential backoff: base * 2^(over) capped at the max.
		over := e.count - authFreeAttempts - 1
		lock := authBaseLockout
		for i := 0; i < over && lock < authMaxLockout; i++ {
			lock *= 2
		}
		if lock > authMaxLockout {
			lock = authMaxLockout
		}
		e.lockedUntil = now.Add(lock)
	}
}

// recordSuccess clears the failure history for key.
func (af *authFailures) recordSuccess(key string) {
	af.mu.Lock()
	defer af.mu.Unlock()
	delete(af.entries, key)
}

func (af *authFailures) sweep() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		af.mu.Lock()
		for k, e := range af.entries {
			if time.Since(e.lastSeen) > authMaxLockout && time.Now().After(e.lockedUntil) {
				delete(af.entries, k)
			}
		}
		af.mu.Unlock()
	}
}

// ---- Shared instances & middleware -----------------------------------------

var (
	globalLimiter = newRateLimiter(20, 40) // ~20 req/s sustained, burst 40, per IP
	authLimiter   = newAuthFailures()
)

// clientIP extracts the best-effort client IP, honoring X-Forwarded-For /
// X-Real-IP when TRUST_PROXY is set (so a fronting reverse proxy works).
func clientIP(r *http.Request) string {
	if trustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			// First address in the list is the original client.
			if i := strings.IndexByte(xff, ','); i >= 0 {
				return strings.TrimSpace(xff[:i])
			}
			return strings.TrimSpace(xff)
		}
		if xr := r.Header.Get("X-Real-IP"); xr != "" {
			return strings.TrimSpace(xr)
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// rateLimit wraps a handler with the per-IP token-bucket limiter.
func rateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		if !globalLimiter.allow(ip) {
			w.Header().Set("Retry-After", "1")
			jsonError(w, "Too many requests", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// authKey identifies the subject for auth brute-force tracking.
func authKey(r *http.Request) string {
	return clientIP(r)
}

func logBruteForce(ip string, d time.Duration) {
	log.Printf("[auth] lockout: ip=%s locked for %s after repeated failures", ip, d.Round(time.Second))
}
