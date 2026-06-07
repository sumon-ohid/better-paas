package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// VulnerabilityInfo represents a single detected package vulnerability.
type VulnerabilityInfo struct {
	Package  string `json:"package"`
	Severity string `json:"severity"`
	Title    string `json:"title"`
	URL      string `json:"url"`
	Range    string `json:"range"`
}

// scanAndSaveVulnerabilities runs the vulnerability check on an app's local repository
// and updates the vulnerabilities count in memory and database.
func scanAndSaveVulnerabilities(appID string) (int, error) {
	app := findApp(appID)
	if app == nil {
		return 0, fmt.Errorf("app %s not found", appID)
	}

	buildDir := filepath.Join("builds", app.ID)
	appPath := buildDir
	if app.RootDir != "" && app.RootDir != "." && app.RootDir != "./" {
		rootDir, err := validateRootDir(app.RootDir)
		if err == nil {
			appPath = filepath.Join(buildDir, rootDir)
		}
	}

	// If build directory doesn't exist, app is not deployed yet.
	if _, err := os.Stat(appPath); os.IsNotExist(err) {
		return 0, nil
	}

	vulnerabilities, _, err := runAuditForPath(appPath)
	if err != nil {
		// Log but don't fail, maybe audit tool failed or project is not Node.js.
		log.Printf("[vulnerabilities] audit failed for app %s: %v", app.Name, err)
		return 0, nil
	}

	count := len(vulnerabilities)

	// Update in-memory App list
	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == app.ID {
			apps[i].VulnerabilitiesCount = count
			break
		}
	}
	appsLock.Unlock()

	// Update Database
	if err := dbSaveApp(*findApp(app.ID)); err != nil {
		log.Printf("[db] failed to save app vulnerabilities count: %v", err)
	}

	return count, nil
}

// runAuditForPath runs the audit tool in the specified path and returns parsed findings.
func runAuditForPath(appPath string) ([]VulnerabilityInfo, string, error) {
	// First check if package.json exists.
	if _, err := os.Stat(filepath.Join(appPath, "package.json")); os.IsNotExist(err) {
		return nil, "", fmt.Errorf("no package.json found at %s", appPath)
	}

	// Detect package manager
	packageManager := "npm"
	if _, err := os.Stat(filepath.Join(appPath, "pnpm-lock.yaml")); err == nil {
		packageManager = "pnpm"
	} else if _, err := os.Stat(filepath.Join(appPath, "yarn.lock")); err == nil {
		packageManager = "yarn"
	} else if _, err := os.Stat(filepath.Join(appPath, "package-lock.json")); err == nil {
		packageManager = "npm"
	}

	var cmdName string
	var cmdArgs []string

	switch packageManager {
	case "pnpm":
		cmdName = "pnpm"
		cmdArgs = []string{"audit", "--json"}
	case "yarn":
		cmdName = "yarn"
		cmdArgs = []string{"audit", "--json"}
	default:
		cmdName = "npm"
		cmdArgs = []string{"audit", "--json"}
	}

	cmd := exec.Command(cmdName, cmdArgs...)
	cmd.Dir = appPath

	// Note: audit commands exit non-zero when vulnerabilities are found, so we ignore
	// the error and check the output.
	out, _ := cmd.CombinedOutput()

	list := parseAuditOutput(out, packageManager)
	return list, packageManager, nil
}

