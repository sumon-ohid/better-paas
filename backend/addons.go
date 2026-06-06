package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Managed add-ons (databases / caches)
// ---------------------------------------------------------------------------
//
// One-click backing services run as Docker containers on a shared internal
// network ("better-paas-net") so app containers can reach them by container
// name. Each add-on gets a persistent named volume and generated credentials,
// surfaced as connection env vars the user can paste into an app.
//
// Supported types: postgres, redis, mysql.

const addonNetwork = "better-paas-net"

// addonSpec describes how to launch a given add-on type.
type addonSpec struct {
	Image        string
	InternalPort int
	VolumePath   string // container path to persist
	env          func(password string) []string
	connEnv      func(a *Addon, password string) map[string]string
}

func addonSpecs() map[string]addonSpec {
	return map[string]addonSpec{
		"postgres": {
			Image:        "postgres:16-alpine",
			InternalPort: 5432,
			VolumePath:   "/var/lib/postgresql/data",
			env: func(pw string) []string {
				return []string{"-e", "POSTGRES_PASSWORD=" + pw, "-e", "POSTGRES_USER=appuser", "-e", "POSTGRES_DB=appdb"}
			},
			connEnv: func(a *Addon, pw string) map[string]string {
				host := a.ContainerName
				return map[string]string{
					"DATABASE_URL": fmt.Sprintf("postgres://appuser:%s@%s:5432/appdb", pw, host),
					"PGHOST":       host,
					"PGPORT":       "5432",
					"PGUSER":       "appuser",
					"PGPASSWORD":   pw,
					"PGDATABASE":   "appdb",
				}
			},
		},
		"redis": {
			Image:        "redis:7-alpine",
			InternalPort: 6379,
			VolumePath:   "/data",
			env: func(pw string) []string {
				return nil // command sets the password
			},
			connEnv: func(a *Addon, pw string) map[string]string {
				host := a.ContainerName
				return map[string]string{
					"REDIS_URL":      fmt.Sprintf("redis://:%s@%s:6379", pw, host),
					"REDIS_HOST":     host,
					"REDIS_PORT":     "6379",
					"REDIS_PASSWORD": pw,
				}
			},
		},
		"mysql": {
			Image:        "mysql:8",
			InternalPort: 3306,
			VolumePath:   "/var/lib/mysql",
			env: func(pw string) []string {
				return []string{"-e", "MYSQL_ROOT_PASSWORD=" + pw, "-e", "MYSQL_DATABASE=appdb", "-e", "MYSQL_USER=appuser", "-e", "MYSQL_PASSWORD=" + pw}
			},
			connEnv: func(a *Addon, pw string) map[string]string {
				host := a.ContainerName
				return map[string]string{
					"DATABASE_URL":   fmt.Sprintf("mysql://appuser:%s@%s:3306/appdb", pw, host),
					"MYSQL_HOST":     host,
					"MYSQL_PORT":     "3306",
					"MYSQL_USER":     "appuser",
					"MYSQL_PASSWORD": pw,
					"MYSQL_DATABASE": "appdb",
				}
			},
		},
	}
}

// normalizeServerID returns the canonical local server id for empty values.
func normalizeServerID(serverID string) string {
	serverID = strings.TrimSpace(serverID)
	if serverID == "" {
		return "localhost"
	}
	return serverID
}

// ensureAddonNetwork creates the shared docker network if it doesn't exist.
func ensureAddonNetwork(serverID string) error {
	ex, err := GetExecutorForServer(normalizeServerID(serverID))
	if err != nil {
		return err
	}
	if sshEx, ok := ex.(*SSHExecutor); ok {
		defer sshEx.Close()
	}
	// `docker network create` returns an error if it already exists; ignore it.
	_, _ = ex.RunCommand("docker", "network", "create", addonNetwork)
	return nil
}

// addonPassword returns a 24-char hex secret.
func addonPassword() string {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "changeme" + generateRandomID()
	}
	return hex.EncodeToString(b)
}

// ---------------------------------------------------------------------------
// GET /api/addons
// ---------------------------------------------------------------------------

