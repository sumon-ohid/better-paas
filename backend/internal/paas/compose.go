package paas

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Docker Compose support
// ---------------------------------------------------------------------------
//
// A compose deploy runs the user's compose file as a SINGLE docker compose
// project (named "paas-<appID>") but surfaces it in the dashboard as one App
// row per service. Each row resolves to exactly one container, so every
// single-container subsystem (Caddy routing, terminal, cron, runtime logs,
// metrics) keeps working unchanged — the row IS the container.
//
// We let compose own the hard parts (build graph, service-name DNS via the
// project's default network, depends_on ordering, named volumes, ${VAR}
// interpolation). The platform only controls which services are web-facing and
// which host port each web service binds to, via a generated override file.

// composeFileCandidates are the compose filenames we look for, in priority
// order, matching docker compose's own resolution.
var composeFileCandidates = []string{
	"compose.yaml", "compose.yml",
	"docker-compose.yaml", "docker-compose.yml",
}

// composeProjectName returns the docker compose project name (the group key)
// for an app. appID is already constrained to lowercase alphanumerics, which
// satisfies compose's project-name charset.
func composeProjectName(appID string) string {
	return "paas-" + appID
}

// findComposeFile returns the name of a compose file in dir (preferring the
// canonical names), or "" if none exists.
func findComposeFile(dir string) string {
	for _, name := range composeFileCandidates {
		if _, err := os.Stat(filepath.Join(dir, name)); err == nil {
			return name
		}
	}
	return ""
}

// ---------------------------------------------------------------------------
// Parsing (via `docker compose config --format json`)
// ---------------------------------------------------------------------------

// composeConfig is the subset of `docker compose config --format json` we use.
type composeConfig struct {
	Name     string                          `json:"name"`
	Services map[string]composeServiceConfig `json:"services"`
}

type composeServiceConfig struct {
	Image       string                 `json:"image"`
	Environment map[string]interface{} `json:"environment"`
	Ports       []composePort          `json:"ports"`
}

type composePort struct {
	Target    int    `json:"target"`    // container port
	Published string `json:"published"` // host port (string; may be "" or a range)
	Protocol  string `json:"protocol"`
}

// composeService is the platform's classified view of one compose service.
type composeService struct {
	Name          string // compose service name (e.g. "web")
	Image         string // resolved image (may be "" for build-only services)
	Web           bool   // web-facing: gets a URL + Caddy route + host port
	ContainerPort int    // the in-container port to route to (web services only)
	HadPublished  bool   // the original file published a host port for this service
}

// parseComposeConfig runs `docker compose config` to fully resolve the compose
// file (interpolation, extends, defaults) and returns the parsed config. The
// command runs with cwd=composeDir so relative build contexts resolve, and with
// env so ${VAR} interpolation can use the app's env vars.
func parseComposeConfig(composeDir, composeFile, project string, env []string) (*composeConfig, error) {
	cmd := exec.Command("docker", "compose", "-p", project, "-f", composeFile, "config", "--format", "json")
	cmd.Dir = composeDir
	cmd.Env = append(os.Environ(), env...)
	out, err := cmd.Output()
	if err != nil {
		msg := err.Error()
		if ee, ok := err.(*exec.ExitError); ok && len(ee.Stderr) > 0 {
			msg = strings.TrimSpace(string(ee.Stderr))
		}
		return nil, fmt.Errorf("failed to parse compose file: %s", msg)
	}
	var cfg composeConfig
	if err := json.Unmarshal(out, &cfg); err != nil {
		return nil, fmt.Errorf("failed to read compose config: %w", err)
	}
	if len(cfg.Services) == 0 {
		return nil, fmt.Errorf("compose file defines no services")
	}
	return &cfg, nil
}

// dbServiceImageRe matches images of common databases/caches/search/queues that
// must never be treated as web-facing, even when they publish a port.
var dbServiceImageRe = regexp.MustCompile(`(?i)(^|/)(postgres|postgis|mysql|mariadb|percona|redis|valkey|keydb|mongo|mongodb|memcached|cassandra|scylla|cockroach|clickhouse|influxdb|timescale|elasticsearch|opensearch|rabbitmq|kafka|zookeeper|nats|etcd|minio)(:|$)`)

// dbServiceNameRe matches service names that conventionally denote a datastore.
var dbServiceNameRe = regexp.MustCompile(`(?i)^(db|database|postgres|postgresql|pg|mysql|mariadb|redis|valkey|cache|mongo|mongodb|memcached|rabbitmq|amqp|broker|queue|elasticsearch|opensearch|search|kafka|zookeeper|clickhouse|minio)$`)

