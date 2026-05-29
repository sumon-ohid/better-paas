package main

import (
	"bufio"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// defaultNodeVersion is the Node.js major used when a repo declares no
// engines.node constraint. Nixpacks resolves this via NIXPACKS_NODE_VERSION.
const defaultNodeVersion = "22"


// generateRandomID returns a 10-character lowercase alphanumeric string using
// a cryptographically secure source. IDs form part of the public per-app URL,
// so they must not be predictable.
func generateRandomID() string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 10)
	if _, err := rand.Read(b); err != nil {
		log.Fatalf("[id] failed to read secure random: %v", err)
	}
	for i := range b {
		b[i] = charset[int(b[i])%len(charset)]
	}
	return string(b)
}

// formatGitURL injects an auth token into a Git HTTPS URL.
func formatGitURL(gitURL, token string) string {
	if token == "" {
		return gitURL
	}
	escaped := url.QueryEscape(token)
	if strings.HasPrefix(gitURL, "https://") {
		return "https://" + escaped + "@" + strings.TrimPrefix(gitURL, "https://")
	}
	if strings.HasPrefix(gitURL, "http://") {
		return "http://" + escaped + "@" + strings.TrimPrefix(gitURL, "http://")
	}
	return "https://" + escaped + "@" + gitURL
}

// normalizeGitURL ensures a git URL has a scheme.
func normalizeGitURL(raw string) string {
	if raw == "" || strings.HasPrefix(raw, "/") || filepath.IsAbs(raw) {
		return raw
	}
	// Already has an explicit scheme, or is an SSH-style URL (git@host:path /
	// git://...). Note: we must match "git@"/"git://" precisely rather than a
	// bare "git" prefix, otherwise hosts like github.com / gitlab.com (which
	// start with "git") would wrongly be left without a scheme.
	if strings.HasPrefix(raw, "http") ||
		strings.HasPrefix(raw, "git@") ||
		strings.HasPrefix(raw, "git://") ||
		strings.HasPrefix(raw, "ssh://") {
		return raw
	}
	return "https://" + raw
}

// logToBuild appends a log line to the in-memory ring buffer, persists it to
// disk, and broadcasts it to any connected WebSocket subscribers.
func logToBuild(appID, message, logFile string) {
	log.Printf("[%s] %s", appID, message)

	// Persist to disk.
	if logFile != "" {
		_ = appendLogFile(logFile, message)
	}

	// Maintain in-memory ring buffer for WebSocket replay.
	buildLogsLock.Lock()
	buf := buildLogs[appID]
	buf = append(buf, message)
	if len(buf) > maxBuildLogLines {
		buf = buf[len(buf)-maxBuildLogLines:]
	}
	buildLogs[appID] = buf
	buildLogsLock.Unlock()

	// Broadcast to subscribers.
	subscribersLock.Lock()
	for ch := range subscribers[appID] {
		select {
		case ch <- message:
		default: // drop if subscriber is slow
		}
	}
	subscribersLock.Unlock()
}

// updateAppStatus updates app status in memory and DB, then rebuilds Caddyfile.
func updateAppStatus(appID, status string) {
	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == appID {
			apps[i].Status = status
			break
		}
	}
	appsLock.Unlock()

	if err := dbUpdateAppStatus(appID, status); err != nil {
		log.Printf("[db] failed to update app status: %v", err)
	}
	rebuildCaddyfile()
}

// allocatePort picks a free host port in [9000, 9999], avoiding ports already
// assigned to other apps and ports currently bound on the host.
//
// IMPORTANT: callers must hold appsLock, since this reads the apps slice.
func allocatePort() int {
	inUse := make(map[int]bool, len(apps))
	for _, a := range apps {
		inUse[a.Port] = true
	}

	const lo, hi = 9000, 9999
	// Try random ports first to reduce clustering.
	for attempt := 0; attempt < 200; attempt++ {
		p := lo + secureIntn(hi-lo+1)
		if !inUse[p] && portFree(p) {
			return p
		}
	}
	// Deterministic fallback: first free port in range.
	for p := lo; p <= hi; p++ {
		if !inUse[p] && portFree(p) {
			return p
		}
	}
	// Last resort: a port not tracked in memory (host check may have raced).
	for p := lo; p <= hi; p++ {
		if !inUse[p] {
			return p
		}
	}
	return lo
}

