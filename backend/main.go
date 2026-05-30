package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
)

func main() {
	// Create required directories
	os.MkdirAll("builds", 0755)
	// data/ holds the SQLite DB (with stored tokens) and admin_token.txt, so
	// restrict it to the owner.
	os.MkdirAll("data", 0700)

	// Initialize SQLite and restore state
	initDB()

	// CLI subcommands (run after initDB so the token store is available).
	// These let operators retrieve or rotate the admin token without the
	// dashboard — useful on a headless VPS regardless of how it was deployed.
	if len(os.Args) > 1 {
		runCLI(os.Args[1:])
		return
	}

	// Load or provision the admin token (must run after initDB).
	initAuth()

	// Reconcile apps/deployments left mid-build by a previous restart or crash,
	// so an interrupted deployment doesn't show an eternal "building" spinner.
	reconcileStuckBuilds()

	// Rebuild Caddyfile from loaded apps
	rebuildCaddyfile()

	// Start sampling real host metrics (CPU/memory/disk) for the stats stream.
	startMetricsSampler()

	// Restore managed add-on containers (databases/caches).
	reconcileAddons()

	// Begin persistent runtime-log capture for already-running apps.
	startAllRuntimeLogCaptures()

	// Start the cron scheduler for scheduled jobs.
	startCronScheduler()

	// Start automatic backups if configured (BACKUP_INTERVAL_HOURS).
	startBackupScheduler()

	// Start Caddy reverse proxy subprocess
	startCaddySubprocess()

	// --- HTTP Routes ---
	mux := http.NewServeMux()

	// App management
	mux.HandleFunc("/api/apps", handleApps)
	mux.HandleFunc("/api/deploy", handleDeploy)
	mux.HandleFunc("/api/apps/stop", handleStop)
	mux.HandleFunc("/api/apps/start", handleStart)
	mux.HandleFunc("/api/apps/delete", handleDelete)
	mux.HandleFunc("/api/apps/update", handleUpdate)
	mux.HandleFunc("/api/apps/redeploy", handleRedeploy)
	mux.HandleFunc("/api/apps/rollback", handleRollback)
	mux.HandleFunc("/api/apps/webhook", handleWebhookInfo)
	mux.HandleFunc("/api/apps/webhook/regenerate", handleWebhookRegenerate)
	mux.HandleFunc("/api/apps/domains/add", handleDomainAdd)
	mux.HandleFunc("/api/apps/domains/remove", handleDomainRemove)

	// Custom domains + Cloudflare DNS
	mux.HandleFunc("/api/server/info", handleServerInfo)
	mux.HandleFunc("/api/cloudflare/status", handleCloudflareStatus)
	mux.HandleFunc("/api/cloudflare/token/save", handleCloudflareTokenSet)
	mux.HandleFunc("/api/cloudflare/token/delete", handleCloudflareTokenDelete)
	mux.HandleFunc("/api/cloudflare/dns", handleCloudflareDNS)

	// Git helpers
	mux.HandleFunc("/api/git/branches", handleGitBranches)
	mux.HandleFunc("/api/git/repos", handleGitRepos)
	mux.HandleFunc("/api/git/contents", handleGitContents)
	mux.HandleFunc("/api/git/file", handleGitFile)
	mux.HandleFunc("/api/git/token", handleGitTokenGet)
	mux.HandleFunc("/api/git/token/save", handleGitTokenSet)
	mux.HandleFunc("/api/git/token/delete", handleGitTokenDelete)

	// Managed add-ons (databases/caches)
	mux.HandleFunc("/api/addons", handleAddons)
	mux.HandleFunc("/api/addons/create", handleAddonCreate)
	mux.HandleFunc("/api/addons/delete", handleAddonDelete)
	mux.HandleFunc("/api/addons/attach", handleAddonAttach)

	// Scheduled jobs (cron)
	mux.HandleFunc("/api/cron", handleCronList)
	mux.HandleFunc("/api/cron/create", handleCronCreate)
	mux.HandleFunc("/api/cron/update", handleCronUpdate)
	mux.HandleFunc("/api/cron/delete", handleCronDelete)
	mux.HandleFunc("/api/cron/run", handleCronRunNow)

	// Notifications
	mux.HandleFunc("/api/notifications", handleNotificationsGet)
	mux.HandleFunc("/api/notifications/save", handleNotificationsSave)
	mux.HandleFunc("/api/notifications/test", handleNotificationsTest)

	// Backups
	mux.HandleFunc("/api/backups", handleBackupsList)
	mux.HandleFunc("/api/backups/create", handleBackupCreate)
	mux.HandleFunc("/api/backups/download", handleBackupDownload)
	mux.HandleFunc("/api/backups/delete", handleBackupDelete)

	// System
	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/api/auth/verify", handleAuthVerify)
	mux.HandleFunc("/api/docker/prune", handleDockerPrune)
	mux.HandleFunc("/api/deployments/history", handleDeploymentHistory)
	mux.HandleFunc("/api/metrics/apps", handlePerAppMetrics)
	mux.HandleFunc("/api/apps/runtime-logs", handleRuntimeLogHistory)

	// Public webhook endpoint (authenticated by per-app HMAC signature).
	mux.HandleFunc("/api/webhooks/github/", handleGitHubWebhook)

	// WebSockets (auth enforced inside each handler via ?token=).
	mux.HandleFunc("/ws/stats", handleStatsWS)
	mux.HandleFunc("/ws/logs", handleLogsWS)
	mux.HandleFunc("/ws/runtime-logs", handleRuntimeLogsWS)
	mux.HandleFunc("/ws/terminal", handleTerminalWS)

	// Auth gate, then CORS. Health stays public for uptime probes.
	authed := authGate(mux)
	limited := limitBody(authed)
	throttled := rateLimit(limited)
	handler := corsMiddleware(throttled)

	addr := listenAddr()
	fmt.Printf("🚀 Better-PaaS running on http://%s\n", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

// trustProxy controls whether X-Forwarded-For / X-Real-IP headers are honored
// for client-IP resolution (only enable when behind a trusted reverse proxy,
// otherwise clients could spoof their IP to evade rate limits).
var trustProxy = strings.EqualFold(strings.TrimSpace(os.Getenv("TRUST_PROXY")), "true") ||
	os.Getenv("TRUST_PROXY") == "1"

// maxRequestBody caps JSON request bodies to defend against memory-exhaustion.
// WebSocket upgrades are exempt (they are long-lived streams).
const maxRequestBody = 2 << 20 // 2 MiB

func limitBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil && !strings.HasPrefix(r.URL.Path, "/ws/") {
			r.Body = http.MaxBytesReader(w, r.Body, maxRequestBody)
		}
		next.ServeHTTP(w, r)
	})
}

