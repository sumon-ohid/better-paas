package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// App catalog — one-click deploys of popular open-source apps
// ---------------------------------------------------------------------------
//
// Each template describes a single prebuilt Docker image that runs as one
// container (no git clone, no Nixpacks build). Deploying a template reuses the
// normal zero-downtime release pipeline with BuildMethod == "image", so catalog
// apps get the same health-checked cutover, Caddy routing, logs, metrics, and
// rollback as git-based apps.
//
// Multi-container stacks (Postgres-backed apps, Supabase, Immich, …) are
// deliberately excluded until Docker Compose support lands; they would mislead
// users by failing. Apps here are intentionally single-container with, at most,
// a persistent volume and some environment variables.
//
// Logos are served from the community "dashboard-icons" CDN (jsDelivr). The
// frontend builds the URL from CatalogTemplate.Icon, so only the slug lives
// here. Every slug below was verified to resolve.

// CatalogEnv describes one environment variable a template accepts.
type CatalogEnv struct {
	Key         string `json:"key"`
	Value       string `json:"value"`       // default value (may be empty)
	Description string `json:"description"` // shown next to the field
	Required    bool   `json:"required"`    // must be non-empty to deploy
	Secret      bool   `json:"secret"`      // mark as a secret env var (redacted)
	Generate    bool   `json:"generate"`    // auto-fill with a random secret when empty
}

// CatalogTemplate is a single one-click deployable app.
type CatalogTemplate struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Category    string       `json:"category"`
	Image       string       `json:"image"`      // pinned registry image
	Port        int          `json:"port"`       // internal container port the app listens on
	VolumePath  string       `json:"volumePath"` // container path to persist (empty = stateless)
	Env         []CatalogEnv `json:"env"`
	HealthPath  string       `json:"healthPath"` // HTTP path probed before cutover (empty = TCP check)
	Website     string       `json:"website"`
	Icon        string       `json:"icon"`  // dashboard-icons slug
	Notes       string       `json:"notes"` // caveats (e.g. needs docker socket)
}

