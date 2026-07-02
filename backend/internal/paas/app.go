package paas

import (
	"fmt"
	"log"
	"net/http"
	"os"
)

// Run boots the Better-PaaS backend. It is kept in the importable backend
// package so tests and command entrypoints exercise the same startup path.
func Run() {
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

	// Load scoped agent tokens into memory for fast validation.
	loadAgentsIntoMemory()

	// Clear a stale "running" update marker now that we've booted the new build.
	resetUpdateStateOnBoot()

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

	// Start the analytics retention pruner (bounds the events table).
	startAnalyticsPruner()

	// Fetch catalog image sizes from Docker Hub in the background.
	go fetchImageSizes()

	// Start Caddy reverse proxy subprocess
	startCaddySubprocess()

	mux := newRouter()

	// Auth gate, then audit log, then body limit, then rate limit, then CORS.
	// Health stays public for uptime probes.
	authed := authGate(mux)
	audited := auditLogMiddleware(authed)
	limited := limitBody(audited)
	throttled := rateLimit(limited)
	handler := corsMiddleware(throttled)

	addr := listenAddr()
	fmt.Printf("🚀 Better-PaaS running on http://%s\n", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
