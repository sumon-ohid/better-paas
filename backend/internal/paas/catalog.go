package paas

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	catalogdata "paas/internal/catalog"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// App catalog - one-click deploys of popular open-source apps
// ---------------------------------------------------------------------------
//
// Each template describes a single prebuilt Docker image that runs as one
// container (no git clone, no Nixpacks build). Deploying a template reuses the
// normal zero-downtime release pipeline with BuildMethod == "image", so catalog
// apps get the same health-checked cutover, Caddy routing, logs, metrics, and
// rollback as git-based apps.
//
// Apps here are intentionally single-container with, at most, persistent
// volumes and environment variables. Templates that need a database/cache expose
// the required connection settings so users can pair them with Better PaaS
// add-ons until first-class compose-style stacks land.
//
// Logos are served from the community "dashboard-icons" CDN (jsDelivr). The
// frontend builds the URL from CatalogTemplate.Icon and falls back gracefully if
// a community icon slug disappears or is renamed.

type CatalogEnv = catalogdata.Env
type CatalogRequiredAddon = catalogdata.RequiredAddon
type CatalogTemplate = catalogdata.Template

// ---------------------------------------------------------------------------
// Image-size cache - fetches compressed sizes from Docker Hub in the background
// ---------------------------------------------------------------------------

var (
	imageSizeCache   = map[string]string{}
	imageSizeCacheMu sync.RWMutex
)

// fetchImageSizes populates the in-memory cache with compressed sizes for every
// catalog template. It runs once at startup in its own goroutine so it never
// blocks the server from starting. Five concurrent workers are used so all
// ~50 templates are resolved in ~2 s instead of the ~10 s it would take
// sequentially.
func fetchImageSizes() {
	templates := catalogTemplates()

	type job struct{ image string }
	jobs := make(chan job, len(templates))
	for _, tpl := range templates {
		jobs <- job{tpl.Image}
	}
	close(jobs)

	const workers = 5
	var wg sync.WaitGroup
	wg.Add(workers)
	for range workers {
		go func() {
			defer wg.Done()
			for j := range jobs {
				size := fetchImageSize(j.image)
				if size != "" {
					imageSizeCacheMu.Lock()
					imageSizeCache[j.image] = size
					imageSizeCacheMu.Unlock()
				}
			}
		}()
	}
	wg.Wait()
	log.Printf("[catalog] image sizes fetched for %d templates", len(templates))
}

// fetchImageSize returns a human-readable compressed pull size for any image
// reference we support (Docker Hub, lscr.io/linuxserver, ghcr.io). Returns ""
// when the registry is unsupported or the lookup fails.
func fetchImageSize(imageRef string) string {
	switch {
	case strings.Contains(imageRef, "lscr.io"):
		return fetchLinuxserverSize(imageRef)
	case strings.Contains(imageRef, "ghcr.io"):
		return fetchGHCRSize(imageRef)
	case strings.Contains(imageRef, "quay.io"):
		return "" // quay.io API requires auth - skip
	default:
		return fetchDockerHubSize(imageRef)
	}
}

