package paas

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
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
			Name     string            `json:"name"`
			Severity string            `json:"severity"`
			Range    string            `json:"range"`
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

	if app.BuildMethod == "image" || app.CatalogID != "" {
		saveVulnerabilityCount(app.ID, 0)
		jsonOK(w, map[string]interface{}{
			"vulnerabilities": []VulnerabilityInfo{},
			"packageManager":  "container image",
		})
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
		saveVulnerabilityCount(app.ID, 0)
		jsonOK(w, map[string]interface{}{
			"vulnerabilities": []VulnerabilityInfo{},
			"packageManager":  "",
		})
		return
	}

	vulnerabilities, packageManager, err := runAuditForPath(appPath)
	if err != nil {
		if strings.Contains(err.Error(), "no package.json found") {
			saveVulnerabilityCount(app.ID, 0)
			jsonOK(w, map[string]interface{}{
				"vulnerabilities": []VulnerabilityInfo{},
				"packageManager":  "",
			})
			return
		}
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	saveVulnerabilityCount(app.ID, len(vulnerabilities))

	jsonOK(w, map[string]interface{}{
		"vulnerabilities": vulnerabilities,
		"packageManager":  packageManager,
	})
}

func saveVulnerabilityCount(appID string, count int) {
	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == appID {
			apps[i].VulnerabilitiesCount = count
			break
		}
	}
	appsLock.Unlock()

	app := findApp(appID)
	if app == nil {
		return
	}
	if err := dbSaveApp(*app); err != nil {
		log.Printf("[db] failed to save app vulnerabilities count: %v", err)
	}
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
			// Update the package and all its transitive usages recursively
			updateCmd = exec.Command("pnpm", "update", pkgName, "--depth", "Infinity", "--no-frozen-lockfile", "--ignore-scripts", "--config.confirmModulesPurge=false")
		} else {
			updateCmd = exec.Command("pnpm", "update", "--no-frozen-lockfile", "--ignore-scripts", "--config.confirmModulesPurge=false")
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

	// Inject overrides to ensure transitive vulnerabilities are forced to resolve to safe versions
	var vulnerabilities []VulnerabilityInfo
	if pkgName == "" {
		vuls, _, err := runAuditForPath(appPath)
		if err == nil {
			vulnerabilities = vuls
		} else {
			log.Printf("[vulnerabilities] failed to audit path before fix: %v", err)
		}
	}

	overridesInjected := false
	if err := injectDependencyOverrides(appPath, packageManager, pkgName, vulnerabilities); err != nil {
		log.Printf("[vulnerabilities] failed to inject dependency overrides: %v", err)
	} else {
		overridesInjected = true
	}

	ensureValidPnpmWorkspace(appPath, nil)

	// For pnpm: if overrides changed, regenerate the lockfile before deploying.
	// Docker/Nixpacks runs pnpm in CI, where bare `pnpm install` is frozen by
	// default, so package metadata and pnpm-lock.yaml must agree exactly.
	if packageManager == "pnpm" && overridesInjected {
		if err := regeneratePnpmLockfile(appPath); err != nil {
			jsonError(w, fmt.Sprintf("Failed to regenerate pnpm lockfile: %v", err), http.StatusInternalServerError)
			return
		}
		log.Printf("[vulnerabilities] pnpm lockfile regenerated with new overrides")
		goto deploy
	}

	updateCmd.Dir = appPath
	if output, err := updateCmd.CombinedOutput(); err != nil {
		jsonError(w, fmt.Sprintf("Failed to update package: %v\nOutput: %s", err, string(output)), http.StatusInternalServerError)
		return
	}

deploy:

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
			authenticatedURL := formatGitURL(gitURL, resolvedGitHubToken(*app))
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

	appForDeploy := *app
	if triggerType == "local" && packageManager == "pnpm" {
		appForDeploy.InstallCommand = pnpmFrozenInstallCommand(appPath)
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
	go runDeployment(appForDeploy, normalizeGitURL(app.GitRepo), deployID, logFile, triggerType, "", false)

	jsonOK(w, map[string]interface{}{
		"status":   "deploying",
		"deployId": deployID,
	})
}

func regeneratePnpmLockfile(appPath string) error {
	if err := preparePinnedPnpm(appPath); err != nil {
		return err
	}

	if output, err := runPnpm(appPath, "install", "--lockfile-only", "--no-frozen-lockfile", "--ignore-scripts"); err != nil {
		return fmt.Errorf("%v\nOutput: %s", err, string(output))
	}

	if output, err := runPnpm(appPath, "install", "--frozen-lockfile", "--ignore-scripts", "--config.confirmModulesPurge=false"); err != nil {
		return fmt.Errorf("%v\nOutput: %s", err, string(output))
	}
	return nil
}

func preparePinnedPnpm(appPath string) error {
	version := pinnedPnpmVersion(appPath)
	if version == "" {
		return nil
	}

	cmd := exec.Command("corepack", "prepare", "pnpm@"+version, "--activate")
	cmd.Dir = appPath
	cmd.Env = append(os.Environ(), "CI=true")
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to activate pnpm@%s via Corepack: %v\nOutput: %s", version, err, string(output))
	}
	return nil
}

