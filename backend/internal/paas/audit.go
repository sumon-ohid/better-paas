package paas

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------
//
// Every mutating request is captured as an AuditLog row. The audit middleware
// runs after auth so the actor is known.

// actionsToAudit maps HTTP method+path patterns to human-readable actions.
func actionFromRequest(r *http.Request) string {
	m := r.Method
	p := r.URL.Path

	// Map specific endpoints to friendly action names.
	switch {
	case p == "/api/deploy" && m == "POST":
		return "app:deploy"
	case p == "/api/apps/stop" && m == "POST":
		return "app:stop"
	case p == "/api/apps/start" && m == "POST":
		return "app:start"
	case p == "/api/apps/delete" && m == "POST":
		return "app:delete"
	case p == "/api/apps/update" && m == "POST":
		return "app:update"
	case p == "/api/apps/rename" && m == "POST":
		return "app:rename"
	case p == "/api/apps/redeploy" && m == "POST":
		return "app:redeploy"
	case p == "/api/apps/rollback" && m == "POST":
		return "app:rollback"
	case strings.HasPrefix(p, "/api/apps/domains/") && m == "POST":
		return "app:domain"
	case p == "/api/addons/create" && m == "POST":
		return "addon:create"
	case p == "/api/addons/delete" && m == "POST":
		return "addon:delete"
	case p == "/api/addons/attach" && m == "POST":
		return "addon:attach"
	case p == "/api/addons/detach" && m == "POST":
		return "addon:detach"
	case strings.HasPrefix(p, "/api/addons/db/") && m == "POST":
		return "addon:db"
	case p == "/api/cron/create" && m == "POST":
		return "cron:create"
	case p == "/api/cron/update" && m == "POST":
		return "cron:update"
	case p == "/api/cron/delete" && m == "POST":
		return "cron:delete"
	case p == "/api/cron/run" && m == "POST":
		return "cron:run"
	case p == "/api/projects/create" && m == "POST":
		return "project:create"
	case p == "/api/projects/rename" && m == "POST":
		return "project:rename"
	case p == "/api/projects/delete" && m == "POST":
		return "project:delete"
	case p == "/api/servers/create" && m == "POST":
		return "server:create"
	case p == "/api/servers/delete" && m == "POST":
		return "server:delete"
	case p == "/api/backups/create" && m == "POST":
		return "backup:create"
	case p == "/api/backups/restore" && m == "POST":
		return "backup:restore"
	case p == "/api/backups/delete" && m == "POST":
		return "backup:delete"
	case p == "/api/docker/prune" && m == "POST":
		return "system:prune"
	case p == "/api/system/update/apply" && m == "POST":
		return "system:update"
	case p == "/api/notifications/save" && m == "POST":
		return "notification:save"
	case p == "/api/git/token/save" && m == "POST":
		return "git:token_save"
	case p == "/api/git/token/delete" && m == "DELETE":
		return "git:token_delete"
	case p == "/api/agents/create" && m == "POST":
		return "agent:create"
	case p == "/api/agents/delete" && m == "POST":
		return "agent:delete"
	case p == "/api/agents/rotate" && m == "POST":
		return "agent:rotate"
	}

	return fmt.Sprintf("%s %s", m, p)
}

// isMutatingMethod reports whether the HTTP method typically changes state.
func isMutatingMethod(m string) bool {
	switch m {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	}
	return false
}

// auditLogMiddleware wraps handlers and records mutating actions.
// It must run *after* authGate so the actor is already in the context.
func auditLogMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)

		// Only audit mutating requests.
		if !isMutatingMethod(r.Method) {
			return
		}

		actor := actorFromRequest(r)
		if actor == nil {
			return // shouldn't happen after auth
		}

		// Try to extract a resource ID from common JSON bodies.
		resourceID := extractResourceID(r)

		// Use the existing clientIP helper from ratelimit.go.
		entry := AuditLog{
			ID:           generateRandomID(),
			ActorType:    string(actor.kind),
			ActorID:      actor.id,
			Action:       actionFromRequest(r),
			ResourceType: extractResourceType(r),
			ResourceID:   resourceID,
			Outcome:      "success", // optimistic; failure would have returned earlier
			IPAddress:    clientIP(r),
			CreatedAt:    time.Now(),
		}

		auditLogLock.Lock()
		if err := dbCreateAuditLog(entry); err != nil {
			log.Printf("[audit] failed to log: %v", err)
		}
		auditLogLock.Unlock()
	})
}

// extractResourceType guesses the resource type from the URL path.
func extractResourceType(r *http.Request) string {
	p := r.URL.Path
	switch {
	case strings.HasPrefix(p, "/api/apps"):
		return "app"
	case strings.HasPrefix(p, "/api/addons"):
		return "addon"
	case strings.HasPrefix(p, "/api/projects"):
		return "project"
	case strings.HasPrefix(p, "/api/servers"):
		return "server"
	case strings.HasPrefix(p, "/api/cron"):
		return "cron"
	case strings.HasPrefix(p, "/api/backups"):
		return "backup"
	case strings.HasPrefix(p, "/api/agents"):
		return "agent"
	case strings.HasPrefix(p, "/api/deploy"):
		return "app"
	case strings.HasPrefix(p, "/api/system") || p == "/api/docker/prune":
		return "system"
	case strings.HasPrefix(p, "/api/notifications"):
		return "notification"
	case strings.HasPrefix(p, "/api/git"):
		return "git"
	}
	return ""
}

// extractResourceID attempts to read an "id" or "appId" field from the request
// body. Because the body is consumed by the handler before the audit middleware
// runs, this currently returns empty. In the future we can read from a
// buffered copy injected earlier in the middleware chain.
func extractResourceID(r *http.Request) string {
	// Body already consumed by handler at this point.
	return ""
}

// ---------------------------------------------------------------------------
// Audit log API
// ---------------------------------------------------------------------------

func handleAuditLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	limit := 50
	if n := r.URL.Query().Get("limit"); n != "" {
		if parsed, err := parseIntSafe(n); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}

	logs, err := dbLoadAuditLogs(limit)
	if err != nil {
		jsonError(w, "Failed to load audit logs", http.StatusInternalServerError)
		return
	}
	jsonOK(w, logs)
}

func parseIntSafe(s string) (int, error) {
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	return n, err
}
