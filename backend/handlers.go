package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
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

// decodeJSON decodes a request body into v.
func decodeJSON(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
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

	// Enrich each app with the commit info of its latest deployment so the
	// dashboard can show what's currently deployed. Best-effort: a missing or
	// errored lookup just leaves the fields empty.
	for i := range result {
		if dep, err := dbGetLatestDeployment(result[i].ID); err == nil && dep != nil {
			result[i].ActiveCommit = dep.Commit
			result[i].ActiveCommitMsg = dep.CommitMsg
		}
	}

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
		Domains        []string          `json:"domains"`
		Memory         string            `json:"memory"`
		CPUs           string            `json:"cpus"`
		Volumes        []string          `json:"volumes"`
		HealthPath     string            `json:"healthPath"`
		SecretKeys     []string          `json:"secretKeys"`
		AutoDeploy     bool              `json:"autoDeploy"`
		BuildMethod    string            `json:"buildMethod"`
		DockerfilePath string            `json:"dockerfilePath"`
		ComposePath    string            `json:"composePath"`
		ServerID       string            `json:"serverId"`
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

	serverID := req.ServerID
	if serverID == "" {
		serverID = "localhost"
	}

	if err := validateResourceLimits(req.Memory, req.CPUs); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := validateDomains(req.Domains); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := validateVolumes(req.Volumes); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	rootDir, err := validateRootDir(req.RootDir)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	buildMethod, dockerfilePath, err := validateBuildMethod(req.BuildMethod, req.DockerfilePath)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	composePath, err := validateComposePath(req.ComposePath)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	gitURL := normalizeGitURL(req.GitRepo)
	gitToken := strings.TrimSpace(req.GitToken)
	if gitToken == "" {
		githubTokenLock.RLock()
		gitToken = githubToken
		githubTokenLock.RUnlock()
	}

	appsLock.Lock()
	appID := generateRandomID()
	taken := make(map[string]bool, len(apps))
	for _, a := range apps {
		taken[a.Name] = true
	}
	name := uniqueAppName(req.Name, taken)
	newApp := App{
		ID:             appID,
		Name:           name,
		Status:         "building",
		GitRepo:        req.GitRepo,
		Branch:         req.Branch,
		Port:           allocatePort(serverID),
		CreatedAt:      time.Now(),
		GitToken:       gitToken,
		RootDir:        rootDir,
		EnvVars:        req.EnvVars,
		BuildCommand:   req.BuildCommand,
		StartCommand:   req.StartCommand,
		InstallCommand: req.InstallCommand,
		PortOverride:   req.PortOverride,
		Domains:        req.Domains,
		Memory:         req.Memory,
		CPUs:           req.CPUs,
		Volumes:        req.Volumes,
		HealthPath:     req.HealthPath,
		SecretKeys:     req.SecretKeys,
		AutoDeploy:     req.AutoDeploy,
		BuildMethod:    buildMethod,
		DockerfilePath: dockerfilePath,
		ComposePath:    composePath,
		WebhookSecret:  generateRandomID() + generateRandomID(), // 20-char webhook secret
		ServerID:       serverID,
	}
	newApp.URL = defaultAppURL(newApp.ID, serverID)
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

	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	app := findApp(req.ID)
	if app == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}

	// Compose rows stop as a group (interdependent services).
	if app.ComposeProject != "" {
		stopComposeGroup(*app)
		jsonOK(w, map[string]string{"status": "stopped"})
		return
	}

	if ex, err := GetExecutorForServer(app.ServerID); err == nil {
		if sshEx, ok := ex.(*SSHExecutor); ok {
			defer sshEx.Close()
		}
		_, _ = ex.RunCommand("docker", "stop", app.containerName())
	}
	stopRuntimeLogCapture(req.ID)

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

	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	app := findApp(req.ID)
	if app == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}

	// Compose rows start as a group.
	if app.ComposeProject != "" {
		if err := startComposeGroup(*app); err != nil {
			jsonError(w, fmt.Sprintf("Failed to start compose project: %v", err), http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]string{"status": "running"})
		return
	}

	ex, err := GetExecutorForServer(app.ServerID)
	if err != nil {
		jsonError(w, fmt.Sprintf("Failed to get server connection: %v", err), http.StatusInternalServerError)
		return
	}
	if sshEx, ok := ex.(*SSHExecutor); ok {
		defer sshEx.Close()
	}
	if out, err := ex.RunCommand("docker", "start", app.containerName()); err != nil {
		jsonError(w, fmt.Sprintf("Failed to start container: %v — %s", err, out), http.StatusInternalServerError)
		return
	}
	startRuntimeLogCapture(app.ID, app.containerName())

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

	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	app := findApp(req.ID)
	if app == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}

	// ── Compose group: delete the entire project and all its rows ────────────
	// A compose service can't be meaningfully deleted on its own (the project's
	// network/volumes and sibling services depend on it), so deleting any row
	// tears down the whole group.
	if app.ComposeProject != "" {
		deleteComposeGroup(*app)
		jsonOK(w, map[string]string{"status": "deleted"})
		return
	}

	// ── Stop and remove container(s) + image(s) ──────────────────────────────
	// Remove the active container, the legacy-named container (if any), and all
	// images tagged for this app (every per-deploy tag).
	stopRuntimeLogCapture(app.ID)
	if ex, err := GetExecutorForServer(app.ServerID); err == nil {
		if sshEx, ok := ex.(*SSHExecutor); ok {
			defer sshEx.Close()
		}
		_, _ = ex.RunCommand("docker", "rm", "-f", app.containerName())
		_, _ = ex.RunCommand("docker", "rm", "-f", app.Name)
	}
	removeAppContainers(app.ServerID, app.ID)
	removeAppImages(app.ServerID, *app)
	if app.ServerID != "" && app.ServerID != "localhost" {
		removeAppImages("localhost", *app)
	}

	// ── Remove build directory ───────────────────────────────────────────────
	buildDir := filepath.Join("builds", app.ID)
	if err := os.RemoveAll(buildDir); err != nil {
		log.Printf("[delete] warning: failed to remove build dir %s: %v", buildDir, err)
	}

	// ── Remove log files ─────────────────────────────────────────────────────
	logDir := filepath.Join("data", "logs", app.ID)
	if err := os.RemoveAll(logDir); err != nil {
		log.Printf("[delete] warning: failed to remove log dir %s: %v", logDir, err)
	}
	// Remove persisted runtime logs.
	os.Remove(runtimeLogPath(app.ID))
	os.Remove(runtimeLogPath(app.ID) + ".1")

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
	if err := dbDeleteCronJobsForApp(req.ID); err != nil {
		log.Printf("[db] failed to delete cron jobs: %v", err)
	}
	if err := dbDeleteAnalyticsForApp(req.ID); err != nil {
		log.Printf("[db] failed to delete analytics: %v", err)
	}
	if err := detachAppFromAddons(req.ID); err != nil {
		log.Printf("[db] failed to detach add-ons: %v", err)
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
		Domains        *[]string         `json:"domains"`
		Memory         string            `json:"memory"`
		CPUs           string            `json:"cpus"`
		Volumes        []string          `json:"volumes"`
		HealthPath     string            `json:"healthPath"`
		SecretKeys     []string          `json:"secretKeys"`
		AutoDeploy     *bool             `json:"autoDeploy"`
		BuildMethod    *string           `json:"buildMethod"`
		DockerfilePath *string           `json:"dockerfilePath"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := validateResourceLimits(req.Memory, req.CPUs); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.Domains != nil {
		if err := validateDomains(*req.Domains); err != nil {
			jsonError(w, err.Error(), http.StatusBadRequest)
			return
		}
	}
	if req.Volumes != nil {
		if err := validateVolumes(req.Volumes); err != nil {
			jsonError(w, err.Error(), http.StatusBadRequest)
			return
		}
	}
	rootDir, err := validateRootDir(req.RootDir)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate build method when provided. We resolve the effective method +
	// dockerfile path so an unset path defaults correctly.
	var normMethod, normDockerfile string
	buildMethodChanged := req.BuildMethod != nil
	if buildMethodChanged {
		df := ""
		if req.DockerfilePath != nil {
			df = *req.DockerfilePath
		}
		m, p, err := validateBuildMethod(*req.BuildMethod, df)
		if err != nil {
			jsonError(w, err.Error(), http.StatusBadRequest)
			return
		}
		normMethod, normDockerfile = m, p
	}

	appsLock.Lock()
	var updated *App
	for i := range apps {
		if apps[i].ID == req.ID {
			apps[i].GitRepo = req.GitRepo
			apps[i].Branch = req.Branch
			apps[i].RootDir = rootDir
			apps[i].EnvVars = mergeEnvVars(apps[i].EnvVars, req.EnvVars, req.SecretKeys)
			apps[i].BuildCommand = req.BuildCommand
			apps[i].StartCommand = req.StartCommand
			apps[i].InstallCommand = req.InstallCommand
			apps[i].PortOverride = req.PortOverride
			if req.Domains != nil {
				apps[i].Domains = *req.Domains
			}
			apps[i].Memory = req.Memory
			apps[i].CPUs = req.CPUs
			apps[i].Volumes = req.Volumes
			apps[i].HealthPath = req.HealthPath
			apps[i].SecretKeys = req.SecretKeys
			if req.AutoDeploy != nil {
				apps[i].AutoDeploy = *req.AutoDeploy
			}
			if buildMethodChanged {
				apps[i].BuildMethod = normMethod
				apps[i].DockerfilePath = normDockerfile
			}
			apps[i].URL = defaultAppURL(apps[i].ID, apps[i].ServerID)
			full := apps[i] // full copy WITH secrets for DB persistence
			clone := apps[i].Public()
			updated = &clone
			_ = full
			break
		}
	}
	appsLock.Unlock()

	if updated == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}

	// Persist the full (unredacted) app, not the public view.
	if full := findApp(req.ID); full != nil {
		if err := dbSaveApp(*full); err != nil {
			log.Printf("[db] failed to save app: %v", err)
		}
	}
	rebuildCaddyfile()
	jsonOK(w, updated)
}

// ---------------------------------------------------------------------------
// POST /api/apps/rename
// ---------------------------------------------------------------------------

func handleRenameApp(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	if !validAppName(name) {
		jsonError(w, "invalid name: use 2-40 lowercase letters, digits, or hyphens (must start and end alphanumeric)", http.StatusBadRequest)
		return
	}

	appsLock.Lock()
	var updated *App
	taken := make(map[string]bool, len(apps))
	for _, a := range apps {
		if a.ID != req.ID {
			taken[a.Name] = true
		}
	}
	resolvedName := uniqueAppName(name, taken)
	for i := range apps {
		if apps[i].ID == req.ID {
			apps[i].Name = resolvedName
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
	if full := findApp(req.ID); full != nil {
		if err := dbSaveApp(*full); err != nil {
			log.Printf("[db] failed to rename app: %v", err)
			jsonError(w, "failed to save app name", http.StatusInternalServerError)
			return
		}
	}

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

	var req struct {
		ID      string `json:"id"`
		NoCache bool   `json:"noCache"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	// For compose rows, always redeploy from the group's primary row so the
	// whole project is rebuilt and all rows reconcile together.
	redeployID := req.ID
	if r := findApp(req.ID); r != nil && r.ComposeProject != "" {
		if primary := composePrimaryRow(r.ComposeProject); primary != nil {
			redeployID = primary.ID
		}
	}

	appsLock.Lock()
	var targetApp *App
	for i := range apps {
		if apps[i].ID == redeployID {
			apps[i].Status = "building"
			apps[i].URL = defaultAppURL(apps[i].ID, apps[i].ServerID)
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

	if err := dbUpdateAppStatus(targetApp.ID, "building"); err != nil {
		log.Printf("[db] failed to update app status: %v", err)
	}

	// Create new deployment record.
	deployID := generateRandomID()
	logFile := filepath.Join("data", "logs", targetApp.ID, deployID+".log")
	os.MkdirAll(filepath.Dir(logFile), 0755)
	dep := DeploymentRecord{
		ID:        deployID,
		AppID:     targetApp.ID,
		AppName:   targetApp.Name,
		Status:    "building",
		LogFile:   logFile,
		CreatedAt: time.Now(),
		Trigger:   "manual",
	}
	if err := dbCreateDeployment(dep); err != nil {
		log.Printf("[db] failed to create deployment: %v", err)
	}

	rebuildCaddyfile()
	jsonOK(w, targetApp.Public())

	go runDeployment(*targetApp, normalizeGitURL(targetApp.GitRepo), deployID, logFile, "manual", "", req.NoCache)
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
	gitToken := strings.TrimSpace(req.GitToken)
	if gitToken == "" {
		githubTokenLock.RLock()
		gitToken = githubToken
		githubTokenLock.RUnlock()
	}
	authenticatedURL := formatGitURL(gitURL, gitToken)

	cmd := exec.Command("git", "ls-remote", "--heads", authenticatedURL)
	output, err := cmd.CombinedOutput()
	if err != nil {
		jsonError(w, fmt.Sprintf("Failed to fetch branches: %s", scrubCredentials(string(output))), http.StatusInternalServerError)
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
		"uptime":    time.Since(startTime).Round(time.Second).String(),
		"version":   version,
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
// Onboarding state
//
// A one-time welcome flow runs on first sign-in. The "completed" flag lives in
// the meta table so it is shared across browsers/devices (it is a property of
// the node, not the client) and survives a localStorage clear.
// ---------------------------------------------------------------------------

const onboardingMetaKey = "onboarding_complete"

func handleOnboardingGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jsonOK(w, map[string]bool{"completed": dbGetMeta(onboardingMetaKey) == "true"})
}

func handleOnboardingComplete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := dbSetMeta(onboardingMetaKey, "true"); err != nil {
		jsonError(w, "Failed to save", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]bool{"completed": true})
}

func handleOnboardingReset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := dbSetMeta(onboardingMetaKey, "false"); err != nil {
		jsonError(w, "Failed to save", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]bool{"completed": false})
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

// ---------------------------------------------------------------------------
// POST /api/apps/rollback — re-release a previous deployment's image
// ---------------------------------------------------------------------------

func handleRollback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID           string `json:"id"`           // app id
		DeploymentID string `json:"deploymentId"` // deployment to roll back to
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	app := findApp(req.ID)
	if app == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}

	target, err := dbGetDeployment(req.DeploymentID)
	if err != nil || target == nil {
		jsonError(w, "Deployment not found", http.StatusNotFound)
		return
	}
	if target.AppID != app.ID {
		jsonError(w, "Deployment does not belong to this app", http.StatusBadRequest)
		return
	}
	if target.Image == "" {
		jsonError(w, "This deployment has no stored image to roll back to", http.StatusBadRequest)
		return
	}

	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == req.ID {
			apps[i].Status = "building"
			break
		}
	}
	appsLock.Unlock()

	buildLogsLock.Lock()
	buildLogs[app.ID] = []string{}
	buildLogsLock.Unlock()

	_ = dbUpdateAppStatus(req.ID, "building")

	deployID := generateRandomID()
	logFile := filepath.Join("data", "logs", req.ID, deployID+".log")
	os.MkdirAll(filepath.Dir(logFile), 0755)
	dep := DeploymentRecord{
		ID:        deployID,
		AppID:     req.ID,
		AppName:   app.Name,
		Status:    "building",
		LogFile:   logFile,
		CreatedAt: time.Now(),
		Trigger:   "rollback",
	}
	_ = dbCreateDeployment(dep)
	rebuildCaddyfile()
	jsonOK(w, app.Public())

	go runDeployment(*app, normalizeGitURL(app.GitRepo), deployID, logFile, "rollback", target.Image, false)
}