// dbServicePorts are well-known datastore ports; a service exposing only these
// is treated as a backing service, not a web app.
var dbServicePorts = map[int]bool{
	5432: true, 3306: true, 6379: true, 27017: true, 11211: true,
	5672: true, 15672: true, 9200: true, 9300: true, 9092: true,
	2181: true, 8123: true, 9000: true, 26257: true, 6333: true,
}

// isDatabaseService reports whether a service is a backing datastore/cache that
// should never be auto-routed as a web service.
func isDatabaseService(name, image string) bool {
	if dbServiceImageRe.MatchString(image) {
		return true
	}
	if dbServiceNameRe.MatchString(strings.TrimSpace(name)) {
		return true
	}
	return false
}

func composeDatabaseType(name string, svc composeServiceConfig) string {
	text := strings.ToLower(strings.TrimSpace(name) + " " + strings.TrimSpace(svc.Image))
	hasPort := func(port int) bool {
		for _, p := range svc.Ports {
			if p.Target == port {
				return true
			}
		}
		return false
	}

	if strings.Contains(text, "postgres") || strings.Contains(text, "postgis") || hasPort(5432) {
		return "postgres"
	}
	if strings.Contains(text, "mysql") || strings.Contains(text, "mariadb") || strings.Contains(text, "percona") || hasPort(3306) {
		return "mysql"
	}
	if strings.Contains(text, "redis") || strings.Contains(text, "valkey") || hasPort(6379) {
		return "redis"
	}
	return ""
}

func composeEnvValue(env map[string]interface{}, key, fallback string) string {
	if env == nil {
		return fallback
	}
	if v, ok := env[key]; ok && v != nil {
		s := strings.TrimSpace(fmt.Sprint(v))
		if s != "" {
			return s
		}
	}
	return fallback
}

// classifyComposeServices turns a parsed config into the platform's service
// list, deciding which services are web-facing. A service is web-facing when it
// publishes at least one port AND is not a recognized datastore/cache (and the
// published port isn't a well-known DB port). Services are returned sorted by
// name for stable ordering.
func classifyComposeServices(cfg *composeConfig) []composeService {
	names := make([]string, 0, len(cfg.Services))
	for name := range cfg.Services {
		names = append(names, name)
	}
	sort.Strings(names)

	var out []composeService
	for _, name := range names {
		svc := cfg.Services[name]
		info := composeService{Name: name, Image: svc.Image}

		// Find the first usable published TCP port (its target is the container
		// port we'd route to).
		containerPort := 0
		published := false
		for _, p := range svc.Ports {
			if p.Protocol != "" && p.Protocol != "tcp" {
				continue
			}
			if strings.TrimSpace(p.Published) != "" {
				published = true
			}
			if p.Target > 0 && containerPort == 0 {
				containerPort = p.Target
			}
		}
		info.HadPublished = published

		isDB := isDatabaseService(name, svc.Image)
		if !isDB && containerPort != 0 && dbServicePorts[containerPort] && len(svc.Ports) == 1 {
			// Only a single well-known DB port exposed → treat as datastore.
			isDB = true
		}

		if !isDB && containerPort > 0 {
			info.Web = true
			info.ContainerPort = containerPort
		}
		out = append(out, info)
	}
	return out
}

// ---------------------------------------------------------------------------
// Override file generation
// ---------------------------------------------------------------------------

// composeOverrideFile is the platform-managed override compose file name,
// written alongside the user's compose file at deploy time.
const composeOverrideFile = "paas-override.yml"

