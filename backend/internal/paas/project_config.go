package paas

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// projectDeployType classifies a project's deployment model and returns the
// primary service that owns shared config (git repo, compose file, Dockerfile).
func projectDeployType(services []App) (deployType string, primary *App) {
	if len(services) == 0 {
		return "", nil
	}
	projectID := services[0].ProjectID
	seed := pickPrimaryAppForProject(projectID, services)

	// Compose: every service belongs to the same compose project.
	composeProjects := map[string]int{}
	for _, s := range services {
		if s.ComposeProject != "" {
			composeProjects[s.ComposeProject]++
		}
	}
	if len(composeProjects) == 1 && composeProjects[""] == 0 {
		for _, s := range services {
			if s.ComposePrimary {
				clone := s
				return "compose", &clone
			}
		}
		clone := seed
		return "compose", &clone
	}

	if len(services) == 1 {
		s := services[0]
		switch s.BuildMethod {
		case "compose":
			return "compose", &s
		case "dockerfile":
			return "dockerfile", &s
		case "dockerfile-inline":
			return "dockerfile-inline", &s
		}
	}
	return "", nil
}

func projectBuildContextDir(primary App) string {
	dir := filepath.Join("builds", primary.ID)
	if primary.RootDir != "" && primary.RootDir != "." && primary.RootDir != "./" {
		if rootDir, err := validateRootDir(primary.RootDir); err == nil {
			dir = filepath.Join(dir, rootDir)
		}
	}
	return dir
}

func readFileIfExists(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return string(data)
}

func resolveComposeContent(primary App) string {
	if strings.TrimSpace(primary.ComposeContent) != "" {
		return primary.ComposeContent
	}
	composeDir := projectBuildContextDir(primary)
	composeFile := strings.TrimSpace(primary.ComposePath)
	if composeFile == "" {
		composeFile = findComposeFile(composeDir)
	}
	if composeFile == "" {
		return ""
	}
	return readFileIfExists(filepath.Join(composeDir, composeFile))
}

func resolveDockerfileContent(primary App) string {
	if strings.TrimSpace(primary.DockerfileContent) != "" {
		return primary.DockerfileContent
	}
	ctxDir := projectBuildContextDir(primary)
	dfPath := strings.TrimSpace(primary.DockerfilePath)
	if dfPath == "" {
		dfPath = "Dockerfile"
	}
	return readFileIfExists(filepath.Join(ctxDir, dfPath))
}

func projectDeployConfig(projectID string) (*ProjectDeployConfig, error) {
	p := findProject(projectID)
	if p == nil {
		return nil, errProjectNotFound
	}
	services := appsForProject(projectID)
	deployType, primary := projectDeployType(services)
	if deployType == "" || primary == nil {
		return nil, errProjectNotConfigurable
	}
	full := findApp(primary.ID)
	if full == nil {
		return nil, errProjectNotConfigurable
	}
	pub := full.Public()
	cfg := &ProjectDeployConfig{
		ProjectID:        projectID,
		DeployType:       deployType,
		PrimaryServiceID: full.ID,
		GitRepo:          pub.GitRepo,
		Branch:           pub.Branch,
		RootDir:          pub.RootDir,
		ComposePath:      pub.ComposePath,
		DockerfilePath:   pub.DockerfilePath,
		EnvVars:          pub.EnvVars,
		SecretKeys:       pub.SecretKeys,
		AutoDeploy:       pub.AutoDeploy,
		ComposeProject:   pub.ComposeProject,
		ServiceCount:     len(services),
	}
	if deployType == "compose" {
		cfg.ComposeContent = resolveComposeContent(*full)
	} else {
		cfg.DockerfileContent = resolveDockerfileContent(*full)
	}
	return cfg, nil
}

var (
	errProjectNotFound        = &configError{"Project not found"}
	errProjectNotConfigurable = &configError{"Project does not have a shared Docker or Compose configuration"}
)

type configError struct{ msg string }

func (e *configError) Error() string { return e.msg }

// applyComposeContentOverride writes a dashboard-edited compose file over the
// cloned/uploaded source before `docker compose up`.
func applyComposeContentOverride(app App, composeDir, composeFile string) error {
	content := strings.TrimSpace(app.ComposeContent)
	if content == "" {
		return nil
	}
	target := filepath.Join(composeDir, composeFile)
	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return err
	}
	return os.WriteFile(target, []byte(content), 0644)
}

// applyDockerfileContentOverride writes a dashboard-edited Dockerfile over the
// cloned source before `docker build`.
func applyDockerfileContentOverride(app App, buildSubDir string) error {
	content := strings.TrimSpace(app.DockerfileContent)
	if content == "" || app.BuildMethod != "dockerfile" {
		return nil
	}
	dfPath := strings.TrimSpace(app.DockerfilePath)
	if dfPath == "" {
		dfPath = "Dockerfile"
	}
	if !safeRelPath(dfPath) {
		return nil
	}
	target := filepath.Join(buildSubDir, dfPath)
	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return err
	}
	return os.WriteFile(target, []byte(content), 0644)
}

func markComposeGroupBuilding(project string) {
	if project == "" {
		return
	}
	for _, r := range composeGroupRows(project) {
		appsLock.Lock()
		for i := range apps {
			if apps[i].ID == r.ID {
				apps[i].Status = "building"
				break
			}
		}
		appsLock.Unlock()
		_ = dbUpdateAppStatus(r.ID, "building")
	}
}

// ---------------------------------------------------------------------------
// GET /api/projects/config?id=
// ---------------------------------------------------------------------------

func handleProjectConfigGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		jsonError(w, "id is required", http.StatusBadRequest)
		return
	}
	cfg, err := projectDeployConfig(id)
	if err == errProjectNotFound {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	if err == errProjectNotConfigurable {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err != nil {
		jsonError(w, "failed to load project config", http.StatusInternalServerError)
		return
	}
	jsonOK(w, cfg)
}

// ---------------------------------------------------------------------------
// POST /api/projects/config/update
// ---------------------------------------------------------------------------

func handleProjectConfigUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ProjectID         string            `json:"projectId"`
		GitRepo           string            `json:"gitRepo"`
		Branch            string            `json:"branch"`
		RootDir           string            `json:"rootDir"`
		ComposePath       string            `json:"composePath"`
		ComposeContent    *string           `json:"composeContent"`
		DockerfilePath    string            `json:"dockerfilePath"`
		DockerfileContent *string           `json:"dockerfileContent"`
		EnvVars           map[string]string `json:"envVars"`
		SecretKeys        []string          `json:"secretKeys"`
		AutoDeploy        *bool             `json:"autoDeploy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.ProjectID == "" {
		jsonError(w, "projectId is required", http.StatusBadRequest)
		return
	}
	if findProject(req.ProjectID) == nil {
		jsonError(w, "Project not found", http.StatusNotFound)
		return
	}

	services := appsForProject(req.ProjectID)
	deployType, primary := projectDeployType(services)
	if deployType == "" || primary == nil {
		jsonError(w, errProjectNotConfigurable.Error(), http.StatusBadRequest)
		return
	}

	rootDir, err := validateRootDir(req.RootDir)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	composePath := primary.ComposePath
	if deployType == "compose" {
		var cpErr error
		composePath, cpErr = validateComposePath(req.ComposePath)
		if cpErr != nil {
			jsonError(w, cpErr.Error(), http.StatusBadRequest)
			return
		}
	}

	appsLock.Lock()
	var updated *App
	for i := range apps {
		if apps[i].ID != primary.ID {
			continue
		}
		if req.GitRepo != "" {
			apps[i].GitRepo = req.GitRepo
		}
		apps[i].Branch = req.Branch
		apps[i].RootDir = rootDir
		if deployType == "compose" {
			apps[i].ComposePath = composePath
			if req.ComposeContent != nil {
				apps[i].ComposeContent = *req.ComposeContent
			}
		}
		if deployType == "dockerfile" || deployType == "dockerfile-inline" {
			if req.DockerfilePath != "" {
				df := req.DockerfilePath
				if _, _, vErr := validateBuildMethod("dockerfile", df); vErr == nil {
					apps[i].DockerfilePath = df
				}
			}
			if req.DockerfileContent != nil {
				apps[i].DockerfileContent = *req.DockerfileContent
			}
		}
		if req.EnvVars != nil {
			apps[i].EnvVars = mergeEnvVars(apps[i].EnvVars, req.EnvVars, req.SecretKeys)
		}
		if req.SecretKeys != nil {
			apps[i].SecretKeys = req.SecretKeys
		}
		if req.AutoDeploy != nil {
			apps[i].AutoDeploy = *req.AutoDeploy
		}
		clone := apps[i].Public()
		updated = &clone
		break
	}
	appsLock.Unlock()

	if updated == nil {
		jsonError(w, "Primary service not found", http.StatusNotFound)
		return
	}
	if full := findApp(primary.ID); full != nil {
		if err := dbSaveApp(*full); err != nil {
			log.Printf("[db] failed to save project config: %v", err)
			jsonError(w, "failed to save configuration", http.StatusInternalServerError)
			return
		}
	}

	rebuildCaddyfile()
	jsonOK(w, updated)

	if req.AutoDeploy != nil && *req.AutoDeploy {
		if full := findApp(primary.ID); full != nil {
			scheduleGitHubWebhookSetup(*full, webhookPublicBaseURL(r), resolvedGitHubToken(*full))
		}
	}
}

// ---------------------------------------------------------------------------
// POST /api/projects/redeploy
// ---------------------------------------------------------------------------

func handleProjectRedeploy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ProjectID string `json:"projectId"`
		NoCache   bool   `json:"noCache"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	if req.ProjectID == "" {
		jsonError(w, "projectId is required", http.StatusBadRequest)
		return
	}
	if findProject(req.ProjectID) == nil {
		jsonError(w, "Project not found", http.StatusNotFound)
		return
	}

	services := appsForProject(req.ProjectID)
	deployType, primary := projectDeployType(services)
	if deployType == "" || primary == nil {
		jsonError(w, errProjectNotConfigurable.Error(), http.StatusBadRequest)
		return
	}

	targetID := primary.ID
	appsLock.Lock()
	var targetApp *App
	for i := range apps {
		if apps[i].ID == targetID {
			apps[i].Status = "building"
			apps[i].URL = defaultAppURL(apps[i].ID, apps[i].ServerID)
			clone := apps[i]
			targetApp = &clone
			break
		}
	}
	appsLock.Unlock()

	if targetApp == nil {
		jsonError(w, "Primary service not found", http.StatusNotFound)
		return
	}

	if targetApp.ComposeProject != "" {
		markComposeGroupBuilding(targetApp.ComposeProject)
	}

	buildLogsLock.Lock()
	buildLogs[targetApp.ID] = []string{}
	buildLogsLock.Unlock()

	deployID := generateRandomID()
	logFile := filepath.Join("data", "logs", targetApp.ID, deployID+".log")
	_ = os.MkdirAll(filepath.Dir(logFile), 0755)
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