// fetchDockerHubSize resolves a Docker Hub image ("namespace/repo:tag" or
// "repo:tag" for official library images) via the Hub v2 REST API.
func fetchDockerHubSize(imageRef string) string {
	// Parse "[namespace/]name:tag" - defaults to library/ and latest.
	ref := imageRef
	tag := "latest"
	if idx := strings.LastIndex(ref, ":"); idx != -1 {
		tag = ref[idx+1:]
		ref = ref[:idx]
	}

	var namespace, repo string
	parts := strings.SplitN(ref, "/", 2)
	if len(parts) == 1 {
		namespace = "library"
		repo = parts[0]
	} else {
		namespace = parts[0]
		repo = parts[1]
	}

	url := fmt.Sprintf("https://hub.docker.com/v2/repositories/%s/%s/tags/%s", namespace, repo, tag)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil || resp.StatusCode != http.StatusOK {
		return ""
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result struct {
		FullSize int64 `json:"full_size"`
	}
	if err := json.Unmarshal(body, &result); err != nil || result.FullSize == 0 {
		return ""
	}
	return formatBytes(result.FullSize)
}

// fetchLinuxserverSize handles lscr.io/linuxserver/{name}:{tag} images.
// LinuxServer images are published to Docker Hub as linuxserver/{name}, so we
// can reuse the Hub API by stripping the lscr.io/linuxserver prefix.
func fetchLinuxserverSize(imageRef string) string {
	// lscr.io/linuxserver/bookstack:latest → linuxserver/bookstack:latest
	suffix := strings.TrimPrefix(imageRef, "lscr.io/")
	return fetchDockerHubSize(suffix)
}

// fetchGHCRSize resolves a ghcr.io image size via the OCI Distribution API.
// Public images only require an anonymous Bearer token issued by ghcr.io itself.
func fetchGHCRSize(imageRef string) string {
	// Parse ghcr.io/{owner}/{repo}:{tag}
	withoutRegistry := strings.TrimPrefix(imageRef, "ghcr.io/")
	tag := "latest"
	if idx := strings.LastIndex(withoutRegistry, ":"); idx != -1 {
		tag = withoutRegistry[idx+1:]
		withoutRegistry = withoutRegistry[:idx]
	}

	client := &http.Client{Timeout: 10 * time.Second}

	// Step 1: obtain anonymous pull token.
	tokenURL := fmt.Sprintf("https://ghcr.io/token?scope=repository:%s:pull&service=ghcr.io", withoutRegistry)
	tresp, err := client.Get(tokenURL)
	if err != nil || tresp.StatusCode != http.StatusOK {
		return ""
	}
	defer tresp.Body.Close()
	tbody, _ := io.ReadAll(tresp.Body)
	var tok struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(tbody, &tok); err != nil || tok.Token == "" {
		return ""
	}

	// Step 2: fetch the manifest (prefer manifest-list for multi-arch images).
	manifestURL := fmt.Sprintf("https://ghcr.io/v2/%s/manifests/%s", withoutRegistry, tag)
	mreq, _ := http.NewRequest(http.MethodGet, manifestURL, nil)
	mreq.Header.Set("Authorization", "Bearer "+tok.Token)
	// Accept both manifest lists (multi-arch) and single-arch manifests.
	mreq.Header.Set("Accept",
		"application/vnd.oci.image.index.v1+json,"+
			"application/vnd.docker.distribution.manifest.list.v2+json,"+
			"application/vnd.oci.image.manifest.v1+json,"+
			"application/vnd.docker.distribution.manifest.v2+json")

	mresp, err := client.Do(mreq)
	if err != nil || mresp.StatusCode != http.StatusOK {
		return ""
	}
	defer mresp.Body.Close()
	mbody, _ := io.ReadAll(mresp.Body)

	// A manifest list contains per-platform manifests - each has a size field
	// that is the total compressed size of that image variant. We pick the
	// first linux/amd64 entry, or the first entry if no amd64 is present.
	var manifestList struct {
		Manifests []struct {
			Size     int64 `json:"size"`
			Platform struct {
				OS   string `json:"os"`
				Arch string `json:"architecture"`
			} `json:"platform"`
		} `json:"manifests"`
	}
	if err := json.Unmarshal(mbody, &manifestList); err == nil && len(manifestList.Manifests) > 0 {
		// Try to find a single-manifest size embedded in the list entries.
		// Note: these sizes are the manifest JSON blob, not the image layers.
		// Fall through to the single-manifest path for accurate layer sizes.
		_ = manifestList // parsed but we prefer the single-manifest path below
	}

	// A single-arch manifest contains a config blob size + per-layer sizes.
	var manifest struct {
		Config struct {
			Size int64 `json:"size"`
		} `json:"config"`
		Layers []struct {
			Size int64 `json:"size"`
		} `json:"layers"`
	}
	if err := json.Unmarshal(mbody, &manifest); err == nil && len(manifest.Layers) > 0 {
		var total int64
		for _, l := range manifest.Layers {
			total += l.Size
		}
		if total > 0 {
			return formatBytes(total)
		}
	}

	// For manifest lists, resolve the linux/amd64 child manifest.
	if len(manifestList.Manifests) > 0 {
		var picked *struct {
			Digest string `json:"-"` // unused
		}
		_ = picked
		// Re-parse with digest field for child resolution.
		var mlist struct {
			Manifests []struct {
				Digest   string `json:"digest"`
				Platform struct {
					OS   string `json:"os"`
					Arch string `json:"architecture"`
				} `json:"platform"`
			} `json:"manifests"`
		}
		if err := json.Unmarshal(mbody, &mlist); err == nil {
			digest := ""
			for _, m := range mlist.Manifests {
				if m.Platform.OS == "linux" && m.Platform.Arch == "amd64" {
					digest = m.Digest
					break
				}
			}
			if digest == "" && len(mlist.Manifests) > 0 {
				digest = mlist.Manifests[0].Digest
			}
			if digest != "" {
				return fetchGHCRManifestByDigest(client, tok.Token, withoutRegistry, digest)
			}
		}
	}
	return ""
}

// fetchGHCRManifestByDigest fetches a specific manifest by digest and returns
// the total compressed layer size.
func fetchGHCRManifestByDigest(client *http.Client, token, repo, digest string) string {
	url := fmt.Sprintf("https://ghcr.io/v2/%s/manifests/%s", repo, digest)
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept",
		"application/vnd.oci.image.manifest.v1+json,"+
			"application/vnd.docker.distribution.manifest.v2+json")
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return ""
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var manifest struct {
		Layers []struct {
			Size int64 `json:"size"`
		} `json:"layers"`
	}
	if err := json.Unmarshal(body, &manifest); err != nil {
		return ""
	}
	var total int64
	for _, l := range manifest.Layers {
		total += l.Size
	}
	if total == 0 {
		return ""
	}
	return formatBytes(total)
}

