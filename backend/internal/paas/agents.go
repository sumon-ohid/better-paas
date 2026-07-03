package paas

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Agent token CRUD
// ---------------------------------------------------------------------------
//
// Admin-only endpoints for creating, listing, and revoking scoped agent tokens.

// generateAgentToken creates a new bpagt_ prefixed token. The raw token is
// returned once to the caller; only its SHA-256 hash is persisted.
func generateAgentToken() string {
	return "bpagt_" + secureToken()
}

// handleAgentsList returns all agent tokens (admin only).
func handleAgentsList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	list, err := dbLoadAgents()
	if err != nil {
		jsonError(w, "Failed to load agents", http.StatusInternalServerError)
		return
	}
	jsonOK(w, list)
}

// handleAgentCreate creates a new scoped agent token (admin only).
func handleAgentCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Name   string   `json:"name"`
		Scopes []string `json:"scopes"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		jsonError(w, "name is required", http.StatusBadRequest)
		return
	}

	// Validate scopes - reject unknown ones.
	validScope := map[string]bool{}
	for _, s := range AllScopes {
		validScope[s] = true
	}
	scopes := make([]string, 0, len(req.Scopes))
	for _, s := range req.Scopes {
		if !validScope[s] {
			jsonError(w, "invalid scope: "+s, http.StatusBadRequest)
			return
		}
		scopes = append(scopes, s)
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

	// Refresh in-memory cache.
	agentsLock.Lock()
	agentsMap[tokenHash] = agent
	agentsLock.Unlock()

	jsonOK(w, map[string]interface{}{
		"id":        agent.ID,
		"name":      agent.Name,
		"scopes":    agent.Scopes,
		"createdAt": agent.CreatedAt,
		"token":     rawToken, // shown once
	})
}

// handleAgentDelete revokes an agent token (admin only).
func handleAgentDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	agent, err := dbGetAgentByID(req.ID)
	if err != nil {
		jsonError(w, "Failed to lookup agent", http.StatusInternalServerError)
		return
	}
	if agent == nil {
		jsonError(w, "Agent not found", http.StatusNotFound)
		return
	}

	if err := dbDeleteAgent(req.ID); err != nil {
		jsonError(w, "Failed to delete agent", http.StatusInternalServerError)
		return
	}

	agentsLock.Lock()
	delete(agentsMap, agent.TokenHash)
	agentsLock.Unlock()

	jsonOK(w, map[string]string{"status": "deleted"})
}

// handleAgentRotate generates a new token for an existing agent (admin only).
func handleAgentRotate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	agent, err := dbGetAgentByID(req.ID)
	if err != nil {
		jsonError(w, "Failed to lookup agent", http.StatusInternalServerError)
		return
	}
	if agent == nil {
		jsonError(w, "Agent not found", http.StatusNotFound)
		return
	}

	oldHash := agent.TokenHash
	rawToken := generateAgentToken()
	agent.TokenHash = hashToken(rawToken)
	agent.LastUsedAt = time.Time{}

	if err := dbSaveAgent(*agent); err != nil {
		jsonError(w, "Failed to rotate token", http.StatusInternalServerError)
		return
	}

	agentsLock.Lock()
	delete(agentsMap, oldHash)
	agentsMap[agent.TokenHash] = *agent
	agentsLock.Unlock()

	jsonOK(w, map[string]interface{}{
		"id":    agent.ID,
		"name":  agent.Name,
		"token": rawToken, // shown once
	})
}

// dbGetAgentByID fetches an agent by ID.
func dbGetAgentByID(id string) (*Agent, error) {
	var a Agent
	var scopesJSON string
	var lastUsed sql.NullTime
	err := sqliteDB.QueryRow(`SELECT id, name, token_hash, scopes, created_at, last_used_at FROM agents WHERE id = ?`, id).
		Scan(&a.ID, &a.Name, &a.TokenHash, &scopesJSON, &a.CreatedAt, &lastUsed)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal([]byte(scopesJSON), &a.Scopes)
	if lastUsed.Valid {
		a.LastUsedAt = lastUsed.Time
	}
	return &a, nil
}
