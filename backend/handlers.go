package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
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
// GitHub API Types
// ---------------------------------------------------------------------------

type GitHubRepo struct {
	FullName    string `json:"full_name"`
	Name        string `json:"name"`
	CloneURL    string `json:"clone_url"`
	HTMLURL     string `json:"html_url"`
	Private     bool   `json:"private"`
	Description string `json:"description"`
	UpdatedAt   string `json:"updated_at"`
}

type GitHubContent struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Type string `json:"type"` // "file" or "dir"
}

type GitHubFile struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Type        string `json:"type"`
	Content     string `json:"content"`
	Encoding    string `json:"encoding"`
	Size        int    `json:"size"`
	DownloadURL string `json:"download_url"`
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

	if !validAppName(req.Name) {
		jsonError(w, "invalid name: use 2-40 lowercase letters, digits, or hyphens (must start and end alphanumeric)", http.StatusBadRequest)
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

	if err := dbSaveApp(newApp); err != nil {
		log.Printf("[db] failed to save app: %v", err)
	}

	// Initialize build log buffer.
	buildLogsLock.Lock()
	buildLogs[appID] = []string{}
	buildLogsLock.Unlock()

	rebuildCaddyfile()

	// Create deployment record and log file upfront.
	deployID := generateRandomID()
	logFile := filepath.Join("data", "logs", appID, deployID+".log")
	os.MkdirAll(filepath.Dir(logFile), 0755)

	dep := DeploymentRecord{
		ID:        deployID,
		AppID:     appID,
		AppName:   newApp.Name,
		Status:    "building",
		LogFile:   logFile,
		CreatedAt: time.Now(),
	}
	if err := dbCreateDeployment(dep); err != nil {
		log.Printf("[db] failed to create deployment: %v", err)
	}

	jsonOK(w, newApp.Public())

	// Run deployment asynchronously.
	go runPaaSDeployment(newApp, gitURL, deployID, logFile)
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

	if err := dbUpdateAppStatus(req.ID, "stopped"); err != nil {
		log.Printf("[db] failed to update app status: %v", err)
	}
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

	if err := dbUpdateAppStatus(req.ID, "running"); err != nil {
		log.Printf("[db] failed to update app status: %v", err)
	}
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

	// ── Stop and remove container + image ────────────────────────────────────
	exec.Command("docker", "rm", "-f", app.Name).Run()
	exec.Command("docker", "rmi", "-f", app.Name).Run()

	// ── Remove build directory ───────────────────────────────────────────────
	buildDir := filepath.Join("builds", app.Name)
	if err := os.RemoveAll(buildDir); err != nil {
		log.Printf("[delete] warning: failed to remove build dir %s: %v", buildDir, err)
	}

	// ── Remove log files ─────────────────────────────────────────────────────
	logDir := filepath.Join("data", "logs", app.ID)
	if err := os.RemoveAll(logDir); err != nil {
		log.Printf("[delete] warning: failed to remove log dir %s: %v", logDir, err)
	}

	appsLock.Lock()
	for i, a := range apps {
		if a.ID == req.ID {
			apps = append(apps[:i], apps[i+1:]...)
			break
		}
	}
	appsLock.Unlock()

	if err := dbDeleteApp(req.ID); err != nil {
		log.Printf("[db] failed to delete app: %v", err)
	}
	if err := dbDeleteDeploymentsForApp(req.ID); err != nil {
		log.Printf("[db] failed to delete deployments: %v", err)
	}

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
		jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
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

	if err := dbSaveApp(*updated); err != nil {
		log.Printf("[db] failed to save app: %v", err)
	}
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

	// Clear old build logs.
	buildLogsLock.Lock()
	buildLogs[targetApp.ID] = []string{}
	buildLogsLock.Unlock()

	if err := dbUpdateAppStatus(req.ID, "building"); err != nil {
		log.Printf("[db] failed to update app status: %v", err)
	}

	// Create new deployment record.
	deployID := generateRandomID()
	logFile := filepath.Join("data", "logs", req.ID, deployID+".log")
	os.MkdirAll(filepath.Dir(logFile), 0755)
	dep := DeploymentRecord{
		ID:        deployID,
		AppID:     req.ID,
		AppName:   targetApp.Name,
		Status:    "building",
		LogFile:   logFile,
		CreatedAt: time.Now(),
	}
	if err := dbCreateDeployment(dep); err != nil {
		log.Printf("[db] failed to create deployment: %v", err)
	}

	rebuildCaddyfile()
	jsonOK(w, targetApp.Public())

	go runPaaSDeployment(*targetApp, normalizeGitURL(targetApp.GitRepo), deployID, logFile)
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
	for _, line := range strings.Split(string(output), "\n") {
		parts := strings.Fields(line)
		if len(parts) >= 2 && strings.HasPrefix(parts[1], "refs/heads/") {
			branches = append(branches, strings.TrimPrefix(parts[1], "refs/heads/"))
		}
	}

	if len(branches) == 0 {
		branches = []string{"main", "master"}
	}

	jsonOK(w, branches)
}