// writeComposeOverride generates the override compose file that pins each
// web service to its platform-allocated host port and suppresses host port
// publishing for every other service (so backing DB ports never leak to the
// host). webHostPorts maps service name → allocated host port.
//
// It uses compose's merge tags:
//   - `ports: !override [ ... ]` replaces the service's port list entirely
//   - `ports: !reset []`         removes all published ports for a service
func writeComposeOverride(path string, services []composeService, webHostPorts map[string]int) error {
	var sb strings.Builder
	sb.WriteString("# Auto-generated by better-paas — DO NOT EDIT\n")
	sb.WriteString("services:\n")
	wroteService := false
	for _, svc := range services {
		if svc.Web {
			hostPort, ok := webHostPorts[svc.Name]
			if !ok || hostPort == 0 {
				continue
			}
			wroteService = true
			sb.WriteString(fmt.Sprintf("  %s:\n", svc.Name))
			sb.WriteString("    ports: !override\n")
			sb.WriteString(fmt.Sprintf("      - \"127.0.0.1:%d:%d\"\n", hostPort, svc.ContainerPort))
			continue
		}
		// Non-web service that originally published ports: strip them so a
		// bundled database isn't exposed on the host.
		if svc.HadPublished {
			wroteService = true
			sb.WriteString(fmt.Sprintf("  %s:\n", svc.Name))
			sb.WriteString("    ports: !reset []\n")
		}
	}
	if !wroteService {
		sb.Reset()
		sb.WriteString("# Auto-generated by better-paas — DO NOT EDIT\n")
		sb.WriteString("services: {}\n")
	}
	return os.WriteFile(path, []byte(sb.String()), 0644)
}

// ---------------------------------------------------------------------------
// Project lifecycle helpers
// ---------------------------------------------------------------------------

// composeDown tears the whole project down. Volumes are deliberately preserved
// (no -v), matching the platform's data-retention stance for managed state.
func composeDown(project, composeDir string) error {
	cmd := exec.Command("docker", "compose", "-p", project, "down", "--remove-orphans", "--rmi", "local")
	if composeDir != "" {
		cmd.Dir = composeDir
	}
	return cmd.Run()
}

// ---------------------------------------------------------------------------
// Deploy orchestration
// ---------------------------------------------------------------------------

// preferredPrimaryNames are service names we favor as the group's representative
// (primary) web service when several are web-facing.
var preferredPrimaryNames = map[string]int{
	"web": 0, "app": 1, "frontend": 2, "www": 3, "main": 4, "api": 5,
}

// composeEnv builds the process environment for compose commands: the host env
// plus the app's configured env vars (used for ${VAR} interpolation).
func composeEnv(app App) []string {
	env := make([]string, 0, len(app.EnvVars))
	for k, v := range app.EnvVars {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}
	return env
}

// composeServiceContainerName returns the stable container name for one service
// of a project (e.g. "paas-ab12-web-1"), or "" if it isn't created.
func composeServiceContainerName(project, service string) string {
	out, err := exec.Command("docker", "ps", "-a",
		"--filter", "label=com.docker.compose.project="+project,
		"--filter", "label=com.docker.compose.service="+service,
		"--format", "{{.Names}}").Output()
	if err != nil {
		return ""
	}
	// A service may have multiple replicas; take the first line.
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if s := strings.TrimSpace(line); s != "" {
			return s
		}
	}
	return ""
}

func composeAddonID(project, service string) string {
	cleanService := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			return r
		}
		if r >= 'A' && r <= 'Z' {
			return r + ('a' - 'A')
		}
		return '-'
	}, service)
	return "compose-" + project + "-" + strings.Trim(cleanService, "-")
}

func isComposeAddonID(id string) bool {
	return strings.HasPrefix(id, "compose-paas-")
}

func registerComposeDatabaseAddon(app App, project string, svc composeService, cfg composeServiceConfig, container string) {
	addonType := composeDatabaseType(svc.Name, cfg)
	if addonType == "" || container == "" {
		return
	}

	env := cfg.Environment
	conn := map[string]string{}
	switch addonType {
	case "postgres":
		user := composeEnvValue(env, "POSTGRES_USER", "postgres")
		dbname := composeEnvValue(env, "POSTGRES_DB", user)
		pass := composeEnvValue(env, "POSTGRES_PASSWORD", "")
		conn = map[string]string{
			"DATABASE_URL": fmt.Sprintf("postgres://%s:%s@%s:5432/%s", user, pass, container, dbname),
			"PGHOST":       container,
			"PGPORT":       "5432",
			"PGUSER":       user,
			"PGPASSWORD":   pass,
			"PGDATABASE":   dbname,
		}
	case "mysql":
		user := composeEnvValue(env, "MYSQL_USER", "root")
		pass := composeEnvValue(env, "MYSQL_PASSWORD", composeEnvValue(env, "MYSQL_ROOT_PASSWORD", ""))
		dbname := composeEnvValue(env, "MYSQL_DATABASE", "")
		conn = map[string]string{
			"DATABASE_URL":   fmt.Sprintf("mysql://%s:%s@%s:3306/%s", user, pass, container, dbname),
			"MYSQL_HOST":     container,
			"MYSQL_PORT":     "3306",
			"MYSQL_USER":     user,
			"MYSQL_PASSWORD": pass,
			"MYSQL_DATABASE": dbname,
		}
	case "redis":
		pass := composeEnvValue(env, "REDIS_PASSWORD", "")
		conn = map[string]string{
			"REDIS_URL":      fmt.Sprintf("redis://:%s@%s:6379", pass, container),
			"REDIS_HOST":     container,
			"REDIS_PORT":     "6379",
			"REDIS_PASSWORD": pass,
		}
	}

	addon := Addon{
		ID:            composeAddonID(project, svc.Name),
		Type:          addonType,
		Name:          app.Name + "-" + svc.Name,
		ContainerName: container,
		Status:        "running",
		Port:          addonSpecs()[addonType].InternalPort,
		ConnEnv:       conn,
		AttachedApps:  []string{app.ID},
		CreatedAt:     time.Now(),
		ServerID:      app.ServerID,
	}
	if err := dbSaveAddon(addon); err != nil {
		log.Printf("[compose] failed to register database add-on for %s/%s: %v", project, svc.Name, err)
	}
}

