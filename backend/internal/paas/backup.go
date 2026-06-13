package paas

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Backups
// ---------------------------------------------------------------------------
//
// A backup is a gzipped tar of the data/ directory (SQLite DB, logs, admin
// token, encryption key). Backups are written to data/backups/ and can be
// downloaded via the API. This gives self-hosters a one-click safety net.
//
// SECURITY: the archive contains secrets (the DB has encrypted tokens, plus
// secret.key and admin_token.txt). It is only reachable behind admin auth, and
// the on-disk copy lives in the owner-only data/ tree.

const backupDir = "data/backups"

const backupConfigKey = "backup_config"

// BackupConfig controls automatic backups and optional offsite (S3/R2) storage.
// Stored as JSON in the meta table. The S3 secret key is encrypted separately
// (see load/save) so it is never persisted in cleartext.
type BackupConfig struct {
	AutoEnabled      bool `json:"autoEnabled"`
	IntervalHours    int  `json:"intervalHours"`    // how often automatic backups run
	Retention        int  `json:"retention"`        // how many local backups to keep
	IncludeDatabases bool `json:"includeDatabases"` // also dump managed DB contents

	// Offsite object storage (S3-compatible: AWS S3, Cloudflare R2, MinIO…).
	S3Enabled      bool   `json:"s3Enabled"`
	S3Endpoint     string `json:"s3Endpoint"` // blank = AWS regional host
	S3Region       string `json:"s3Region"`
	S3Bucket       string `json:"s3Bucket"`
	S3Prefix       string `json:"s3Prefix"`
	S3AccessKeyID  string `json:"s3AccessKeyId"`
	S3SecretKey    string `json:"s3SecretKey,omitempty"` // write-only; redacted on read
	S3SecretKeySet bool   `json:"s3SecretKeySet"`        // read-only: whether a secret is stored
}

// backupSecretKeyMeta holds the encrypted S3 secret access key separately from
// the JSON config blob.
const backupSecretKeyMeta = "backup_s3_secret"

// defaultBackupConfig returns sensible defaults (auto off, daily, keep 10).
func defaultBackupConfig() BackupConfig {
	return BackupConfig{
		AutoEnabled:      false,
		IntervalHours:    24,
		Retention:        10,
		IncludeDatabases: true,
	}
}

// getBackupConfig loads the stored backup configuration, merging defaults.
func getBackupConfig() BackupConfig {
	cfg := defaultBackupConfig()
	if raw := dbGetMeta(backupConfigKey); raw != "" {
		_ = json.Unmarshal([]byte(raw), &cfg)
	}
	if cfg.IntervalHours <= 0 {
		cfg.IntervalHours = 24
	}
	if cfg.Retention <= 0 {
		cfg.Retention = 10
	}
	// Legacy fallback: BACKUP_INTERVAL_HOURS env still enables auto backups.
	if !cfg.AutoEnabled {
		if h := envInt("BACKUP_INTERVAL_HOURS", 0); h > 0 {
			cfg.AutoEnabled = true
			cfg.IntervalHours = h
		}
	}
	cfg.S3SecretKey = ""
	cfg.S3SecretKeySet = decryptSecret(dbGetMeta(backupSecretKeyMeta)) != ""
	return cfg
}

// getBackupSecretKey returns the decrypted S3 secret access key (server-side).
func getBackupSecretKey() string {
	return decryptSecret(dbGetMeta(backupSecretKeyMeta))
}

// saveBackupConfig persists the config. When newSecret is non-empty it replaces
// the stored S3 secret key; an empty newSecret leaves the existing one intact.
func saveBackupConfig(cfg BackupConfig, newSecret string) error {
	// Never store the secret inside the JSON blob.
	clean := cfg
	clean.S3SecretKey = ""
	clean.S3SecretKeySet = false
	data, _ := json.Marshal(clean)
	if err := dbSetMeta(backupConfigKey, string(data)); err != nil {
		return err
	}
	if newSecret != "" {
		return dbSetSecretMeta(backupSecretKeyMeta, newSecret)
	}
	return nil
}

// s3TargetFromConfig builds an s3Target from config + the stored secret.
func s3TargetFromConfig(cfg BackupConfig) s3Target {
	return s3Target{
		Endpoint:        cfg.S3Endpoint,
		Region:          cfg.S3Region,
		Bucket:          cfg.S3Bucket,
		AccessKeyID:     cfg.S3AccessKeyID,
		SecretAccessKey: getBackupSecretKey(),
		Prefix:          cfg.S3Prefix,
	}
}

