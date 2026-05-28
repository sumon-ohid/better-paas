package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// generateRandomID returns a 10-character lowercase alphanumeric string.
func generateRandomID() string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 10)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
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

// logToBuild appends a log line to the in-memory build log and broadcasts
// it to any connected WebSocket subscribers.
func logToBuild(appID, message string) {
	log.Printf("[%s] %s", appID, message)

	buildLogsLock.Lock()
	buildLogs[appID] = append(buildLogs[appID], message)
	buildLogsLock.Unlock()

	subscribersLock.Lock()
	for ch := range subscribers[appID] {
		select {
		case ch <- message:
		default: // drop if subscriber is slow
		}
	}
	subscribersLock.Unlock()
}

// updateAppStatus updates app status and persists to disk.
func updateAppStatus(appID, status string) {
	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == appID {
			apps[i].Status = status
			break
		}
	}
	appsLock.Unlock()
	saveDB()
	rebuildCaddyfile()
}

// allocatePort picks a random port in [9000, 9999].
func allocatePort() int {
	return rand.Intn(1000) + 9000
}

// runDockerPrune runs docker system prune -f --volumes and returns output.
func runDockerPrune() (string, error) {
	cmd := exec.Command("docker", "system", "prune", "-f", "--volumes")
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// runPaaSDeployment clones, builds with Nixpacks, and runs the container.
func runPaaSDeployment(app App, gitURL string) {
	startedAt := time.Now()

	// Collect all logs for the deployment record
	var deployLogs []string
	localLog := func(msg string) {
		logToBuild(app.ID, msg)
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
		finishDeployment(app, deployLogs, "failed", startedAt)
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

	// ── 4. Build with Nixpacks ───────────────────────────────────────────────
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
		finishDeployment(app, deployLogs, "failed", startedAt)
		return
	}
	nixpacksCmd.Stderr = nixpacksCmd.Stdout

	if err := nixpacksCmd.Start(); err != nil {
		localLog(fmt.Sprintf("✖ Failed to start Nixpacks: %v", err))
		finishDeployment(app, deployLogs, "failed", startedAt)
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
		finishDeployment(app, deployLogs, "failed", startedAt)
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
		finishDeployment(app, deployLogs, "failed", startedAt)
		return
	}

	localLog(fmt.Sprintf("✅ Deployment complete! App live at: %s", app.URL))
	finishDeployment(app, deployLogs, "success", startedAt)
}

// finishDeployment updates app status, saves deployment record, and persists.
func finishDeployment(app App, logs []string, status string, startedAt time.Time) {
	duration := time.Since(startedAt).Round(time.Second).String()

	finalStatus := "running"
	if status == "failed" {
		finalStatus = "failed"
	}

	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == app.ID {
			apps[i].Status = finalStatus
			break
		}
	}
	appsLock.Unlock()

	record := DeploymentRecord{
		ID:        generateRandomID(),
		AppID:     app.ID,
		AppName:   app.Name,
		Status:    status,
		Logs:      logs,
		CreatedAt: time.Now(),
		Duration:  duration,
	}

	deploymentsLock.Lock()
	deployments = append([]DeploymentRecord{record}, deployments...) // newest first
	// Cap history at 100 records
	if len(deployments) > 100 {
		deployments = deployments[:100]
	}
	deploymentsLock.Unlock()

	saveDB()
	rebuildCaddyfile()
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
