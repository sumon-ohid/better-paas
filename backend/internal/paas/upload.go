package paas

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	maxUploadBody      = 500 << 20 // 500 MiB total request
	maxUploadFiles     = 10000
	maxUploadFileBytes = 100 << 20 // 100 MiB per file
)

// isUploadSource reports whether an app was deployed from uploaded files rather
// than a git repository.
func isUploadSource(gitRepo string) bool {
	return strings.HasPrefix(gitRepo, "upload://")
}

func uploadGitRepo(appID string) string {
	return "upload://" + appID
}

// deployUploadConfig mirrors the JSON deploy payload minus git fields.
type deployUploadConfig struct {
	ProjectID      string            `json:"projectId"`
	Name           string            `json:"name"`
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
	BuildMethod    string            `json:"buildMethod"`
	DockerfilePath string            `json:"dockerfilePath"`
	ComposePath    string            `json:"composePath"`
	ServerID       string            `json:"serverId"`
}

func parseDeployUploadConfig(r *http.Request) (deployUploadConfig, error) {
	raw := strings.TrimSpace(r.FormValue("config"))
	if raw == "" {
		return deployUploadConfig{}, fmt.Errorf("config field is required")
	}
	var cfg deployUploadConfig
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return deployUploadConfig{}, fmt.Errorf("invalid config JSON: %w", err)
	}
	return cfg, nil
}

func validateDeployUploadConfig(cfg deployUploadConfig, requireProject bool) (deployUploadConfig, string, string, string, string, string, error) {
	if requireProject && cfg.ProjectID == "" {
		return cfg, "", "", "", "", "", fmt.Errorf("projectId is required")
	}
	if cfg.Name == "" {
		return cfg, "", "", "", "", "", fmt.Errorf("name is required")
	}
	if !validAppName(cfg.Name) {
		return cfg, "", "", "", "", "", fmt.Errorf("invalid name: use 2-40 lowercase letters, digits, or hyphens (must start and end alphanumeric)")
	}

	var proj *Project
	if requireProject {
		proj = findProject(cfg.ProjectID)
		if proj == nil {
			return cfg, "", "", "", "", "", fmt.Errorf("Project not found")
		}
	}

	serverID := cfg.ServerID
	if serverID == "" {
		if proj != nil && proj.ServerID != "" {
			serverID = proj.ServerID
		} else {
			serverID = "localhost"
		}
	}

	if err := validateResourceLimits(cfg.Memory, cfg.CPUs); err != nil {
		return cfg, "", "", "", "", "", err
	}
	if err := validateDomains(cfg.Domains); err != nil {
		return cfg, "", "", "", "", "", err
	}
	if err := validateVolumes(cfg.Volumes); err != nil {
		return cfg, "", "", "", "", "", err
	}
	rootDir, err := validateRootDir(cfg.RootDir)
	if err != nil {
		return cfg, "", "", "", "", "", err
	}
	buildMethod, dockerfilePath, err := validateBuildMethod(cfg.BuildMethod, cfg.DockerfilePath)
	if err != nil {
		return cfg, "", "", "", "", "", err
	}
	composePath, err := validateComposePath(cfg.ComposePath)
	if err != nil {
		return cfg, "", "", "", "", "", err
	}
	return cfg, serverID, rootDir, buildMethod, dockerfilePath, composePath, nil
}

func materializeUpload(buildDir string, r *http.Request) error {
	if err := os.RemoveAll(buildDir); err != nil {
		return fmt.Errorf("failed to prepare build directory: %w", err)
	}
	if err := os.MkdirAll(buildDir, 0755); err != nil {
		return fmt.Errorf("failed to create build directory: %w", err)
	}

	if archive, archiveHeader, err := r.FormFile("archive"); err == nil {
		defer archive.Close()
		if archiveHeader.Size > maxUploadBody {
			return fmt.Errorf("archive exceeds maximum upload size (%d MiB)", maxUploadBody>>20)
		}
		name := strings.ToLower(archiveHeader.Filename)
		if strings.HasSuffix(name, ".zip") {
			return extractZipUpload(buildDir, archive, archiveHeader.Size)
		}
		return fmt.Errorf("unsupported archive format %q (use .zip)", archiveHeader.Filename)
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		return fmt.Errorf("upload an archive (.zip) or one or more files")
	}
	if len(files) > maxUploadFiles {
		return fmt.Errorf("too many files (max %d)", maxUploadFiles)
	}

	paths := r.MultipartForm.Value["paths"]
	if len(paths) != len(files) {
		return fmt.Errorf("paths count (%d) must match files count (%d)", len(paths), len(files))
	}

	stripRoot := commonUploadRootPrefix(paths)

	for i, fh := range files {
		if fh.Size > maxUploadFileBytes {
			return fmt.Errorf("file %q exceeds maximum size (%d MiB)", fh.Filename, maxUploadFileBytes>>20)
		}
		rel := strings.TrimSpace(paths[i])
		if rel == "" {
			rel = fh.Filename
		}
		rel = filepath.ToSlash(rel)
		if stripRoot != "" && (rel == stripRoot || strings.HasPrefix(rel, stripRoot+"/")) {
			rel = strings.TrimPrefix(strings.TrimPrefix(rel, stripRoot), "/")
		}
		if rel == "" {
			rel = filepath.Base(fh.Filename)
		}
		destPath, err := safeUploadPath(buildDir, rel)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return fmt.Errorf("failed to create directory for %q: %w", rel, err)
		}
		src, err := fh.Open()
		if err != nil {
			return fmt.Errorf("failed to read uploaded file %q: %w", rel, err)
		}
		if err := writeUploadFile(destPath, src); err != nil {
			src.Close()
			return err
		}
		src.Close()
	}
	return nil
}