// ---------------------------------------------------------------------------
// GET  /api/apps/webhook?id=<appID>   — fetch webhook URL + secret
// POST /api/apps/webhook/regenerate   — rotate the webhook secret
// ---------------------------------------------------------------------------

func handleWebhookInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := r.URL.Query().Get("id")
	app := findApp(id)
	if app == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}
	jsonOK(w, map[string]string{
		"url":    fmt.Sprintf("%s/api/webhooks/github/%s", externalBaseURL(r), app.ID),
		"secret": app.WebhookSecret,
		"event":  "push",
	})
}

func handleWebhookRegenerate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	app := findApp(req.ID)
	if app == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}
	newSecret := generateRandomID() + generateRandomID()
	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == req.ID {
			apps[i].WebhookSecret = newSecret
			break
		}
	}
	appsLock.Unlock()
	if full := findApp(req.ID); full != nil {
		_ = dbSaveApp(*full)
	}
	jsonOK(w, map[string]string{"secret": newSecret})
}

// POST /api/apps/webhook/github/create — create or update the repo webhook on GitHub.
func handleGitHubWebhookCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	app := findApp(req.ID)
	if app == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}
	if app.GitRepo == "" {
		jsonError(w, "This app is not linked to a Git repository", http.StatusBadRequest)
		return
	}
	if app.WebhookSecret == "" {
		jsonError(w, "Webhook secret is missing; regenerate it first", http.StatusBadRequest)
		return
	}

	slug := parseGitHubRepoSlug(app.GitRepo)
	if slug == "" {
		jsonError(w, "Could not derive a GitHub owner/repo from this Git URL", http.StatusBadRequest)
		return
	}

	githubTokenLock.RLock()
	tok := githubToken
	githubTokenLock.RUnlock()
	if tok == "" {
		jsonError(w, "No GitHub token configured", http.StatusUnauthorized)
		return
	}

	hookURL := fmt.Sprintf("%s/api/webhooks/github/%s", webhookPublicBaseURL(r), app.ID)
	hookID, action, err := ensureGitHubRepoWebhook(tok, slug, hookURL, app.WebhookSecret)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}

	jsonOK(w, map[string]any{
		"status": "success",
		"action": action,
		"hookId": hookID,
		"url":    hookURL,
	})
}