// uploadBackupOffsite pushes a freshly written backup to object storage when
// S3 is configured. Best-effort: logs failures, never blocks local backups.
func uploadBackupOffsite(cfg BackupConfig, localPath string) {
	if !cfg.S3Enabled || cfg.S3Bucket == "" {
		return
	}
	target := s3TargetFromConfig(cfg)
	if target.AccessKeyID == "" || target.SecretAccessKey == "" {
		log.Printf("[backup] S3 enabled but credentials missing; skipping upload")
		return
	}
	name := filepath.Base(localPath)
	if err := s3PutFile(target, target.objectKey(name), localPath); err != nil {
		log.Printf("[backup] offsite upload of %s failed: %v", name, err)
		return
	}
	log.Printf("[backup] uploaded %s to s3://%s/%s", name, target.Bucket, target.objectKey(name))
}

// createBackup writes a timestamped .tar.gz of the data directory (excluding
// the backups folder itself) and returns its path.
func createBackup() (string, error) {
	if err := os.MkdirAll(backupDir, 0700); err != nil {
		return "", err
	}
	name := fmt.Sprintf("backup-%s.tar.gz", time.Now().Format("20060102-150405"))
	outPath := filepath.Join(backupDir, name)

	f, err := os.OpenFile(outPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return "", err
	}
	defer f.Close()

	gz := gzip.NewWriter(f)
	defer gz.Close()
	tw := tar.NewWriter(gz)
	defer tw.Close()

	root := "data"
	err = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		// Skip the backups directory to avoid recursive inclusion.
		if strings.HasPrefix(path, backupDir) {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		hdr, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		hdr.Name = rel
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		src, err := os.Open(path)
		if err != nil {
			// A transient file (e.g. SQLite WAL) may vanish; skip it.
			log.Printf("[backup] skipping %s: %v", path, err)
			return nil
		}
		defer src.Close()
		_, err = io.Copy(tw, src)
		return err
	})
	if err != nil {
		os.Remove(outPath)
		return "", err
	}

	// Capture live database contents (best-effort) unless disabled in config.
	if getBackupConfig().IncludeDatabases {
		writeAddonDumps(tw, time.Now())
	}
	return outPath, nil
}

// ---------------------------------------------------------------------------
// Managed database dumps
// ---------------------------------------------------------------------------
//
// In addition to the control-plane data directory, a backup can capture the
// live contents of each managed database (addon) so a restore brings back real
// rows, not just empty containers. Dumps are logical where possible:
//   postgres → pg_dump (.sql)
//   mysql    → mysqldump (.sql)
//   redis    → SAVE + dump.rdb (binary)
//
// Each dump runs via `docker exec` against the addon's own container. Failures
// are logged and skipped so one unreachable database never aborts the backup.

// dumpAddonDatabase produces a logical dump of one addon's contents. It returns
// the file extension and the dump bytes.
func dumpAddonDatabase(a Addon) (ext string, data []byte, err error) {
	if !containerExists(a.ContainerName) {
		return "", nil, fmt.Errorf("container %s not present", a.ContainerName)
	}
	pw := a.ConnEnv // map of connection env (may be nil if not loaded)
	switch a.Type {
	case "postgres":
		out, e := dockerExecCapture(a.ContainerName,
			[]string{"-e", "PGPASSWORD=" + pw["PGPASSWORD"]},
			"pg_dump", "-U", "appuser", "-d", "appdb", "--no-owner", "--clean", "--if-exists")
		return "sql", out, e
	case "mysql":
		out, e := dockerExecCapture(a.ContainerName,
			[]string{"-e", "MYSQL_PWD=" + pw["MYSQL_PASSWORD"]},
			"mysqldump", "-u", "appuser", "--databases", "appdb",
			"--single-transaction", "--no-tablespaces")
		return "sql", out, e
	case "redis":
		// Force a synchronous save so dump.rdb is current, then read it.
		if _, e := dockerExecCapture(a.ContainerName,
			[]string{"-e", "REDISCLI_AUTH=" + pw["REDIS_PASSWORD"]},
			"redis-cli", "SAVE"); e != nil {
			return "", nil, e
		}
		out, e := dockerExecCapture(a.ContainerName, nil, "cat", "/data/dump.rdb")
		return "rdb", out, e
	default:
		return "", nil, fmt.Errorf("unsupported addon type %q", a.Type)
	}
}

