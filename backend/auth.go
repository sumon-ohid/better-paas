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
		line("ANTIGRAVITY ADMIN TOKEN — GENERATED ON FIRST RUN")
	} else {
		line("ANTIGRAVITY ADMIN TOKEN")
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

// wsAuthOK validates the token query parameter for WebSocket upgrades.
func wsAuthOK(r *http.Request) bool {
	return validToken(r.URL.Query().Get("token"))
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

	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n", args[0])
		printCLIUsage(os.Stderr)
		os.Exit(2)
	}
}

func printCLIUsage(w *os.File) {
	fmt.Fprint(w, `Antigravity PaaS server

Usage:
  server                 Start the API server (default)
  server token           Print the current admin token
  server token rotate    Generate a new admin token (invalidates the old one)
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