// secureIntn returns a crypto-random int in [0, n).
func secureIntn(n int) int {
	if n <= 0 {
		return 0
	}
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return 0
	}
	v := int(b[0])<<24 | int(b[1])<<16 | int(b[2])<<8 | int(b[3])
	if v < 0 {
		v = -v
	}
	return v % n
}

// portFree reports whether a TCP port can currently be bound on the host.
func portFree(port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return false
	}
	_ = ln.Close()
	return true
}

// runDockerPrune runs docker system prune -f --volumes and returns output.
func runDockerPrune() (string, error) {
	cmd := exec.Command("docker", "system", "prune", "-f", "--volumes")
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// runPaaSDeployment clones, builds with Nixpacks, and runs the container using
// a zero-downtime cutover: the new container is started on a fresh port and
// health-checked before Caddy is switched to it and the old container removed.
func runPaaSDeployment(app App, gitURL, deployID, logFile string) {
	runDeployment(app, gitURL, deployID, logFile, "manual", "")
}

// runDeployment is the full build+release pipeline. trigger records how it was
// initiated ("manual","webhook","rollback") and rollbackImage, when non-empty,
// skips the build and re-releases an existing image tag.
func runDeployment(app App, gitURL, deployID, logFile, trigger, rollbackImage string) {
	startedAt := time.Now()

	dep := DeploymentRecord{
		ID:        deployID,
		AppID:     app.ID,
		AppName:   app.Name,
		Status:    "building",
		LogFile:   logFile,
		CreatedAt: startedAt,
		Trigger:   trigger,
	}
	if err := dbCreateDeployment(dep); err != nil {
		log.Printf("[db] failed to create deployment: %v", err)
	}

	var deployLogs []string
	var commitSHA string
	localLog := func(msg string) {
		logToBuild(app.ID, msg, logFile)
		deployLogs = append(deployLogs, msg)
	}

	finish := func(status, image string) {
		finishDeployment(app, deployLogs, status, startedAt, deployID, logFile, image, trigger, commitSHA)
	}

	image := rollbackImage

	if rollbackImage != "" {
		// ── Rollback path: reuse an existing image, no clone/build ───────────
		localLog(fmt.Sprintf("⏪ Rolling back %s to image %s", app.Name, rollbackImage))
		if !dockerImageExists(rollbackImage) {
			localLog(fmt.Sprintf("✖ Image %s no longer exists; cannot roll back.", rollbackImage))
			finish("failed", "")
			return
		}
	} else {
		// ── 1. Clone repository ──────────────────────────────────────────────
		localLog(fmt.Sprintf("✨ Initializing environment for app: %s", app.Name))
		buildDir := filepath.Join("builds", app.Name)
		os.RemoveAll(buildDir)

		localLog(fmt.Sprintf("📦 Cloning %s [branch: %s]...", gitURL, app.Branch))
		authenticatedURL := formatGitURL(gitURL, app.GitToken)
		cloneCmd := exec.Command("git", "clone", authenticatedURL, buildDir, "--branch", app.Branch, "--depth", "1")
		if output, err := cloneCmd.CombinedOutput(); err != nil {
			localLog(fmt.Sprintf("✖ Git clone failed: %v\nOutput: %s", err, string(output)))
			finish("failed", "")
			return
		}
		commitSHA = gitHeadCommit(buildDir)
		if commitSHA != "" {
			localLog(fmt.Sprintf("✔ Repository cloned (commit %s).", shortSHA(commitSHA)))
		} else {
			localLog("✔ Repository cloned successfully.")
		}

		// ── 2. Determine build subdirectory ──────────────────────────────────
		buildSubDir := buildDir
		if app.RootDir != "" && app.RootDir != "." && app.RootDir != "./" {
			buildSubDir = filepath.Join(buildDir, app.RootDir)
			localLog(fmt.Sprintf("📂 Using sub-directory build context: %s", app.RootDir))
		}

		// ── 3. Detect required Node version, THEN patch package.json ──────────
		// Detection must happen before patching, because patchPackageJSON strips
		// the engines/packageManager fields we read here.
		nodeVersion := detectNodeVersion(buildSubDir, defaultNodeVersion)
		installOverride := ""
		if app.InstallCommand == "" {
			installOverride = defaultInstallCommand(buildSubDir)
		}
		patchPackageJSON(app.ID, buildDir, localLog)

		// ── 4. Remove restrictive .dockerignore ──────────────────────────────
		dockerignorePath := filepath.Join(buildSubDir, ".dockerignore")
		if _, err := os.Stat(dockerignorePath); err == nil {
			os.Rename(dockerignorePath, dockerignorePath+".bak")
			localLog("📝 Removed restrictive .dockerignore for Nixpacks build")
		}

		// ── 5. Build with Nixpacks → unique image tag per deploy ──────────────
		image = fmt.Sprintf("%s:%s", app.Name, deployID)
		localLog("🔍 Analyzing workspace with Nixpacks...")

		// nodeVersion and pkgManager were detected in step 3, before engines
		// were stripped, so genuine requirements (e.g. a workspace pinned to
		// >=24) are honored instead of silently downgraded.
		localLog(fmt.Sprintf("🟢 Using Node.js %s", nodeVersion))

		nixpacksArgs := []string{"build", buildSubDir, "--name", image, "--env", "NIXPACKS_NODE_VERSION=" + nodeVersion}
		for k, v := range app.EnvVars {
			nixpacksArgs = append(nixpacksArgs, "--env", fmt.Sprintf("%s=%s", k, v))
		}
		// Default the package manager to pnpm for Node apps unless the repo
		// already commits to a different one (yarn/bun lockfile) or the user
		// supplied their own install command.
		if installOverride != "" {
			localLog(fmt.Sprintf("📦 Install command: %s", installOverride))
			nixpacksArgs = append(nixpacksArgs, "--install-cmd", installOverride)
		}
		if app.InstallCommand != "" {
			nixpacksArgs = append(nixpacksArgs, "--install-cmd", app.InstallCommand)
		}
		if app.BuildCommand != "" {
			nixpacksArgs = append(nixpacksArgs, "--build-cmd", app.BuildCommand)
		}
		if app.StartCommand != "" {
			nixpacksArgs = append(nixpacksArgs, "--start-cmd", app.StartCommand)
		}

		nixpacksCmd := exec.Command("nixpacks", nixpacksArgs...)
		stdout, err := nixpacksCmd.StdoutPipe()
		if err != nil {
			localLog(fmt.Sprintf("✖ Failed to open Nixpacks output: %v", err))
			finish("failed", "")
			return
		}
		nixpacksCmd.Stderr = nixpacksCmd.Stdout

		if err := nixpacksCmd.Start(); err != nil {
			localLog(fmt.Sprintf("✖ Failed to start Nixpacks: %v", err))
			finish("failed", "")
			return
		}

		reader := bufio.NewReader(stdout)
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				if err != io.EOF {
					localLog(fmt.Sprintf("✖ Output read error: %v", err))
				}
				break
			}
			localLog(strings.TrimRight(line, "\n"))
		}

		if err := nixpacksCmd.Wait(); err != nil {
			localLog(fmt.Sprintf("✖ Nixpacks build failed: %v", err))
			finish("failed", "")
			return
		}
		localLog("✔ Docker image built successfully!")
	}

	// ── 6. Start the NEW container on a fresh port (zero-downtime) ───────────
	containerPort := app.Port
	if app.PortOverride > 0 {
		containerPort = app.PortOverride
	}

	appsLock.Lock()
	newHostPort := allocatePort()
	appsLock.Unlock()

	newContainer := fmt.Sprintf("%s-%s", app.Name, deployID)
	oldContainer := app.containerName()
	oldPort := app.Port

	localLog(fmt.Sprintf("🚀 Starting new container %q (host :%d → container :%d)...", newContainer, newHostPort, containerPort))
	if err := startContainer(app, image, newContainer, newHostPort, containerPort); err != nil {
		localLog(fmt.Sprintf("✖ Container startup failed: %v", err))
		exec.Command("docker", "rm", "-f", newContainer).Run()
		finish("failed", "")
		return
	}

	// ── 7. Health check before cutover ───────────────────────────────────────
	localLog("🩺 Waiting for the new container to become healthy...")
	if err := waitHealthy(newHostPort, app.HealthPath, 30*time.Second, localLog); err != nil {
		localLog(fmt.Sprintf("✖ Health check failed: %v", err))
		localLog("↩ Keeping the previous version live; discarding the failed container.")
		exec.Command("docker", "rm", "-f", newContainer).Run()
		finish("failed", "")
		return
	}
	localLog("✔ New container is healthy.")

	// ── 8. Cutover: point Caddy at the new container, then retire the old ────
	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == app.ID {
			apps[i].Port = newHostPort
			apps[i].ActiveContainer = newContainer
			apps[i].ActiveImage = image
			apps[i].ActiveDeployID = deployID
			apps[i].Status = "running"
			app = apps[i] // refresh local copy for the DB save below
			break
		}
	}
	appsLock.Unlock()
	if err := dbSaveApp(app); err != nil {
		log.Printf("[db] failed to save app after cutover: %v", err)
	}
	rebuildCaddyfile()
	localLog(fmt.Sprintf("🔀 Traffic switched to the new container (port %d).", newHostPort))

	// Begin persistent runtime-log capture for the new container.
	startRuntimeLogCapture(app.ID, newContainer)

	// Retire the previous container (best-effort).
	if oldContainer != "" && oldContainer != newContainer {
		exec.Command("docker", "rm", "-f", oldContainer).Run()
		localLog(fmt.Sprintf("🧹 Removed previous container %q (was on port %d).", oldContainer, oldPort))
	}

	// Keep only the most recent images for rollback; prune older ones.
	pruneOldImages(app.Name, 5, localLog)

	localLog(fmt.Sprintf("✅ Deployment complete! App live at: %s", app.URL))
	finish("success", image)
}