// dockerExecCapture runs `docker exec [execEnv] <container> <cmd> <args...>` and
// returns stdout. stderr is captured separately and surfaced only on error, so
// tool warnings (e.g. mysqldump notices) don't corrupt the dump.
func dockerExecCapture(container string, execEnv []string, cmd string, args ...string) ([]byte, error) {
	full := []string{"exec"}
	full = append(full, execEnv...)
	full = append(full, container, cmd)
	full = append(full, args...)

	c := exec.Command("docker", full...)
	var stdout, stderr bytes.Buffer
	c.Stdout = &stdout
	c.Stderr = &stderr
	if err := c.Run(); err != nil {
		return nil, fmt.Errorf("%v: %s", err, strings.TrimSpace(stderr.String()))
	}
	return stdout.Bytes(), nil
}

// writeAddonDumps appends a logical dump of every managed database to the tar
// archive under databases/. Best-effort: individual failures are logged.
func writeAddonDumps(tw *tar.Writer, mtime time.Time) {
	addons, err := dbLoadAddons()
	if err != nil {
		log.Printf("[backup] could not load addons for dumping: %v", err)
		return
	}
	for _, a := range addons {
		ext, data, err := dumpAddonDatabase(a)
		if err != nil {
			log.Printf("[backup] skipping dump of %s (%s): %v", a.Name, a.Type, err)
			continue
		}
		hdr := &tar.Header{
			Name:    fmt.Sprintf("databases/%s.%s", a.ContainerName, ext),
			Mode:    0600,
			Size:    int64(len(data)),
			ModTime: mtime,
		}
		if err := tw.WriteHeader(hdr); err != nil {
			log.Printf("[backup] failed to write dump header for %s: %v", a.Name, err)
			continue
		}
		if _, err := tw.Write(data); err != nil {
			log.Printf("[backup] failed to write dump for %s: %v", a.Name, err)
			continue
		}
		log.Printf("[backup] captured %s dump for %s (%d bytes)", a.Type, a.Name, len(data))
	}
}

// backupInfo describes one stored backup.
type backupInfo struct {
	Name      string    `json:"name"`
	SizeBytes int64     `json:"sizeBytes"`
	CreatedAt time.Time `json:"createdAt"`
}

func listBackups() ([]backupInfo, error) {
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []backupInfo{}, nil
		}
		return nil, err
	}
	var out []backupInfo
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".tar.gz") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, backupInfo{
			Name:      e.Name(),
			SizeBytes: info.Size(),
			CreatedAt: info.ModTime(),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	if out == nil {
		out = []backupInfo{}
	}
	return out, nil
}

// pruneBackups keeps only the newest `keep` backups.
func pruneBackups(keep int) {
	list, err := listBackups()
	if err != nil || len(list) <= keep {
		return
	}
	for _, b := range list[keep:] {
		os.Remove(filepath.Join(backupDir, b.Name))
	}
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

// GET /api/backups — list backups.
func handleBackupsList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	list, err := listBackups()
	if err != nil {
		jsonError(w, "Failed to list backups", http.StatusInternalServerError)
		return
	}
	jsonOK(w, list)
}

// POST /api/backups/create — make a new backup.
func handleBackupCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	path, err := createBackup()
	if err != nil {
		jsonError(w, fmt.Sprintf("Backup failed: %v", err), http.StatusInternalServerError)
		return
	}
	cfg := getBackupConfig()
	pruneBackups(cfg.Retention)
	go uploadBackupOffsite(cfg, path)
	info, _ := os.Stat(path)
	jsonOK(w, backupInfo{
		Name:      filepath.Base(path),
		SizeBytes: sizeOf(info),
		CreatedAt: time.Now(),
	})
}

// GET /api/backups/download?name=<file> — stream a backup file.
func handleBackupDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	name := r.URL.Query().Get("name")
	if err := validateBackupName(name); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	path := filepath.Join(backupDir, name)
	f, err := os.Open(path)
	if err != nil {
		jsonError(w, "Backup not found", http.StatusNotFound)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", name))
	io.Copy(w, f)
}

var restoreApplyLock sync.Mutex
var restoreInProgress bool

func validateBackupName(name string) error {
	if name == "" || strings.ContainsAny(name, "/\\") || !strings.HasSuffix(name, ".tar.gz") {
		return fmt.Errorf("invalid backup name")
	}
	return nil
}