// formatBytes converts a byte count into a short human-readable string.
func formatBytes(b int64) string {
	const mb = 1024 * 1024
	const gb = 1024 * mb
	switch {
	case b >= gb:
		return fmt.Sprintf("~%.1f GB", float64(b)/float64(gb))
	case b >= mb:
		return fmt.Sprintf("~%d MB", b/mb)
	default:
		return fmt.Sprintf("~%d KB", b/1024)
	}
}

func catalogTemplates() []CatalogTemplate {
	return catalogdata.Templates()
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
// GET /api/catalog - list available one-click templates
// ---------------------------------------------------------------------------

func handleCatalog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	templates := catalogTemplates()
	imageSizeCacheMu.RLock()
	for i := range templates {
		if sz, ok := imageSizeCache[templates[i].Image]; ok {
			templates[i].ImageSize = sz
		}
	}
	imageSizeCacheMu.RUnlock()
	jsonOK(w, templates)
}

// ---------------------------------------------------------------------------
// POST /api/catalog/deploy - deploy a catalog template in one click
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

	appID := generateRandomID()

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
	serverID := normalizeServerID(req.ServerID)
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
	var createdAddons []Addon
	autoEnv := map[string]string{}
	for _, required := range tpl.RequiredAddons {
		addonName := uniqueCatalogAddonName(name, required.Type)
		addon, password, err := createManagedAddon(required.Type, addonName, serverID)
		if err != nil {
			jsonError(w, fmt.Sprintf("failed to create %s add-on: %v", required.Type, err), http.StatusBadRequest)
			return
		}
		createdAddons = append(createdAddons, *addon)
		for k, v := range catalogTemplateAddonEnv(tpl.ID, *addon, password) {
			autoEnv[k] = v
		}
	}

	// Derive public URL for templates that need it
	appURL := defaultAppURL(appID, serverID)
	if len(req.Domains) > 0 {
		appURL = "https://" + req.Domains[0]
	}
	if tpl.ID == "mixpost" || tpl.ID == "trypost" {
		autoEnv["APP_URL"] = appURL
	}
	if tpl.ID == "seonaut" {
		autoEnv["SEONAUT_SERVER_URL"] = appURL
	}
	for _, e := range tpl.Env {
		val := e.Value
		if auto, ok := autoEnv[e.Key]; ok {
			val = auto
		}
		if ov, ok := req.EnvVars[e.Key]; ok && strings.TrimSpace(ov) != "" {
			val = strings.TrimSpace(ov)
		}
		if val == "" && e.Generate {
			if e.Key == "APP_KEY" {
				val = laravelAppKey()
			} else {
				val = addonPassword() // 24-char hex secret
			}
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

	// ── Persistent volumes: generate uniquely-named volumes so redeploys keep
	// data. Stateless templates get none.
	appsLock.Lock()
	taken := make(map[string]bool, len(apps))
	for _, a := range apps {
		taken[a.Name] = true
	}
	name = uniqueAppName(name, taken)
	var volumes []string
	volumePaths := append([]string{}, tpl.VolumePaths...)
	if tpl.VolumePath != "" {
		volumePaths = append([]string{tpl.VolumePath}, volumePaths...)
	}
	for i, path := range volumePaths {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		volName := fmt.Sprintf("paas-%s-%s-%d-data", name, generateRandomID()[:6], i+1)
		volumes = append(volumes, fmt.Sprintf("%s:%s", volName, path))
	}
	if tpl.ID == "dozzle" {
		volumes = append(volumes, "/var/run/docker.sock:/var/run/docker.sock:ro")
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
		StartCommand:  tpl.StartCommand,
		CatalogID:     tpl.ID,
		ProjectID:     appID,
		ServiceName:   name,
		WebhookSecret: generateRandomID() + generateRandomID(),
	}
	newApp.URL = defaultAppURL(newApp.ID, serverID)
	apps = append(apps, newApp)
	appsLock.Unlock()

	ensureProjectForApp(newApp, name)

	if err := dbSaveApp(newApp); err != nil {
		log.Printf("[db] failed to save catalog app: %v", err)
	}
	for _, addon := range createdAddons {
		markAddonAttached(addon.ID, appID)
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
	go runDeployment(newApp, "", deployID, logFile, "catalog", "", false)
}

func uniqueCatalogAddonName(appName, addonType string) string {
	base := appName + "-" + addonType
	if len(base) > 40 {
		maxAppLen := 40 - len(addonType) - 1
		if maxAppLen < 2 {
			maxAppLen = 2
		}
		base = strings.TrimRight(appName[:min(len(appName), maxAppLen)], "-") + "-" + addonType
	}
	if validAppName(base) {
		return base
	}
	return addonType + "-" + generateRandomID()[:6]
}

func catalogTemplateAddonEnv(templateID string, addon Addon, password string) map[string]string {
	base := catalogAddonEnv(addon, password)
	out := map[string]string{}
	switch templateID {
	case "wordpress":
		if addon.Type == "mysql" {
			out["WORDPRESS_DB_HOST"] = base["MYSQL_HOST"]
			out["WORDPRESS_DB_USER"] = base["MYSQL_USER"]
			out["WORDPRESS_DB_PASSWORD"] = base["MYSQL_PASSWORD"]
			out["WORDPRESS_DB_NAME"] = base["MYSQL_DATABASE"]
		}
	case "yourls":
		if addon.Type == "mysql" {
			out["YOURLS_DB_HOST"] = base["MYSQL_HOST"]
			out["YOURLS_DB_USER"] = base["MYSQL_USER"]
			out["YOURLS_DB_PASS"] = base["MYSQL_PASSWORD"]
			out["YOURLS_DB_NAME"] = base["MYSQL_DATABASE"]
		}
	case "paperless-ngx":
		if addon.Type == "redis" {
			out["PAPERLESS_REDIS"] = base["REDIS_URL"]
		}
	case "listmonk":
		if addon.Type == "postgres" {
			out["LISTMONK_db__host"] = base["POSTGRES_HOST"]
			out["LISTMONK_db__user"] = base["POSTGRES_USER"]
			out["LISTMONK_db__password"] = base["POSTGRES_PASSWORD"]
			out["LISTMONK_db__database"] = base["POSTGRES_DB"]
			out["LISTMONK_db__port"] = "5432"
			out["LISTMONK_db__sslmode"] = "disable"
			out["LISTMONK_app__address"] = "0.0.0.0:9000"
		}
	case "bookstack":
		if addon.Type == "mysql" {
			out["DB_HOST"] = base["MYSQL_HOST"]
			out["DB_USER"] = base["MYSQL_USER"]
			out["DB_PASS"] = base["MYSQL_PASSWORD"]
			out["DB_DATABASE"] = base["MYSQL_DATABASE"]
		}
	case "semaphore":
		if addon.Type == "postgres" {
			out["SEMAPHORE_DB_DIALECT"] = "postgres"
			out["SEMAPHORE_DB_HOST"] = base["POSTGRES_HOST"]
			out["SEMAPHORE_DB_PORT"] = "5432"
			out["SEMAPHORE_DB_USER"] = base["POSTGRES_USER"]
			out["SEMAPHORE_DB_PASS"] = base["POSTGRES_PASSWORD"]
			out["SEMAPHORE_DB"] = base["POSTGRES_DB"]
		}
	case "mixpost":
		if addon.Type == "mysql" {
			out["DB_HOST"] = base["MYSQL_HOST"]
			out["DB_PORT"] = "3306"
			out["DB_DATABASE"] = base["MYSQL_DATABASE"]
			out["DB_USERNAME"] = base["MYSQL_USER"]
			out["DB_PASSWORD"] = base["MYSQL_PASSWORD"]
			out["DB_CONNECTION"] = "mysql"
		} else if addon.Type == "redis" {
			out["REDIS_HOST"] = base["REDIS_HOST"]
			out["REDIS_PORT"] = "6379"
			out["REDIS_PASSWORD"] = base["REDIS_PASSWORD"]
		}
	case "trypost":
		if addon.Type == "postgres" {
			out["DB_HOST"] = base["POSTGRES_HOST"]
			out["DB_PORT"] = "5432"
			out["DB_DATABASE"] = base["POSTGRES_DB"]
			out["DB_USERNAME"] = base["POSTGRES_USER"]
			out["DB_PASSWORD"] = base["POSTGRES_PASSWORD"]
			out["DB_CONNECTION"] = "pgsql"
		} else if addon.Type == "redis" {
			out["REDIS_URL"] = base["REDIS_URL"]
			out["REDIS_HOST"] = base["REDIS_HOST"]
			out["REDIS_PORT"] = "6379"
			out["REDIS_USERNAME"] = "default"
			out["REDIS_PASSWORD"] = base["REDIS_PASSWORD"]
		}
	case "matomo":
		if addon.Type == "mysql" {
			out["MATOMO_DATABASE_HOST"] = base["MYSQL_HOST"]
			out["MATOMO_DATABASE_DBNAME"] = base["MYSQL_DATABASE"]
			out["MATOMO_DATABASE_USERNAME"] = base["MYSQL_USER"]
			out["MATOMO_DATABASE_PASSWORD"] = base["MYSQL_PASSWORD"]
		}
	case "prestashop":
		if addon.Type == "mysql" {
			out["DB_SERVER"] = base["MYSQL_HOST"]
			out["DB_NAME"] = base["MYSQL_DATABASE"]
			out["DB_USER"] = base["MYSQL_USER"]
			out["DB_PASSWD"] = base["MYSQL_PASSWORD"]
		}
	case "seonaut":
		if addon.Type == "mysql" {
			out["SEONAUT_DATABASE_SERVER"] = base["MYSQL_HOST"]
			out["SEONAUT_DATABASE_PORT"] = "3306"
			out["SEONAUT_DATABASE_USER"] = base["MYSQL_USER"]
			out["SEONAUT_DATABASE_PASSWORD"] = base["MYSQL_PASSWORD"]
			out["SEONAUT_DATABASE_DATABASE"] = base["MYSQL_DATABASE"]
		}
	case "seopanel":
		if addon.Type == "mysql" {
			out["MYSQL_DB_HOST"] = base["MYSQL_HOST"]
			out["MYSQL_USER"] = base["MYSQL_USER"]
			out["MYSQL_PASSWORD"] = base["MYSQL_PASSWORD"]
			out["MYSQL_DATABASE"] = base["MYSQL_DATABASE"]
			out["MYSQL_ROOT_PASSWORD"] = base["MYSQL_PASSWORD"]
		}
	default:
		for k, v := range base {
			out[k] = v
		}
	}
	return out
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
	newApp.URL = defaultAppURL(newApp.ID, newApp.ServerID)
	if newApp.ProjectID == "" {
		newApp.ProjectID = newApp.ID
	}
	if newApp.ServiceName == "" {
		newApp.ServiceName = newApp.Name
	}
	apps = append(apps, newApp)
	appsLock.Unlock()

	ensureProjectForApp(newApp, newApp.Name)

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
	go runDeployment(newApp, "", deployID, logFile, trigger, "", false)
}

// ---------------------------------------------------------------------------
// POST /api/catalog/deploy-image - deploy any registry image
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
// POST /api/catalog/deploy-dockerfile - build & run an inline Dockerfile
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

func laravelAppKey() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "base64:yS4U+ZJ3bYFqHl+3XmS7w9uXo4G6Z9d3Y5U+W8e7rNs="
	}
	return "base64:" + base64.StdEncoding.EncodeToString(b)
}