func webhookPublicBaseURL(r *http.Request) string {
	if domain := strings.TrimSpace(getPaasDomain()); domain != "" {
		return "https://" + strings.TrimSuffix(domain, "/")
	}
	return externalBaseURL(r)
}

func parseGitHubRepoSlug(remote string) string {
	s := strings.TrimSuffix(strings.TrimSpace(remote), ".git")
	if s == "" {
		return ""
	}
	if strings.HasPrefix(s, "git@github.com:") {
		return cleanSlug(strings.TrimPrefix(s, "git@github.com:"))
	}
	if strings.HasPrefix(s, "github.com/") {
		return cleanSlug(strings.TrimPrefix(s, "github.com/"))
	}
	if i := strings.Index(s, "://"); i >= 0 {
		rest := s[i+3:]
		j := strings.Index(rest, "/")
		if j < 0 {
			return ""
		}
		host := rest[:j]
		if !strings.HasSuffix(host, "github.com") {
			return ""
		}
		return cleanSlug(rest[j+1:])
	}
	return ""
}

type githubRepoHook struct {
	ID     int64 `json:"id"`
	Active bool  `json:"active"`
	Config struct {
		URL string `json:"url"`
	} `json:"config"`
}

func ensureGitHubRepoWebhook(token, repoSlug, hookURL, secret string) (int64, string, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	hooks, err := listGitHubRepoHooks(client, token, repoSlug)
	if err != nil {
		return 0, "", err
	}
	for _, hook := range hooks {
		if hook.Config.URL == hookURL {
			if err := updateGitHubRepoHook(client, token, repoSlug, hook.ID, hookURL, secret); err != nil {
				return 0, "", err
			}
			return hook.ID, "updated", nil
		}
	}

	id, err := createGitHubRepoHook(client, token, repoSlug, hookURL, secret)
	if err != nil {
		return 0, "", err
	}
	return id, "created", nil
}