func runPnpm(appPath string, args ...string) ([]byte, error) {
	cmdName := "pnpm"
	cmdArgs := args
	if pinnedPnpmVersion(appPath) != "" {
		cmdName = "corepack"
		cmdArgs = append([]string{"pnpm"}, args...)
	}

	cmd := exec.Command(cmdName, cmdArgs...)
	cmd.Dir = appPath
	cmd.Env = append(os.Environ(), "CI=true")
	return cmd.CombinedOutput()
}

func pinnedPnpmVersion(appPath string) string {
	pkg := readPackageJSON(filepath.Join(appPath, "package.json"))
	if pkg == nil {
		return ""
	}
	pm, ok := pkg["packageManager"].(string)
	if !ok || !strings.HasPrefix(pm, "pnpm@") {
		return ""
	}
	version := strings.TrimSpace(strings.TrimPrefix(pm, "pnpm@"))
	if version == "" || !isSafePackageManagerVersion(version) {
		return ""
	}
	return version
}

func isSafePackageManagerVersion(version string) bool {
	for _, r := range version {
		if r >= '0' && r <= '9' {
			continue
		}
		if r >= 'A' && r <= 'Z' {
			continue
		}
		if r >= 'a' && r <= 'z' {
			continue
		}
		switch r {
		case '.', '-', '_', '+':
			continue
		}
		return false
	}
	return true
}

func pnpmFrozenInstallCommand(appPath string) string {
	version := pinnedPnpmVersion(appPath)
	if version == "" {
		return "pnpm install --frozen-lockfile"
	}
	return fmt.Sprintf("corepack enable && corepack prepare pnpm@%s --activate && pnpm install --frozen-lockfile", version)
}

// getLatestNpmVersion queries npm registry for the latest version of a package.
func getLatestNpmVersion(ctx context.Context, pkg string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "npm", "view", pkg, "version")
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