// writeRestoreScript renders a detached helper that stops services, unpacks a
// backup into data/, and restarts. The server cannot restore its own SQLite DB
// in-process.
func writeRestoreScript(backupName string) (string, error) {
	repo := repoDir()
	logPath, _ := filepath.Abs(filepath.Join("data", "restore.log"))
	backupPath := filepath.Join(backupDir, backupName)

	useSystemd := commandExists("systemctl") && fileExists("/etc/systemd/system/better-paas-backend.service")

	var serviceFns string
	if useSystemd {
		serviceFns = `
run_systemctl() {
  if [ "$(id -u)" -eq 0 ]; then
    systemctl "$@"
    return $?
  fi
  if command -v sudo >/dev/null 2>&1; then
    sudo -n systemctl "$@"
    return $?
  fi
  echo "[restore] systemctl requires root or passwordless sudo."
  return 1
}
stop_services() {
  echo "[restore] stopping Better-PaaS services..."
  run_systemctl stop better-paas-frontend || true
  if ! run_systemctl stop better-paas-backend; then
    echo "[restore] could not stop backend; aborting to avoid corrupting data/"
    exit 1
  fi
  sleep 2
}
start_services() {
  echo "[restore] starting Better-PaaS services..."
  if ! run_systemctl start better-paas-backend; then
    echo "[restore] failed to start backend"
    exit 1
  fi
  run_systemctl start better-paas-frontend || true
}
`
	} else {
		serviceFns = fmt.Sprintf(`
stop_services() {
  echo "[restore] stopping Better-PaaS processes (dev/macOS)..."
  pkill -f "%[1]s/server" 2>/dev/null || true
  pkill -f "next-server" 2>/dev/null || true
  pkill -f "next start" 2>/dev/null || true
  lsof -t -i :3000 | xargs kill -9 2>/dev/null || true
}
start_services() {
  echo "[restore] starting Better-PaaS processes (dev/macOS)..."
  ( cd "%[1]s" && nohup ./server > "%[1]s/server.log" 2>&1 & )
  ( cd "%[2]s" && nohup pnpm start > "%[2]s/frontend.log" 2>&1 & )
}
`, filepath.Join(repo, "backend"), filepath.Join(repo, "frontend"))
	}

	script := fmt.Sprintf(`#!/usr/bin/env bash
# Auto-generated by better-paas restore. Safe to delete.
export PATH="/usr/local/go/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:${PATH:-}"
set -euo pipefail
exec >> "%[1]s" 2>&1
echo "=== restore started $(date -u +%%Y-%%m-%%dT%%H:%%M:%%SZ) from %[2]s ==="

REPO="%[3]s"
BACKUP_NAME="%[2]s"
BACKUP_ARCHIVE="$REPO/data/backups/$BACKUP_NAME"
DATA_DIR="$REPO/data"
%[4]s

cd "$REPO" || { echo "[restore] repo dir missing"; exit 1; }

if [ ! -f "$BACKUP_ARCHIVE" ]; then
  echo "[restore] backup archive missing: $BACKUP_ARCHIVE"
  exit 1
fi

stop_services

STAMP="$(date -u +%%Y%%m%%dT%%H%%M%%SZ)"
SAFETY_DIR="$REPO/data.pre-restore-$STAMP"
if [ -d "$DATA_DIR" ]; then
  mv "$DATA_DIR" "$SAFETY_DIR"
  echo "[restore] previous data preserved at $SAFETY_DIR"
fi
mkdir -p "$DATA_DIR"

echo "[restore] unpacking $BACKUP_NAME ..."
tar -xzf "$BACKUP_ARCHIVE" -C "$DATA_DIR"

mkdir -p "$DATA_DIR/backups"
if [ -d "$SAFETY_DIR/backups" ]; then
  cp -a "$SAFETY_DIR/backups/." "$DATA_DIR/backups/"
fi

start_services
echo "=== restore finished OK $(date -u +%%Y-%%m-%%dT%%H:%%M:%%SZ) ==="
`, logPath, shellSafe(backupName), shellSafe(repo), serviceFns)

	path := filepath.Join("data", "run-restore.sh")
	if err := os.WriteFile(path, []byte(script), 0700); err != nil {
		return "", err
	}
	abs, _ := filepath.Abs(path)
	_ = backupPath // validated by caller
	return abs, nil
}

