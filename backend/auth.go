package main

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Admin authentication
// ---------------------------------------------------------------------------
//
// This is a self-hosted, single-admin control plane. On first run we generate
// a high-entropy bearer token, persist it in the DB (meta table) and write it
// to data/admin_token.txt so the operator can retrieve it. Every API and
// WebSocket request must present this token:
//
//   - HTTP:       Authorization: Bearer <token>
//   - WebSocket:  ?token=<token>   (browsers can't set WS headers)
//
// The token can be overridden via the ADMIN_TOKEN environment variable, which
// takes precedence over the stored value (useful for IaC / rotation).

var (
	authTokenLock sync.RWMutex
	authToken     string
)

// secureToken returns a 32-byte cryptographically random hex string.
func secureToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		// rand.Read should never fail; if it does we must not continue with a
		// weak/empty token.
		log.Fatalf("[auth] failed to generate secure token: %v", err)
	}
	return hex.EncodeToString(b)
}

// initAuth loads or provisions the admin token.
func initAuth() {
	// Env override always wins.
	if env := strings.TrimSpace(os.Getenv("ADMIN_TOKEN")); env != "" {
		authTokenLock.Lock()
		authToken = env
		authTokenLock.Unlock()
		log.Println("[auth] Using ADMIN_TOKEN from environment.")
		return
	}

	// Try the DB.
	tok := dbGetMeta("auth_token")
	firstRun := tok == ""
	if firstRun {
		tok = secureToken()
		if err := dbSetMeta("auth_token", tok); err != nil {
			log.Fatalf("[auth] failed to persist admin token: %v", err)
		}
	}
	writeAdminTokenFile(tok)

	authTokenLock.Lock()
	authToken = tok
	authTokenLock.Unlock()

	// Always print the token banner on startup so operators can find it in the
	// logs (journalctl, docker logs, nohup output) no matter how they deploy.
	printTokenBanner(tok, firstRun)
}

// printTokenBanner writes the admin token to the logs in a clearly delimited
// block so it is easy to spot and copy. It explicitly states the token is the
// dashboard login credential.
func printTokenBanner(tok string, firstRun bool) {
	line := func(s string) { log.Printf("║ %-72s ║", s) }
	log.Println("╔══════════════════════════════════════════════════════════════════════════╗")
	if firstRun {
		line("Better-PaaS ADMIN TOKEN — GENERATED ON FIRST RUN")
	} else {
		line("Better-PaaS ADMIN TOKEN")
	}
	line("")
	line(">>> You need this token to LOG IN to the dashboard. <<<")
	line("Paste it into the sign-in screen at http://<your-server>:3000")
	line("")
	line("Token:")
	line("  " + tok)
	line("")
	line("Also saved to: data/admin_token.txt   (chmod 0600)")
	line("Show again:    ./server token")
	line("Rotate it:     ./server token rotate")
	line("Keep it secret — anyone with this token has full control.")
	log.Println("╚══════════════════════════════════════════════════════════════════════════╝")
}

func writeAdminTokenFile(tok string) {
	path := filepath.Join("data", "admin_token.txt")
	// 0600: readable only by the owner.
	if err := os.WriteFile(path, []byte(tok+"\n"), 0600); err != nil {
		log.Printf("[auth] warning: failed to write %s: %v", path, err)
	}
}

// validToken reports whether the supplied token matches the admin token using
// a constant-time comparison.
func validToken(tok string) bool {
	if tok == "" {
		return false
	}
	authTokenLock.RLock()
	expected := authToken
	authTokenLock.RUnlock()
	if expected == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(tok), []byte(expected)) == 1
}

// bearerFromRequest extracts a bearer token from the Authorization header.
func bearerFromRequest(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if h == "" {
		return ""
	}
	const prefix = "Bearer "
	if len(h) > len(prefix) && strings.EqualFold(h[:len(prefix)], prefix) {
		return strings.TrimSpace(h[len(prefix):])
	}
	return ""
}

// wsAuthOK validates the token query parameter for a WebSocket upgrade,
// enforcing the per-IP brute-force lockout. On failure it writes the HTTP
// status (before the upgrade handshake) and returns false.
func wsAuthOK(w http.ResponseWriter, r *http.Request) bool {
	res := authenticate(r, r.URL.Query().Get("token"))
	if res.OK {
		return true
	}
	if res.LockedOut {
		w.Header().Set("Retry-After", fmt.Sprintf("%d", retryAfterSeconds(res.RetryAfter)))
		http.Error(w, "Too many failed attempts", http.StatusTooManyRequests)
		return false
	}
	http.Error(w, "Unauthorized", http.StatusUnauthorized)
	return false
}

// ---------------------------------------------------------------------------
// Brute-force–aware authentication
// ---------------------------------------------------------------------------
//
// Every token check (HTTP bearer, WebSocket query param, and the login/verify
// endpoint) funnels through authenticate so a shared per-IP failure tracker
// can lock out repeated bad guesses with an escalating backoff. validToken
// remains the pure constant-time comparison used underneath.

// authResult captures the outcome of an authentication attempt.
type authResult struct {
	OK         bool          // token was valid
	LockedOut  bool          // request is currently rate-limited for auth failures
	RetryAfter time.Duration // how long until the lockout clears (when LockedOut)
}