// injectDependencyOverrides injects overrides/resolutions to package.json to force transitive dependency updates.
func injectDependencyOverrides(appPath, packageManager, targetPkg string, vulnerabilities []VulnerabilityInfo) error {
	packageJSONPath := filepath.Join(appPath, "package.json")
	if _, err := os.Stat(packageJSONPath); os.IsNotExist(err) {
		return nil // No package.json, skip
	}

	// Determine packages to override
	var pkgsToOverride []string
	if targetPkg != "" {
		pkgsToOverride = append(pkgsToOverride, targetPkg)
	} else {
		// Dedup package names from vulnerabilities list
		seen := make(map[string]bool)
		for _, vul := range vulnerabilities {
			if vul.Package != "" && !seen[vul.Package] {
				seen[vul.Package] = true
				pkgsToOverride = append(pkgsToOverride, vul.Package)
			}
		}
	}

	if len(pkgsToOverride) == 0 {
		return nil
	}

	// Fetch latest versions concurrently
	var wg sync.WaitGroup
	var mu sync.Mutex
	pkgVersions := make(map[string]string)

	ctx := context.Background()
	for _, pkg := range pkgsToOverride {
		wg.Add(1)
		go func(p string) {
			defer wg.Done()
			ver, err := getLatestNpmVersion(ctx, p)
			if err != nil {
				log.Printf("[vulnerabilities] failed to fetch latest version for %s: %v", p, err)
				return
			}
			mu.Lock()
			pkgVersions[p] = ver
			mu.Unlock()
		}(pkg)
	}
	wg.Wait()

	if len(pkgVersions) == 0 {
		return nil // Nothing successfully fetched
	}

	// Read package.json
	data, err := os.ReadFile(packageJSONPath)
	if err != nil {
		return err
	}

	var pkgMap map[string]interface{}
	if err := json.Unmarshal(data, &pkgMap); err != nil {
		return err
	}

	switch packageManager {
	case "pnpm":
		// pnpm v11+ ignores overrides in package.json; they must be in pnpm-workspace.yaml.
		// We patch (or create) that file with the needed overrides section.
		if err := injectPnpmWorkspaceOverrides(appPath, pkgVersions); err != nil {
			return err
		}
		var pnpmConfig map[string]interface{}
		if val, exists := pkgMap["pnpm"]; exists {
			if m, ok := val.(map[string]interface{}); ok {
				pnpmConfig = m
			}
		}
		if pnpmConfig == nil {
			pnpmConfig = make(map[string]interface{})
		}

		var overrides map[string]interface{}
		if val, exists := pnpmConfig["overrides"]; exists {
			if m, ok := val.(map[string]interface{}); ok {
				overrides = m
			}
		}
		if overrides == nil {
			overrides = make(map[string]interface{})
		}

		for pkg, ver := range pkgVersions {
			overrides[pkg] = "^" + ver
			log.Printf("[vulnerabilities] injecting pnpm package override: %s -> ^%s", pkg, ver)
		}
		pnpmConfig["overrides"] = overrides
		pkgMap["pnpm"] = pnpmConfig

	case "yarn":
		var resolutions map[string]interface{}
		if val, exists := pkgMap["resolutions"]; exists {
			if m, ok := val.(map[string]interface{}); ok {
				resolutions = m
			}
		}
		if resolutions == nil {
			resolutions = make(map[string]interface{})
		}

		for pkg, ver := range pkgVersions {
			resolutions[pkg] = "^" + ver
			log.Printf("[vulnerabilities] injecting yarn resolution: %s -> ^%s", pkg, ver)
		}
		pkgMap["resolutions"] = resolutions

	default: // npm
		var overrides map[string]interface{}
		if val, exists := pkgMap["overrides"]; exists {
			if m, ok := val.(map[string]interface{}); ok {
				overrides = m
			}
		}
		if overrides == nil {
			overrides = make(map[string]interface{})
		}

		for pkg, ver := range pkgVersions {
			overrides[pkg] = "^" + ver
			log.Printf("[vulnerabilities] injecting npm override: %s -> ^%s", pkg, ver)
		}
		pkgMap["overrides"] = overrides
	}

	newData, err := json.MarshalIndent(pkgMap, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(packageJSONPath, newData, 0644)
}

// injectPnpmWorkspaceOverrides writes/updates the overrides: section in
// pnpm-workspace.yaml (pnpm v11+ ignores package.json["pnpm"]["overrides"]).
// If pnpm-workspace.yaml does not exist it is created.
func injectPnpmWorkspaceOverrides(appPath string, pkgVersions map[string]string) error {
	workspacePath := ""
	for _, name := range []string{"pnpm-workspace.yaml", "pnpm-workspace.yml"} {
		p := filepath.Join(appPath, name)
		if _, err := os.Stat(p); err == nil {
			workspacePath = p
			break
		}
	}
	if workspacePath == "" {
		workspacePath = filepath.Join(appPath, "pnpm-workspace.yaml")
	}

	var existing string
	if data, err := os.ReadFile(workspacePath); err == nil {
		existing = string(data)
	}

	// Remove any existing overrides: block while preserving its entries for merge.
	lines := strings.Split(existing, "\n")
	var filtered []string
	inOverridesBlock := false
	existingOverrides := make(map[string]string)
	for _, line := range lines {
		trimmed := strings.TrimRight(line, " \t")
		if trimmed == "overrides:" {
			inOverridesBlock = true
			continue
		}
		if inOverridesBlock {
			// Lines that start with whitespace are continuation of the overrides block
			if len(trimmed) > 0 && (trimmed[0] == ' ' || trimmed[0] == '\t') {
				if pkg, ver, ok := strings.Cut(strings.TrimSpace(trimmed), ":"); ok {
					existingOverrides[strings.TrimSpace(pkg)] = strings.Trim(strings.TrimSpace(ver), `"'`)
				}
				continue
			}
			inOverridesBlock = false
		}
		filtered = append(filtered, line)
	}

	// Trim trailing blank lines
	for len(filtered) > 0 && strings.TrimSpace(filtered[len(filtered)-1]) == "" {
		filtered = filtered[:len(filtered)-1]
	}

	// Ensure packages: entry exists
	content := strings.Join(filtered, "\n")
	if !strings.Contains(content, "packages:") {
		content = content + "\n\npackages:\n  - '.'"
	}

	// Append overrides block (merge with any pre-existing entries).
	mergedOverrides := existingOverrides
	for pkg, ver := range pkgVersions {
		mergedOverrides[pkg] = "^" + ver
		log.Printf("[vulnerabilities] injecting pnpm workspace override: %s -> ^%s", pkg, ver)
	}
	overrideLines := "\n\noverrides:"
	for pkg, ver := range mergedOverrides {
		overrideLines += fmt.Sprintf("\n  %s: \"%s\"", pkg, ver)
	}
	content = content + overrideLines + "\n"

	return os.WriteFile(workspacePath, []byte(content), 0644)
}