// startContainer runs an image as a detached container with the app's env,
// resource limits, restart policy, and persistent volumes.
func startContainer(app App, image, containerName string, hostPort, containerPort int) error {
	runArgs := []string{
		"run", "-d",
		"-p", fmt.Sprintf("%d:%d", hostPort, containerPort),
		"-e", fmt.Sprintf("PORT=%d", containerPort),
		"--restart", "unless-stopped",
		"--label", "better-paas=1",
		"--label", fmt.Sprintf("better-paas-app=%s", app.ID),
	}
	if app.Memory != "" {
		runArgs = append(runArgs, "--memory", app.Memory)
	}
	if app.CPUs != "" {
		runArgs = append(runArgs, "--cpus", app.CPUs)
	}
	for k, v := range app.EnvVars {
		runArgs = append(runArgs, "-e", fmt.Sprintf("%s=%s", k, v))
	}
	for _, vol := range app.Volumes {
		if strings.TrimSpace(vol) != "" {
			runArgs = append(runArgs, "-v", vol)
		}
	}
	runArgs = append(runArgs, "--name", containerName, image)

	if output, err := exec.Command("docker", runArgs...).CombinedOutput(); err != nil {
		return fmt.Errorf("%v — %s", err, string(output))
	}

	// Attach to the shared add-on network (best-effort) so the container can
	// reach managed databases/caches by their container name. Published ports
	// remain on the default bridge, so this is purely additive.
	exec.Command("docker", "network", "connect", addonNetwork, containerName).Run()
	return nil
}

