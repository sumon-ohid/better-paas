package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

var sqliteDB *sql.DB

func initDB() {
	// data/ holds secrets (DB with tokens); keep it owner-only.
	os.MkdirAll("data", 0700)
	os.MkdirAll(filepath.Join("data", "logs"), 0755)

	// Initialize the at-rest encryption key before any secret is read or
	// written below (migrateFromJSON / loadStateFromDB touch token columns).
	initSecretKey()

	dbPath := filepath.Join("data", "baas.db")
	var err error
	sqliteDB, err = sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)")
	if err != nil {
		log.Fatalf("[db] failed to open SQLite: %v", err)
	}
	if err := sqliteDB.Ping(); err != nil {
		log.Fatalf("[db] failed to ping SQLite: %v", err)
	}

	if err := runMigrations(); err != nil {
		log.Fatalf("[db] failed to run migrations: %v", err)
	}

	migrateFromJSON()
	loadStateFromDB()
}

func runMigrations() error {
	schema := `
CREATE TABLE IF NOT EXISTS apps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    git_repo TEXT,
    branch TEXT,
    port INTEGER NOT NULL,
    url TEXT,
    created_at DATETIME NOT NULL,
    git_token TEXT,
    root_dir TEXT,
    env_vars TEXT,
    build_command TEXT,
    start_command TEXT,
    install_command TEXT,
    port_override INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL,
    app_name TEXT NOT NULL,
    status TEXT NOT NULL,
    log_file TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    duration TEXT
);

CREATE INDEX IF NOT EXISTS idx_deployments_app_id ON deployments(app_id, created_at DESC);

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
);
`
	_, err := sqliteDB.Exec(schema)
	return err
}