func removeComposeImportedAddons(project string) {
	addons, err := dbLoadAddons()
	if err != nil {
		log.Printf("[compose] failed to load imported add-ons for cleanup: %v", err)
		return
	}
	prefix := "compose-" + project + "-"
	for _, addon := range addons {
		if strings.HasPrefix(addon.ID, prefix) {
			if err := dbDeleteAddon(addon.ID); err != nil {
				log.Printf("[compose] failed to delete imported add-on %s: %v", addon.ID, err)
			}
		}
	}
}

func updateComposeImportedAddonStatus(project, status string) {
	addons, err := dbLoadAddons()
	if err != nil {
		log.Printf("[compose] failed to load imported add-ons for status update: %v", err)
		return
	}
	prefix := "compose-" + project + "-"
	for _, addon := range addons {
		if strings.HasPrefix(addon.ID, prefix) {
			addon.Status = status
			if err := dbSaveAddon(addon); err != nil {
				log.Printf("[compose] failed to update imported add-on %s status: %v", addon.ID, err)
			}
		}
	}
}

// choosePrimaryService picks which service becomes the group's primary row. It
// prefers a conventionally-named web service, then any web service, then the
// first service overall.
func choosePrimaryService(services []composeService) string {
	bestWeb, bestRank := "", 1<<30
	firstWeb := ""
	for _, s := range services {
		if !s.Web {
			continue
		}
		if firstWeb == "" {
			firstWeb = s.Name
		}
		if rank, ok := preferredPrimaryNames[strings.ToLower(s.Name)]; ok && rank < bestRank {
			bestRank, bestWeb = rank, s.Name
		}
	}
	if bestWeb != "" {
		return bestWeb
	}
	if firstWeb != "" {
		return firstWeb
	}
	if len(services) > 0 {
		return services[0].Name
	}
	return ""
}

// uniqueComposeRowName derives a unique, DB-safe app name for a child service
// row, based on the group's base name and the service name.
func uniqueComposeRowName(base, service string, taken map[string]bool) string {
	clean := strings.ToLower(base + "-" + service)
	clean = regexp.MustCompile(`[^a-z0-9-]+`).ReplaceAllString(clean, "-")
	clean = strings.Trim(clean, "-")
	if clean == "" {
		clean = "svc"
	}
	if len(clean) > 40 {
		clean = strings.Trim(clean[:40], "-")
	}
	name := clean
	for i := 2; taken[name]; i++ {
		suffix := "-" + strconv.Itoa(i)
		trimTo := 40 - len(suffix)
		if trimTo < len(clean) {
			name = strings.Trim(clean[:trimTo], "-") + suffix
		} else {
			name = clean + suffix
		}
	}
	taken[name] = true
	return name
}