// waitHealthy polls a container until it answers, or the timeout elapses. When
// healthPath is set it expects an HTTP 2xx/3xx/4xx (any HTTP response means the
// server is up); otherwise a successful TCP connect is sufficient.
func waitHealthy(hostPort int, healthPath string, timeout time.Duration, logf func(string)) error {
	deadline := time.Now().Add(timeout)
	attempt := 0
	for time.Now().Before(deadline) {
		attempt++
		if healthPath != "" {
			url := fmt.Sprintf("http://127.0.0.1:%d%s", hostPort, ensureLeadingSlash(healthPath))
			client := &http.Client{Timeout: 3 * time.Second}
			resp, err := client.Get(url)
			if err == nil {
				resp.Body.Close()
				if resp.StatusCode < 500 {
					return nil
				}
			}
		} else {
			conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", hostPort), 2*time.Second)
			if err == nil {
				conn.Close()
				return nil
			}
		}
		time.Sleep(1 * time.Second)
	}
	return fmt.Errorf("container did not become healthy within %s", timeout)
}

func ensureLeadingSlash(p string) string {
	if !strings.HasPrefix(p, "/") {
		return "/" + p
	}
	return p
}

// dockerImageExists reports whether an image tag is present locally.
func dockerImageExists(image string) bool {
	err := exec.Command("docker", "image", "inspect", image).Run()
	return err == nil
}