// commonUploadRootPrefix strips a shared top-level folder when every path shares
// one (e.g. "my-app/src/index.js" → "src/index.js").
func commonUploadRootPrefix(paths []string) string {
	if len(paths) == 0 {
		return ""
	}
	var root string
	for _, p := range paths {
		p = filepath.ToSlash(strings.TrimSpace(p))
		if p == "" {
			return ""
		}
		seg := strings.SplitN(p, "/", 2)[0]
		if root == "" {
			root = seg
		} else if root != seg {
			return ""
		}
	}
	if root == "" {
		return ""
	}
	return root
}

func writeUploadFile(dest string, src io.Reader) error {
	out, err := os.OpenFile(dest, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return fmt.Errorf("failed to write %q: %w", dest, err)
	}
	defer out.Close()
	if _, err := io.Copy(out, src); err != nil {
		return fmt.Errorf("failed to write %q: %w", dest, err)
	}
	return nil
}

func safeUploadPath(baseDir, relPath string) (string, error) {
	relPath = strings.TrimSpace(relPath)
	relPath = strings.TrimPrefix(relPath, "/")
	relPath = filepath.ToSlash(relPath)
	if relPath == "" || !safeRelPath(relPath) {
		return "", fmt.Errorf("invalid upload path %q", relPath)
	}
	abs, err := filepath.Abs(filepath.Join(baseDir, relPath))
	if err != nil {
		return "", fmt.Errorf("invalid upload path %q", relPath)
	}
	baseAbs, err := filepath.Abs(baseDir)
	if err != nil {
		return "", fmt.Errorf("invalid build directory")
	}
	if abs != baseAbs && !strings.HasPrefix(abs, baseAbs+string(os.PathSeparator)) {
		return "", fmt.Errorf("invalid upload path %q: escapes build directory", relPath)
	}
	return abs, nil
}

func extractZipUpload(dest string, r io.Reader, size int64) error {
	data, err := io.ReadAll(io.LimitReader(r, maxUploadBody+1))
	if err != nil {
		return fmt.Errorf("failed to read archive: %w", err)
	}
	if int64(len(data)) > maxUploadBody {
		return fmt.Errorf("archive exceeds maximum upload size (%d MiB)", maxUploadBody>>20)
	}
	return extractZipReader(dest, data)
}

func extractZipReader(dest string, data []byte) error {
	zr, err := zip.NewReader(readerAt(data), int64(len(data)))
	if err != nil {
		return fmt.Errorf("invalid zip archive: %w", err)
	}
	if len(zr.File) > maxUploadFiles {
		return fmt.Errorf("archive contains too many files (max %d)", maxUploadFiles)
	}

	stripRoot := ""
	for _, f := range zr.File {
		name := filepath.ToSlash(f.Name)
		if strings.HasSuffix(name, "/") {
			continue
		}
		if strings.HasPrefix(name, "__MACOSX/") {
			continue
		}
		seg := strings.SplitN(name, "/", 2)[0]
		if stripRoot == "" {
			stripRoot = seg
		} else if stripRoot != seg {
			stripRoot = ""
			break
		}
	}

	written := 0
	for _, f := range zr.File {
		name := filepath.ToSlash(f.Name)
		if strings.HasSuffix(name, "/") || strings.HasPrefix(name, "__MACOSX/") {
			continue
		}
		rel := name
		if stripRoot != "" && (rel == stripRoot || strings.HasPrefix(rel, stripRoot+"/")) {
			rel = strings.TrimPrefix(strings.TrimPrefix(rel, stripRoot), "/")
		}
		if rel == "" {
			continue
		}
		destPath, err := safeUploadPath(dest, rel)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return fmt.Errorf("failed to create directory for %q: %w", rel, err)
		}
		if f.UncompressedSize64 > uint64(maxUploadFileBytes) {
			return fmt.Errorf("file %q in archive exceeds maximum size (%d MiB)", rel, maxUploadFileBytes>>20)
		}
		rc, err := f.Open()
		if err != nil {
			return fmt.Errorf("failed to read %q from archive: %w", rel, err)
		}
		if err := writeUploadFile(destPath, io.LimitReader(rc, maxUploadFileBytes+1)); err != nil {
			rc.Close()
			return err
		}
		rc.Close()
		written++
	}
	if written == 0 {
		return fmt.Errorf("archive contains no files")
	}
	return nil
}

type readerAt []byte