// listenAddr returns the address the API listens on. Defaults to all
// interfaces on :8080 (the dashboard needs remote access for self-hosting),
// but can be overridden via LISTEN_ADDR (e.g. "127.0.0.1:8080" when fronted
// by a reverse proxy).
func listenAddr() string {
	if a := strings.TrimSpace(os.Getenv("LISTEN_ADDR")); a != "" {
		return a
	}
	return ":8080"
}

// envInt reads an integer environment variable, returning def when unset or
// unparseable.
func envInt(key string, def int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

// publicPaths are reachable without an admin token.
var publicPaths = map[string]bool{
	"/api/health":      true,
	"/api/auth/verify": true,
}

// authGate enforces bearer-token auth on every API route except public ones.
// WebSocket routes authenticate themselves (token query param) since browsers
// cannot attach Authorization headers to WS handshakes. The GitHub webhook
// endpoint is also exempt: it is authenticated per-app by HMAC signature.
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

// corsMiddleware adds CORS headers. The allowed origin is reflected from the
// request (or restricted to DASHBOARD_ORIGIN, comma-separated, when set).
// Credentials are NOT enabled because auth uses bearer tokens, not cookies, so
// a malicious origin still cannot forge an authenticated request.
func corsMiddleware(next http.Handler) http.Handler {
	allowed := parseAllowedOrigins(os.Getenv("DASHBOARD_ORIGIN"))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		w.Header().Set("Vary", "Origin")
		if originAllowed(origin, allowed) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else if len(allowed) == 0 && origin != "" {
			// No explicit allow-list configured: reflect origin (safe under
			// bearer-token auth, no ambient credentials are exposed).
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
