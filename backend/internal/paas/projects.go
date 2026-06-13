package paas

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const projectsDir = "projects"

func projectDir(id string) string {
	return filepath.Join(projectsDir, id)
}

func ensureProjectDir(id string) error {
	return os.MkdirAll(projectDir(id), 0755)
}

func findProject(id string) *Project {
	projectsLock.Lock()
	defer projectsLock.Unlock()
	for i := range projects {
		if projects[i].ID == id {
			clone := projects[i]
			return &clone
		}
	}
	return nil
}

func appsForProject(projectID string) []App {
	appsLock.Lock()
	defer appsLock.Unlock()
	var out []App
	for _, a := range apps {
		if a.ProjectID == projectID {
			out = append(out, a)
		}
	}
	return out
}

func aggregateProjectStatus(services []App) string {
	if len(services) == 0 {
		return "stopped"
	}
	worst := services[0].Status
	for _, s := range services[1:] {
		if statusPriority(s.Status) < statusPriority(worst) {
			worst = s.Status
		}
	}
	return worst
}

func statusPriority(status string) int {
	switch status {
	case "building":
		return 0
	case "failed":
		return 1
	case "running":
		return 2
	case "stopped":
		return 3
	default:
		return 4
	}
}

func projectSummary(p Project) ProjectSummary {
	services := appsForProject(p.ID)
	hasGit, hasDocker := projectSourceFlags(services)
	status := aggregateProjectStatus(services)
	return ProjectSummary{
		Project:         p,
		ServiceCount:    len(services),
		Status:          status,
		HasGit:          hasGit,
		HasDocker:       hasDocker,
		LastServiceAt:   latestServiceTime(services),
		FocusServiceID:  focusServiceForStatus(services, status),
		ServiceStatuses: projectServiceStatuses(services),
	}
}

func projectServiceStatuses(services []App) []ProjectServiceStatus {
	if len(services) == 0 {
		return nil
	}
	out := make([]ProjectServiceStatus, 0, len(services))
	for _, s := range services {
		name := strings.TrimSpace(s.ServiceName)
		if name == "" {
			name = strings.TrimSpace(s.ComposeService)
		}
		if name == "" {
			name = s.Name
		}
		out = append(out, ProjectServiceStatus{
			ID:     s.ID,
			Name:   name,
			Status: s.Status,
		})
	}
	return out
}

func latestServiceTime(services []App) *time.Time {
	var latest *time.Time
	for _, s := range services {
		if latest == nil || s.CreatedAt.After(*latest) {
			t := s.CreatedAt
			latest = &t
		}
	}
	return latest
}

func focusServiceForStatus(services []App, status string) string {
	for _, s := range services {
		if s.Status == status {
			return s.ID
		}
	}
	if len(services) > 0 {
		return services[0].ID
	}
	return ""
}

func projectSourceFlags(services []App) (hasGit, hasDocker bool) {
	for _, s := range services {
		if strings.TrimSpace(s.GitRepo) != "" {
			hasGit = true
		}
		if serviceUsesDocker(s) {
			hasDocker = true
		}
	}
	return hasGit, hasDocker
}

func serviceUsesDocker(a App) bool {
	if strings.TrimSpace(a.Image) != "" || strings.TrimSpace(a.CatalogID) != "" {
		return true
	}
	if a.ComposeProject != "" {
		return true
	}
	switch a.BuildMethod {
	case "image", "dockerfile", "compose":
		return true
	}
	return false
}

func uniqueProjectName(base string, taken map[string]bool) string {
	name := base
	if !taken[name] {
		return name
	}
	for i := 2; i < 1000; i++ {
		candidate := base + "-" + strconv.Itoa(i)
		if !taken[candidate] {
			return candidate
		}
	}
	return base + "-" + generateRandomID()[:6]
}

func takenProjectNames() map[string]bool {
	taken := make(map[string]bool, len(projects))
	for _, p := range projects {
		taken[p.Name] = true
	}
	return taken
}