func listGitHubRepoHooks(client *http.Client, token, repoSlug string) ([]githubRepoHook, error) {
	req, err := githubAPIRequest(http.MethodGet, fmt.Sprintf("https://api.github.com/repos/%s/hooks", repoSlug), token, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create GitHub request")
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to reach GitHub API")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API error: %s", string(body))
	}
	var hooks []githubRepoHook
	if err := json.NewDecoder(resp.Body).Decode(&hooks); err != nil {
		return nil, fmt.Errorf("failed to parse GitHub hooks response")
	}
	return hooks, nil
}

func createGitHubRepoHook(client *http.Client, token, repoSlug, hookURL, secret string) (int64, error) {
	req, err := githubAPIRequest(http.MethodPost, fmt.Sprintf("https://api.github.com/repos/%s/hooks", repoSlug), token, githubWebhookPayload(hookURL, secret))
	if err != nil {
		return 0, fmt.Errorf("failed to create GitHub request")
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("failed to reach GitHub API")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("GitHub API error: %s", string(body))
	}
	var hook githubRepoHook
	if err := json.NewDecoder(resp.Body).Decode(&hook); err != nil {
		return 0, fmt.Errorf("failed to parse GitHub hook response")
	}
	return hook.ID, nil
}

func updateGitHubRepoHook(client *http.Client, token, repoSlug string, hookID int64, hookURL, secret string) error {
	req, err := githubAPIRequest(http.MethodPatch, fmt.Sprintf("https://api.github.com/repos/%s/hooks/%d", repoSlug, hookID), token, githubWebhookPayload(hookURL, secret))
	if err != nil {
		return fmt.Errorf("failed to create GitHub request")
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to reach GitHub API")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("GitHub API error: %s", string(body))
	}
	return nil
}