func handleAddons(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	list, err := dbLoadAddons()
	if err != nil {
		jsonError(w, "Failed to load add-ons", http.StatusInternalServerError)
		return
	}
	out := make([]Addon, len(list))
	for i, a := range list {
		out[i] = a.Public()
	}
	jsonOK(w, out)
}

// ---------------------------------------------------------------------------
// POST /api/addons/create
// ---------------------------------------------------------------------------

func handleAddonCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Type     string `json:"type"`
		Name     string `json:"name"`
		ServerID string `json:"serverId"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	spec, ok := addonSpecs()[req.Type]
	if !ok {
		jsonError(w, "Unsupported add-on type (use postgres, redis, or mysql)", http.StatusBadRequest)
		return
	}
	if req.Name == "" || !validAppName(req.Name) {
		jsonError(w, "invalid name: 2-40 lowercase letters, digits, or hyphens", http.StatusBadRequest)
		return
	}
	req.ServerID = normalizeServerID(req.ServerID)
	ex, err := GetExecutorForServer(req.ServerID)
	if err != nil {
		jsonError(w, "target server unavailable: "+err.Error(), http.StatusBadRequest)
		return
	}
	if sshEx, ok := ex.(*SSHExecutor); ok {
		_ = sshEx.Close()
	}

	if err := ensureAddonNetwork(req.ServerID); err != nil {
		jsonError(w, "failed to prepare database network: "+err.Error(), http.StatusBadRequest)
		return
	}

	id := generateRandomID()
	containerName := fmt.Sprintf("paas-addon-%s-%s", req.Type, id)
	volume := containerName + "-data"
	password := addonPassword()

	addon := Addon{
		ID:            id,
		Type:          req.Type,
		Name:          req.Name,
		ContainerName: containerName,
		Status:        "building",
		Volume:        volume,
		Port:          spec.InternalPort,
		CreatedAt:     time.Now(),
		ServerID:      req.ServerID,
	}
	addon.ConnEnv = spec.connEnv(&addon, password)

	if err := dbSaveAddon(addon); err != nil {
		log.Printf("[addon] failed to save: %v", err)
	}

	// Respond immediately; launch the container in the background.
	jsonOK(w, addon.Public())

	go launchAddon(addon, spec, password)
}

// launchAddon pulls and runs the add-on container.
func launchAddon(addon Addon, spec addonSpec, password string) {
	args := []string{
		"run", "-d",
		"--name", addon.ContainerName,
		"--network", addonNetwork,
		"--restart", "unless-stopped",
		"--label", "better-paas-addon=1",
		"-v", fmt.Sprintf("%s:%s", addon.Volume, spec.VolumePath),
	}
	args = append(args, spec.env(password)...)

	if addon.Type == "redis" {
		args = append(args, spec.Image, "redis-server", "--requirepass", password)
	} else {
		args = append(args, spec.Image)
	}

	ex, err := GetExecutorForServer(addon.ServerID)
	if err != nil {
		log.Printf("[addon] failed to get executor for %s: %v", addon.ContainerName, err)
		addon.Status = "failed"
	} else {
		if sshEx, ok := ex.(*SSHExecutor); ok {
			defer sshEx.Close()
		}
		if out, err := ex.RunCommand("docker", args...); err != nil {
			log.Printf("[addon] failed to launch %s: %v — %s", addon.ContainerName, err, out)
			addon.Status = "failed"
		} else {
			// Wait for the addon to become healthy/ready to accept connections
			log.Printf("[addon] waiting for %s to become healthy...", addon.ContainerName)
			if err := waitAddonHealthy(addon.ServerID, addon, password, 45*time.Second); err != nil {
				log.Printf("[addon] health check failed for %s: %v", addon.ContainerName, err)
				addon.Status = "failed"
				// Clean up the failed container
				_, _ = ex.RunCommand("docker", "rm", "-f", addon.ContainerName)
			} else {
				addon.Status = "running"
			}
		}
	}
	if err := dbSaveAddon(addon); err != nil {
		log.Printf("[addon] failed to update status: %v", err)
	}
}

// waitAddonHealthy checks if a database addon is ready to accept connections.
func waitAddonHealthy(serverID string, addon Addon, password string, timeout time.Duration) error {
	ex, err := GetExecutorForServer(serverID)
	if err != nil {
		return err
	}
	if sshEx, ok := ex.(*SSHExecutor); ok {
		defer sshEx.Close()
	}

	var cmd []string
	switch addon.Type {
	case "postgres":
		cmd = []string{"exec", addon.ContainerName, "pg_isready", "-U", "appuser"}
	case "mysql":
		cmd = []string{"exec", addon.ContainerName, "mysqladmin", "ping", "-uappuser", "-p" + password}
	case "redis":
		cmd = []string{"exec", addon.ContainerName, "redis-cli", "-a", password, "ping"}
	default:
		cmd = []string{"inspect", "-f", "{{.State.Running}}", addon.ContainerName}
	}

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		out, err := ex.RunCommand("docker", cmd...)
		if err == nil {
			if addon.Type == "postgres" || addon.Type == "mysql" {
				return nil
			}
			if addon.Type == "redis" {
				if strings.Contains(strings.ToLower(out), "pong") {
					return nil
				}
			} else {
				if strings.TrimSpace(out) == "true" {
					return nil
				}
			}
		}
		time.Sleep(1 * time.Second)
	}

	return fmt.Errorf("addon %s did not become healthy within %s", addon.ContainerName, timeout)
}

func removeAddonContainer(addon Addon, deleteData bool) {
	ex, err := GetExecutorForServer(addon.ServerID)
	if err != nil {
		log.Printf("[addon] failed to get executor for delete %s: %v", addon.ContainerName, err)
		return
	}
	if sshEx, ok := ex.(*SSHExecutor); ok {
		defer sshEx.Close()
	}
	_, _ = ex.RunCommand("docker", "rm", "-f", addon.ContainerName)
	if deleteData && addon.Volume != "" {
		_, _ = ex.RunCommand("docker", "volume", "rm", "-f", addon.Volume)
	}
}

func startAddonContainer(addon Addon) {
	ex, err := GetExecutorForServer(addon.ServerID)
	if err != nil {
		log.Printf("[addon] failed to get executor for reconcile %s: %v", addon.ContainerName, err)
		return
	}
	if sshEx, ok := ex.(*SSHExecutor); ok {
		defer sshEx.Close()
	}
	_, _ = ex.RunCommand("docker", "start", addon.ContainerName)
}

func addonContainerExists(addon Addon) bool {
	ex, err := GetExecutorForServer(addon.ServerID)
	if err != nil {
		return false
	}
	if sshEx, ok := ex.(*SSHExecutor); ok {
		defer sshEx.Close()
	}
	out, err := ex.RunCommand("docker", "ps", "-aq", "--filter", "name=^/"+addon.ContainerName+"$")
	return err == nil && strings.TrimSpace(out) != ""
}

func createManagedAddon(addonType, name, serverID string) (*Addon, string, error) {
	spec, ok := addonSpecs()[addonType]
	if !ok {
		return nil, "", fmt.Errorf("unsupported add-on type %q", addonType)
	}
	name = strings.TrimSpace(name)
	if name == "" || !validAppName(name) {
		return nil, "", fmt.Errorf("invalid add-on name")
	}
	serverID = normalizeServerID(serverID)
	if err := ensureAddonNetwork(serverID); err != nil {
		return nil, "", err
	}

	id := generateRandomID()
	containerName := fmt.Sprintf("paas-addon-%s-%s", addonType, id)
	volume := containerName + "-data"
	password := addonPassword()
	addon := Addon{
		ID:            id,
		Type:          addonType,
		Name:          name,
		ContainerName: containerName,
		Status:        "building",
		Volume:        volume,
		Port:          spec.InternalPort,
		CreatedAt:     time.Now(),
		ServerID:      serverID,
	}
	addon.ConnEnv = spec.connEnv(&addon, password)
	if err := dbSaveAddon(addon); err != nil {
		return nil, "", err
	}
	launchAddon(addon, spec, password)
	if refreshed, err := dbGetAddon(id); err == nil && refreshed != nil {
		addon = *refreshed
	}
	if addon.Status == "failed" {
		return &addon, password, fmt.Errorf("failed to launch %s container", addonType)
	}
	return &addon, password, nil
}

func catalogAddonEnv(addon Addon, password string) map[string]string {
	env := map[string]string{}
	switch addon.Type {
	case "postgres":
		env["DATABASE_URL"] = fmt.Sprintf("postgres://appuser:%s@%s:5432/appdb", password, addon.ContainerName)
		env["DB_HOSTNAME"] = addon.ContainerName
		env["DB_USERNAME"] = "appuser"
		env["DB_PASSWORD"] = password
		env["DB_DATABASE_NAME"] = "appdb"
		env["POSTGRES_HOST"] = addon.ContainerName
		env["POSTGRES_USER"] = "appuser"
		env["POSTGRES_PASSWORD"] = password
		env["POSTGRES_DB"] = "appdb"
	case "mysql":
		env["DATABASE_URL"] = fmt.Sprintf("mysql://appuser:%s@%s:3306/appdb", password, addon.ContainerName)
		env["MYSQL_HOST"] = addon.ContainerName
		env["MYSQL_USER"] = "appuser"
		env["MYSQL_PASSWORD"] = password
		env["MYSQL_DATABASE"] = "appdb"
	case "redis":
		env["REDIS_URL"] = fmt.Sprintf("redis://:%s@%s:6379", password, addon.ContainerName)
		env["REDIS_HOST"] = addon.ContainerName
		env["REDIS_PASSWORD"] = password
		env["REDIS_HOSTNAME"] = addon.ContainerName
	}
	return env
}

func markAddonAttached(addonID, appID string) {
	addon, err := dbGetAddon(addonID)
	if err != nil || addon == nil {
		return
	}
	if containsString(addon.AttachedApps, appID) {
		return
	}
	addon.AttachedApps = append(addon.AttachedApps, appID)
	if err := dbSaveAddon(*addon); err != nil {
		log.Printf("[addon] failed to record catalog attachment: %v", err)
	}
}

// ---------------------------------------------------------------------------
// POST /api/addons/delete
// ---------------------------------------------------------------------------

func handleAddonDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ID         string `json:"id"`
		DeleteData bool   `json:"deleteData"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	addon, err := dbGetAddon(req.ID)
	if err != nil || addon == nil {
		jsonError(w, "Add-on not found", http.StatusNotFound)
		return
	}
	if isComposeAddonID(addon.ID) {
		jsonError(w, "Compose-backed databases are managed by their Compose project. Delete the project to remove this add-on entry.", http.StatusBadRequest)
		return
	}

	removeAddonContainer(*addon, req.DeleteData)
	if err := dbDeleteAddon(req.ID); err != nil {
		log.Printf("[addon] failed to delete: %v", err)
	}
	jsonOK(w, map[string]string{"status": "deleted"})
}