// deployComposeProject clones the repo, parses the compose file, brings the
// project up, and registers one App row per service (reusing the primary row
// for the representative service and creating child rows for the rest).
//
// It returns (status, commitSHA, commitMsg) for the primary deployment record.
// The caller is responsible for calling finishDeployment with these values.
func deployComposeProject(app App, gitURL, deployID, logFile string, noCache bool, localLog func(string)) (string, string, string) {
	project := composeProjectName(app.ID)

	// ── 1. Clone ─────────────────────────────────────────────────────────────
	localLog(fmt.Sprintf("✨ Initializing Compose deployment for: %s", app.Name))
	buildDir := filepath.Join("builds", app.ID)
	os.RemoveAll(buildDir)

	branchLog := app.Branch
	if branchLog == "" {
		branchLog = "default branch"
	}
	localLog(fmt.Sprintf("📦 Cloning %s [branch: %s]...", gitURL, branchLog))
	authenticatedURL := formatGitURL(gitURL, app.GitToken)
	var cloneCmd *exec.Cmd
	if app.Branch != "" {
		cloneCmd = exec.Command("git", "clone", authenticatedURL, buildDir, "--branch", app.Branch, "--depth", "1")
	} else {
		cloneCmd = exec.Command("git", "clone", authenticatedURL, buildDir, "--depth", "1")
	}
	if output, err := cloneCmd.CombinedOutput(); err != nil {
		localLog(fmt.Sprintf("✖ Git clone failed: %v\nOutput: %s", err, scrubCredentials(string(output))))
		return "failed", "", ""
	}
	commitSHA := gitHeadCommit(buildDir)
	commitMsg := gitHeadCommitMsg(buildDir)
	if commitSHA != "" {
		localLog(fmt.Sprintf("✔ Repository cloned (commit %s).", shortSHA(commitSHA)))
	} else {
		localLog("✔ Repository cloned successfully.")
	}

	// ── 2. Resolve compose file + directory ──────────────────────────────────
	composeDir := buildDir
	if app.RootDir != "" && app.RootDir != "." && app.RootDir != "./" {
		rootDir, err := validateRootDir(app.RootDir)
		if err != nil {
			localLog(fmt.Sprintf("✖ %v", err))
			return "failed", commitSHA, commitMsg
		}
		composeDir = filepath.Join(buildDir, rootDir)
	}
	composeFile := strings.TrimSpace(app.ComposePath)
	if composeFile == "" {
		composeFile = findComposeFile(composeDir)
		if composeFile == "" {
			localLog("✖ No compose file found (looked for compose.yaml / docker-compose.yml).")
			return "failed", commitSHA, commitMsg
		}
	}
	if !safeRelPath(composeFile) {
		localLog("✖ Invalid compose file path.")
		return "failed", commitSHA, commitMsg
	}
	localLog(fmt.Sprintf("🧩 Using compose file: %s", composeFile))

	// ── 3. Parse + classify services ─────────────────────────────────────────
	env := composeEnv(app)
	cfg, err := parseComposeConfig(composeDir, composeFile, project, env)
	if err != nil {
		localLog(fmt.Sprintf("✖ %v", err))
		return "failed", commitSHA, commitMsg
	}
	services := classifyComposeServices(cfg)
	primaryService := choosePrimaryService(services)

	var webNames []string
	for _, s := range services {
		if s.Web {
			webNames = append(webNames, s.Name)
		}
	}
	localLog(fmt.Sprintf("🔎 Discovered %d service(s): %s", len(services), describeServices(services)))
	if len(webNames) > 0 {
		localLog(fmt.Sprintf("🌐 Web-facing: %s", strings.Join(webNames, ", ")))
	} else {
		localLog("ℹ No web-facing service detected; the group will run without a public URL.")
	}

	// ── 4. Allocate host ports for web services + write override ─────────────
	appsLock.Lock()
	reserved := map[int]bool{}
	webHostPorts := map[string]int{}
	for _, s := range services {
		if s.Web {
			p := allocatePortAvoiding(app.ServerID, reserved)
			reserved[p] = true
			webHostPorts[s.Name] = p
		}
	}
	appsLock.Unlock()

	overridePath := filepath.Join(composeDir, composeOverrideFile)
	if err := writeComposeOverride(overridePath, services, webHostPorts); err != nil {
		localLog(fmt.Sprintf("✖ Failed to write compose override: %v", err))
		return "failed", commitSHA, commitMsg
	}

	// ── 5. Bring the project up ──────────────────────────────────────────────
	localLog("🚀 Starting compose project (build + up)...")
	upArgs := []string{"compose", "-p", project,
		"-f", composeFile, "-f", composeOverrideFile,
		"up", "-d", "--build", "--remove-orphans"}
	if noCache {
		upArgs = append(upArgs, "--no-cache")
	}
	upCmd := exec.Command("docker", upArgs...)
	upCmd.Dir = composeDir
	upCmd.Env = append(os.Environ(), env...)
	if err := streamBuildCommand(upCmd, localLog); err != nil {
		localLog(fmt.Sprintf("✖ Compose up failed: %v", err))
		// Best-effort teardown so a half-started project doesn't linger.
		composeDown(project, composeDir)
		return "failed", commitSHA, commitMsg
	}
	localLog("✔ Compose project is up.")

	// ── 6. Register one row per service ──────────────────────────────────────
	// Names already taken across all apps (to keep child names unique).
	appsLock.Lock()
	taken := make(map[string]bool, len(apps))
	for _, a := range apps {
		taken[a.Name] = true
	}
	// The primary row's own name is allowed (we reuse it).
	delete(taken, app.Name)
	// Existing child rows of this group are reused (matched by service), so
	// their names shouldn't block reuse either.
	existingByService := map[string]App{}
	for _, a := range apps {
		if a.ComposeProject == project && !a.ComposePrimary {
			existingByService[a.ComposeService] = a
			delete(taken, a.Name)
		}
	}
	appsLock.Unlock()

	// Track which services are still present so we can retire stale child rows.
	seenService := map[string]bool{}

	for _, s := range services {
		seenService[s.Name] = true
		container := composeServiceContainerName(project, s.Name)
		if container == "" {
			localLog(fmt.Sprintf("⚠ Service %q has no container (build-only?); skipping row.", s.Name))
			continue
		}
		// Attach to the shared add-on network (best-effort) for managed DB access.
		exec.Command("docker", "network", "connect", addonNetwork, container).Run()
		registerComposeDatabaseAddon(app, project, s, cfg.Services[s.Name], container)

		hostPort := webHostPorts[s.Name]
		if s.Name == primaryService {
			// Reuse the primary row that handleDeploy already created.
			appsLock.Lock()
			for i := range apps {
				if apps[i].ID == app.ID {
					apps[i].ComposeProject = project
					apps[i].ComposeService = s.Name
					apps[i].ComposeWeb = s.Web
					apps[i].ComposePrimary = true
					apps[i].ActiveContainer = container
					apps[i].ActiveDeployID = deployID
					apps[i].Status = "running"
					if s.Web {
						apps[i].Port = hostPort
						apps[i].URL = defaultAppURL(apps[i].ID, apps[i].ServerID)
					} else {
						apps[i].URL = ""
					}
					app = apps[i]
					break
				}
			}
			appsLock.Unlock()
			if err := dbSaveApp(app); err != nil {
				log.Printf("[db] failed to save primary compose row: %v", err)
			}
			startRuntimeLogCapture(app.ID, container)
			continue
		}

		// Child service → reuse existing row if present, else create one.
		if existing, ok := existingByService[s.Name]; ok {
			appsLock.Lock()
			for i := range apps {
				if apps[i].ID == existing.ID {
					apps[i].ComposeWeb = s.Web
					apps[i].ActiveContainer = container
					apps[i].ActiveDeployID = deployID
					apps[i].Status = "running"
					if s.Web {
						apps[i].Port = hostPort
						apps[i].URL = defaultAppURL(apps[i].ID, apps[i].ServerID)
					} else {
						apps[i].Port = 0
						apps[i].URL = ""
					}
					existing = apps[i]
					break
				}
			}
			appsLock.Unlock()
			if err := dbSaveApp(existing); err != nil {
				log.Printf("[db] failed to update child compose row: %v", err)
			}
			startRuntimeLogCapture(existing.ID, container)
			continue
		}

		childID := generateRandomID()
		childName := uniqueComposeRowName(app.Name, s.Name, taken)
		child := App{
			ID:              childID,
			Name:            childName,
			Status:          "running",
			GitRepo:         app.GitRepo,
			Branch:          app.Branch,
			CreatedAt:       app.CreatedAt,
			ServerID:        app.ServerID,
			BuildMethod:     "compose",
			ComposePath:     composeFile,
			ComposeProject:  project,
			ComposeService:  s.Name,
			ComposeWeb:      s.Web,
			ComposePrimary:  false,
			ActiveContainer: container,
			ActiveDeployID:  deployID,
			EnvVars:         map[string]string{},
		}
		if s.Web {
			child.Port = hostPort
			child.URL = defaultAppURL(childID, child.ServerID)
		}
		appsLock.Lock()
		apps = append(apps, child)
		appsLock.Unlock()
		if err := dbSaveApp(child); err != nil {
			log.Printf("[db] failed to save child compose row: %v", err)
		}
		startRuntimeLogCapture(childID, container)
		localLog(fmt.Sprintf("➕ Registered service %q → %s", s.Name, childName))
	}

	// Retire child rows whose service no longer exists in the compose file.
	for svc, existing := range existingByService {
		if seenService[svc] {
			continue
		}
		stopRuntimeLogCapture(existing.ID)
		appsLock.Lock()
		for i, a := range apps {
			if a.ID == existing.ID {
				apps = append(apps[:i], apps[i+1:]...)
				break
			}
		}
		appsLock.Unlock()
		_ = dbDeleteApp(existing.ID)
		_ = dbDeleteDeploymentsForApp(existing.ID)
		os.Remove(runtimeLogPath(existing.ID))
		localLog(fmt.Sprintf("➖ Removed service %q (no longer in compose file).", svc))
	}

	// ── 7. Health-check web services (best-effort) ───────────────────────────
	for name, port := range webHostPorts {
		cName := composeServiceContainerName(project, name)
		if err := waitHealthy(app.ServerID, cName, port, "", 30*time.Second, func(string) {}); err != nil {
			localLog(fmt.Sprintf("⚠ Service %q did not pass a TCP health check on :%d (continuing).", name, port))
		} else {
			localLog(fmt.Sprintf("✔ Service %q is reachable on :%d.", name, port))
		}
	}

	rebuildCaddyfile()
	if app.URL != "" {
		localLog(fmt.Sprintf("✅ Compose deployment complete! Primary service live at: %s", app.URL))
	} else {
		localLog("✅ Compose deployment complete!")
	}
	return "success", commitSHA, commitMsg
}

