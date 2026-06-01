package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

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

	if err := runAnalyticsMigrations(); err != nil {
		log.Fatalf("[db] failed to run analytics migrations: %v", err)
	}

	if err := runServersMigrations(); err != nil {
		log.Fatalf("[db] failed to run servers migrations: %v", err)
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

CREATE TABLE IF NOT EXISTS addons (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    container_name TEXT NOT NULL,
    status TEXT NOT NULL,
    volume TEXT,
    port INTEGER NOT NULL,
    conn_env TEXT,
    created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS cron_jobs (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL,
    app_name TEXT NOT NULL,
    schedule TEXT NOT NULL,
    command TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    last_run DATETIME,
    last_status TEXT,
    created_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cron_app_id ON cron_jobs(app_id);

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
);
`
	if _, err := sqliteDB.Exec(schema); err != nil {
		return err
	}

	// Additive column migrations for existing databases. Each is idempotent:
	// errors from a column that already exists are ignored.
	addColumns := []struct{ table, col, def string }{
		{"apps", "domains", "TEXT"},
		{"apps", "memory", "TEXT"},
		{"apps", "cpus", "TEXT"},
		{"apps", "volumes", "TEXT"},
		{"apps", "health_path", "TEXT"},
		{"apps", "active_container", "TEXT"},
		{"apps", "active_image", "TEXT"},
		{"apps", "active_deploy_id", "TEXT"},
		{"apps", "secret_keys", "TEXT"},
		{"apps", "webhook_secret", "TEXT"},
		{"apps", "auto_deploy", "INTEGER DEFAULT 0"},
		{"apps", "build_method", "TEXT"},
		{"apps", "dockerfile_path", "TEXT"},
		{"apps", "compose_path", "TEXT"},
		{"apps", "compose_project", "TEXT"},
		{"apps", "compose_service", "TEXT"},
		{"apps", "compose_web", "INTEGER DEFAULT 0"},
		{"apps", "compose_primary", "INTEGER DEFAULT 0"},
		{"apps", "image", "TEXT"},
		{"apps", "catalog_id", "TEXT"},
		{"apps", "dockerfile_content", "TEXT"},
		{"deployments", "image", "TEXT"},
		{"deployments", "trigger", "TEXT"},
		{"deployments", "commit_sha", "TEXT"},
		{"deployments", "commit_msg", "TEXT"},
		{"addons", "attached_apps", "TEXT"},
		{"apps", "server_id", "TEXT DEFAULT 'localhost'"},
		{"addons", "server_id", "TEXT DEFAULT 'localhost'"},
	}
	for _, c := range addColumns {
		// SQLite has no "ADD COLUMN IF NOT EXISTS"; ignore the duplicate error.
		_, _ = sqliteDB.Exec("ALTER TABLE " + c.table + " ADD COLUMN " + c.col + " " + c.def)
	}
	return nil
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

	rows, err := sqliteDB.Query(`SELECT id, name, status, git_repo, branch, port, url, created_at, git_token, root_dir, env_vars, build_command, start_command, install_command, port_override, domains, memory, cpus, volumes, health_path, active_container, active_image, active_deploy_id, secret_keys, webhook_secret, auto_deploy, build_method, dockerfile_path, compose_path, compose_project, compose_service, compose_web, compose_primary, image, catalog_id, dockerfile_content, server_id FROM apps`)
	if err != nil {
		log.Printf("[db] failed to load apps: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var a App
		var envJSON string
		var domainsJSON, volumesJSON, secretKeysJSON sql.NullString
		var memory, cpus, healthPath, activeContainer, activeImage, activeDeployID, webhookSecret sql.NullString
		var buildMethod, dockerfilePath, composePath sql.NullString
		var composeProject, composeService sql.NullString
		var composeWeb, composePrimary sql.NullBool
		var image, catalogID, dockerfileContent sql.NullString
		var autoDeploy sql.NullBool
		var serverID sql.NullString
		err := rows.Scan(&a.ID, &a.Name, &a.Status, &a.GitRepo, &a.Branch, &a.Port, &a.URL, &a.CreatedAt, &a.GitToken, &a.RootDir, &envJSON, &a.BuildCommand, &a.StartCommand, &a.InstallCommand, &a.PortOverride,
			&domainsJSON, &memory, &cpus, &volumesJSON, &healthPath, &activeContainer, &activeImage, &activeDeployID, &secretKeysJSON, &webhookSecret, &autoDeploy, &buildMethod, &dockerfilePath, &composePath, &composeProject, &composeService, &composeWeb, &composePrimary, &image, &catalogID, &dockerfileContent, &serverID)
		if err != nil {
			log.Printf("[db] failed to scan app: %v", err)
			continue
		}
		if envJSON != "" {
			_ = json.Unmarshal([]byte(envJSON), &a.EnvVars)
		}
		if domainsJSON.Valid && domainsJSON.String != "" {
			_ = json.Unmarshal([]byte(domainsJSON.String), &a.Domains)
		}
		if volumesJSON.Valid && volumesJSON.String != "" {
			_ = json.Unmarshal([]byte(volumesJSON.String), &a.Volumes)
		}
		if secretKeysJSON.Valid && secretKeysJSON.String != "" {
			_ = json.Unmarshal([]byte(secretKeysJSON.String), &a.SecretKeys)
		}
		a.Memory = memory.String
		a.CPUs = cpus.String
		a.HealthPath = healthPath.String
		a.ActiveContainer = activeContainer.String
		a.ActiveImage = activeImage.String
		a.ActiveDeployID = activeDeployID.String
		a.WebhookSecret = decryptSecret(webhookSecret.String)
		a.AutoDeploy = autoDeploy.Bool
		a.BuildMethod = buildMethod.String
		a.DockerfilePath = dockerfilePath.String
		a.ComposePath = composePath.String
		a.ComposeProject = composeProject.String
		a.ComposeService = composeService.String
		a.ComposeWeb = composeWeb.Bool
		a.ComposePrimary = composePrimary.Bool
		a.Image = image.String
		a.CatalogID = catalogID.String
		a.DockerfileContent = dockerfileContent.String
		a.GitToken = decryptSecret(a.GitToken)
		a.ServerID = serverID.String
		if a.ServerID == "" {
			a.ServerID = "localhost"
		}
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
	domainsJSON, _ := json.Marshal(app.Domains)
	volumesJSON, _ := json.Marshal(app.Volumes)
	secretKeysJSON, _ := json.Marshal(app.SecretKeys)
	encToken := encryptSecret(app.GitToken)
	encWebhook := encryptSecret(app.WebhookSecret)
	_, err := tx.Exec(`
		INSERT INTO apps (id, name, status, git_repo, branch, port, url, created_at, git_token, root_dir, env_vars, build_command, start_command, install_command, port_override,
			domains, memory, cpus, volumes, health_path, active_container, active_image, active_deploy_id, secret_keys, webhook_secret, auto_deploy, build_method, dockerfile_path, compose_path, compose_project, compose_service, compose_web, compose_primary, image, catalog_id, dockerfile_content, server_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
			port_override=excluded.port_override,
			domains=excluded.domains,
			memory=excluded.memory,
			cpus=excluded.cpus,
			volumes=excluded.volumes,
			health_path=excluded.health_path,
			active_container=excluded.active_container,
			active_image=excluded.active_image,
			active_deploy_id=excluded.active_deploy_id,
			secret_keys=excluded.secret_keys,
			webhook_secret=excluded.webhook_secret,
			auto_deploy=excluded.auto_deploy,
			build_method=excluded.build_method,
			dockerfile_path=excluded.dockerfile_path,
			compose_path=excluded.compose_path,
			compose_project=excluded.compose_project,
			compose_service=excluded.compose_service,
			compose_web=excluded.compose_web,
			compose_primary=excluded.compose_primary,
			image=excluded.image,
			catalog_id=excluded.catalog_id,
			dockerfile_content=excluded.dockerfile_content,
			server_id=excluded.server_id
	`, app.ID, app.Name, app.Status, app.GitRepo, app.Branch, app.Port, app.URL, app.CreatedAt, encToken, app.RootDir, string(envJSON), app.BuildCommand, app.StartCommand, app.InstallCommand, app.PortOverride,
		string(domainsJSON), app.Memory, app.CPUs, string(volumesJSON), app.HealthPath, app.ActiveContainer, app.ActiveImage, app.ActiveDeployID, string(secretKeysJSON), encWebhook, app.AutoDeploy, app.BuildMethod, app.DockerfilePath, app.ComposePath, app.ComposeProject, app.ComposeService, app.ComposeWeb, app.ComposePrimary, app.Image, app.CatalogID, app.DockerfileContent, app.ServerID)
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
		INSERT INTO deployments (id, app_id, app_name, status, log_file, created_at, duration, image, trigger, commit_sha, commit_msg)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			status=excluded.status,
			duration=excluded.duration,
			image=excluded.image,
			commit_sha=excluded.commit_sha,
			commit_msg=excluded.commit_msg
	`, dep.ID, dep.AppID, dep.AppName, dep.Status, dep.LogFile, dep.CreatedAt, dep.Duration, dep.Image, dep.Trigger, dep.Commit, dep.CommitMsg)
	return err
}

// dbFailStaleBuildingDeployments marks any deployment still recorded as
// "building" as failed. Used at startup to clean up deployments that were
// interrupted by a server restart/crash mid-build.
func dbFailStaleBuildingDeployments() (int64, error) {
	res, err := sqliteDB.Exec(
		`UPDATE deployments SET status = 'failed', duration = 'interrupted' WHERE status = 'building'`,
	)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return n, nil
}

func dbGetLatestDeployment(appID string) (*DeploymentRecord, error) {
	var d DeploymentRecord
	var image, trigger, commit, commitMsg sql.NullString
	err := sqliteDB.QueryRow(`
		SELECT id, app_id, app_name, status, log_file, created_at, duration, image, trigger, commit_sha, commit_msg
		FROM deployments
		WHERE app_id = ?
		ORDER BY created_at DESC
		LIMIT 1
	`, appID).Scan(&d.ID, &d.AppID, &d.AppName, &d.Status, &d.LogFile, &d.CreatedAt, &d.Duration, &image, &trigger, &commit, &commitMsg)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	d.Image, d.Trigger, d.Commit, d.CommitMsg = image.String, trigger.String, commit.String, commitMsg.String
	return &d, nil
}

// dbFindDeploymentByImage returns the most recent successful deployment for an
// app that produced the given image tag, or nil. Used on rollback to carry the
// target's commit metadata onto the new rollback record.
func dbFindDeploymentByImage(appID, image string) *DeploymentRecord {
	if image == "" {
		return nil
	}
	var d DeploymentRecord
	var img, trigger, commit, commitMsg sql.NullString
	err := sqliteDB.QueryRow(`
		SELECT id, app_id, app_name, status, log_file, created_at, duration, image, trigger, commit_sha, commit_msg
		FROM deployments
		WHERE app_id = ? AND image = ?
		ORDER BY created_at DESC
		LIMIT 1
	`, appID, image).Scan(&d.ID, &d.AppID, &d.AppName, &d.Status, &d.LogFile, &d.CreatedAt, &d.Duration, &img, &trigger, &commit, &commitMsg)
	if err != nil {
		return nil
	}
	d.Image, d.Trigger, d.Commit, d.CommitMsg = img.String, trigger.String, commit.String, commitMsg.String
	return &d
}

// dbGetDeployment returns a single deployment by ID (used for rollback).
func dbGetDeployment(id string) (*DeploymentRecord, error) {
	var d DeploymentRecord
	var image, trigger, commit, commitMsg sql.NullString
	err := sqliteDB.QueryRow(`
		SELECT id, app_id, app_name, status, log_file, created_at, duration, image, trigger, commit_sha, commit_msg
		FROM deployments WHERE id = ?
	`, id).Scan(&d.ID, &d.AppID, &d.AppName, &d.Status, &d.LogFile, &d.CreatedAt, &d.Duration, &image, &trigger, &commit, &commitMsg)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	d.Image, d.Trigger, d.Commit, d.CommitMsg = image.String, trigger.String, commit.String, commitMsg.String
	if d.LogFile != "" {
		d.Logs, _ = readLogFile(d.LogFile)
	}
	return &d, nil
}

func dbLoadDeployments() ([]DeploymentRecord, error) {
	rows, err := sqliteDB.Query(`SELECT id, app_id, app_name, status, log_file, created_at, duration, image, trigger, commit_sha, commit_msg FROM deployments ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []DeploymentRecord
	for rows.Next() {
		var d DeploymentRecord
		var image, trigger, commit, commitMsg sql.NullString
		err := rows.Scan(&d.ID, &d.AppID, &d.AppName, &d.Status, &d.LogFile, &d.CreatedAt, &d.Duration, &image, &trigger, &commit, &commitMsg)
		if err != nil {
			continue
		}
		d.Image, d.Trigger, d.Commit, d.CommitMsg = image.String, trigger.String, commit.String, commitMsg.String
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

// ---------------------------------------------------------------------------
// Addon CRUD
// ---------------------------------------------------------------------------

func dbSaveAddon(a Addon) error {
	connJSON, _ := json.Marshal(a.ConnEnv)
	attachedJSON, _ := json.Marshal(a.AttachedApps)
	_, err := sqliteDB.Exec(`
		INSERT INTO addons (id, type, name, container_name, status, volume, port, conn_env, attached_apps, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			status=excluded.status,
			conn_env=excluded.conn_env,
			attached_apps=excluded.attached_apps
	`, a.ID, a.Type, a.Name, a.ContainerName, a.Status, a.Volume, a.Port, encryptSecret(string(connJSON)), string(attachedJSON), a.CreatedAt)
	return err
}

func dbLoadAddons() ([]Addon, error) {
	// LEFT-style scan: attached_apps may be NULL on rows created before the
	// column existed.
	rows, err := sqliteDB.Query(`SELECT id, type, name, container_name, status, volume, port, conn_env, attached_apps, created_at FROM addons ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Addon
	for rows.Next() {
		var a Addon
		var connEnc sql.NullString
		var attached sql.NullString
		if err := rows.Scan(&a.ID, &a.Type, &a.Name, &a.ContainerName, &a.Status, &a.Volume, &a.Port, &connEnc, &attached, &a.CreatedAt); err != nil {
			continue
		}
		if connEnc.Valid && connEnc.String != "" {
			_ = json.Unmarshal([]byte(decryptSecret(connEnc.String)), &a.ConnEnv)
		}
		if attached.Valid && attached.String != "" {
			_ = json.Unmarshal([]byte(attached.String), &a.AttachedApps)
		}
		result = append(result, a)
	}
	return result, nil
}

func dbGetAddon(id string) (*Addon, error) {
	var a Addon
	var connEnc sql.NullString
	var attached sql.NullString
	err := sqliteDB.QueryRow(`SELECT id, type, name, container_name, status, volume, port, conn_env, attached_apps, created_at FROM addons WHERE id = ?`, id).
		Scan(&a.ID, &a.Type, &a.Name, &a.ContainerName, &a.Status, &a.Volume, &a.Port, &connEnc, &attached, &a.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if connEnc.Valid && connEnc.String != "" {
		_ = json.Unmarshal([]byte(decryptSecret(connEnc.String)), &a.ConnEnv)
	}
	if attached.Valid && attached.String != "" {
		_ = json.Unmarshal([]byte(attached.String), &a.AttachedApps)
	}
	return &a, nil
}

func dbDeleteAddon(id string) error {
	_, err := sqliteDB.Exec(`DELETE FROM addons WHERE id = ?`, id)
	return err
}

// ---------------------------------------------------------------------------
// Cron job CRUD
// ---------------------------------------------------------------------------

func dbSaveCronJob(c CronJob) error {
	_, err := sqliteDB.Exec(`
		INSERT INTO cron_jobs (id, app_id, app_name, schedule, command, enabled, last_run, last_status, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			schedule=excluded.schedule,
			command=excluded.command,
			enabled=excluded.enabled,
			last_run=excluded.last_run,
			last_status=excluded.last_status
	`, c.ID, c.AppID, c.AppName, c.Schedule, c.Command, c.Enabled, c.LastRun, c.LastStatus, c.CreatedAt)
	return err
}

func dbLoadCronJobs() ([]CronJob, error) {
	rows, err := sqliteDB.Query(`SELECT id, app_id, app_name, schedule, command, enabled, last_run, last_status, created_at FROM cron_jobs ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []CronJob
	for rows.Next() {
		var c CronJob
		var lastRun sql.NullTime
		var lastStatus sql.NullString
		if err := rows.Scan(&c.ID, &c.AppID, &c.AppName, &c.Schedule, &c.Command, &c.Enabled, &lastRun, &lastStatus, &c.CreatedAt); err != nil {
			continue
		}
		c.LastRun = lastRun.Time
		c.LastStatus = lastStatus.String
		result = append(result, c)
	}
	return result, nil
}

func dbDeleteCronJob(id string) error {
	_, err := sqliteDB.Exec(`DELETE FROM cron_jobs WHERE id = ?`, id)
	return err
}

func dbDeleteCronJobsForApp(appID string) error {
	_, err := sqliteDB.Exec(`DELETE FROM cron_jobs WHERE app_id = ?`, appID)
	return err
}

// dbState mirrors the old JSON structure for one-time migration.
type dbState struct {
	Apps        []App              `json:"apps"`
	Deployments []DeploymentRecord `json:"deployments"`
	GitHubToken string             `json:"gitHubToken,omitempty"`
}

// ---------------------------------------------------------------------------
// Servers migration
// ---------------------------------------------------------------------------

func runServersMigrations() error {
	schema := `
CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    ip TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    ssh_user TEXT NOT NULL DEFAULT 'root',
    ssh_key TEXT NOT NULL DEFAULT '',
    is_local INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unknown',
    last_checked DATETIME,
    created_at DATETIME NOT NULL
);
`
	if _, err := sqliteDB.Exec(schema); err != nil {
		return err
	}

	// Seed the default localhost row on first boot.
	_, err := sqliteDB.Exec(`
		INSERT INTO servers (id, name, description, ip, port, ssh_user, ssh_key, is_local, status, created_at)
		VALUES ('localhost', 'Localhost', 'The server running this control plane', '127.0.0.1', 22, 'root', '', 1, 'connected', CURRENT_TIMESTAMP)
		ON CONFLICT(id) DO NOTHING
	`)
	return err
}

// ---------------------------------------------------------------------------
// Server CRUD
// ---------------------------------------------------------------------------

func dbSaveServer(s Server) error {
	_, err := sqliteDB.Exec(`
		INSERT INTO servers (id, name, description, ip, port, ssh_user, ssh_key, is_local, status, last_checked, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name,
			description=excluded.description,
			ip=excluded.ip,
			port=excluded.port,
			ssh_user=excluded.ssh_user,
			ssh_key=excluded.ssh_key,
			status=excluded.status,
			last_checked=excluded.last_checked
	`,
		s.ID, s.Name, s.Description, s.IP, s.Port, s.SSHUser,
		encryptSecret(s.SSHKey), s.IsLocal, s.Status, s.LastChecked, s.CreatedAt,
	)
	return err
}

func dbGetServer(id string) (*Server, error) {
	var s Server
	var sshKeyEnc, description sql.NullString
	var lastChecked sql.NullTime
	err := sqliteDB.QueryRow(
		`SELECT id, name, description, ip, port, ssh_user, ssh_key, is_local, status, last_checked, created_at FROM servers WHERE id = ?`, id,
	).Scan(&s.ID, &s.Name, &description, &s.IP, &s.Port, &s.SSHUser, &sshKeyEnc, &s.IsLocal, &s.Status, &lastChecked, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	s.Description = description.String
	s.LastChecked = lastChecked.Time
	if sshKeyEnc.Valid && sshKeyEnc.String != "" {
		s.SSHKey = decryptSecret(sshKeyEnc.String)
	}
	return &s, nil
}

func dbLoadServers() ([]Server, error) {
	rows, err := sqliteDB.Query(
		`SELECT id, name, description, ip, port, ssh_user, ssh_key, is_local, status, last_checked, created_at FROM servers ORDER BY is_local DESC, created_at ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Server
	for rows.Next() {
		var s Server
		var sshKeyEnc, description sql.NullString
		var lastChecked sql.NullTime
		if err := rows.Scan(&s.ID, &s.Name, &description, &s.IP, &s.Port, &s.SSHUser, &sshKeyEnc, &s.IsLocal, &s.Status, &lastChecked, &s.CreatedAt); err != nil {
			continue
		}
		s.Description = description.String
		s.LastChecked = lastChecked.Time
		if sshKeyEnc.Valid && sshKeyEnc.String != "" {
			s.SSHKey = decryptSecret(sshKeyEnc.String)
		}
		result = append(result, s)
	}
	return result, nil
}

func dbDeleteServer(id string) error {
	_, err := sqliteDB.Exec(`DELETE FROM servers WHERE id = ?`, id)
	return err
}

func dbUpdateServerStatus(id, status string) error {
	_, err := sqliteDB.Exec(
		`UPDATE servers SET status = ?, last_checked = ? WHERE id = ?`,
		status, time.Now(), id,
	)
	return err
}

func dbCountAppsOnServer(serverID string) (int, error) {
	var count int
	err := sqliteDB.QueryRow(`SELECT COUNT(*) FROM apps WHERE server_id = ?`, serverID).Scan(&count)
	return count, err
}