// catalogTemplates is the curated, single-container catalog. Image tags are
// pinned to a major/minor line rather than "latest" so deploys are repeatable.
func catalogTemplates() []CatalogTemplate {
	return []CatalogTemplate{
		// ── Monitoring & status ──────────────────────────────────────────────
		{
			ID:          "uptime-kuma",
			Name:        "Uptime Kuma",
			Description: "Self-hosted uptime monitoring with status pages and alerts.",
			Category:    "Monitoring",
			Image:       "louislam/uptime-kuma:1",
			Port:        3001,
			VolumePath:  "/app/data",
			HealthPath:  "/",
			Website:     "https://github.com/louislam/uptime-kuma",
			Icon:        "uptime-kuma",
		},
		{
			ID:          "dozzle",
			Name:        "Dozzle",
			Description: "Real-time log viewer for your Docker containers.",
			Category:    "Monitoring",
			Image:       "amir20/dozzle:v8",
			Port:        8080,
			HealthPath:  "/",
			Website:     "https://dozzle.dev",
			Icon:        "dozzle",
			Notes:       "Needs read-only access to the Docker socket to read logs. Add a volume mapping /var/run/docker.sock:/var/run/docker.sock:ro after deploy.",
		},
		{
			ID:          "beszel",
			Name:        "Beszel",
			Description: "Lightweight server resource monitoring hub with history and alerts.",
			Category:    "Monitoring",
			Image:       "henrygd/beszel:0",
			Port:        8090,
			VolumePath:  "/beszel_data",
			HealthPath:  "/",
			Website:     "https://beszel.dev",
			Icon:        "beszel",
		},
		{
			ID:          "glances",
			Name:        "Glances",
			Description: "An eye on your system: CPU, memory, disk, network in one web view.",
			Category:    "Monitoring",
			Image:       "nicolargo/glances:latest-full",
			Port:        61208,
			Env: []CatalogEnv{
				{Key: "GLANCES_OPT", Value: "-w", Description: "Run in web-server mode."},
			},
			HealthPath: "/",
			Website:    "https://nicolargo.github.io/glances/",
			Icon:       "glances",
			Notes:      "For full host metrics it needs host PID and the Docker socket; the basic web view works without them.",
		},

		// ── Productivity & notes ──────────────────────────────────────────────
		{
			ID:          "memos",
			Name:        "Memos",
			Description: "A lightweight, privacy-first, self-hosted note-taking service.",
			Category:    "Productivity",
			Image:       "neosmemo/memos:stable",
			Port:        5230,
			VolumePath:  "/var/opt/memos",
			HealthPath:  "/",
			Website:     "https://usememos.com",
			Icon:        "memos",
		},
		{
			ID:          "trilium",
			Name:        "Trilium Notes",
			Description: "Hierarchical note-taking app for building personal knowledge bases.",
			Category:    "Productivity",
			Image:       "triliumnext/notes:latest",
			Port:        8080,
			VolumePath:  "/home/node/trilium-data",
			HealthPath:  "/",
			Website:     "https://github.com/TriliumNext/Notes",
			Icon:        "trilium",
		},
		{
			ID:          "linkding",
			Name:        "Linkding",
			Description: "Minimal, fast self-hosted bookmark manager.",
			Category:    "Productivity",
			Image:       "sissbruecker/linkding:latest",
			Port:        9090,
			VolumePath:  "/etc/linkding/data",
			Env: []CatalogEnv{
				{Key: "LD_SUPERUSER_NAME", Value: "admin", Description: "Initial admin username.", Required: true},
				{Key: "LD_SUPERUSER_PASSWORD", Description: "Initial admin password.", Required: true, Secret: true, Generate: true},
			},
			HealthPath: "/",
			Website:    "https://linkding.link",
			Icon:       "linkding",
		},
		{
			ID:          "actual-budget",
			Name:        "Actual Budget",
			Description: "A local-first personal finance and budgeting app.",
			Category:    "Productivity",
			Image:       "actualbudget/actual-server:latest",
			Port:        5006,
			VolumePath:  "/data",
			HealthPath:  "/",
			Website:     "https://actualbudget.org",
			Icon:        "actual-budget",
		},
		{
			ID:          "freshrss",
			Name:        "FreshRSS",
			Description: "A free, self-hostable RSS feed aggregator (SQLite mode).",
			Category:    "Productivity",
			Image:       "freshrss/freshrss:latest",
			Port:        80,
			VolumePath:  "/var/www/FreshRSS/data",
			HealthPath:  "/",
			Website:     "https://freshrss.org",
			Icon:        "freshrss",
		},

		// ── Notifications ─────────────────────────────────────────────────────
		{
			ID:          "gotify",
			Name:        "Gotify",
			Description: "A simple server for sending and receiving push notifications.",
			Category:    "Notifications",
			Image:       "gotify/server:latest",
			Port:        80,
			VolumePath:  "/app/data",
			HealthPath:  "/",
			Website:     "https://gotify.net",
			Icon:        "gotify",
		},
		{
			ID:          "ntfy",
			Name:        "ntfy",
			Description: "Pub-sub notifications to your phone or desktop over HTTP.",
			Category:    "Notifications",
			Image:       "binwiederhier/ntfy:latest",
			Port:        80,
			VolumePath:  "/var/cache/ntfy",
			Env: []CatalogEnv{
				{Key: "NTFY_BASE_URL", Description: "Public base URL of this server, e.g. https://ntfy.example.com.", Required: false},
			},
			HealthPath: "/",
			Website:    "https://ntfy.sh",
			Icon:       "ntfy",
		},

		// ── Security ──────────────────────────────────────────────────────────
		{
			ID:          "vaultwarden",
			Name:        "Vaultwarden",
			Description: "Lightweight Bitwarden-compatible password manager server.",
			Category:    "Security",
			Image:       "vaultwarden/server:latest",
			Port:        80,
			VolumePath:  "/data",
			Env: []CatalogEnv{
				{Key: "ADMIN_TOKEN", Description: "Token to access the /admin panel.", Required: false, Secret: true, Generate: true},
				{Key: "SIGNUPS_ALLOWED", Value: "true", Description: "Allow new account sign-ups."},
			},
			HealthPath: "/alive",
			Website:    "https://github.com/dani-garcia/vaultwarden",
			Icon:       "vaultwarden",
		},
		{
			ID:          "privatebin",
			Name:        "PrivateBin",
			Description: "Minimalist, zero-knowledge online pastebin.",
			Category:    "Security",
			Image:       "privatebin/nginx-fpm-alpine:stable",
			Port:        8080,
			VolumePath:  "/srv/data",
			HealthPath:  "/",
			Website:     "https://privatebin.info",
			Icon:        "privatebin",
		},

		// ── Developer tools & utilities ───────────────────────────────────────
		{
			ID:          "it-tools",
			Name:        "IT Tools",
			Description: "A handy collection of tools for developers (stateless).",
			Category:    "Utilities",
			Image:       "corentinth/it-tools:latest",
			Port:        80,
			HealthPath:  "/",
			Website:     "https://it-tools.tech",
			Icon:        "it-tools",
		},
		{
			ID:          "cyberchef",
			Name:        "CyberChef",
			Description: "The cyber swiss-army knife for encoding, encryption and analysis.",
			Category:    "Utilities",
			Image:       "mpepping/cyberchef:latest",
			Port:        8000,
			HealthPath:  "/",
			Website:     "https://github.com/gchq/CyberChef",
			Icon:        "cyberchef",
		},
		{
			ID:          "excalidraw",
			Name:        "Excalidraw",
			Description: "Virtual whiteboard for sketching hand-drawn style diagrams (stateless).",
			Category:    "Utilities",
			Image:       "excalidraw/excalidraw:latest",
			Port:        80,
			HealthPath:  "/",
			Website:     "https://excalidraw.com",
			Icon:        "excalidraw",
		},
		{
			ID:          "stirling-pdf",
			Name:        "Stirling PDF",
			Description: "A powerful, locally-hosted web-based PDF manipulation toolkit.",
			Category:    "Utilities",
			Image:       "stirlingtools/stirling-pdf:latest",
			Port:        8080,
			VolumePath:  "/configs",
			HealthPath:  "/",
			Website:     "https://stirlingpdf.com",
			Icon:        "stirling-pdf",
		},
		{
			ID:          "filebrowser",
			Name:        "File Browser",
			Description: "A web-based file manager for a directory on your server.",
			Category:    "Utilities",
			Image:       "filebrowser/filebrowser:latest",
			Port:        80,
			VolumePath:  "/srv",
			HealthPath:  "/",
			Website:     "https://filebrowser.org",
			Icon:        "filebrowser",
			Notes:       "Default login is admin / admin — change it immediately after first sign-in.",
		},
		{
			ID:          "libretranslate",
			Name:        "LibreTranslate",
			Description: "Free and open-source machine translation API, fully self-hosted.",
			Category:    "Utilities",
			Image:       "libretranslate/libretranslate:latest",
			Port:        5000,
			VolumePath:  "/home/libretranslate/.local",
			HealthPath:  "/",
			Website:     "https://libretranslate.com",
			Icon:        "libretranslate",
			Notes:       "First start downloads language models and may take a few minutes to become healthy.",
		},

		// ── Media ─────────────────────────────────────────────────────────────
		{
			ID:          "jellyfin",
			Name:        "Jellyfin",
			Description: "The free software media system for streaming your own library.",
			Category:    "Media",
			Image:       "jellyfin/jellyfin:latest",
			Port:        8096,
			VolumePath:  "/config",
			HealthPath:  "/health",
			Website:     "https://jellyfin.org",
			Icon:        "jellyfin",
			Notes:       "Mount your media as an extra volume after deploy (e.g. /path/to/media:/media).",
		},
		{
			ID:          "navidrome",
			Name:        "Navidrome",
			Description: "Modern music server and streamer compatible with Subsonic clients.",
			Category:    "Media",
			Image:       "deluan/navidrome:latest",
			Port:        4533,
			VolumePath:  "/data",
			HealthPath:  "/",
			Website:     "https://navidrome.org",
			Icon:        "navidrome",
			Notes:       "Mount your music as an extra volume after deploy (e.g. /path/to/music:/music:ro).",
		},
		{
			ID:          "calibre-web",
			Name:        "Calibre-Web",
			Description: "A clean web app for browsing and reading your eBook library.",
			Category:    "Media",
			Image:       "linuxserver/calibre-web:latest",
			Port:        8083,
			VolumePath:  "/config",
			HealthPath:  "/",
			Website:     "https://github.com/janeczku/calibre-web",
			Icon:        "calibre-web",
		},
	}
}