// describeServices renders a short "name(web:port)" summary for logs.
func describeServices(services []composeService) string {
	parts := make([]string, 0, len(services))
	for _, s := range services {
		if s.Web {
			parts = append(parts, fmt.Sprintf("%s(web:%d)", s.Name, s.ContainerPort))
		} else {
			parts = append(parts, s.Name)
		}
	}
	return strings.Join(parts, ", ")
}

// composeGroupRows returns copies of every app row belonging to a compose
// project (the group). The primary row is first when present.
func composeGroupRows(project string) []App {
	if project == "" {
		return nil
	}
	appsLock.Lock()
	defer appsLock.Unlock()
	var primary []App
	var rest []App
	for i := range apps {
		if apps[i].ComposeProject == project {
			clone := apps[i]
			if clone.ComposePrimary {
				primary = append(primary, clone)
			} else {
				rest = append(rest, clone)
			}
		}
	}
	return append(primary, rest...)
}

// ---------------------------------------------------------------------------
// Group lifecycle (stop / start / delete)
// ---------------------------------------------------------------------------

// composeDirForApp returns the on-disk compose working directory for a group,
// honoring the primary row's RootDir. The build dir is keyed by the primary
// row's ID (that's where the repo was cloned).
func composeDirForApp(primary App) string {
	dir := filepath.Join("builds", primary.ID)
	if primary.RootDir != "" && primary.RootDir != "." && primary.RootDir != "./" {
		if rootDir, err := validateRootDir(primary.RootDir); err == nil {
			dir = filepath.Join(dir, rootDir)
		}
	}
	return dir
}

