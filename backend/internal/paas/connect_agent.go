package paas

import (
	"crypto/subtle"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

// CLI scope profiles (must match backend/cmd/paas/profiles.go).
var agentProfileScopes = map[string][]string{
	"observer": {
		ScopeAppsRead, ScopeLogsRead, ScopeMetricsRead,
	},
	"deployer": {
		ScopeAppsRead, ScopeLogsRead, ScopeMetricsRead,
		ScopeAppsWrite, ScopeDeployTrigger,
	},
	"operator": {
		ScopeAppsRead, ScopeLogsRead, ScopeMetricsRead,
		ScopeAppsWrite, ScopeDeployTrigger,
		ScopeAddonsManage, ScopeServersManage,
		ScopeCronManage, ScopeBackupsManage, ScopeNotificationsManage,
	},
}

type connectPending struct {
	code      string
	token     string
	agentID   string
	name      string
	profile   string
	expiresAt time.Time
}

var (
	connectLock     sync.Mutex
	connectPending_ = make(map[string]connectPending) // key = state
)

const connectSessionTTL = 5 * time.Minute

func sweepConnectSessions() {
	now := time.Now()
	connectLock.Lock()
	defer connectLock.Unlock()
	for state, entry := range connectPending_ {
		if now.After(entry.expiresAt) {
			delete(connectPending_, state)
		}
	}
}

func storeConnectSession(state string, entry connectPending) {
	connectLock.Lock()
	connectPending_[state] = entry
	connectLock.Unlock()
}

func consumeConnectSession(state, code string) (connectPending, bool) {
	connectLock.Lock()
	defer connectLock.Unlock()
	entry, ok := connectPending_[state]
	if !ok {
		return connectPending{}, false
	}
	delete(connectPending_, state)
	if time.Now().After(entry.expiresAt) {
		return connectPending{}, false
	}
	if subtle.ConstantTimeCompare([]byte(entry.code), []byte(code)) != 1 {
		return connectPending{}, false
	}
	return entry, true
}

func validConnectState(state string) bool {
	state = strings.TrimSpace(state)
	if len(state) < 16 || len(state) > 128 {
		return false
	}
	for _, c := range state {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			continue
		}
		return false
	}
	return true
}

func validCallbackPort(port int) bool {
	return port >= 1024 && port <= 65535
}

// handleConnectAgentApprove creates a scoped agent after admin confirms in the browser.
// POST /api/connect/agent/approve
func handleConnectAgentApprove(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !actorIsAdmin(r) {
		jsonError(w, "Forbidden: admin token required", http.StatusForbidden)
		return
	}

	var req struct {
		State   string `json:"state"`
		Profile string `json:"profile"`
		Name    string `json:"name"`
		Port    int    `json:"port"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	state := strings.TrimSpace(req.State)
	if !validConnectState(state) {
		jsonError(w, "Invalid state", http.StatusBadRequest)
		return
	}
	if !validCallbackPort(req.Port) {
		jsonError(w, "Invalid callback port", http.StatusBadRequest)
		return
	}

	profile := strings.TrimSpace(strings.ToLower(req.Profile))
	scopes, ok := agentProfileScopes[profile]
	if !ok {
		jsonError(w, "Invalid profile", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		jsonError(w, "name is required", http.StatusBadRequest)
		return
	}

	rawToken := generateAgentToken()
	tokenHash := hashToken(rawToken)
	agent := Agent{
		ID:        generateRandomID(),
		Name:      name,
		TokenHash: tokenHash,
		Scopes:    scopes,
		CreatedAt: time.Now(),
	}
	if err := dbSaveAgent(agent); err != nil {
		jsonError(w, "Failed to save agent", http.StatusInternalServerError)
		return
	}

	agentsLock.Lock()
	agentsMap[tokenHash] = agent
	agentsLock.Unlock()

	code := secureToken()
	sweepConnectSessions()
	storeConnectSession(state, connectPending{
		code:      code,
		token:     rawToken,
		agentID:   agent.ID,
		name:      name,
		profile:   profile,
		expiresAt: time.Now().Add(connectSessionTTL),
	})

	callbackURL := fmt.Sprintf("http://127.0.0.1:%d/callback?code=%s&state=%s", req.Port, code, state)
	log.Printf("[connect] agent %q approved for CLI (profile=%s)", name, profile)

	jsonOK(w, map[string]string{
		"callbackUrl": callbackURL,
		"agentId":     agent.ID,
	})
}

// handleConnectAgentExchange lets the local CLI swap a one-time code for the agent token.
// POST /api/connect/agent/exchange
func handleConnectAgentExchange(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		State string `json:"state"`
		Code  string `json:"code"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	state := strings.TrimSpace(req.State)
	code := strings.TrimSpace(req.Code)
	if !validConnectState(state) || code == "" {
		jsonError(w, "Invalid request", http.StatusBadRequest)
		return
	}

	entry, ok := consumeConnectSession(state, code)
	if !ok {
		jsonError(w, "Invalid or expired connect code", http.StatusUnauthorized)
		return
	}

	// API base URL for the CLI config (respect reverse-proxy headers).
	apiURL := requestBaseURL(r)

	jsonOK(w, map[string]interface{}{
		"url":     apiURL,
		"token":   entry.token,
		"profile": entry.profile,
		"name":    entry.name,
		"agentId": entry.agentID,
	})
}

// requestBaseURL returns the external API base URL for CLI config.
func requestBaseURL(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		scheme = strings.TrimSpace(strings.Split(proto, ",")[0])
	}
	host := r.Host
	if fwd := r.Header.Get("X-Forwarded-Host"); fwd != "" {
		host = strings.TrimSpace(strings.Split(fwd, ",")[0])
	}
	return scheme + "://" + host
}