// POST /api/backups/restore — unpack a backup into data/ and restart services.
func handleBackupRestore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	restoreApplyLock.Lock()
	if restoreInProgress {
		restoreApplyLock.Unlock()
		jsonError(w, "A restore is already in progress", http.StatusConflict)
		return
	}
	restoreApplyLock.Unlock()

	var req struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
		return
	}
	if err := validateBackupName(req.Name); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if _, err := os.Stat(filepath.Join(backupDir, req.Name)); err != nil {
		jsonError(w, "Backup not found", http.StatusNotFound)
		return
	}

	if _, err := createBackup(); err != nil {
		jsonError(w, "Pre-restore safety backup failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	scriptPath, err := writeRestoreScript(req.Name)
	if err != nil {
		jsonError(w, "Failed to prepare restore: "+err.Error(), http.StatusInternalServerError)
		return
	}

	restoreApplyLock.Lock()
	restoreInProgress = true
	restoreApplyLock.Unlock()

	jsonOK(w, map[string]any{
		"status":  "started",
		"message": "Restore started. Services will restart shortly.",
	})

	go func() {
		defer func() {
			restoreApplyLock.Lock()
			restoreInProgress = false
			restoreApplyLock.Unlock()
		}()
		_ = os.WriteFile(filepath.Join("data", "restore.log"), []byte(""), 0600)
		cmd := exec.Command("bash", scriptPath)
		cmd.Dir = repoDir()
		cmd.SysProcAttr = detachSysProcAttr()
		if err := cmd.Start(); err != nil {
			log.Printf("[restore] failed to launch restore script: %v", err)
		}
	}()
}

// POST /api/backups/delete — remove a backup file.
func handleBackupDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	if err := validateBackupName(req.Name); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := os.Remove(filepath.Join(backupDir, req.Name)); err != nil {
		jsonError(w, "Failed to delete backup", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "deleted"})
}

// GET /api/backups/config — return the current backup configuration.
func handleBackupConfigGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jsonOK(w, getBackupConfig())
}

// POST /api/backups/config — update the backup configuration.
func handleBackupConfigSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req BackupConfig
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	if req.IntervalHours <= 0 {
		req.IntervalHours = 24
	}
	if req.Retention <= 0 {
		req.Retention = 10
	}
	if req.S3Enabled {
		if strings.TrimSpace(req.S3Bucket) == "" {
			jsonError(w, "Bucket is required to enable offsite storage", http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(req.S3AccessKeyID) == "" {
			jsonError(w, "Access key ID is required to enable offsite storage", http.StatusBadRequest)
			return
		}
		// A secret must either be provided now or already stored.
		if strings.TrimSpace(req.S3SecretKey) == "" && getBackupSecretKey() == "" {
			jsonError(w, "Secret access key is required to enable offsite storage", http.StatusBadRequest)
			return
		}
	}
	if err := saveBackupConfig(req, strings.TrimSpace(req.S3SecretKey)); err != nil {
		log.Printf("[backup] failed to save config: %v", err)
		jsonError(w, "Failed to save backup config", http.StatusInternalServerError)
		return
	}
	jsonOK(w, getBackupConfig())
}

// POST /api/backups/s3/test — verify S3/R2 credentials and bucket reachability.
// Uses the secret from the request body if present, else the stored one.
func handleBackupS3Test(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req BackupConfig
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	secret := strings.TrimSpace(req.S3SecretKey)
	if secret == "" {
		secret = getBackupSecretKey()
	}
	target := s3Target{
		Endpoint:        req.S3Endpoint,
		Region:          req.S3Region,
		Bucket:          req.S3Bucket,
		AccessKeyID:     req.S3AccessKeyID,
		SecretAccessKey: secret,
		Prefix:          req.S3Prefix,
	}
	if target.Bucket == "" || target.AccessKeyID == "" || target.SecretAccessKey == "" {
		jsonError(w, "Bucket, access key, and secret are required to test", http.StatusBadRequest)
		return
	}
	if err := s3CheckAccess(target); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	jsonOK(w, map[string]string{"status": "ok"})
}

func sizeOf(info os.FileInfo) int64 {
	if info == nil {
		return 0
	}
	return info.Size()
}

// startBackupScheduler runs automatic backups based on the stored BackupConfig.
// It wakes hourly, so interval/enabled changes from the UI take effect within
// the hour without a restart. The legacy BACKUP_INTERVAL_HOURS env var still
// works (surfaced through getBackupConfig).
func startBackupScheduler() {
	go func() {
		var lastRun time.Time
		// Seed from the newest existing backup so restarts don't trigger an
		// immediate extra backup when one was taken recently.
		if list, err := listBackups(); err == nil && len(list) > 0 {
			lastRun = list[0].CreatedAt
		}
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for {
			cfg := getBackupConfig()
			if cfg.AutoEnabled {
				due := lastRun.IsZero() ||
					time.Since(lastRun) >= time.Duration(cfg.IntervalHours)*time.Hour
				if due {
					if path, err := createBackup(); err != nil {
						log.Printf("[backup] scheduled backup failed: %v", err)
					} else {
						lastRun = time.Now()
						pruneBackups(cfg.Retention)
						uploadBackupOffsite(cfg, path)
					}
				}
			}
			<-ticker.C
		}
	}()
}
