package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os/exec"
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
	Image         string
	InternalPort  int
	VolumePath    string // container path to persist
	env           func(password string) []string
	connEnv       func(a *Addon, password string) map[string]string
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
					"REDIS_URL": fmt.Sprintf("redis://:%s@%s:6379", pw, host),
					"REDIS_HOST": host,
					"REDIS_PORT": "6379",
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
					"DATABASE_URL": fmt.Sprintf("mysql://appuser:%s@%s:3306/appdb", pw, host),
					"MYSQL_HOST":   host,
					"MYSQL_PORT":   "3306",
					"MYSQL_USER":   "appuser",
					"MYSQL_PASSWORD": pw,
					"MYSQL_DATABASE": "appdb",
				}
			},
		},
	}
}

// ensureAddonNetwork creates the shared docker network if it doesn't exist.
func ensureAddonNetwork() {
	// `docker network create` is a no-op-ish error if it already exists; ignore.
	exec.Command("docker", "network", "create", addonNetwork).Run()
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
		Type string `json:"type"`
		Name string `json:"name"`
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

	ensureAddonNetwork()

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

	if out, err := exec.Command("docker", args...).CombinedOutput(); err != nil {
		log.Printf("[addon] failed to launch %s: %v — %s", addon.ContainerName, err, string(out))
		addon.Status = "failed"
	} else {
		addon.Status = "running"
	}
	if err := dbSaveAddon(addon); err != nil {
		log.Printf("[addon] failed to update status: %v", err)
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
		ID          string `json:"id"`
		DeleteData  bool   `json:"deleteData"`
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

	exec.Command("docker", "rm", "-f", addon.ContainerName).Run()
	if req.DeleteData && addon.Volume != "" {
		exec.Command("docker", "volume", "rm", "-f", addon.Volume).Run()
	}
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

	if full := findApp(req.AppID); full != nil {
		if err := dbSaveApp(*full); err != nil {
			log.Printf("[addon] failed to save app after attach: %v", err)
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
		ensureAddonNetwork()
	}
	for _, a := range list {
		// If the container exists but is stopped, start it.
		if containerExists(a.ContainerName) {
			exec.Command("docker", "start", a.ContainerName).Run()
		}
	}
}

// containerExists reports whether a named container exists (any state).
func containerExists(name string) bool {
	out, err := exec.Command("docker", "ps", "-aq", "--filter", "name=^/"+name+"$").Output()
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(out)) != ""
}