// findCatalogTemplate returns the template with the given ID, or nil.
func findCatalogTemplate(id string) *CatalogTemplate {
	for _, t := range catalogTemplates() {
		if t.ID == id {
			tpl := t
			return &tpl
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// GET /api/catalog — list available one-click templates
// ---------------------------------------------------------------------------

func handleCatalog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jsonOK(w, catalogTemplates())
}

// ---------------------------------------------------------------------------
// POST /api/catalog/deploy — deploy a catalog template in one click
// ---------------------------------------------------------------------------

func handleCatalogDeploy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		TemplateID string            `json:"templateId"`
		Name       string            `json:"name"`
		EnvVars    map[string]string `json:"envVars"`
		Domains    []string          `json:"domains"`
		Memory     string            `json:"memory"`
		CPUs       string            `json:"cpus"`
		ServerID   string            `json:"serverId"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
		return
	}

	tpl := findCatalogTemplate(req.TemplateID)
	if tpl == nil {
		jsonError(w, "Unknown catalog template", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = tpl.ID
	}
	if !validAppName(name) {
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

	// ── Resolve env vars: start from template defaults, then apply overrides,
	// auto-generate any "generate" secrets left empty, and enforce "required".
	envVars := map[string]string{}
	var secretKeys []string
	for _, e := range tpl.Env {
		val := e.Value
		if ov, ok := req.EnvVars[e.Key]; ok {
			val = strings.TrimSpace(ov)
		}
		if val == "" && e.Generate {
			val = addonPassword() // 24-char hex secret
		}
		if val == "" && e.Required {
			jsonError(w, fmt.Sprintf("%s is required", e.Key), http.StatusBadRequest)
			return
		}
		if val != "" {
			envVars[e.Key] = val
			if e.Secret {
				secretKeys = append(secretKeys, e.Key)
			}
		}
	}

	// ── Persistent volume: generate a uniquely-named volume so redeploys keep
	// data. Stateless templates (no VolumePath) get none.
	appsLock.Lock()
	appID := generateRandomID()
	taken := make(map[string]bool, len(apps))
	for _, a := range apps {
		taken[a.Name] = true
	}
	name = uniqueAppName(name, taken)
	var volumes []string
	if tpl.VolumePath != "" {
		volName := fmt.Sprintf("paas-%s-%s-data", name, generateRandomID()[:6])
		volumes = append(volumes, fmt.Sprintf("%s:%s", volName, tpl.VolumePath))
	}
	newApp := App{
		ID:            appID,
		Name:          name,
		Status:        "building",
		Port:          allocatePort(serverID),
		ServerID:      serverID,
		CreatedAt:     time.Now(),
		EnvVars:       envVars,
		SecretKeys:    secretKeys,
		PortOverride:  tpl.Port,
		Domains:       req.Domains,
		Memory:        req.Memory,
		CPUs:          req.CPUs,
		Volumes:       volumes,
		HealthPath:    tpl.HealthPath,
		BuildMethod:   "image",
		Image:         tpl.Image,
		CatalogID:     tpl.ID,
		WebhookSecret: generateRandomID() + generateRandomID(),
	}
	newApp.URL = fmt.Sprintf("http://%s.%s.sslip.io", newApp.ID, appHostIP(serverID))
	apps = append(apps, newApp)
	appsLock.Unlock()

	if err := dbSaveApp(newApp); err != nil {
		log.Printf("[db] failed to save catalog app: %v", err)
	}

	buildLogsLock.Lock()
	buildLogs[appID] = []string{}
	buildLogsLock.Unlock()

	rebuildCaddyfile()

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
		Trigger:   "catalog",
	}
	if err := dbCreateDeployment(dep); err != nil {
		log.Printf("[db] failed to create deployment: %v", err)
	}

	jsonOK(w, newApp.Public())

	// Image-based deploy: gitURL is unused.
	go runDeployment(newApp, "", deployID, logFile, "catalog", "")
}

// ---------------------------------------------------------------------------
// Shared helpers for custom (non-template) deploys
// ---------------------------------------------------------------------------

// customDeployCommon holds the fields shared by the image and Dockerfile custom
// deploy endpoints.
type customDeployCommon struct {
	Name       string            `json:"name"`
	EnvVars    map[string]string `json:"envVars"`
	SecretKeys []string          `json:"secretKeys"`
	Domains    []string          `json:"domains"`
	Memory     string            `json:"memory"`
	CPUs       string            `json:"cpus"`
	Volumes    []string          `json:"volumes"`
	Port       int               `json:"port"`
	HealthPath string            `json:"healthPath"`
	ServerID   string            `json:"serverId"`
}

// validateCustomDeploy validates the common fields and returns a resolved app
// name, or writes an error response and returns ok=false.
func validateCustomDeploy(w http.ResponseWriter, c customDeployCommon, fallbackName string) (string, bool) {
	name := strings.TrimSpace(c.Name)
	if name == "" {
		name = fallbackName
	}
	if !validAppName(name) {
		jsonError(w, "invalid name: use 2-40 lowercase letters, digits, or hyphens (must start and end alphanumeric)", http.StatusBadRequest)
		return "", false
	}
	serverID := c.ServerID
	if serverID == "" {
		serverID = "localhost"
	}
	if err := validateResourceLimits(c.Memory, c.CPUs); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return "", false
	}
	if err := validateDomains(c.Domains); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return "", false
	}
	if err := validateVolumes(c.Volumes); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return "", false
	}
	return name, true
}

// cleanEnvVars drops blank keys and returns the secret keys that actually
// correspond to a provided variable.
func cleanEnvVars(in map[string]string, secretKeys []string) (map[string]string, []string) {
	out := map[string]string{}
	for k, v := range in {
		k = strings.TrimSpace(k)
		if k == "" {
			continue
		}
		out[k] = v
	}
	secret := map[string]bool{}
	for _, k := range secretKeys {
		secret[strings.TrimSpace(k)] = true
	}
	var keys []string
	for k := range out {
		if secret[k] {
			keys = append(keys, k)
		}
	}
	return out, keys
}

// startCustomDeploy persists a new app and kicks off the deploy pipeline. It
// assumes the caller has already validated name, limits, domains, and volumes.
func startCustomDeploy(w http.ResponseWriter, newApp App, trigger string) {
	appsLock.Lock()
	taken := make(map[string]bool, len(apps))
	for _, a := range apps {
		taken[a.Name] = true
	}
	newApp.Name = uniqueAppName(newApp.Name, taken)
	newApp.URL = fmt.Sprintf("http://%s.%s.sslip.io", newApp.ID, appHostIP(newApp.ServerID))
	apps = append(apps, newApp)
	appsLock.Unlock()

	if err := dbSaveApp(newApp); err != nil {
		log.Printf("[db] failed to save custom app: %v", err)
	}

	buildLogsLock.Lock()
	buildLogs[newApp.ID] = []string{}
	buildLogsLock.Unlock()

	rebuildCaddyfile()

	deployID := generateRandomID()
	logFile := filepath.Join("data", "logs", newApp.ID, deployID+".log")
	os.MkdirAll(filepath.Dir(logFile), 0755)
	dep := DeploymentRecord{
		ID:        deployID,
		AppID:     newApp.ID,
		AppName:   newApp.Name,
		Status:    "building",
		LogFile:   logFile,
		CreatedAt: time.Now(),
		Trigger:   trigger,
	}
	if err := dbCreateDeployment(dep); err != nil {
		log.Printf("[db] failed to create deployment: %v", err)
	}

	jsonOK(w, newApp.Public())
	go runDeployment(newApp, "", deployID, logFile, trigger, "")
}

// ---------------------------------------------------------------------------
// POST /api/catalog/deploy-image — deploy any registry image
// ---------------------------------------------------------------------------

func handleCatalogDeployImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		customDeployCommon
		Image string `json:"image"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
		return
	}

	image, err := validateImageRef(req.Image)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Derive a fallback app name from the image (e.g. ghcr.io/owner/app:tag → app).
	fallback := imageBaseName(image)
	name, ok := validateCustomDeploy(w, req.customDeployCommon, fallback)
	if !ok {
		return
	}

	envVars, secretKeys := cleanEnvVars(req.EnvVars, req.SecretKeys)

	serverId := req.ServerID
	if serverId == "" {
		serverId = "localhost"
	}
	newApp := App{
		ID:            generateRandomID(),
		Name:          name,
		Status:        "building",
		Port:          allocatePortLocked(serverId),
		ServerID:      serverId,
		CreatedAt:     time.Now(),
		EnvVars:       envVars,
		SecretKeys:    secretKeys,
		PortOverride:  req.Port,
		Domains:       req.Domains,
		Memory:        req.Memory,
		CPUs:          req.CPUs,
		Volumes:       req.Volumes,
		HealthPath:    req.HealthPath,
		BuildMethod:   "image",
		Image:         image,
		WebhookSecret: generateRandomID() + generateRandomID(),
	}
	startCustomDeploy(w, newApp, "image")
}