// parseAuditOutput parses npm, pnpm, and yarn audit json formats.
func parseAuditOutput(data []byte, packageManager string) []VulnerabilityInfo {
	var list []VulnerabilityInfo

	if packageManager == "yarn" {
		// Yarn audit format is NDJSON (Newline Delimited JSON)
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			if strings.TrimSpace(line) == "" {
				continue
			}
			var entry struct {
				Type string `json:"type"`
				Data struct {
					Advisory struct {
						ModuleName      string `json:"module_name"`
						Severity        string `json:"severity"`
						Title           string `json:"title"`
						URL             string `json:"url"`
						PatchedVersions string `json:"patched_versions"`
					} `json:"advisory"`
				} `json:"data"`
			}
			if err := json.Unmarshal([]byte(line), &entry); err == nil && entry.Type == "auditAdvisory" {
				list = append(list, VulnerabilityInfo{
					Package:  entry.Data.Advisory.ModuleName,
					Severity: entry.Data.Advisory.Severity,
					Title:    entry.Data.Advisory.Title,
					URL:      entry.Data.Advisory.URL,
					Range:    entry.Data.Advisory.PatchedVersions,
				})
			}
		}
		return list
	}

	// Try pnpm format first
	var pnpmOutput struct {
		Advisories map[string]struct {
			ModuleName      string `json:"module_name"`
			Severity        string `json:"severity"`
			Title           string `json:"title"`
			URL             string `json:"url"`
			PatchedVersions string `json:"patched_versions"`
		} `json:"advisories"`
	}
	if err := json.Unmarshal(data, &pnpmOutput); err == nil && len(pnpmOutput.Advisories) > 0 {
		for _, adv := range pnpmOutput.Advisories {
			list = append(list, VulnerabilityInfo{
				Package:  adv.ModuleName,
				Severity: adv.Severity,
				Title:    adv.Title,
				URL:      adv.URL,
				Range:    adv.PatchedVersions,
			})
		}
		return list
	}

	// Try standard npm audit v2 format
	var npmOutput struct {
		Vulnerabilities map[string]struct {
			Name     string `json:"name"`
			Severity string `json:"severity"`
			Range    string `json:"range"`
			Via      []json.RawMessage `json:"via"`
		} `json:"vulnerabilities"`
	}
	if err := json.Unmarshal(data, &npmOutput); err == nil && len(npmOutput.Vulnerabilities) > 0 {
		for pkgName, vul := range npmOutput.Vulnerabilities {
			name := vul.Name
			if name == "" {
				name = pkgName
			}
			
			title := "Vulnerability in " + name
			url := ""
			
			for _, rawVia := range vul.Via {
				var viaObj struct {
					Title string `json:"title"`
					URL   string `json:"url"`
				}
				if err := json.Unmarshal(rawVia, &viaObj); err == nil && viaObj.Title != "" {
					title = viaObj.Title
					url = viaObj.URL
					break
				}
			}

			list = append(list, VulnerabilityInfo{
				Package:  name,
				Severity: vul.Severity,
				Title:    title,
				URL:      url,
				Range:    vul.Range,
			})
		}
		return list
	}

	return list
}

// GET /api/apps/vulnerabilities/scan?id=...
func handleVulnerabilitiesScan(w http.ResponseWriter, r *http.Request) {
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

	buildDir := filepath.Join("builds", app.ID)
	appPath := buildDir
	if app.RootDir != "" && app.RootDir != "." && app.RootDir != "./" {
		rootDir, err := validateRootDir(app.RootDir)
		if err != nil {
			jsonError(w, fmt.Sprintf("invalid root directory: %v", err), http.StatusBadRequest)
			return
		}
		appPath = filepath.Join(buildDir, rootDir)
	}

	if _, err := os.Stat(appPath); os.IsNotExist(err) {
		jsonError(w, "Application has not been deployed yet. Deploy the app to compile and run vulnerability checks.", http.StatusBadRequest)
		return
	}

	vulnerabilities, packageManager, err := runAuditForPath(appPath)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Update local and DB count as a side effect
	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == app.ID {
			apps[i].VulnerabilitiesCount = len(vulnerabilities)
			break
		}
	}
	appsLock.Unlock()

	if err := dbSaveApp(*findApp(app.ID)); err != nil {
		log.Printf("[db] failed to save app vulnerabilities count: %v", err)
	}

	jsonOK(w, map[string]interface{}{
		"vulnerabilities": vulnerabilities,
		"packageManager":  packageManager,
	})
}

