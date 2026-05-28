package main

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"
)

func main() {
	// Seed random
	rand.Seed(time.Now().UnixNano())

	// Create required directories
	os.MkdirAll("builds", 0755)
	os.MkdirAll("data", 0755)

	// Load persisted state from disk
	loadDB()

	// Rebuild Caddyfile from loaded apps
	rebuildCaddyfile()

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

	// Git helpers
	mux.HandleFunc("/api/git/branches", handleGitBranches)
	mux.HandleFunc("/api/git/repos", handleGitRepos)
	mux.HandleFunc("/api/git/token", handleGitTokenGet)
	mux.HandleFunc("/api/git/token/save", handleGitTokenSet)
	mux.HandleFunc("/api/git/token/delete", handleGitTokenDelete)

	// System
	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/api/docker/prune", handleDockerPrune)
	mux.HandleFunc("/api/deployments/history", handleDeploymentHistory)

	// WebSockets
	mux.HandleFunc("/ws/stats", handleStatsWS)
	mux.HandleFunc("/ws/logs", handleLogsWS)
	mux.HandleFunc("/ws/runtime-logs", handleRuntimeLogsWS)

	// Apply CORS middleware
	handler := corsMiddleware(mux)

	fmt.Println("🚀 PaaS Engine running on http://localhost:8080")
	if err := http.ListenAndServe(":8080", handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

// corsMiddleware adds CORS headers to every response.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