// ---------------------------------------------------------------------------
// POST /api/catalog/deploy-dockerfile — build & run an inline Dockerfile
// ---------------------------------------------------------------------------

func handleCatalogDeployDockerfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		customDeployCommon
		Dockerfile string `json:"dockerfile"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
		return
	}

	content := strings.TrimSpace(req.Dockerfile)
	if content == "" {
		jsonError(w, "dockerfile content is required", http.StatusBadRequest)
		return
	}
	if len(content) > 64*1024 {
		jsonError(w, "dockerfile is too large (max 64 KB)", http.StatusBadRequest)
		return
	}
	if !strings.Contains(strings.ToUpper(content), "FROM ") {
		jsonError(w, "dockerfile must contain a FROM instruction", http.StatusBadRequest)
		return
	}

	name, ok := validateCustomDeploy(w, req.customDeployCommon, "app")
	if !ok {
		return
	}

	envVars, secretKeys := cleanEnvVars(req.EnvVars, req.SecretKeys)

	serverId := req.ServerID
	if serverId == "" {
		serverId = "localhost"
	}
	newApp := App{
		ID:                generateRandomID(),
		Name:              name,
		Status:            "building",
		Port:              allocatePortLocked(serverId),
		ServerID:          serverId,
		CreatedAt:         time.Now(),
		EnvVars:           envVars,
		SecretKeys:        secretKeys,
		PortOverride:      req.Port,
		Domains:           req.Domains,
		Memory:            req.Memory,
		CPUs:              req.CPUs,
		Volumes:           req.Volumes,
		HealthPath:        req.HealthPath,
		BuildMethod:       "dockerfile-inline",
		DockerfileContent: content,
		WebhookSecret:     generateRandomID() + generateRandomID(),
	}
	startCustomDeploy(w, newApp, "dockerfile")
}

// imageBaseName extracts a usable app-name seed from an image reference by
// taking the last path segment and stripping any tag/digest, then sanitizing.
func imageBaseName(image string) string {
	s := image
	if at := strings.Index(s, "@"); at >= 0 {
		s = s[:at]
	}
	// Take the final path segment.
	if slash := strings.LastIndex(s, "/"); slash >= 0 {
		s = s[slash+1:]
	}
	// Strip the tag.
	if colon := strings.Index(s, ":"); colon >= 0 {
		s = s[:colon]
	}
	s = strings.ToLower(s)
	// Keep only allowed characters.
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			b.WriteRune(r)
		}
	}
	out := strings.Trim(b.String(), "-")
	if len(out) < 2 {
		return "app"
	}
	if len(out) > 40 {
		out = strings.Trim(out[:40], "-")
	}
	return out
}

// allocatePortLocked acquires appsLock and allocates a free host port. The
// underlying allocatePort requires the caller to hold appsLock.
func allocatePortLocked(serverID string) int {
	appsLock.Lock()
	defer appsLock.Unlock()
	return allocatePort(serverID)
}