// ---------------------------------------------------------------------------
// POST /api/git/repos
// ---------------------------------------------------------------------------

func handleGitRepos(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	githubTokenLock.RLock()
	tok := githubToken
	githubTokenLock.RUnlock()

	if tok == "" {
		jsonError(w, "No GitHub token configured", http.StatusUnauthorized)
		return
	}

	ghReq, err := http.NewRequest("GET", "https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator", nil)
	if err != nil {
		jsonError(w, "Failed to create request", http.StatusInternalServerError)
		return
	}
	ghReq.Header.Set("Authorization", "Bearer "+tok)
	ghReq.Header.Set("Accept", "application/vnd.github.v3+json")
	ghReq.Header.Set("User-Agent", "BaaS-Deploy")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(ghReq)
	if err != nil {
		jsonError(w, "Failed to reach GitHub API", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		jsonError(w, fmt.Sprintf("GitHub API error: %s", string(body)), resp.StatusCode)
		return
	}

	var repos []GitHubRepo
	if err := json.NewDecoder(resp.Body).Decode(&repos); err != nil {
		jsonError(w, "Failed to parse GitHub response", http.StatusInternalServerError)
		return
	}

	jsonOK(w, repos)
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
// POST /api/auth/verify — validates an admin token (used by the login screen).
// ---------------------------------------------------------------------------

func handleAuthVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Accept the token either as a bearer header or in the JSON body.
	tok := bearerFromRequest(r)
	if tok == "" {
		var req struct {
			Token string `json:"token"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		tok = req.Token
	}

	if !httpAuthOK(w, r, tok) {
		return
	}
	jsonOK(w, map[string]bool{"valid": true})
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

	deps, err := dbLoadDeployments()
	if err != nil {
		jsonError(w, fmt.Sprintf("Failed to load deployments: %v", err), http.StatusInternalServerError)
		return
	}

	jsonOK(w, deps)
}

// ---------------------------------------------------------------------------
// GET /api/git/contents
// ---------------------------------------------------------------------------

func handleGitContents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	repo := r.URL.Query().Get("repo")
	path := r.URL.Query().Get("path")
	branch := r.URL.Query().Get("branch")
	if repo == "" {
		jsonError(w, "Missing repo parameter", http.StatusBadRequest)
		return
	}
	if branch == "" {
		branch = "main"
	}

	githubTokenLock.RLock()
	tok := githubToken
	githubTokenLock.RUnlock()

	var url string
	if path == "" {
		url = fmt.Sprintf("https://api.github.com/repos/%s/contents?ref=%s", repo, branch)
	} else {
		url = fmt.Sprintf("https://api.github.com/repos/%s/contents/%s?ref=%s", repo, path, branch)
	}
	ghReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		jsonError(w, "Failed to create request", http.StatusInternalServerError)
		return
	}
	if tok != "" {
		ghReq.Header.Set("Authorization", "Bearer "+tok)
	}
	ghReq.Header.Set("Accept", "application/vnd.github.v3+json")
	ghReq.Header.Set("User-Agent", "BaaS-Deploy")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(ghReq)
	if err != nil {
		jsonError(w, "Failed to reach GitHub API", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		jsonError(w, fmt.Sprintf("GitHub API error: %s", string(body)), resp.StatusCode)
		return
	}

	var contents []GitHubContent
	if err := json.NewDecoder(resp.Body).Decode(&contents); err != nil {
		resp.Body.Close()
		ghReq2, _ := http.NewRequest("GET", url, nil)
		if tok != "" {
			ghReq2.Header.Set("Authorization", "Bearer "+tok)
		}
		ghReq2.Header.Set("Accept", "application/vnd.github.v3+json")
		ghReq2.Header.Set("User-Agent", "BaaS-Deploy")
		resp2, _ := client.Do(ghReq2)
		if resp2 != nil {
			defer resp2.Body.Close()
			var single GitHubContent
			if json.NewDecoder(resp2.Body).Decode(&single) == nil {
				contents = []GitHubContent{single}
			}
		}
	}

	if contents == nil {
		contents = []GitHubContent{}
	}

	jsonOK(w, contents)
}

// ---------------------------------------------------------------------------
// GET /api/git/file
// ---------------------------------------------------------------------------

func handleGitFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	repo := r.URL.Query().Get("repo")
	path := r.URL.Query().Get("path")
	branch := r.URL.Query().Get("branch")
	if repo == "" || path == "" {
		jsonError(w, "Missing repo or path parameter", http.StatusBadRequest)
		return
	}
	if branch == "" {
		branch = "main"
	}

	githubTokenLock.RLock()
	tok := githubToken
	githubTokenLock.RUnlock()

	var url string
	if path == "" {
		url = fmt.Sprintf("https://api.github.com/repos/%s/contents?ref=%s", repo, branch)
	} else {
		url = fmt.Sprintf("https://api.github.com/repos/%s/contents/%s?ref=%s", repo, path, branch)
	}
	ghReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		jsonError(w, "Failed to create request", http.StatusInternalServerError)
		return
	}
	if tok != "" {
		ghReq.Header.Set("Authorization", "Bearer "+tok)
	}
	ghReq.Header.Set("Accept", "application/vnd.github.v3+json")
	ghReq.Header.Set("User-Agent", "BaaS-Deploy")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(ghReq)
	if err != nil {
		jsonError(w, "Failed to reach GitHub API", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		jsonError(w, fmt.Sprintf("GitHub API error: %s", string(body)), resp.StatusCode)
		return
	}

	var file GitHubFile
	if err := json.NewDecoder(resp.Body).Decode(&file); err != nil {
		jsonError(w, "Failed to parse GitHub response", http.StatusInternalServerError)
		return
	}

	if file.Encoding == "base64" && file.Content != "" {
		decoded, err := base64.StdEncoding.DecodeString(file.Content)
		if err == nil {
			file.Content = string(decoded)
		}
	}

	jsonOK(w, file)
}

// ---------------------------------------------------------------------------
// GitHub Token Management
// ---------------------------------------------------------------------------

func handleGitTokenGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	githubTokenLock.RLock()
	tok := githubToken
	githubTokenLock.RUnlock()

	jsonOK(w, map[string]interface{}{
		"connected": tok != "",
		"token":     "",
	})
}

func handleGitTokenSet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	githubTokenLock.Lock()
	githubToken = req.Token
	githubTokenLock.Unlock()

	if err := dbSetToken(req.Token); err != nil {
		log.Printf("[db] failed to save token: %v", err)
	}

	jsonOK(w, map[string]string{"status": "saved"})
}

func handleGitTokenDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	githubTokenLock.Lock()
	githubToken = ""
	githubTokenLock.Unlock()

	if err := dbSetToken(""); err != nil {
		log.Printf("[db] failed to clear token: %v", err)
	}

	jsonOK(w, map[string]string{"status": "deleted"})
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
