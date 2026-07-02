package paas

import (
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// maxRequestBody caps JSON request bodies to defend against memory-exhaustion.
// WebSocket upgrades are exempt (they are long-lived streams).
const maxRequestBody = 2 << 20 // 2 MiB

// maxUploadBody is applied to file/directory deploy uploads (see upload.go).
// Upload routes get their own cap inside limitBody so large projects can deploy.

func limitBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// WebSocket upgrades are long-lived streams (exempt). The GitHub webhook
		// endpoint applies its own, larger cap (maxWebhookBody) inside the
		// handler, so we don't double-limit it here with the smaller default.
		if r.Body != nil &&
			!strings.HasPrefix(r.URL.Path, "/ws/") &&
			!strings.HasPrefix(r.URL.Path, "/api/webhooks/") {
			limit := maxRequestBody
			if strings.HasSuffix(r.URL.Path, "/upload") {
				limit = maxUploadBody
			}
			r.Body = http.MaxBytesReader(w, r.Body, int64(limit))
		}
		next.ServeHTTP(w, r)
	})
}

// publicPaths are reachable without an admin token.
var publicPaths = map[string]bool{
	"/api/health":      true,
	"/api/auth/verify": true,
	// Analytics ingestion + the embeddable tracking script run on third-party
	// deployed sites, which never carry the admin token.
	"/api/track":               true,
	"/api/analytics/script.js": true,
}

// authGate enforces bearer-token auth on every API route except public ones.
// WebSocket routes authenticate themselves with short-lived tickets since
// browsers cannot attach Authorization headers to WS handshakes. The GitHub
// webhook endpoint is also exempt: it is authenticated per-app by HMAC
// signature.
func authGate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions ||
			publicPaths[r.URL.Path] ||
			strings.HasPrefix(r.URL.Path, "/ws/") ||
			strings.HasPrefix(r.URL.Path, "/api/webhooks/") {
			next.ServeHTTP(w, r)
			return
		}
		if !httpAuthOK(w, r, bearerFromRequest(r)) {
			return
		}
		next.ServeHTTP(w, r)
	})
}

// scoped wraps a handler and requires the actor to hold every listed scope.
// Admin tokens bypass all scope checks.
func scoped(h http.HandlerFunc, scopes ...string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		for _, s := range scopes {
			if !actorHasScope(r, s) {
				jsonError(w, "Forbidden: missing scope "+s, http.StatusForbidden)
				return
			}
		}
		h(w, r)
	}
}

// scopedAny wraps a handler and requires at least one of the listed scopes.
func scopedAny(h http.HandlerFunc, scopes ...string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !actorHasAnyScope(r, scopes...) {
			jsonError(w, "Forbidden: missing scope "+scopes[0], http.StatusForbidden)
			return
		}
		h(w, r)
	}
}

// scopeGate enforces that the authenticated actor (admin or agent) has the
// given scope. Admin tokens bypass all scope checks.
func scopeGate(scope string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !actorHasScope(r, scope) {
				jsonError(w, "Forbidden: missing scope "+scope, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// corsMiddleware adds CORS headers. Origins are restricted to DASHBOARD_ORIGIN
// when set, otherwise to the same hostname as the API request. Credentials are
// NOT enabled because auth uses bearer tokens, not cookies.
func corsMiddleware(next http.Handler) http.Handler {
	allowed := parseAllowedOrigins(os.Getenv("DASHBOARD_ORIGIN"))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		w.Header().Set("Vary", "Origin")
		if requestOriginAllowed(r, origin, allowed) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func parseAllowedOrigins(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func originAllowed(origin string, allowed []string) bool {
	if origin == "" {
		return false
	}
	for _, a := range allowed {
		if a == origin || a == "*" {
			return true
		}
	}
	return false
}

func requestOriginAllowed(r *http.Request, origin string, allowed []string) bool {
	if origin == "" {
		return false
	}
	if len(allowed) > 0 {
		return originAllowed(origin, allowed)
	}
	return sameHostnameOrigin(r, origin)
}

func sameHostnameOrigin(r *http.Request, origin string) bool {
	u, err := url.Parse(origin)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return false
	}
	host := r.Host
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	return strings.EqualFold(u.Hostname(), strings.Trim(host, "[]"))
}