// authenticate validates tok for the request while enforcing the per-IP
// lockout. A valid token clears the IP's failure history; an invalid *non-empty*
// guess is counted toward the lockout. Empty/missing tokens are treated as
// "no credentials" and are NOT counted, so unauthenticated probes can't lock
// out a legitimate operator (a real brute-force always supplies a guess).
func authenticate(r *http.Request, tok string) authResult {
	key := authKey(r)

	// Already locked out? Reject without even comparing the token.
	if d := authLimiter.retryAfter(key); d > 0 {
		return authResult{LockedOut: true, RetryAfter: d}
	}

	if validToken(tok) {
		authLimiter.recordSuccess(key)
		return authResult{OK: true}
	}

	if tok != "" {
		authLimiter.recordFailure(key)
		// If this failure just tripped the lockout, surface it (and log once).
		if d := authLimiter.retryAfter(key); d > 0 {
			logBruteForce(key, d)
			return authResult{LockedOut: true, RetryAfter: d}
		}
	}
	return authResult{}
}

// httpAuthOK enforces auth for an HTTP request, writing 401 (bad token) or 429
// with a Retry-After header (locked out). Returns true only when allowed.
func httpAuthOK(w http.ResponseWriter, r *http.Request, tok string) bool {
	res := authenticate(r, tok)
	if res.OK {
		return true
	}
	if res.LockedOut {
		w.Header().Set("Retry-After", fmt.Sprintf("%d", retryAfterSeconds(res.RetryAfter)))
		jsonError(w, "Too many failed attempts. Try again later.", http.StatusTooManyRequests)
		return false
	}
	jsonError(w, "Unauthorized", http.StatusUnauthorized)
	return false
}

// retryAfterSeconds converts a lockout duration to a whole-second Retry-After
// value, rounding up so the client never retries a hair too early.
func retryAfterSeconds(d time.Duration) int {
	s := int(d / time.Second)
	if d%time.Second != 0 {
		s++
	}
	if s < 1 {
		s = 1
	}
	return s
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

// appNameRe allows lowercase DNS-label-style names. This is important because
// the name is used as a Docker container/image name AND as a filesystem path
// segment (builds/<name>, data/logs/...). Restricting it prevents path
// traversal (e.g. "../etc") and Docker arg abuse.
var appNameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$`)

// validAppName reports whether name is a safe app/container name.
func validAppName(name string) bool {
	return appNameRe.MatchString(name)
}

// ---------------------------------------------------------------------------
// CLI subcommands
// ---------------------------------------------------------------------------

// runCLI handles operator commands like retrieving or rotating the admin
// token. It is invoked when the binary is run with arguments and exits when
// done (the HTTP server does not start).
func runCLI(args []string) {
	switch args[0] {
	case "token":
		// Subcommands: (none)=print, "rotate"=generate a new one.
		if len(args) > 1 && args[1] == "rotate" {
			cliRotateToken()
			return
		}
		cliPrintToken()

	case "help", "-h", "--help":
		printCLIUsage(os.Stdout)

	case "version", "-v", "--version":
		fmt.Println(version)

	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n", args[0])
		printCLIUsage(os.Stderr)
		os.Exit(2)
	}
}

func printCLIUsage(w *os.File) {
	fmt.Fprint(w, `Better-PaaS server

Usage:
  server                 Start the API server (default)
  server token           Print the current admin token
  server token rotate    Generate a new admin token (invalidates the old one)
  server version         Print the build version
  server help            Show this help

Notes:
  - If ADMIN_TOKEN is set in the environment, it overrides the stored token
    and 'token rotate' has no effect.
  - The token is also written to data/admin_token.txt (mode 0600).
`)
}

// cliPrintToken prints the effective admin token for the operator.
func cliPrintToken() {
	if env := strings.TrimSpace(os.Getenv("ADMIN_TOKEN")); env != "" {
		fmt.Println(env)
		fmt.Fprintln(os.Stderr, "(from ADMIN_TOKEN environment variable)")
		return
	}
	tok := dbGetMeta("auth_token")
	if tok == "" {
		// No token yet: provision one now so the first value the operator sees
		// is the one the server will use.
		tok = secureToken()
		if err := dbSetMeta("auth_token", tok); err != nil {
			fmt.Fprintf(os.Stderr, "failed to create token: %v\n", err)
			os.Exit(1)
		}
		writeAdminTokenFile(tok)
	}
	fmt.Println(tok)
}

// cliRotateToken generates and stores a fresh admin token.
func cliRotateToken() {
	if env := strings.TrimSpace(os.Getenv("ADMIN_TOKEN")); env != "" {
		fmt.Fprintln(os.Stderr, "ADMIN_TOKEN is set in the environment; rotation has no effect.")
		fmt.Fprintln(os.Stderr, "Change the environment variable instead.")
		os.Exit(1)
	}
	tok := secureToken()
	if err := dbSetMeta("auth_token", tok); err != nil {
		fmt.Fprintf(os.Stderr, "failed to rotate token: %v\n", err)
		os.Exit(1)
	}
	writeAdminTokenFile(tok)
	fmt.Println(tok)
	fmt.Fprintln(os.Stderr, "Admin token rotated. Restart the server and sign in again with the new token.")
}