// composePrimaryRow returns the primary row of a group, or a best-effort
// fallback (first row) if none is flagged.
func composePrimaryRow(project string) *App {
	rows := composeGroupRows(project)
	for i := range rows {
		if rows[i].ComposePrimary {
			clone := rows[i]
			return &clone
		}
	}
	if len(rows) > 0 {
		clone := rows[0]
		return &clone
	}
	return nil
}

// deleteComposeGroup tears down a compose project and removes every app row,
// deployment record, cron job, analytics, and log artifact belonging to it.
// Named volumes are preserved (compose down without -v).
func deleteComposeGroup(any App) {
	project := any.ComposeProject
	rows := composeGroupRows(project)
	primary := composePrimaryRow(project)

	// Stop runtime log capture for every row first.
	for _, r := range rows {
		stopRuntimeLogCapture(r.ID)
	}

	// Tear the whole project down (keep volumes).
	dir := ""
	if primary != nil {
		dir = composeDirForApp(*primary)
	}
	if err := composeDown(project, dir); err != nil {
		log.Printf("[compose] down failed for %s: %v", project, err)
		// Fallback: force-remove any lingering project containers by label.
		removeComposeProjectContainers(project)
	}

	// Remove the per-app network (best-effort; created on demand at deploy).
	exec.Command("docker", "network", "rm", composeNetworkName(any.ID)).Run()
	removeComposeImportedAddons(project)

	// Remove all rows + their DB rows / artifacts.
	for _, r := range rows {
		appsLock.Lock()
		for i, a := range apps {
			if a.ID == r.ID {
				apps = append(apps[:i], apps[i+1:]...)
				break
			}
		}
		appsLock.Unlock()

		if err := dbDeleteApp(r.ID); err != nil {
			log.Printf("[db] failed to delete app %s: %v", r.ID, err)
		}
		if err := dbDeleteDeploymentsForApp(r.ID); err != nil {
			log.Printf("[db] failed to delete deployments for %s: %v", r.ID, err)
		}
		if err := dbDeleteCronJobsForApp(r.ID); err != nil {
			log.Printf("[db] failed to delete cron jobs for %s: %v", r.ID, err)
		}
		if err := dbDeleteAnalyticsForApp(r.ID); err != nil {
			log.Printf("[db] failed to delete analytics for %s: %v", r.ID, err)
		}
		if err := detachAppFromAddons(r.ID); err != nil {
			log.Printf("[db] failed to detach add-ons for %s: %v", r.ID, err)
		}
		// Remove persisted runtime logs + deploy log dir.
		os.Remove(runtimeLogPath(r.ID))
		os.Remove(runtimeLogPath(r.ID) + ".1")
		os.RemoveAll(filepath.Join("data", "logs", r.ID))
	}

	// Remove the shared build directory (cloned once under the primary ID).
	if primary != nil {
		os.RemoveAll(filepath.Join("builds", primary.ID))
	}

	rebuildCaddyfile()
}