func dbSaveProject(p Project) error {
	_, err := sqliteDB.Exec(`
		INSERT INTO projects (id, name, description, created_at, server_id)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name,
			description=excluded.description,
			server_id=excluded.server_id
	`, p.ID, p.Name, p.Description, p.CreatedAt, p.ServerID)
	return err
}

func dbDeleteProject(id string) error {
	_, err := sqliteDB.Exec(`DELETE FROM projects WHERE id = ?`, id)
	return err
}

func persistProject(p Project) error {
	projectsLock.Lock()
	found := false
	for i := range projects {
		if projects[i].ID == p.ID {
			projects[i] = p
			found = true
			break
		}
	}
	if !found {
		projects = append(projects, p)
	}
	projectsLock.Unlock()
	return dbSaveProject(p)
}

func createEmptyProject(name, description, serverID string) (Project, error) {
	if serverID == "" {
		serverID = "localhost"
	}
	projectsLock.Lock()
	taken := takenProjectNames()
	resolved := uniqueProjectName(name, taken)
	id := generateRandomID()
	p := Project{
		ID:          id,
		Name:        resolved,
		Description: strings.TrimSpace(description),
		CreatedAt:   time.Now(),
		ServerID:    serverID,
	}
	projects = append(projects, p)
	projectsLock.Unlock()

	if err := ensureProjectDir(p.ID); err != nil {
		return Project{}, err
	}
	if err := dbSaveProject(p); err != nil {
		return Project{}, err
	}
	return p, nil
}

// migrateAppsToProjectsIfNeeded backfills projects for apps deployed before the
// Project model existed.
func migrateAppsToProjectsIfNeeded() {
	appsLock.Lock()
	defer appsLock.Unlock()
	projectsLock.Lock()
	defer projectsLock.Unlock()

	needsMigration := false
	for _, a := range apps {
		if a.ProjectID == "" {
			needsMigration = true
			break
		}
	}
	if !needsMigration {
		return
	}

	projectByID := make(map[string]Project, len(projects))
	for _, p := range projects {
		projectByID[p.ID] = p
	}

	composeBuckets := map[string][]int{}
	for i, a := range apps {
		if a.ProjectID != "" {
			continue
		}
		if a.ComposeProject != "" {
			composeBuckets[a.ComposeProject] = append(composeBuckets[a.ComposeProject], i)
		}
	}

	for _, idxs := range composeBuckets {
		primaryIdx := -1
		for _, i := range idxs {
			if apps[i].ComposePrimary {
				primaryIdx = i
				break
			}
		}
		if primaryIdx < 0 && len(idxs) > 0 {
			primaryIdx = idxs[0]
		}
		primary := apps[primaryIdx]
		if _, ok := projectByID[primary.ID]; !ok {
			p := Project{
				ID:        primary.ID,
				Name:      primary.Name,
				CreatedAt: primary.CreatedAt,
				ServerID:  primary.ServerID,
			}
			projects = append(projects, p)
			projectByID[p.ID] = p
			_ = ensureProjectDir(p.ID)
			_ = dbSaveProject(p)
		}
		for _, i := range idxs {
			apps[i].ProjectID = primary.ID
			if apps[i].ServiceName == "" {
				if apps[i].ComposeService != "" {
					apps[i].ServiceName = apps[i].ComposeService
				} else {
					apps[i].ServiceName = apps[i].Name
				}
			}
			_ = dbSaveApp(apps[i])
		}
	}

	for i := range apps {
		if apps[i].ProjectID != "" {
			continue
		}
		if apps[i].ComposeProject != "" {
			continue
		}
		p := Project{
			ID:        apps[i].ID,
			Name:      apps[i].Name,
			CreatedAt: apps[i].CreatedAt,
			ServerID:  apps[i].ServerID,
		}
		if _, ok := projectByID[p.ID]; !ok {
			projects = append(projects, p)
			projectByID[p.ID] = p
			_ = ensureProjectDir(p.ID)
			_ = dbSaveProject(p)
		}
		apps[i].ProjectID = p.ID
		if apps[i].ServiceName == "" {
			apps[i].ServiceName = apps[i].Name
		}
		_ = dbSaveApp(apps[i])
	}

	log.Printf("[db] Migrated %d apps to projects (%d projects total)", len(apps), len(projects))
}