func githubWebhookPayload(hookURL, secret string) io.Reader {
	body, _ := json.Marshal(map[string]any{
		"name":   "web",
		"active": true,
		"events": []string{"push"},
		"config": map[string]string{
			"url":          hookURL,
			"content_type": "json",
			"secret":       secret,
			"insecure_ssl": "0",
		},
	})
	return bytes.NewReader(body)
}

func githubAPIRequest(method, url, token string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "Better-PaaS")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return req, nil
}

// externalBaseURL best-effort reconstructs the externally visible base URL for
// building webhook links (honors X-Forwarded-* when behind a proxy).
func externalBaseURL(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if trustProxy {
		if p := r.Header.Get("X-Forwarded-Proto"); p != "" {
			scheme = strings.Split(p, ",")[0]
		}
	}
	host := r.Host
	if trustProxy {
		if h := r.Header.Get("X-Forwarded-Host"); h != "" {
			host = strings.Split(h, ",")[0]
		}
	}
	return fmt.Sprintf("%s://%s", scheme, strings.TrimSpace(host))
}

// ---------------------------------------------------------------------------
// GET /api/metrics/apps — per-container resource usage
// ---------------------------------------------------------------------------

func handlePerAppMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jsonOK(w, collectPerAppMetrics())
}

// ---------------------------------------------------------------------------
// Notification config: GET /api/notifications, POST /api/notifications/save
// ---------------------------------------------------------------------------

func handleNotificationsGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jsonOK(w, getNotificationConfig())
}

func handleNotificationsSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var cfg NotificationConfig
	if err := decodeJSON(r, &cfg); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	if err := saveNotificationConfig(cfg); err != nil {
		jsonError(w, "Failed to save", http.StatusInternalServerError)
		return
	}
	jsonOK(w, cfg)
}

// POST /api/notifications/test — send a test notification.
func handleNotificationsTest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	cfg := getNotificationConfig()
	text := "🔔 Better-PaaS test notification — your webhook is configured correctly."
	if cfg.SlackWebhookURL != "" {
		postJSON(cfg.SlackWebhookURL, map[string]string{"text": text})
	}
	if cfg.GenericURL != "" {
		postJSON(cfg.GenericURL, map[string]string{"text": text, "test": "true"})
	}
	jsonOK(w, map[string]string{"status": "sent"})
}

// ---------------------------------------------------------------------------
// GET /api/apps/runtime-logs?id=<appID>&lines=N — persisted runtime logs
// ---------------------------------------------------------------------------

func handleRuntimeLogHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		jsonError(w, "Missing id", http.StatusBadRequest)
		return
	}
	lines := 500
	if n := r.URL.Query().Get("lines"); n != "" {
		if parsed, err := strconv.Atoi(n); err == nil && parsed > 0 {
			lines = parsed
		}
	}
	logs, err := readRuntimeLog(id, lines)
	if err != nil {
		jsonError(w, "Failed to read runtime logs", http.StatusInternalServerError)
		return
	}
	if logs == nil {
		logs = []string{}
	}
	jsonOK(w, map[string]interface{}{"logs": logs})
}

// findApp returns a copy of the app with the given id, or nil.
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

// findAppByName returns a copy of the app with the given name, or nil. App
// names are unique (enforced by a UNIQUE constraint), so this identifies at
// most one app.
func findAppByName(name string) *App {
	appsLock.Lock()
	defer appsLock.Unlock()
	for i := range apps {
		if apps[i].Name == name {
			clone := apps[i]
			return &clone
		}
	}
	return nil
}

// findAppByNameAndServer returns a copy of the app with the given name and server,
// or nil if no match is found.
func findAppByNameAndServer(name, serverID string) *App {
	if serverID == "" {
		serverID = "localhost"
	}
	appsLock.Lock()
	defer appsLock.Unlock()
	for i := range apps {
		appServer := apps[i].ServerID
		if appServer == "" {
			appServer = "localhost"
		}
		if apps[i].Name == name && appServer == serverID {
			clone := apps[i]
			return &clone
		}
	}
	return nil
}