// removeComposeProjectContainers force-removes every container labeled for a
// compose project (used as a fallback when `compose down` fails).
func removeComposeProjectContainers(project string) {
	out, err := exec.Command("docker", "ps", "-aq",
		"--filter", "label=com.docker.compose.project="+project).Output()
	if err != nil {
		return
	}
	for _, id := range strings.Fields(string(out)) {
		exec.Command("docker", "rm", "-f", id).Run()
	}
}

// composeNetworkName returns the per-app network name reserved for a compose
// group. (Currently compose creates its own default network; this name is used
// for cleanup symmetry and future per-app isolation.)
func composeNetworkName(appID string) string {
	return "paas-compose-" + appID + "-net"
}

// stopComposeGroup stops every container in the project and marks all rows
// stopped. Volumes and containers are preserved (just stopped).
func stopComposeGroup(any App) {
	project := any.ComposeProject
	primary := composePrimaryRow(project)
	dir := ""
	if primary != nil {
		dir = composeDirForApp(*primary)
	}
	cmd := exec.Command("docker", "compose", "-p", project, "stop")
	if dir != "" {
		cmd.Dir = dir
	}
	cmd.Run()

	for _, r := range composeGroupRows(project) {
		stopRuntimeLogCapture(r.ID)
		appsLock.Lock()
		for i := range apps {
			if apps[i].ID == r.ID {
				apps[i].Status = "stopped"
				break
			}
		}
		appsLock.Unlock()
		if err := dbUpdateAppStatus(r.ID, "stopped"); err != nil {
			log.Printf("[db] failed to mark %s stopped: %v", r.ID, err)
		}
	}
	updateComposeImportedAddonStatus(project, "stopped")
	rebuildCaddyfile()
}

// startComposeGroup starts every container in the project and marks all rows
// running, re-resolving each row's container name (compose may recreate them).
func startComposeGroup(any App) error {
	project := any.ComposeProject
	primary := composePrimaryRow(project)
	dir := ""
	if primary != nil {
		dir = composeDirForApp(*primary)
	}
	cmd := exec.Command("docker", "compose", "-p", project, "start")
	if dir != "" {
		cmd.Dir = dir
	}
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("%v — %s", err, strings.TrimSpace(string(out)))
	}

	for _, r := range composeGroupRows(project) {
		container := composeServiceContainerName(project, r.ComposeService)
		appsLock.Lock()
		for i := range apps {
			if apps[i].ID == r.ID {
				if container != "" {
					apps[i].ActiveContainer = container
				}
				apps[i].Status = "running"
				r = apps[i]
				break
			}
		}
		appsLock.Unlock()
		if err := dbSaveApp(r); err != nil {
			log.Printf("[db] failed to save %s on start: %v", r.ID, err)
		}
		if container != "" {
			startRuntimeLogCapture(r.ID, container)
		}
	}
	updateComposeImportedAddonStatus(project, "running")
	rebuildCaddyfile()
	return nil
}