func (b readerAt) ReadAt(p []byte, off int64) (int, error) {
	if off >= int64(len(b)) {
		return 0, io.EOF
	}
	return copy(p, b[off:]), nil
}

func createUploadApp(cfg deployUploadConfig, serverID, rootDir, buildMethod, dockerfilePath, composePath, containerName string, projectID string) App {
	appID := generateRandomID()
	gitRepo := uploadGitRepo(appID)
	newApp := App{
		ID:             appID,
		Name:           containerName,
		Status:         "building",
		GitRepo:        gitRepo,
		Branch:         "",
		Port:           allocatePort(serverID),
		CreatedAt:      time.Now(),
		RootDir:        rootDir,
		EnvVars:        cfg.EnvVars,
		BuildCommand:   cfg.BuildCommand,
		StartCommand:   cfg.StartCommand,
		InstallCommand: cfg.InstallCommand,
		PortOverride:   cfg.PortOverride,
		Domains:        cfg.Domains,
		Memory:         cfg.Memory,
		CPUs:           cfg.CPUs,
		Volumes:        cfg.Volumes,
		HealthPath:     cfg.HealthPath,
		SecretKeys:     cfg.SecretKeys,
		AutoDeploy:     false,
		BuildMethod:    buildMethod,
		DockerfilePath: dockerfilePath,
		ComposePath:    composePath,
		WebhookSecret:  generateRandomID() + generateRandomID(),
		ServerID:       serverID,
	}
	newApp.URL = defaultAppURL(newApp.ID, serverID)
	if projectID != "" {
		newApp.ProjectID = projectID
		newApp.ServiceName = cfg.Name
	} else {
		newApp.ProjectID = appID
		newApp.ServiceName = cfg.Name
	}
	return newApp
}

func startUploadDeployment(w http.ResponseWriter, newApp App) {
	appsLock.Lock()
	apps = append(apps, newApp)
	appsLock.Unlock()

	if newApp.ProjectID == newApp.ID {
		ensureProjectForApp(newApp, newApp.ServiceName)
	}

	if err := dbSaveApp(newApp); err != nil {
		log.Printf("[db] failed to save app: %v", err)
	}

	buildLogsLock.Lock()
	buildLogs[newApp.ID] = []string{}
	buildLogsLock.Unlock()

	rebuildCaddyfile()

	deployID := generateRandomID()
	logFile := filepath.Join("data", "logs", newApp.ID, deployID+".log")
	_ = os.MkdirAll(filepath.Dir(logFile), 0755)

	dep := DeploymentRecord{
		ID:        deployID,
		AppID:     newApp.ID,
		AppName:   newApp.Name,
		Status:    "building",
		LogFile:   logFile,
		CreatedAt: time.Now(),
	}
	if err := dbCreateDeployment(dep); err != nil {
		log.Printf("[db] failed to create deployment: %v", err)
	}

	jsonOK(w, newApp.Public())
	go runDeployment(newApp, newApp.GitRepo, deployID, logFile, "upload", "", false)
}

// POST /api/deploy/upload
func handleDeployUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := r.ParseMultipartForm(maxUploadBody); err != nil {
		jsonError(w, "Failed to parse upload: "+err.Error(), http.StatusBadRequest)
		return
	}

	cfg, err := parseDeployUploadConfig(r)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	cfg, serverID, rootDir, buildMethod, dockerfilePath, composePath, err := validateDeployUploadConfig(cfg, false)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	appsLock.Lock()
	taken := make(map[string]bool, len(apps))
	for _, a := range apps {
		taken[a.Name] = true
	}
	containerName := uniqueAppName(cfg.Name, taken)
	appsLock.Unlock()

	newApp := createUploadApp(cfg, serverID, rootDir, buildMethod, dockerfilePath, composePath, containerName, "")
	buildDir := filepath.Join("builds", newApp.ID)
	if err := materializeUpload(buildDir, r); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	startUploadDeployment(w, newApp)
}

// POST /api/projects/services/deploy/upload
func handleProjectServiceDeployUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := r.ParseMultipartForm(maxUploadBody); err != nil {
		jsonError(w, "Failed to parse upload: "+err.Error(), http.StatusBadRequest)
		return
	}

	cfg, err := parseDeployUploadConfig(r)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	cfg, serverID, rootDir, buildMethod, dockerfilePath, composePath, err := validateDeployUploadConfig(cfg, true)
	if err != nil {
		code := http.StatusBadRequest
		if err.Error() == "Project not found" {
			code = http.StatusNotFound
		}
		jsonError(w, err.Error(), code)
		return
	}

	proj := findProject(cfg.ProjectID)
	appsLock.Lock()
	taken := make(map[string]bool, len(apps))
	for _, a := range apps {
		taken[a.Name] = true
	}
	containerName := uniqueAppName(proj.Name+"-"+cfg.Name, taken)
	appsLock.Unlock()

	newApp := createUploadApp(cfg, serverID, rootDir, buildMethod, dockerfilePath, composePath, containerName, proj.ID)
	buildDir := filepath.Join("builds", newApp.ID)
	if err := materializeUpload(buildDir, r); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	startUploadDeployment(w, newApp)
}
