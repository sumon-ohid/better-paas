package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"path/filepath"
	"time"
)

// jsonOK writes a 200 JSON response.
func jsonOK(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

// jsonError writes an error JSON response.
func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// ---------------------------------------------------------------------------
// GET /api/apps
// ---------------------------------------------------------------------------

func handleApps(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	appsLock.Lock()
	result := make([]App, len(apps))
	for i, a := range apps {
		result[i] = a.Public()
	}
	appsLock.Unlock()

	jsonOK(w, result)
}

// ---------------------------------------------------------------------------
// POST /api/deploy
// ---------------------------------------------------------------------------

func handleDeploy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name           string            `json:"name"`
		GitRepo        string            `json:"gitRepo"`
		Branch         string            `json:"branch"`
		GitToken       string            `json:"gitToken"`
		RootDir        string            `json:"rootDir"`
		EnvVars        map[string]string `json:"envVars"`
		BuildCommand   string            `json:"buildCommand"`
		StartCommand   string            `json:"startCommand"`
		InstallCommand string            `json:"installCommand"`
		PortOverride   int               `json:"portOverride"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.GitRepo == "" {
		jsonError(w, "name and gitRepo are required", http.StatusBadRequest)
		return
	}

	gitURL := normalizeGitURL(req.GitRepo)
	ip := getLocalIP()

	appsLock.Lock()
	appID := generateRandomID()
	newApp := App{
		ID:             appID,
		Name:           req.Name,
		Status:         "building",
		GitRepo:        req.GitRepo,
		Branch:         req.Branch,
		Port:           allocatePort(),
		CreatedAt:      time.Now(),
		GitToken:       req.GitToken,
		RootDir:        req.RootDir,
		EnvVars:        req.EnvVars,
		BuildCommand:   req.BuildCommand,
		StartCommand:   req.StartCommand,
		InstallCommand: req.InstallCommand,
		PortOverride:   req.PortOverride,
	}
	newApp.URL = fmt.Sprintf("http://%s.%s.sslip.io", newApp.ID, ip)
	apps = append(apps, newApp)
	appsLock.Unlock()

	// Initialise build log buffer
	buildLogsLock.Lock()
	buildLogs[appID] = []string{}
	buildLogsLock.Unlock()

	saveDB()
	rebuildCaddyfile()

	jsonOK(w, newApp.Public())

	// Run deployment asynchronously
	go runPaaSDeployment(newApp, gitURL)
}

// ---------------------------------------------------------------------------
// POST /api/apps/stop
// ---------------------------------------------------------------------------

func handleStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct{ ID string `json:"id"` }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	app := findApp(req.ID)
	if app == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}

	exec.Command("docker", "stop", app.Name).Run()

	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == req.ID {
			apps[i].Status = "stopped"
			break
		}
	}
	appsLock.Unlock()

	saveDB()
	rebuildCaddyfile()
	jsonOK(w, map[string]string{"status": "stopped"})
}

// ---------------------------------------------------------------------------
// POST /api/apps/start
// ---------------------------------------------------------------------------

func handleStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct{ ID string `json:"id"` }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	app := findApp(req.ID)
	if app == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}

	if out, err := exec.Command("docker", "start", app.Name).CombinedOutput(); err != nil {
		jsonError(w, fmt.Sprintf("Failed to start container: %v — %s", err, out), http.StatusInternalServerError)
		return
	}

	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == req.ID {
			apps[i].Status = "running"
			break
		}
	}
	appsLock.Unlock()

	saveDB()
	rebuildCaddyfile()
	jsonOK(w, map[string]string{"status": "running"})
}

// ---------------------------------------------------------------------------
// POST /api/apps/delete
// ---------------------------------------------------------------------------

func handleDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct{ ID string `json:"id"` }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	app := findApp(req.ID)
	if app == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}

	// Stop and remove container
	exec.Command("docker", "rm", "-f", app.Name).Run()

	// Remove build directory
	buildDir := filepath.Join("builds", app.Name)

	appsLock.Lock()
	for i, a := range apps {
		if a.ID == req.ID {
			apps = append(apps[:i], apps[i+1:]...)
			break
		}
	}
	appsLock.Unlock()

	// Remove build dir after unlocking
	_ = buildDir

	saveDB()
	rebuildCaddyfile()
	jsonOK(w, map[string]string{"status": "deleted"})
}

// ---------------------------------------------------------------------------
// POST /api/apps/update
// ---------------------------------------------------------------------------

func handleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID             string            `json:"id"`
		GitRepo        string            `json:"gitRepo"`
		Branch         string            `json:"branch"`
		RootDir        string            `json:"rootDir"`
		EnvVars        map[string]string `json:"envVars"`
		BuildCommand   string            `json:"buildCommand"`
		StartCommand   string            `json:"startCommand"`
		InstallCommand string            `json:"installCommand"`
		PortOverride   int               `json:"portOverride"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	ip := getLocalIP()

	appsLock.Lock()
	var updated *App
	for i := range apps {
		if apps[i].ID == req.ID {
			apps[i].GitRepo = req.GitRepo
			apps[i].Branch = req.Branch
			apps[i].RootDir = req.RootDir
			apps[i].EnvVars = req.EnvVars
			apps[i].BuildCommand = req.BuildCommand
			apps[i].StartCommand = req.StartCommand
			apps[i].InstallCommand = req.InstallCommand
			apps[i].PortOverride = req.PortOverride
			apps[i].URL = fmt.Sprintf("http://%s.%s.sslip.io", apps[i].ID, ip)
			clone := apps[i].Public()
			updated = &clone
			break
		}
	}
	appsLock.Unlock()

	if updated == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}

	saveDB()
	rebuildCaddyfile()
	jsonOK(w, updated)
}