// removeAppContainers force-removes every container labeled for the given app.
func removeAppContainers(appID string) {
	out, err := exec.Command("docker", "ps", "-aq", "--filter", "label=better-paas-app="+appID).Output()
	if err != nil {
		return
	}
	for _, id := range strings.Fields(string(out)) {
		exec.Command("docker", "rm", "-f", id).Run()
	}
}

// removeAppImages removes every image tagged under the app's repository name.
func removeAppImages(appName string) {
	out, err := exec.Command("docker", "images", "-q", appName).Output()
	if err != nil {
		return
	}
	seen := make(map[string]bool)
	for _, id := range strings.Fields(string(out)) {
		if seen[id] {
			continue
		}
		seen[id] = true
		exec.Command("docker", "rmi", "-f", id).Run()
	}
}

// pruneOldImages keeps the newest `keep` images for an app (by tag) and removes
// older ones so the disk doesn't fill with stale build artifacts.
func pruneOldImages(appName string, keep int, logf func(string)) {
	out, err := exec.Command("docker", "images", "--format", "{{.Repository}}:{{.Tag}}\t{{.CreatedAt}}", appName).Output()
	if err != nil {
		return
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) <= keep {
		return
	}
	// `docker images` already lists newest first; remove everything past `keep`.
	for _, line := range lines[keep:] {
		parts := strings.Split(line, "\t")
		if len(parts) == 0 || parts[0] == "" {
			continue
		}
		tag := parts[0]
		if strings.HasSuffix(tag, ":<none>") {
			continue
		}
		exec.Command("docker", "rmi", "-f", tag).Run()
	}
}

// gitHeadCommit returns the HEAD commit SHA of a cloned repo, or "" on error.
func gitHeadCommit(dir string) string {
	out, err := exec.Command("git", "-C", dir, "rev-parse", "HEAD").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func shortSHA(sha string) string {
	if len(sha) > 7 {
		return sha[:7]
	}
	return sha
}

// finishDeployment updates app status, saves deployment record, and persists.
func finishDeployment(app App, deployLogs []string, status string, startedAt time.Time, deployID, logFile, image, trigger, commit string) {
	duration := time.Since(startedAt).Round(time.Second).String()

	finalStatus := "running"
	if status == "failed" {
		finalStatus = "failed"
		// On a failed first deploy there is no previous container to fall back
		// to, so reflect the failure. On a failed redeploy the old container is
		// still serving, so keep the app "running".
		if app.ActiveContainer != "" {
			finalStatus = "running"
		}
	}

	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == app.ID {
			apps[i].Status = finalStatus
			break
		}
	}
	appsLock.Unlock()

	if err := dbUpdateAppStatus(app.ID, finalStatus); err != nil {
		log.Printf("[db] failed to update app status: %v", err)
	}
	rebuildCaddyfile()

	record := DeploymentRecord{
		ID:        deployID,
		AppID:     app.ID,
		AppName:   app.Name,
		Status:    status,
		LogFile:   logFile,
		CreatedAt: startedAt,
		Duration:  duration,
		Logs:      deployLogs,
		Image:     image,
		Trigger:   trigger,
		Commit:    commit,
	}

	if err := dbCreateDeployment(record); err != nil {
		log.Printf("[db] failed to save deployment: %v", err)
	}
	if err := dbPruneDeployments(100); err != nil {
		log.Printf("[db] failed to prune deployments: %v", err)
	}

	// Fire deploy notifications (best-effort, non-blocking).
	go notifyDeploy(app, record)
}

