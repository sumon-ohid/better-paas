package main

import (
	"bufio"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

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
	if !strings.HasPrefix(raw, "http") && !strings.HasPrefix(raw, "git") {
		return "https://" + raw
	}
	return raw
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

// runPaaSDeployment clones, builds with Nixpacks, and runs the container.
func runPaaSDeployment(app App, gitURL, deployID, logFile string) {
	startedAt := time.Now()

	// Seed the deployment record in DB immediately.
	dep := DeploymentRecord{
		ID:        deployID,
		AppID:     app.ID,
		AppName:   app.Name,
		Status:    "building",
		LogFile:   logFile,
		CreatedAt: startedAt,
	}
	if err := dbCreateDeployment(dep); err != nil {
		log.Printf("[db] failed to create deployment: %v", err)
	}

	// Collect in-memory logs for the final record.
	var deployLogs []string
	localLog := func(msg string) {
		logToBuild(app.ID, msg, logFile)
		deployLogs = append(deployLogs, msg)
	}

	localLog(fmt.Sprintf("✨ Initializing environment for app: %s", app.Name))
	buildDir := filepath.Join("builds", app.Name)

	// Delete existing build folder
	os.RemoveAll(buildDir)

	// ── 1. Clone repository ──────────────────────────────────────────────────
	localLog(fmt.Sprintf("📦 Cloning %s [branch: %s]...", gitURL, app.Branch))
	authenticatedURL := formatGitURL(gitURL, app.GitToken)
	cloneCmd := exec.Command("git", "clone", authenticatedURL, buildDir, "--branch", app.Branch, "--depth", "1")
	if output, err := cloneCmd.CombinedOutput(); err != nil {
		localLog(fmt.Sprintf("✖ Git clone failed: %v\nOutput: %s", err, string(output)))
		finishDeployment(app, deployLogs, "failed", startedAt, deployID, logFile)
		return
	}
	localLog("✔ Repository cloned successfully.")

	// ── 2. Patch package.json ────────────────────────────────────────────────
	patchPackageJSON(app.ID, buildDir, localLog)

	// ── 3. Determine build subdirectory ─────────────────────────────────────
	buildSubDir := buildDir
	if app.RootDir != "" && app.RootDir != "." && app.RootDir != "./" {
		buildSubDir = filepath.Join(buildDir, app.RootDir)
		localLog(fmt.Sprintf("📂 Using sub-directory build context: %s", app.RootDir))
	}

	// ── 4. Remove restrictive .dockerignore ──────────────────────────────────
	dockerignorePath := filepath.Join(buildSubDir, ".dockerignore")
	if _, err := os.Stat(dockerignorePath); err == nil {
		os.Rename(dockerignorePath, dockerignorePath+".bak")
		localLog("📝 Removed restrictive .dockerignore for Nixpacks build")
	}

	// ── 5. Build with Nixpacks ───────────────────────────────────────────────
	localLog("🔍 Analyzing workspace with Nixpacks...")
	nixpacksArgs := []string{"build", buildSubDir, "--name", app.Name, "--env", "NIXPACKS_NODE_VERSION=22"}
	for k, v := range app.EnvVars {
		nixpacksArgs = append(nixpacksArgs, "--env", fmt.Sprintf("%s=%s", k, v))
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
		finishDeployment(app, deployLogs, "failed", startedAt, deployID, logFile)
		return
	}
	nixpacksCmd.Stderr = nixpacksCmd.Stdout

	if err := nixpacksCmd.Start(); err != nil {
		localLog(fmt.Sprintf("✖ Failed to start Nixpacks: %v", err))
		finishDeployment(app, deployLogs, "failed", startedAt, deployID, logFile)
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
		finishDeployment(app, deployLogs, "failed", startedAt, deployID, logFile)
		return
	}
	localLog("✔ Docker image built successfully!")

	// ── 5. Stop and remove existing container ───────────────────────────────
	localLog("🧹 Pruning previous container instances...")
	exec.Command("docker", "rm", "-f", app.Name).Run()

	// ── 6. Run the container ─────────────────────────────────────────────────
	containerPort := app.Port
	if app.PortOverride > 0 {
		containerPort = app.PortOverride
	}

	localLog(fmt.Sprintf("🚀 Starting container (host :%d → container :%d)...", app.Port, containerPort))
	runArgs := []string{
		"run", "-d",
		"-p", fmt.Sprintf("%d:%d", app.Port, containerPort),
		"-e", fmt.Sprintf("PORT=%d", containerPort),
		"--restart", "unless-stopped",
	}
	for k, v := range app.EnvVars {
		runArgs = append(runArgs, "-e", fmt.Sprintf("%s=%s", k, v))
	}
	runArgs = append(runArgs, "--name", app.Name, app.Name)

	if output, err := exec.Command("docker", runArgs...).CombinedOutput(); err != nil {
		localLog(fmt.Sprintf("✖ Container startup failed: %v\nOutput: %s", err, string(output)))
		finishDeployment(app, deployLogs, "failed", startedAt, deployID, logFile)
		return
	}

	localLog(fmt.Sprintf("✅ Deployment complete! App live at: %s", app.URL))
	finishDeployment(app, deployLogs, "success", startedAt, deployID, logFile)
}

// finishDeployment updates app status, saves deployment record, and persists.
func finishDeployment(app App, deployLogs []string, status string, startedAt time.Time, deployID, logFile string) {
	duration := time.Since(startedAt).Round(time.Second).String()

	finalStatus := "running"
	if status == "failed" {
		finalStatus = "failed"
	}

	// Update app status in memory and DB.
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
	}

	// Upsert final status to DB.
	if err := dbCreateDeployment(record); err != nil {
		log.Printf("[db] failed to save deployment: %v", err)
	}
	if err := dbPruneDeployments(100); err != nil {
		log.Printf("[db] failed to prune deployments: %v", err)
	}
}

// patchPackageJSON sanitizes a Node.js package.json for Nixpacks compatibility.
func patchPackageJSON(appID, buildDir string, logger func(string)) {
	pkgPath := filepath.Join(buildDir, "package.json")
	if _, err := os.Stat(pkgPath); err != nil {
		return
	}

	data, err := os.ReadFile(pkgPath)
	if err != nil {
		return
	}

	var pkg map[string]interface{}
	if err := json.Unmarshal(data, &pkg); err != nil {
		return
	}

	// Strip restrictions that break Nixpacks
	delete(pkg, "engines")
	delete(pkg, "packageManager")

	scripts, _ := pkg["scripts"].(map[string]interface{})
	if scripts == nil {
		scripts = make(map[string]interface{})
		pkg["scripts"] = scripts
	}

	if _, hasStart := scripts["start"]; !hasStart {
		logger("⚠️  No start script found. Checking for monorepo configuration...")
		webPkgPath := filepath.Join(buildDir, "apps", "web", "package.json")
		if _, err := os.Stat(webPkgPath); err == nil {
			logger("💡 Monorepo detected at apps/web. Injecting root start command...")
			scripts["start"] = "pnpm --filter @repo/web start"
		}
	}

	if updated, err := json.MarshalIndent(pkg, "", "  "); err == nil {
		os.WriteFile(pkgPath, updated, 0644)
	}
}