// ---------------------------------------------------------------------------
// POST /api/apps/redeploy
// ---------------------------------------------------------------------------

func handleRedeploy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct{ ID string `json:"id"` }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	ip := getLocalIP()

	appsLock.Lock()
	var targetApp *App
	for i := range apps {
		if apps[i].ID == req.ID {
			apps[i].Status = "building"
			apps[i].URL = fmt.Sprintf("http://%s.%s.sslip.io", apps[i].ID, ip)
			clone := apps[i]
			targetApp = &clone
			break
		}
	}
	appsLock.Unlock()

	if targetApp == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}

	// Clear old build logs
	buildLogsLock.Lock()
	buildLogs[targetApp.ID] = []string{}
	buildLogsLock.Unlock()

	saveDB()
	rebuildCaddyfile()

	jsonOK(w, targetApp.Public())

	go runPaaSDeployment(*targetApp, normalizeGitURL(targetApp.GitRepo))
}

// ---------------------------------------------------------------------------
// POST /api/git/branches
// ---------------------------------------------------------------------------

func handleGitBranches(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		GitRepo  string `json:"gitRepo"`
		GitToken string `json:"gitToken"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	gitURL := normalizeGitURL(req.GitRepo)
	authenticatedURL := formatGitURL(gitURL, req.GitToken)

	cmd := exec.Command("git", "ls-remote", "--heads", authenticatedURL)
	output, err := cmd.CombinedOutput()
	if err != nil {
		jsonError(w, fmt.Sprintf("Failed to fetch branches: %s", string(output)), http.StatusInternalServerError)
		return
	}

	var branches []string
	for _, line := range splitLines(string(output)) {
		parts := splitFields(line)
		if len(parts) >= 2 && hasPrefix(parts[1], "refs/heads/") {
			branches = append(branches, trimPrefix(parts[1], "refs/heads/"))
		}
	}

	if len(branches) == 0 {
		branches = []string{"main", "master"}
	}

	jsonOK(w, branches)
}

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

func handleHealth(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().Format(time.RFC3339),
		"uptime":    time.Since(startTime).String(),
	})
}

// ---------------------------------------------------------------------------
// POST /api/docker/prune
// ---------------------------------------------------------------------------

func handleDockerPrune(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	output, err := runDockerPrune()
	if err != nil {
		jsonError(w, fmt.Sprintf("Prune failed: %v\n%s", err, output), http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{
		"status": "pruned",
		"output": output,
	})
}

// ---------------------------------------------------------------------------
// GET /api/deployments/history
// ---------------------------------------------------------------------------

func handleDeploymentHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	deploymentsLock.Lock()
	result := make([]DeploymentRecord, len(deployments))
	copy(result, deployments)
	deploymentsLock.Unlock()

	jsonOK(w, result)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// findApp returns a copy of the App with the given ID, or nil.
func findApp(id string) *App {
	appsLock.Lock()
	defer appsLock.Unlock()
	for i := range apps {
		if apps[i].ID == id {
			clone := apps[i]
			return &clone
		}
	}
	return nil
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i, c := range s {
		if c == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func splitFields(s string) []string {
	var fields []string
	inField := false
	start := 0
	for i, c := range s {
		if c == ' ' || c == '\t' {
			if inField {
				fields = append(fields, s[start:i])
				inField = false
			}
		} else {
			if !inField {
				start = i
				inField = true
			}
		}
	}
	if inField {
		fields = append(fields, s[start:])
	}
	return fields
}

func hasPrefix(s, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}

func trimPrefix(s, prefix string) string {
	if hasPrefix(s, prefix) {
		return s[len(prefix):]
	}
	return s
}