// patchPackageJSON sanitizes a Node.js package.json for Nixpacks compatibility.
// It strips engine/packageManager restrictions from the root manifest *and*
// from every workspace package, because pnpm enforces engines.node across the
// whole workspace — a single package pinned to a Node version the builder
// doesn't provide fails the entire `pnpm install`.
func patchPackageJSON(appID, buildDir string, logger func(string)) {
	// Patch the root manifest and capture workspace globs.
	rootPkg, _ := patchSinglePackageJSON(filepath.Join(buildDir, "package.json"))

	// Walk workspace packages and strip their engines too.
	patched := 0
	for _, dir := range workspacePackageDirs(buildDir, rootPkg) {
		if _, ok := patchSinglePackageJSON(filepath.Join(dir, "package.json")); ok {
			patched++
		}
	}
	if patched > 0 {
		logger(fmt.Sprintf("📝 Relaxed engine constraints on %d workspace package(s)", patched))
	}

	// Monorepo start-script convenience (unchanged behaviour).
	if rootPkg != nil {
		scripts, _ := rootPkg["scripts"].(map[string]interface{})
		if scripts == nil {
			scripts = make(map[string]interface{})
		}
		if _, hasStart := scripts["start"]; !hasStart {
			webPkgPath := filepath.Join(buildDir, "apps", "web", "package.json")
			if _, err := os.Stat(webPkgPath); err == nil {
				logger("💡 Monorepo detected at apps/web. Injecting root start command...")
				scripts["start"] = "pnpm --filter @repo/web start"
				rootPkg["scripts"] = scripts
				if updated, err := json.MarshalIndent(rootPkg, "", "  "); err == nil {
					os.WriteFile(filepath.Join(buildDir, "package.json"), updated, 0644)
				}
			}
		}
	}
}

// patchSinglePackageJSON removes engines/packageManager from one package.json.
// It returns the parsed manifest (pre-deletion fields aside) and whether the
// file existed and was rewritten.
func patchSinglePackageJSON(pkgPath string) (map[string]interface{}, bool) {
	data, err := os.ReadFile(pkgPath)
	if err != nil {
		return nil, false
	}
	var pkg map[string]interface{}
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil, false
	}

	_, hadEngines := pkg["engines"]
	_, hadPM := pkg["packageManager"]
	delete(pkg, "engines")
	delete(pkg, "packageManager")

	if hadEngines || hadPM {
		if updated, err := json.MarshalIndent(pkg, "", "  "); err == nil {
			os.WriteFile(pkgPath, updated, 0644)
		}
	}
	return pkg, true
}

// workspacePackageDirs resolves the directories of workspace packages declared
// in the root package.json ("workspaces" array or {packages:[...]}), expanding
// trailing "/*" globs one level deep. Paths are returned absolute under
// buildDir. Best-effort: unreadable or malformed entries are skipped.
func workspacePackageDirs(buildDir string, rootPkg map[string]interface{}) []string {
	if rootPkg == nil {
		return nil
	}
	var patterns []string
	switch ws := rootPkg["workspaces"].(type) {
	case []interface{}:
		for _, p := range ws {
			if s, ok := p.(string); ok {
				patterns = append(patterns, s)
			}
		}
	case map[string]interface{}:
		if pkgs, ok := ws["packages"].([]interface{}); ok {
			for _, p := range pkgs {
				if s, ok := p.(string); ok {
					patterns = append(patterns, s)
				}
			}
		}
	}

	var dirs []string
	seen := make(map[string]bool)
	add := func(rel string) {
		rel = strings.TrimSuffix(strings.TrimPrefix(rel, "./"), "/")
		if rel == "" || seen[rel] {
			return
		}
		seen[rel] = true
		dirs = append(dirs, filepath.Join(buildDir, rel))
	}

	for _, pat := range patterns {
		if strings.HasSuffix(pat, "/*") {
			base := strings.TrimSuffix(pat, "/*")
			if base == "" || strings.Contains(base, "*") {
				continue
			}
			entries, err := os.ReadDir(filepath.Join(buildDir, base))
			if err != nil {
				continue
			}
			for _, e := range entries {
				if e.IsDir() {
					add(filepath.Join(base, e.Name()))
				}
			}
		} else if !strings.Contains(pat, "*") {
			add(pat)
		}
	}
	return dirs
}

