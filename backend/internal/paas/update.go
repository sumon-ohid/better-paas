package paas

import (
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

// ---------------------------------------------------------------------------
// One-click self-update (git checkout + systemd model)
// ---------------------------------------------------------------------------
//
// The running server cannot safely rebuild and restart itself in-process: the
// moment systemd restarts the unit, this process dies mid-step. So applying an
// update is delegated to a detached helper script that:
//
//   1. git fetch + checkout the target ref
//   2. rebuild backend (go build) and frontend (pnpm build)
//   3. restart the systemd units (or relaunch on macOS/dev)
//
// The server's job is only to: take a pre-update backup, write the helper
// script, launch it detached (so it outlives the restart), and record progress
// to a status file the dashboard can poll.
//
// Safety:
//   - A backup is always taken first (reuses createBackup()).
//   - The helper builds into a temp binary and only swaps it in on success, so
//     a failed build leaves the current server running.
//   - Concurrent applies are rejected.

const (
	updateStateMetaKey = "update_state"
	updateLogFile      = "data/update.log"
)

var updateApplyLock sync.Mutex
var updateInProgress bool

// repoDir returns the git checkout root by querying git or falling back
// to the parent of the working directory.
func repoDir() string {
	wd, err := os.Getwd()
	if err != nil {
		wd = "."
	}
	// Try to find the git repository toplevel.
	out, err := exec.Command("git", "-C", wd, "rev-parse", "--show-toplevel").Output()
	if err == nil {
		if path := strings.TrimSpace(string(out)); path != "" {
			return path
		}
	}
	// Fallback to old behavior: one level up
	return filepath.Dir(wd)
}

// isGitCheckout reports whether the install is a git checkout we can pull.
func isGitCheckout() bool {
	info, err := os.Stat(filepath.Join(repoDir(), ".git"))
	return err == nil && info.IsDir()
}

// ---------------------------------------------------------------------------
// GET /api/system/version - current version + cached update status
// ---------------------------------------------------------------------------

func handleSystemVersion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jsonOK(w, map[string]any{
		"version":     version,
		"gitCheckout": isGitCheckout(),
		"updateRepo":  updateRepoSlug(),
	})
}

// ---------------------------------------------------------------------------
// GET/POST /api/system/domain - configure the custom domain for the PAAS control plane itself
// ---------------------------------------------------------------------------

func handleSystemDomain(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		envVal := strings.TrimSpace(os.Getenv("PAAS_DOMAIN"))
		dbVal := strings.TrimSpace(dbGetMeta("paas_domain"))
		domain := dbVal
		if envVal != "" {
			domain = envVal
		}
		jsonOK(w, map[string]any{
			"domain":        domain,
			"envOverridden": envVal != "",
		})
		return
	}

	if r.Method == http.MethodPost {
		envVal := strings.TrimSpace(os.Getenv("PAAS_DOMAIN"))
		if envVal != "" {
			jsonError(w, "Domain configuration is overridden by PAAS_DOMAIN environment variable", http.StatusForbidden)
			return
		}

		var req struct {
			Domain string `json:"domain"`
		}
		if err := decodeJSON(r, &req); err != nil {
			jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
			return
		}

		domain := strings.TrimSpace(req.Domain)
		if domain != "" {
			if len(domain) > 253 || !domainRe.MatchString(domain) {
				jsonError(w, "Invalid domain name", http.StatusBadRequest)
				return
			}
		}

		if err := dbSetMeta("paas_domain", domain); err != nil {
			jsonError(w, "Database error: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Trigger Caddyfile rebuild and reload
		rebuildCaddyfile()

		jsonOK(w, map[string]any{
			"status": "success",
			"domain": domain,
		})
		return
	}

	jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// ---------------------------------------------------------------------------
// GET /api/system/update/check - query latest release (cached)
// ---------------------------------------------------------------------------

func handleUpdateCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	force := r.URL.Query().Get("force") == "1"
	status, err := checkForUpdate(force)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	jsonOK(w, status)
}

// ---------------------------------------------------------------------------
// GET /api/system/update/status - progress of an in-flight/last update
// ---------------------------------------------------------------------------

func handleUpdateStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	state := dbGetMeta(updateStateMetaKey)
	if state == "" {
		state = "idle"
	}
	logTail := ""
	if data, err := os.ReadFile(updateLogFile); err == nil {
		logTail = string(data)
	}
	jsonOK(w, map[string]any{
		"state":      state,
		"inProgress": updateInProgress,
		"log":        logTail,
	})
}