// POST /api/apps/vulnerabilities/fix
func handleVulnerabilitiesFix(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID      string `json:"id"`
		Option  string `json:"option"`  // "git" or "local"
		Package string `json:"package"` // optional package name
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

	buildDir := filepath.Join("builds", app.ID)
	appPath := buildDir
	if app.RootDir != "" && app.RootDir != "." && app.RootDir != "./" {
		rootDir, err := validateRootDir(app.RootDir)
		if err != nil {
			jsonError(w, err.Error(), http.StatusBadRequest)
			return
		}
		appPath = filepath.Join(buildDir, rootDir)
	}

	if _, err := os.Stat(appPath); os.IsNotExist(err) {
		jsonError(w, "Application build directory not found. Please deploy the app first.", http.StatusBadRequest)
		return
	}

	// Detect package manager
	packageManager := "npm"
	if _, err := os.Stat(filepath.Join(appPath, "pnpm-lock.yaml")); err == nil {
		packageManager = "pnpm"
	} else if _, err := os.Stat(filepath.Join(appPath, "yarn.lock")); err == nil {
		packageManager = "yarn"
	} else if _, err := os.Stat(filepath.Join(appPath, "package-lock.json")); err == nil {
		packageManager = "npm"
	}

	var updateCmd *exec.Cmd
	pkgName := strings.TrimSpace(req.Package)

	// Run update/install commands in appPath
	switch packageManager {
	case "pnpm":
		if pkgName != "" {
			updateCmd = exec.Command("pnpm", "add", pkgName+"@latest", "--ignore-scripts")
		} else {
			updateCmd = exec.Command("pnpm", "update", "--ignore-scripts")
		}
	case "yarn":
		if pkgName != "" {
			updateCmd = exec.Command("yarn", "add", pkgName+"@latest", "--ignore-scripts")
		} else {
			updateCmd = exec.Command("yarn", "upgrade", "--ignore-scripts")
		}
	default: // npm
		if pkgName != "" {
			updateCmd = exec.Command("npm", "install", pkgName+"@latest", "--ignore-scripts")
		} else {
			updateCmd = exec.Command("npm", "audit", "fix", "--ignore-scripts")
		}
	}

	ensureValidPnpmWorkspace(appPath, nil)

	updateCmd.Dir = appPath
	if output, err := updateCmd.CombinedOutput(); err != nil {
		jsonError(w, fmt.Sprintf("Failed to update package: %v\nOutput: %s", err, string(output)), http.StatusInternalServerError)
		return
	}

	deployID := generateRandomID()
	logFile := filepath.Join("data", "logs", app.ID, deployID+".log")
	os.MkdirAll(filepath.Dir(logFile), 0755)

	triggerType := "manual"

	if req.Option == "git" {
		// Commit and push back to git
		// Check git status to see if any package files were actually modified.
		statusCmd := exec.Command("git", "status", "--porcelain")
		statusCmd.Dir = buildDir
		statusOut, err := statusCmd.Output()
		if err != nil {
			jsonError(w, fmt.Sprintf("Git status check failed: %v", err), http.StatusInternalServerError)
			return
		}

		if len(strings.TrimSpace(string(statusOut))) > 0 {
			// Set git configs locally so it does not fail if global config is missing
			exec.Command("git", "config", "user.name", "Better-PaaS Auto-Update").Run()
			exec.Command("git", "config", "user.email", "auto-update@better-paas.local").Run()

			// Stage package/lock files
			addCmd := exec.Command("git", "add", ".")
			addCmd.Dir = buildDir
			if err := addCmd.Run(); err != nil {
				jsonError(w, fmt.Sprintf("Git add failed: %v", err), http.StatusInternalServerError)
				return
			}

			commitMsg := "chore: auto-update vulnerable packages"
			if pkgName != "" {
				commitMsg = fmt.Sprintf("chore: update vulnerable package %s", pkgName)
			}
			commitCmd := exec.Command("git", "commit", "-m", commitMsg)
			commitCmd.Dir = buildDir
			if err := commitCmd.Run(); err != nil {
				jsonError(w, fmt.Sprintf("Git commit failed: %v", err), http.StatusInternalServerError)
				return
			}

			// Push to Git
			gitURL := normalizeGitURL(app.GitRepo)
			authenticatedURL := formatGitURL(gitURL, app.GitToken)
			branch := app.Branch
			if branch == "" {
				branch = "main"
			}
			pushCmd := exec.Command("git", "push", authenticatedURL, branch)
			pushCmd.Dir = buildDir
			if output, err := pushCmd.CombinedOutput(); err != nil {
				jsonError(w, fmt.Sprintf("Git push failed: %v\nOutput: %s", err, scrubCredentials(string(output))), http.StatusInternalServerError)
				return
			}
		}
	} else {
		// Local deploy trigger skips Git checkout
		triggerType = "local"
	}

	// Set status to building
	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == app.ID {
			apps[i].Status = "building"
			break
		}
	}
	appsLock.Unlock()
	dbUpdateAppStatus(app.ID, "building")
	rebuildCaddyfile()

	// Redeploy the app
	go runDeployment(*app, normalizeGitURL(app.GitRepo), deployID, logFile, triggerType, "", false)

	jsonOK(w, map[string]interface{}{
		"status":   "deploying",
		"deployId": deployID,
	})
}