// migrateFromJSON imports data from the legacy db.json file, then renames it.
func migrateFromJSON() {
	oldPath := filepath.Join("data", "db.json")
	if _, err := os.Stat(oldPath); os.IsNotExist(err) {
		return
	}

	data, err := os.ReadFile(oldPath)
	if err != nil {
		log.Printf("[migrate] failed to read old db.json: %v", err)
		return
	}

	var state dbState
	if err := json.Unmarshal(data, &state); err != nil {
		log.Printf("[migrate] failed to parse old db.json: %v", err)
		return
	}

	tx, err := sqliteDB.Begin()
	if err != nil {
		log.Printf("[migrate] failed to begin tx: %v", err)
		return
	}
	defer tx.Rollback()

	for _, app := range state.Apps {
		if err := dbSaveAppTx(tx, app); err != nil {
			log.Printf("[migrate] failed to save app %s: %v", app.ID, err)
		}
	}

	for i, dep := range state.Deployments {
		if i >= 100 {
			break
		}
		logFile := filepath.Join("data", "logs", dep.AppID, dep.ID+".log")
		os.MkdirAll(filepath.Dir(logFile), 0755)
		if len(dep.Logs) > 0 {
			if err := writeLogFile(logFile, dep.Logs); err != nil {
				log.Printf("[migrate] failed to write log file: %v", err)
			}
		}
		if _, err := tx.Exec(
			`INSERT INTO deployments (id, app_id, app_name, status, log_file, created_at, duration)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO NOTHING`,
			dep.ID, dep.AppID, dep.AppName, dep.Status, logFile, dep.CreatedAt, dep.Duration,
		); err != nil {
			log.Printf("[migrate] failed to save deployment %s: %v", dep.ID, err)
		}
	}

	if state.GitHubToken != "" {
		if _, err := tx.Exec(
			`INSERT INTO meta (key, value) VALUES (?, ?)
			 ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
			"github_token", encryptSecret(state.GitHubToken),
		); err != nil {
			log.Printf("[migrate] failed to save GitHub token: %v", err)
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("[migrate] failed to commit: %v", err)
		return
	}

	log.Printf("[migrate] Migrated %d apps, %d deployments from db.json", len(state.Apps), min(len(state.Deployments), 100))
	os.Rename(oldPath, oldPath+".migrated")
}

// loadStateFromDB restores the in-memory app list and global token from SQLite.
func loadStateFromDB() {
	appsLock.Lock()
	githubTokenLock.Lock()
	buildLogsLock.Lock()
	defer appsLock.Unlock()
	defer githubTokenLock.Unlock()
	defer buildLogsLock.Unlock()

	apps = []App{}
	buildLogs = make(map[string][]string)

	rows, err := sqliteDB.Query(`SELECT id, name, status, git_repo, branch, port, url, created_at, git_token, root_dir, env_vars, build_command, start_command, install_command, port_override FROM apps`)
	if err != nil {
		log.Printf("[db] failed to load apps: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var a App
		var envJSON string
		err := rows.Scan(&a.ID, &a.Name, &a.Status, &a.GitRepo, &a.Branch, &a.Port, &a.URL, &a.CreatedAt, &a.GitToken, &a.RootDir, &envJSON, &a.BuildCommand, &a.StartCommand, &a.InstallCommand, &a.PortOverride)
		if err != nil {
			log.Printf("[db] failed to scan app: %v", err)
			continue
		}
		if envJSON != "" {
			_ = json.Unmarshal([]byte(envJSON), &a.EnvVars)
		}
		a.GitToken = decryptSecret(a.GitToken)
		apps = append(apps, a)
		buildLogs[a.ID] = []string{}
	}

	var tok string
	_ = sqliteDB.QueryRow(`SELECT value FROM meta WHERE key = 'github_token'`).Scan(&tok)
	githubToken = decryptSecret(tok)

	log.Printf("[db] Loaded %d apps from SQLite", len(apps))
}

// ---------------------------------------------------------------------------
// App CRUD
// ---------------------------------------------------------------------------

func dbSaveApp(app App) error {
	tx, err := sqliteDB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := dbSaveAppTx(tx, app); err != nil {
		return err
	}
	return tx.Commit()
}

func dbSaveAppTx(tx *sql.Tx, app App) error {
	envJSON, _ := json.Marshal(app.EnvVars)
	encToken := encryptSecret(app.GitToken)
	_, err := tx.Exec(`
		INSERT INTO apps (id, name, status, git_repo, branch, port, url, created_at, git_token, root_dir, env_vars, build_command, start_command, install_command, port_override)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name,
			status=excluded.status,
			git_repo=excluded.git_repo,
			branch=excluded.branch,
			port=excluded.port,
			url=excluded.url,
			git_token=excluded.git_token,
			root_dir=excluded.root_dir,
			env_vars=excluded.env_vars,
			build_command=excluded.build_command,
			start_command=excluded.start_command,
			install_command=excluded.install_command,
			port_override=excluded.port_override
	`, app.ID, app.Name, app.Status, app.GitRepo, app.Branch, app.Port, app.URL, app.CreatedAt, encToken, app.RootDir, string(envJSON), app.BuildCommand, app.StartCommand, app.InstallCommand, app.PortOverride)
	return err
}

func dbDeleteApp(id string) error {
	_, err := sqliteDB.Exec(`DELETE FROM apps WHERE id = ?`, id)
	return err
}

func dbUpdateAppStatus(id, status string) error {
	_, err := sqliteDB.Exec(`UPDATE apps SET status = ? WHERE id = ?`, status, id)
	return err
}

// ---------------------------------------------------------------------------
// Deployment CRUD
// ---------------------------------------------------------------------------

func dbCreateDeployment(dep DeploymentRecord) error {
	_, err := sqliteDB.Exec(`
		INSERT INTO deployments (id, app_id, app_name, status, log_file, created_at, duration)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			status=excluded.status,
			duration=excluded.duration
	`, dep.ID, dep.AppID, dep.AppName, dep.Status, dep.LogFile, dep.CreatedAt, dep.Duration)
	return err
}

func dbGetLatestDeployment(appID string) (*DeploymentRecord, error) {
	var d DeploymentRecord
	err := sqliteDB.QueryRow(`
		SELECT id, app_id, app_name, status, log_file, created_at, duration
		FROM deployments
		WHERE app_id = ?
		ORDER BY created_at DESC
		LIMIT 1
	`, appID).Scan(&d.ID, &d.AppID, &d.AppName, &d.Status, &d.LogFile, &d.CreatedAt, &d.Duration)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func dbLoadDeployments() ([]DeploymentRecord, error) {
	rows, err := sqliteDB.Query(`SELECT id, app_id, app_name, status, log_file, created_at, duration FROM deployments ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []DeploymentRecord
	for rows.Next() {
		var d DeploymentRecord
		err := rows.Scan(&d.ID, &d.AppID, &d.AppName, &d.Status, &d.LogFile, &d.CreatedAt, &d.Duration)
		if err != nil {
			continue
		}
		if d.LogFile != "" {
			d.Logs, _ = readLogFile(d.LogFile)
		}
		result = append(result, d)
	}
	return result, nil
}

func dbDeleteDeploymentsForApp(appID string) error {
	_, err := sqliteDB.Exec(`DELETE FROM deployments WHERE app_id = ?`, appID)
	return err
}

func dbPruneDeployments(max int) error {
	_, err := sqliteDB.Exec(`
		DELETE FROM deployments WHERE id NOT IN (
			SELECT id FROM deployments ORDER BY created_at DESC LIMIT ?
		)
	`, max)
	return err
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

func dbSetToken(token string) error {
	return dbSetSecretMeta("github_token", token)
}

// dbSetMeta upserts a key/value pair into the meta table.
func dbSetMeta(key, value string) error {
	_, err := sqliteDB.Exec(`
		INSERT INTO meta (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value=excluded.value
	`, key, value)
	return err
}

// dbSetSecretMeta stores an encrypted value in the meta table. Use this for
// any credential (e.g. the GitHub token) so it is never persisted in cleartext.
func dbSetSecretMeta(key, value string) error {
	return dbSetMeta(key, encryptSecret(value))
}

// dbGetMeta returns the value for key, or "" if absent.
func dbGetMeta(key string) string {
	var v string
	_ = sqliteDB.QueryRow(`SELECT value FROM meta WHERE key = ?`, key).Scan(&v)
	return v
}

// ---------------------------------------------------------------------------
// Log files
// ---------------------------------------------------------------------------

func readLogFile(path string) ([]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, err
	}
	lines := strings.Split(string(data), "\n")
	if len(lines) > 0 && lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}
	return lines, nil
}

func writeLogFile(path string, lines []string) error {
	os.MkdirAll(filepath.Dir(path), 0755)
	return os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0644)
}

func appendLogFile(path string, line string) error {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.WriteString(line + "\n")
	return err
}

// dbState mirrors the old JSON structure for one-time migration.
type dbState struct {
	Apps        []App              `json:"apps"`
	Deployments []DeploymentRecord `json:"deployments"`
	GitHubToken string             `json:"gitHubToken,omitempty"`
}