// ---------------------------------------------------------------------------
// POST /api/addons/attach — copy an add-on's conn env into an app
// ---------------------------------------------------------------------------

func handleAddonAttach(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		AddonID string `json:"addonId"`
		AppID   string `json:"appId"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	addon, err := dbGetAddon(req.AddonID)
	if err != nil || addon == nil {
		jsonError(w, "Add-on not found", http.StatusNotFound)
		return
	}
	app := findApp(req.AppID)
	if app == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}
	if normalizeServerID(addon.ServerID) != normalizeServerID(app.ServerID) {
		jsonError(w, "Add-on and app must be on the same server", http.StatusBadRequest)
		return
	}

	// Merge connection env vars into the app and mark them secret.
	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == req.AppID {
			if apps[i].EnvVars == nil {
				apps[i].EnvVars = map[string]string{}
			}
			secret := map[string]bool{}
			for _, k := range apps[i].SecretKeys {
				secret[k] = true
			}
			for k, v := range addon.ConnEnv {
				apps[i].EnvVars[k] = v
				if !secret[k] {
					apps[i].SecretKeys = append(apps[i].SecretKeys, k)
					secret[k] = true
				}
			}
			break
		}
	}
	appsLock.Unlock()

	// Record the attachment on the add-on (deduplicated) so the UI can show
	// which apps use it, independent of how env vars are redacted.
	if !containsString(addon.AttachedApps, req.AppID) {
		addon.AttachedApps = append(addon.AttachedApps, req.AppID)
		if err := dbSaveAddon(*addon); err != nil {
			log.Printf("[addon] failed to record attachment: %v", err)
		}
	}

	if full := findApp(req.AppID); full != nil {
		if err := dbSaveApp(*full); err != nil {
			log.Printf("[addon] failed to save app after attach: %v", err)
		}
		jsonOK(w, full.Public())
		return
	}
	jsonError(w, "App not found", http.StatusNotFound)
}

// ---------------------------------------------------------------------------
// POST /api/addons/detach — remove an add-on's conn env from an app
// ---------------------------------------------------------------------------

func handleAddonDetach(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		AddonID string `json:"addonId"`
		AppID   string `json:"appId"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	addon, err := dbGetAddon(req.AddonID)
	if err != nil || addon == nil {
		jsonError(w, "Add-on not found", http.StatusNotFound)
		return
	}

	// Remove the add-on's connection env vars from the app (and their secret
	// flags). Only keys still equal to this add-on's values are removed, so we
	// don't clobber vars the user overrode by hand or that another add-on set.
	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == req.AppID {
			if apps[i].EnvVars != nil {
				for k, v := range addon.ConnEnv {
					if cur, ok := apps[i].EnvVars[k]; ok && cur == v {
						delete(apps[i].EnvVars, k)
						apps[i].SecretKeys = removeString(apps[i].SecretKeys, k)
					}
				}
			}
			break
		}
	}
	appsLock.Unlock()

	// Drop the attachment record.
	if containsString(addon.AttachedApps, req.AppID) {
		addon.AttachedApps = removeString(addon.AttachedApps, req.AppID)
		if err := dbSaveAddon(*addon); err != nil {
			log.Printf("[addon] failed to record detachment: %v", err)
		}
	}

	if full := findApp(req.AppID); full != nil {
		if err := dbSaveApp(*full); err != nil {
			log.Printf("[addon] failed to save app after detach: %v", err)
		}
		jsonOK(w, full.Public())
		return
	}
	jsonError(w, "App not found", http.StatusNotFound)
}

