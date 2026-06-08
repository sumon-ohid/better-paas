package paas

import (
	"net/http/httptest"
	"testing"
	"time"
)

// setTestToken installs a known admin token for the duration of a test.
func setTestToken(t *testing.T, tok string) {
	t.Helper()
	authTokenLock.Lock()
	prev := authToken
	authToken = tok
	authTokenLock.Unlock()
	t.Cleanup(func() {
		authTokenLock.Lock()
		authToken = prev
		authTokenLock.Unlock()
	})
}

// freshAuthLimiter swaps in a clean lockout tracker so tests don't interfere
// with each other (or with the package-global state).
func freshAuthLimiter(t *testing.T) {
	t.Helper()
	prev := authLimiter
	authLimiter = &authFailures{entries: make(map[string]*failEntry)}
	t.Cleanup(func() { authLimiter = prev })
}

func TestAuthenticate_ValidTokenSucceedsAndClearsFailures(t *testing.T) {
	setTestToken(t, "correct-horse")
	freshAuthLimiter(t)

	r := httptest.NewRequest("POST", "/api/auth/verify", nil)
	r.RemoteAddr = "203.0.113.5:1234"

	// A couple of bad guesses, then the right one clears the slate.
	for i := 0; i < 3; i++ {
		if res := authenticate(r, "wrong"); res.OK {
			t.Fatalf("expected failure on bad token")
		}
	}
	res := authenticate(r, "correct-horse")
	if !res.OK {
		t.Fatalf("expected success with correct token")
	}
	if d := authLimiter.retryAfter("203.0.113.5"); d != 0 {
		t.Fatalf("success should clear failure history, got lockout %s", d)
	}
}

func TestAuthenticate_LocksOutAfterRepeatedFailures(t *testing.T) {
	setTestToken(t, "secret")
	freshAuthLimiter(t)

	r := httptest.NewRequest("POST", "/api/auth/verify", nil)
	r.RemoteAddr = "198.51.100.9:5555"

	// authFreeAttempts failures are allowed before lockout engages.
	locked := false
	for i := 0; i < authFreeAttempts+3; i++ {
		res := authenticate(r, "nope")
		if res.LockedOut {
			locked = true
			if res.RetryAfter <= 0 {
				t.Fatalf("locked out but RetryAfter not positive: %s", res.RetryAfter)
			}
			break
		}
	}
	if !locked {
		t.Fatalf("expected lockout after %d+ failures", authFreeAttempts)
	}

	// While locked out, even the CORRECT token is rejected.
	res := authenticate(r, "secret")
	if res.OK {
		t.Fatalf("expected correct token to be rejected during active lockout")
	}
	if !res.LockedOut {
		t.Fatalf("expected LockedOut during active lockout window")
	}
}

func TestAuthenticate_EmptyTokenDoesNotCountTowardLockout(t *testing.T) {
	setTestToken(t, "secret")
	freshAuthLimiter(t)

	r := httptest.NewRequest("GET", "/api/apps", nil)
	r.RemoteAddr = "192.0.2.7:4444"

	// Unauthenticated probes (no credentials) must not be able to lock out a
	// legitimate operator who shares the same source IP (e.g. behind NAT).
	for i := 0; i < authFreeAttempts*4; i++ {
		if res := authenticate(r, ""); res.LockedOut {
			t.Fatalf("empty token should never trigger lockout")
		}
	}
	if d := authLimiter.retryAfter("192.0.2.7"); d != 0 {
		t.Fatalf("empty-token attempts must not accrue lockout, got %s", d)
	}
}

func TestRetryAfterSeconds_RoundsUp(t *testing.T) {
	cases := []struct {
		in   time.Duration
		want int
	}{
		{0, 1},
		{500 * time.Millisecond, 1},
		{1 * time.Second, 1},
		{1500 * time.Millisecond, 2},
		{2 * time.Second, 2},
	}
	for _, c := range cases {
		if got := retryAfterSeconds(c.in); got != c.want {
			t.Errorf("retryAfterSeconds(%s) = %d, want %d", c.in, got, c.want)
		}
	}
}

func TestHTTPAuthOK_Writes429WhenLockedOut(t *testing.T) {
	setTestToken(t, "secret")
	freshAuthLimiter(t)

	r := httptest.NewRequest("POST", "/api/auth/verify", nil)
	r.RemoteAddr = "198.51.100.21:9999"

	// Drive it into lockout.
	for i := 0; i < authFreeAttempts+5; i++ {
		authenticate(r, "bad")
	}

	w := httptest.NewRecorder()
	if httpAuthOK(w, r, "secret") {
		t.Fatalf("expected httpAuthOK to reject during lockout")
	}
	if w.Code != 429 {
		t.Fatalf("expected HTTP 429 during lockout, got %d", w.Code)
	}
	if ra := w.Header().Get("Retry-After"); ra == "" {
		t.Fatalf("expected Retry-After header during lockout")
	}
}

func TestWSTicketIsSingleUse(t *testing.T) {
	prev := wsTickets
	wsTickets = make(map[string]wsTicket)
	t.Cleanup(func() { wsTickets = prev })

	ticket := issueWSTicket()
	if !consumeWSTicket(ticket) {
		t.Fatalf("expected fresh ticket to be accepted")
	}
	if consumeWSTicket(ticket) {
		t.Fatalf("expected ticket to be single-use")
	}
}

func TestWSTicketExpires(t *testing.T) {
	prev := wsTickets
	wsTickets = make(map[string]wsTicket)
	t.Cleanup(func() { wsTickets = prev })

	wsTicketLock.Lock()
	wsTickets["expired"] = wsTicket{expiresAt: time.Now().Add(-time.Second)}
	wsTicketLock.Unlock()

	if consumeWSTicket("expired") {
		t.Fatalf("expected expired ticket to be rejected")
	}
}

func TestWSAuthRejectsLegacyQueryToken(t *testing.T) {
	setTestToken(t, "secret")

	r := httptest.NewRequest("GET", "/ws/logs?token=secret", nil)
	w := httptest.NewRecorder()
	if wsAuthOK(w, r) {
		t.Fatalf("expected legacy token query auth to be rejected")
	}
	if w.Code != 401 {
		t.Fatalf("expected HTTP 401, got %d", w.Code)
	}
}

func TestRequestOriginAllowedDefaultsToSameHostname(t *testing.T) {
	r := httptest.NewRequest("GET", "http://api.example.com:8080/api/apps", nil)
	if !requestOriginAllowed(r, "http://api.example.com:3000", nil) {
		t.Fatalf("expected same hostname with a different dashboard port to be allowed")
	}
	if requestOriginAllowed(r, "https://evil.example.net", nil) {
		t.Fatalf("expected different hostname to be rejected by default")
	}
}

func TestPublicPathsStayNarrow(t *testing.T) {
	want := map[string]bool{
		"/api/health":              true,
		"/api/auth/verify":         true,
		"/api/track":               true,
		"/api/analytics/script.js": true,
	}
	if len(publicPaths) != len(want) {
		t.Fatalf("publicPaths length = %d, want %d: %#v", len(publicPaths), len(want), publicPaths)
	}
	for path := range want {
		if !publicPaths[path] {
			t.Fatalf("expected %s to remain public", path)
		}
	}
	for path := range publicPaths {
		if !want[path] {
			t.Fatalf("unexpected public path: %s", path)
		}
	}
}