// ---------------------------------------------------------------------------
// POST /api/system/update/apply - back up, then run the detached updater
// ---------------------------------------------------------------------------

func handleUpdateApply(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	updateApplyLock.Lock()
	if updateInProgress {
		updateApplyLock.Unlock()
		jsonError(w, "An update is already in progress", http.StatusConflict)
		return
	}
	updateApplyLock.Unlock()

	if !isGitCheckout() {
		jsonError(w, "Automatic update requires a git checkout install. Update manually or re-run the installer.", http.StatusBadRequest)
		return
	}

	// Determine the target ref (the latest release tag). Refuse if there's
	// nothing newer, so a misclick can't trigger a pointless rebuild.
	status, err := checkForUpdate(true)
	if err != nil {
		jsonError(w, "Could not check for updates: "+err.Error(), http.StatusBadGateway)
		return
	}
	if !status.Configured {
		jsonError(w, "Update source not configured (set UPDATE_REPO).", http.StatusBadRequest)
		return
	}
	if !status.HasUpdate {
		jsonError(w, "Already up to date.", http.StatusBadRequest)
		return
	}
	targetRef := status.Latest

	// Always back up before mutating the install.
	if _, err := createBackup(); err != nil {
		jsonError(w, "Pre-update backup failed, aborting: "+err.Error(), http.StatusInternalServerError)
		return
	}

	updateApplyLock.Lock()
	updateInProgress = true
	updateApplyLock.Unlock()
	_ = dbSetMeta(updateStateMetaKey, "starting")

	scriptPath, err := writeUpdateScript(targetRef)
	if err != nil {
		updateInProgress = false
		_ = dbSetMeta(updateStateMetaKey, "failed")
		jsonError(w, "Failed to prepare updater: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Respond before launching: the updater will restart this process, so the
	// client must rely on polling /status afterward.
	jsonOK(w, map[string]any{
		"status":  "started",
		"target":  targetRef,
		"message": "Update started. The server will restart shortly.",
	})

	go launchDetachedUpdater(scriptPath)
}

// writeUpdateScript renders the bash updater for the current platform and
// returns its path. The script is intentionally standalone so it keeps running
// after this server process is restarted by systemd.
func writeUpdateScript(targetRef string) (string, error) {
	repo := repoDir()
	backendDir := filepath.Join(repo, "backend")
	frontendDir := filepath.Join(repo, "frontend")
	logPath, _ := filepath.Abs(updateLogFile)
	healthURL := localHealthURL()
	frontendURL := localFrontendURL()

	// systemctl is used on Linux; on macOS/dev we relaunch via nohup.
	useSystemd := commandExists("systemctl") && fileExists("/etc/systemd/system/better-paas-backend.service")

	// Service control helpers are emitted as bash functions so rollback paths
	// can stop/start/restart each tier independently.
	var restartFns string
	if useSystemd {
		restartFns = `
run_systemctl() {
  if [ "$(id -u)" -eq 0 ]; then
    systemctl "$@"
    return $?
  fi
  if command -v sudo >/dev/null 2>&1; then
    sudo -n systemctl "$@"
    return $?
  fi
  echo "[updater] systemctl requires root or passwordless sudo."
  return 1
}
restart_backend() {
  echo "[updater] restarting backend service..."
  run_systemctl restart better-paas-backend
}
stop_frontend() {
  echo "[updater] stopping frontend service..."
  run_systemctl stop better-paas-frontend || true
}
start_frontend() {
  echo "[updater] starting frontend service..."
  run_systemctl start better-paas-frontend
}
`
	} else {
		restartFns = fmt.Sprintf(`
restart_backend() {
  echo "[updater] relaunching backend (dev/macOS)..."
  pkill -f "%[1]s/server" 2>/dev/null || true
  ( cd "%[1]s" && nohup ./server > "%[1]s/server.log" 2>&1 & )
}
stop_frontend() {
  echo "[updater] stopping frontend (dev/macOS)..."
  pkill -f "next-server" 2>/dev/null || true
  pkill -f "next start" 2>/dev/null || true
  lsof -t -i :3000 | xargs kill -9 2>/dev/null || true
}
start_frontend() {
  echo "[updater] starting frontend (dev/macOS)..."
  ( cd "%[2]s" && nohup pnpm start > "%[2]s/frontend.log" 2>&1 & )
}
`, backendDir, frontendDir)
	}

	script := fmt.Sprintf(`#!/usr/bin/env bash
# Auto-generated by better-paas updater. Safe to delete.
export PATH="/usr/local/go/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:${PATH:-}"
export CI=true
set -uo pipefail
exec >> "%[1]s" 2>&1
echo "=== update started $(date -u +%%Y-%%m-%%dT%%H:%%M:%%SZ) → %[2]s ==="

REPO="%[3]s"
BACKEND="%[4]s"
FRONTEND="%[5]s"
FRONTEND_PREV_BUILD="$FRONTEND/.next.pre-update"
FRONTEND_NEW_BUILD="$FRONTEND/.next.new"
HEALTH_URL="%[7]s"
FRONTEND_URL="%[8]s"
%[6]s

# Legacy in-place build: moves the live .next aside before building. Only used
# when the checked-out frontend does not support NEXT_DIST_DIR.
prepare_frontend_build() {
  cd "$FRONTEND" || exit 1
  rm -rf "$FRONTEND_PREV_BUILD"
  if [ -d ".next" ]; then
    mv ".next" "$FRONTEND_PREV_BUILD"
  fi
}

# Atomically promote the out-of-band build (.next.new -> .next) right before
# the frontend restarts, then merge the previous build's hashed static assets
# into the new one. Browsers holding cached HTML from the old build keep
# requesting /_next/static/<old-hash>.css|js; keeping those files around
# prevents unstyled pages after an update.
swap_frontend_build() {
  cd "$FRONTEND" || return 1
  if [ ! -d "$FRONTEND_NEW_BUILD" ]; then
    echo "[updater] missing out-of-band build at $FRONTEND_NEW_BUILD"
    return 1
  fi
  rm -rf "$FRONTEND_PREV_BUILD"
  if [ -d ".next" ]; then
    mv ".next" "$FRONTEND_PREV_BUILD"
  fi
  if ! mv "$FRONTEND_NEW_BUILD" ".next"; then
    echo "[updater] failed to promote $FRONTEND_NEW_BUILD to .next"
    if [ -d "$FRONTEND_PREV_BUILD" ]; then
      rm -rf ".next"
      mv "$FRONTEND_PREV_BUILD" ".next" || true
    fi
    return 1
  fi
  if [ -d "$FRONTEND_PREV_BUILD/static" ]; then
    mkdir -p ".next/static"
    cp -a -n "$FRONTEND_PREV_BUILD/static/." ".next/static/" 2>/dev/null || \
      cp -Rn "$FRONTEND_PREV_BUILD/static/." ".next/static/" 2>/dev/null || true
  fi
}

restore_frontend_build() {
  cd "$FRONTEND" || return 1
  if [ -d "$FRONTEND_PREV_BUILD" ]; then
    rm -rf ".next"
    mv "$FRONTEND_PREV_BUILD" ".next"
    echo "[updater] restored previous frontend build."
  fi
}

restore_frontend_deps() {
  cd "$FRONTEND" || return 1
  corepack enable 2>/dev/null || true
  corepack prepare pnpm@11.1.2 --activate 2>/dev/null || true
  echo "[updater] reinstalling frontend deps for current git ref..."
  pnpm install --frozen-lockfile
}

discard_previous_frontend_build() {
  rm -rf "$FRONTEND_PREV_BUILD"
}

rollback_early() {
  echo "[updater] rolling back before services were swapped: $1"
  rm -f "$BACKEND/server.new"
  rm -rf "$FRONTEND_NEW_BUILD"
  git -C "$REPO" checkout -f "$PREV_REF" || echo "[updater] WARN: could not restore git ref"
  restore_frontend_deps || echo "[updater] WARN: could not restore frontend deps"
  start_frontend || true
}

rollback_full() {
  echo "[updater] rolling back after partial swap: $1"
  cd "$BACKEND" || true
  if [ -f server.bak ]; then
    mv -f server.bak server
    echo "[updater] restored previous server binary."
  fi
  rm -f "$BACKEND/server.new"
  rm -rf "$FRONTEND_NEW_BUILD"
  git -C "$REPO" checkout -f "$PREV_REF" || echo "[updater] WARN: could not restore git ref"
  restore_frontend_build || true
  restore_frontend_deps || echo "[updater] WARN: could not restore frontend deps"
  restart_backend || true
  start_frontend || true
}

# health_has_version: returns 0 when the backend is healthy and reports the expected version.
health_has_version() {
  expected_version="$1"
  for _ in $(seq 1 30); do
    body="$(curl -fsS --max-time 3 "$HEALTH_URL" 2>/dev/null || true)"
    if printf '%%s' "$body" | grep -Fq "\"version\":\"$expected_version\""; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# frontend_ready: returns 0 when the dashboard responds on loopback.
frontend_ready() {
  for _ in $(seq 1 30); do
    code="$(curl -s -o /dev/null -w '%%{http_code}' --max-time 3 "$FRONTEND_URL" 2>/dev/null || echo 000)"
    if [ "$code" != "000" ] && [ "$code" -lt 500 ]; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# health_any: returns 0 when any backend version answers healthily.
health_any() {
  for _ in $(seq 1 30); do
    code="$(curl -s -o /dev/null -w '%%{http_code}' --max-time 3 "$HEALTH_URL" 2>/dev/null || echo 000)"
    if [ "$code" != "000" ] && [ "$code" -lt 500 ]; then
      return 0
    fi
    sleep 2
  done
  return 1
}

cd "$REPO" || { echo "[updater] repo dir missing"; exit 1; }

echo "[updater] fetching..."
if ! git fetch --all --tags --prune; then echo "[updater] git fetch failed"; exit 1; fi

# Record the ref we can roll back to if the new build fails to come up.
PREV_REF="$(git rev-parse HEAD)"
echo "[updater] current ref: $PREV_REF"

# Stop the dashboard before mutating the checkout or node_modules. next start
# needs node_modules at runtime; installing deps while it is running can leave
# old .next paired with new node_modules and break the UI.
stop_frontend

echo "[updater] checking out %[2]s..."
if ! git checkout -f "%[2]s"; then
  echo "[updater] checkout failed"
  start_frontend || true
  exit 1
fi

echo "[updater] building backend..."
cd "$BACKEND" || exit 1
if ! go build -ldflags "-s -w -X paas/internal/paas.version=%[2]s" -o server.new .; then
  echo "[updater] backend build failed; keeping current server"
  rollback_early "backend build failed"
  exit 1
fi

echo "[updater] preparing frontend toolchain..."
cd "$FRONTEND" || exit 1
if ! node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=13)?0:1)" 2>/dev/null; then
  echo "[updater] Node.js 22.13+ is required (found $(node -v 2>/dev/null || echo unknown))"
  rollback_early "unsupported Node.js version"
  exit 1
fi
corepack enable 2>/dev/null || true
if ! corepack prepare pnpm@11.1.2 --activate; then
  echo "[updater] failed to activate pnpm@11.1.2 via corepack"
  rollback_early "pnpm activation failed"
  exit 1
fi

echo "[updater] installing frontend dependencies..."
if ! pnpm install --frozen-lockfile; then
  echo "[updater] frontend deps failed; rolling back"
  rollback_early "frontend dependency install failed"
  exit 1
fi
# Prefer an out-of-band build: the live frontend keeps serving its current
# .next untouched while the new build lands in .next.new. Falls back to the
# legacy in-place build when the checked-out frontend predates NEXT_DIST_DIR.
FRONTEND_OOB=0
if grep -qs "NEXT_DIST_DIR" next.config.mjs next.config.js next.config.ts 2>/dev/null; then
  FRONTEND_OOB=1
fi

if [ "$FRONTEND_OOB" -eq 1 ]; then
  echo "[updater] building frontend out-of-band into .next.new ..."
  rm -rf "$FRONTEND_NEW_BUILD"
  if ! NEXT_DIST_DIR=".next.new" pnpm build; then
    echo "[updater] frontend build failed; rolling back"
    rollback_early "frontend build failed"
    exit 1
  fi
else
  prepare_frontend_build
  if ! pnpm build; then
    echo "[updater] frontend build failed; rolling back"
    restore_frontend_build || true
    rollback_early "frontend build failed"
    exit 1
  fi
fi

# Promote and restart the frontend BEFORE swapping the backend binary.
# The dashboard marks the update complete when the backend restarts; if the
# frontend were still on the old .next at that moment, operators would keep
# seeing the previous UI even though the version badge already changed.
if [ "$FRONTEND_OOB" -eq 1 ]; then
  if ! swap_frontend_build; then
    rollback_early "frontend build swap failed"
    exit 1
  fi
fi
if ! start_frontend; then
  echo "[updater] frontend start failed; rolling back"
  rollback_full "frontend start failed"
  exit 1
fi

echo "[updater] verifying frontend at $FRONTEND_URL ..."
if ! frontend_ready; then
  echo "[updater] frontend did not become ready; rolling back"
  rollback_full "frontend health check failed"
  exit 1
fi

echo "[updater] swapping backend binary and restarting..."
cd "$BACKEND" || exit 1
cp -f server server.bak 2>/dev/null || true
mv -f server.new server
if ! restart_backend; then
  echo "[updater] backend restart failed; rolling back"
  rollback_full "backend restart failed"
  exit 1
fi

echo "[updater] verifying backend health at $HEALTH_URL ..."
if health_has_version "%[2]s"; then
  echo "[updater] new version is healthy."
  discard_previous_frontend_build
  echo "=== update finished OK $(date -u +%%Y-%%m-%%dT%%H:%%M:%%SZ) ==="
  exit 0
fi

echo "[updater] NEW VERSION FAILED HEALTH CHECK - rolling back."
rollback_full "backend health check failed"
if health_any && frontend_ready; then
  echo "[updater] rollback healthy; staying on previous version."
else
  echo "[updater] WARN: rollback did not pass health check - manual intervention needed."
fi
echo "=== update ROLLED BACK $(date -u +%%Y-%%m-%%dT%%H:%%M:%%SZ) ==="
exit 1
`, logPath, shellSafe(targetRef), shellSafe(repo), shellSafe(backendDir), shellSafe(frontendDir), restartFns, shellSafe(healthURL), shellSafe(frontendURL))

	path := filepath.Join("data", "run-update.sh")
	if err := os.WriteFile(path, []byte(script), 0700); err != nil {
		return "", err
	}
	abs, _ := filepath.Abs(path)
	return abs, nil
}

// localHealthURL returns a loopback URL for the API health endpoint, honoring
// LISTEN_ADDR's port (defaults to 8080).
func localHealthURL() string {
	port := "8080"
	addr := strings.TrimSpace(os.Getenv("LISTEN_ADDR"))
	if addr != "" {
		if i := strings.LastIndex(addr, ":"); i >= 0 && i+1 < len(addr) {
			port = addr[i+1:]
		}
	}
	return fmt.Sprintf("http://127.0.0.1:%s/api/health", port)
}

// localFrontendURL returns a loopback URL for the dashboard health probe.
func localFrontendURL() string {
	port := "3000"
	if v := strings.TrimSpace(os.Getenv("FRONTEND_PORT")); v != "" {
		port = v
	}
	return fmt.Sprintf("http://127.0.0.1:%s", port)
}

// launchDetachedUpdater starts the updater script fully detached so it survives
// this process being restarted by systemd.
func launchDetachedUpdater(scriptPath string) {
	// Truncate the previous log so the dashboard shows only this run.
	_ = os.WriteFile(updateLogFile, []byte(""), 0600)
	_ = dbSetMeta(updateStateMetaKey, "running")

	cmd := exec.Command("bash", scriptPath)
	cmd.Dir = repoDir()
	// Detach: new session so it isn't killed when systemd stops this unit.
	cmd.SysProcAttr = detachSysProcAttr()
	if err := cmd.Start(); err != nil {
		log.Printf("[update] failed to launch updater: %v", err)
		_ = dbSetMeta(updateStateMetaKey, "failed")
		updateInProgress = false
		return
	}
	// We do not Wait(): the updater will outlive us. Give it a beat to spin up.
	time.Sleep(2 * time.Second)
}

// resetUpdateStateOnBoot clears a stale "running" marker left behind when the
// updater restarts the backend. The frontend is promoted before that restart,
// so "completed" here means both tiers should already be on the new build.
func resetUpdateStateOnBoot() {
	if dbGetMeta(updateStateMetaKey) == "running" {
		_ = dbSetMeta(updateStateMetaKey, "completed")
	}
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func commandExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// shellSafe rejects shell metacharacters from values interpolated into the
// generated script. Refs and paths should never contain these; if they do we
// strip them rather than risk injection.
func shellSafe(s string) string {
	return strings.Map(func(r rune) rune {
		switch r {
		case '`', '$', ';', '&', '|', '>', '<', '\n', '"', '\'', '\\':
			return -1
		}
		return r
	}, s)
}