// reconcileAddons restores add-on container state on startup (best-effort).
func reconcileAddons() {
	list, err := dbLoadAddons()
	if err != nil {
		return
	}
	if len(list) > 0 {
		serverIDs := map[string]bool{}
		for _, a := range list {
			serverIDs[normalizeServerID(a.ServerID)] = true
		}
		for serverID := range serverIDs {
			if err := ensureAddonNetwork(serverID); err != nil {
				log.Printf("[addon] failed to reconcile network on %s: %v", serverID, err)
			}
		}
	}
	for _, a := range list {
		// If the container exists but is stopped, start it.
		if addonContainerExists(a) {
			startAddonContainer(a)
		}
	}
}

// containerExists reports whether a named container exists (any state).
func containerExists(name string) bool {
	return addonContainerExists(Addon{ContainerName: name, ServerID: "localhost"})
}

// containsString reports whether s is present in list.
func containsString(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

// removeString returns list with all occurrences of s removed.
func removeString(list []string, s string) []string {
	out := list[:0]
	for _, v := range list {
		if v != s {
			out = append(out, v)
		}
	}
	return out
}

// detachAppFromAddons removes appID from every add-on's attachment list. Called
// when an app is deleted so the UI doesn't show stale attachments.
func detachAppFromAddons(appID string) error {
	list, err := dbLoadAddons()
	if err != nil {
		return err
	}
	for _, a := range list {
		if containsString(a.AttachedApps, appID) {
			a.AttachedApps = removeString(a.AttachedApps, appID)
			if err := dbSaveAddon(a); err != nil {
				return err
			}
		}
	}
	return nil
}