// ---------------------------------------------------------------------------
// GET /api/projects
// ---------------------------------------------------------------------------

func handleProjectsList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	projectsLock.Lock()
	snapshot := make([]Project, len(projects))
	copy(snapshot, projects)
	projectsLock.Unlock()

	out := make([]ProjectSummary, 0, len(snapshot))
	for _, p := range snapshot {
		out = append(out, projectSummary(p))
	}
	jsonOK(w, out)
}

// ---------------------------------------------------------------------------
// GET /api/projects/get?id=
// ---------------------------------------------------------------------------

func handleProjectGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		jsonError(w, "id is required", http.StatusBadRequest)
		return
	}
	p := findProject(id)
	if p == nil {
		jsonError(w, "Project not found", http.StatusNotFound)
		return
	}

	services := appsForProject(id)
	public := make([]App, len(services))
	for i, s := range services {
		public[i] = s.Public()
		if dep, err := dbGetLatestDeployment(public[i].ID); err == nil && dep != nil {
			public[i].ActiveCommit = dep.Commit
			public[i].ActiveCommitMsg = dep.CommitMsg
		}
	}

	summary := projectSummary(*p)
	jsonOK(w, ProjectDetail{
		ProjectSummary: summary,
		Services:       public,
	})
}

// ---------------------------------------------------------------------------
// POST /api/projects/create
// ---------------------------------------------------------------------------

func handleProjectCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		ServerID    string `json:"serverId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || !validAppName(name) {
		jsonError(w, "invalid name: use 2-40 lowercase letters, digits, or hyphens", http.StatusBadRequest)
		return
	}
	description := strings.TrimSpace(req.Description)
	if len(description) > 500 {
		jsonError(w, "description must be 500 characters or fewer", http.StatusBadRequest)
		return
	}

	p, err := createEmptyProject(name, description, req.ServerID)
	if err != nil {
		jsonError(w, "failed to create project", http.StatusInternalServerError)
		return
	}
	jsonOK(w, projectSummary(p))
}

// ---------------------------------------------------------------------------
// POST /api/projects/rename
// ---------------------------------------------------------------------------

func handleProjectRename(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	if req.ID == "" || !validAppName(strings.TrimSpace(req.Name)) {
		jsonError(w, "invalid id or name", http.StatusBadRequest)
		return
	}

	projectsLock.Lock()
	var target *Project
	taken := takenProjectNames()
	delete(taken, "") // noop safety
	for i := range projects {
		if projects[i].ID == req.ID {
			target = &projects[i]
			delete(taken, projects[i].Name)
			break
		}
	}
	if target == nil {
		projectsLock.Unlock()
		jsonError(w, "Project not found", http.StatusNotFound)
		return
	}
	target.Name = uniqueProjectName(strings.TrimSpace(req.Name), taken)
	projectsLock.Unlock()

	if err := dbSaveProject(*target); err != nil {
		jsonError(w, "failed to rename project", http.StatusInternalServerError)
		return
	}
	jsonOK(w, projectSummary(*target))
}

// ---------------------------------------------------------------------------
// POST /api/projects/delete
// ---------------------------------------------------------------------------

func handleProjectDelete(w http.ResponseWriter, r *http.Request) {
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
	p := findProject(req.ID)
	if p == nil {
		jsonError(w, "Project not found", http.StatusNotFound)
		return
	}

	services := appsForProject(req.ID)
	for _, s := range services {
		if s.ComposeProject != "" {
			deleteComposeGroup(s)
			break
		}
	}
	// Re-fetch in case compose delete removed siblings.
	services = appsForProject(req.ID)
	for _, s := range services {
		deleteSingleApp(s)
	}

	projectsLock.Lock()
	filtered := projects[:0]
	for _, proj := range projects {
		if proj.ID != req.ID {
			filtered = append(filtered, proj)
		}
	}
	projects = filtered
	projectsLock.Unlock()

	_ = dbDeleteProject(req.ID)
	_ = os.RemoveAll(projectDir(req.ID))

	jsonOK(w, map[string]string{"status": "deleted"})
}

// deleteSingleApp removes one non-compose service (shared helper).
func deleteSingleApp(app App) {
	stopRuntimeLogCapture(app.ID)
	if ex, err := GetExecutorForServer(app.ServerID); err == nil {
		if sshEx, ok := ex.(*SSHExecutor); ok {
			defer sshEx.Close()
		}
		_, _ = ex.RunCommand("docker", "rm", "-f", app.containerName())
		_, _ = ex.RunCommand("docker", "rm", "-f", app.Name)
	}
	appsLock.Lock()
	filtered := apps[:0]
	for _, a := range apps {
		if a.ID != app.ID {
			filtered = append(filtered, a)
		}
	}
	apps = filtered
	appsLock.Unlock()
	_ = dbDeleteApp(app.ID)
	rebuildCaddyfile()
}

// ---------------------------------------------------------------------------
// POST /api/projects/services/deploy
// ---------------------------------------------------------------------------

func handleProjectServiceDeploy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ProjectID      string            `json:"projectId"`
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

	if req.ProjectID == "" {
		jsonError(w, "projectId is required", http.StatusBadRequest)
		return
	}
	proj := findProject(req.ProjectID)
	if proj == nil {
		jsonError(w, "Project not found", http.StatusNotFound)
		return
	}
	if req.Name == "" || req.GitRepo == "" {
		jsonError(w, "name and gitRepo are required", http.StatusBadRequest)
		return
	}
	if !validAppName(req.Name) {
		jsonError(w, "invalid service name", http.StatusBadRequest)
		return
	}

	serverID := req.ServerID
	if serverID == "" {
		serverID = proj.ServerID
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
	containerName := uniqueAppName(proj.Name+"-"+req.Name, taken)
	serviceName := req.Name
	newApp := App{
		ID:             appID,
		Name:           containerName,
		ServiceName:    serviceName,
		ProjectID:      proj.ID,
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
		WebhookSecret:  generateRandomID() + generateRandomID(),
		ServerID:       serverID,
	}
	newApp.URL = defaultAppURL(newApp.ID, serverID)
	apps = append(apps, newApp)
	appsLock.Unlock()

	if err := dbSaveApp(newApp); err != nil {
		log.Printf("[db] failed to save app: %v", err)
	}

	buildLogsLock.Lock()
	buildLogs[appID] = []string{}
	buildLogsLock.Unlock()

	rebuildCaddyfile()

	deployID := generateRandomID()
	logFile := filepath.Join("data", "logs", appID, deployID+".log")
	_ = os.MkdirAll(filepath.Dir(logFile), 0755)
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

	if gitToken != "" && req.AutoDeploy {
		scheduleGitHubWebhookSetup(newApp, webhookPublicBaseURL(r), gitToken)
	}
	go runPaaSDeployment(newApp, gitURL, deployID, logFile)
}

// ensureProjectForApp creates the project record for a newly deployed standalone
// or compose-primary app (project id == primary app id).
func ensureProjectForApp(app App, projectName string) {
	name := strings.TrimSpace(projectName)
	if name == "" {
		name = app.Name
	}
	p := Project{
		ID:        app.ID,
		Name:      name,
		CreatedAt: app.CreatedAt,
		ServerID:  app.ServerID,
	}
	_ = ensureProjectDir(p.ID)
	_ = persistProject(p)
}