// ---------------------------------------------------------------------------
// Node version & package-manager detection
// ---------------------------------------------------------------------------
//
// A full-stack repo often has multiple package.json files (root + workspace
// packages). pnpm enforces engines.node across the whole workspace, so the
// builder must use a Node version that satisfies the *highest* minimum any
// package requires — otherwise `pnpm install` fails with ERR_PNPM_UNSUPPORTED_ENGINE.

var nodeMajorRe = regexp.MustCompile(`(\d+)`)

// detectNodeVersion scans buildSubDir (root + workspace packages) for the
// largest engines.node minimum and returns it as a major version string. Falls
// back to `fallback` when nothing is declared or parsing fails.
func detectNodeVersion(buildSubDir, fallback string) string {
	best := 0

	consider := func(pkg map[string]interface{}) {
		eng, ok := pkg["engines"].(map[string]interface{})
		if !ok {
			return
		}
		node, ok := eng["node"].(string)
		if !ok {
			return
		}
		if maj := minNodeMajor(node); maj > best {
			best = maj
		}
	}

	if rootPkg := readPackageJSON(filepath.Join(buildSubDir, "package.json")); rootPkg != nil {
		consider(rootPkg)
		for _, dir := range workspacePackageDirs(buildSubDir, rootPkg) {
			if wp := readPackageJSON(filepath.Join(dir, "package.json")); wp != nil {
				consider(wp)
			}
		}
	}

	if best > 0 {
		return strconv.Itoa(best)
	}
	return fallback
}

// minNodeMajor extracts the lowest acceptable Node major version from a semver
// range string such as ">=24.0.0", "^20.11", "18.x", or ">=20 <23". It returns
// 0 when no concrete version can be determined.
func minNodeMajor(rangeStr string) int {
	rangeStr = strings.TrimSpace(rangeStr)
	if rangeStr == "" || rangeStr == "*" {
		return 0
	}

	// Split on || (OR ranges) and take the smallest minimum so we stay
	// compatible with every alternative the author allows.
	best := 0
	for _, alt := range strings.Split(rangeStr, "||") {
		// Within a single range, the binding lower bound is the largest of any
		// >= / > / ^ / ~ / bare comparators present.
		lower := 0
		for _, tok := range strings.Fields(alt) {
			m := nodeMajorRe.FindString(tok)
			if m == "" {
				continue
			}
			maj, err := strconv.Atoi(m)
			if err != nil {
				continue
			}
			// Ignore pure upper bounds ("<23", "<=22") for the minimum.
			if strings.HasPrefix(strings.TrimSpace(tok), "<") {
				continue
			}
			if maj > lower {
				lower = maj
			}
		}
		if lower > 0 && (best == 0 || lower < best) {
			best = lower
		}
	}
	return best
}

// defaultInstallCommand returns the install command to force on Nixpacks based
// on the project's package manager. pnpm is the default for Node projects; we
// defer to an existing yarn/bun lockfile so we don't fight a repo's own choice.
// Returns "" for non-Node projects (no package.json) so other ecosystems use
// Nixpacks' native detection untouched.
func defaultInstallCommand(buildSubDir string) string {
	if _, err := os.Stat(filepath.Join(buildSubDir, "package.json")); err != nil {
		return "" // not a Node project
	}
	switch {
	case fileExists(filepath.Join(buildSubDir, "yarn.lock")):
		return "yarn install"
	case fileExists(filepath.Join(buildSubDir, "bun.lockb")):
		return "bun install"
	default:
		// pnpm-lock.yaml present, npm lockfile present, or no lockfile at all —
		// standardize on pnpm. --no-frozen-lockfile keeps installs resilient when
		// a lockfile is missing or out of sync with the manifest.
		return "pnpm install --no-frozen-lockfile"
	}
}

// readPackageJSON parses a package.json file, returning nil on any error.
func readPackageJSON(path string) map[string]interface{} {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var pkg map[string]interface{}
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil
	}
	return pkg
}

// fileExists reports whether a regular file or directory exists at path.
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
