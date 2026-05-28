package main

import (
	"encoding/json"
	"log"
	"os"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Data Types
// ---------------------------------------------------------------------------

// App represents a deployed application.
type App struct {
	ID             string            `json:"id"`
	Name           string            `json:"name"`
	Status         string            `json:"status"` // "running","building","stopped","failed"
	GitRepo        string            `json:"gitRepo"`
	Branch         string            `json:"branch"`
	Port           int               `json:"port"`
	URL            string            `json:"url"`
	CreatedAt      time.Time         `json:"createdAt"`
	GitToken       string            `json:"gitToken,omitempty"` // stored, but redacted in API responses
	RootDir        string            `json:"rootDir"`
	EnvVars        map[string]string `json:"envVars"`
	BuildCommand   string            `json:"buildCommand"`
	StartCommand   string            `json:"startCommand"`
	InstallCommand string            `json:"installCommand"`
	PortOverride   int               `json:"portOverride"`
}

// AppPublic is the safe view of an App (token redacted).
func (a App) Public() App {
	clone := a
	if clone.GitToken != "" {
		clone.GitToken = "***"
	}
	return clone
}

// ServerStats holds real-time server metrics.
type ServerStats struct {
	CPUUsage    float64   `json:"cpuUsage"`
	MemoryUsage float64   `json:"memoryUsage"`
	DiskUsage   float64   `json:"diskUsage"`
	ActiveApps  int       `json:"activeApps"`
	Timestamp   time.Time `json:"timestamp"`
}

// DeploymentRecord is a historical record of one deployment.
type DeploymentRecord struct {
	ID        string    `json:"id"`
	AppID     string    `json:"appId"`
	AppName   string    `json:"appName"`
	Status    string    `json:"status"` // "success","failed"
	Logs      []string  `json:"logs"`
	CreatedAt time.Time `json:"createdAt"`
	Duration  string    `json:"duration"`
}

// ---------------------------------------------------------------------------
// Global State
// ---------------------------------------------------------------------------

var (
	appsLock sync.Mutex
	apps     = []App{}

	buildLogsLock sync.RWMutex
	buildLogs     = make(map[string][]string)

	subscribersLock sync.Mutex
	subscribers     = make(map[string]map[chan string]bool)

	deploymentsLock sync.Mutex
	deployments     = []DeploymentRecord{}

	startTime = time.Now()
)

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const dbPath = "data/db.json"

type dbState struct {
	Apps        []App              `json:"apps"`
	Deployments []DeploymentRecord `json:"deployments"`
}

// loadDB reads the JSON database from disk and restores state.
func loadDB() {
	appsLock.Lock()
	deploymentsLock.Lock()
	defer appsLock.Unlock()
	defer deploymentsLock.Unlock()

	os.MkdirAll("data", 0755)

	file, err := os.ReadFile(dbPath)
	if err != nil {
		log.Printf("No existing database, starting fresh (%v)", err)
		return
	}

	var state dbState
	if err := json.Unmarshal(file, &state); err != nil {
		log.Printf("Error parsing database: %v", err)
		return
	}

	apps = state.Apps
	deployments = state.Deployments

	// Restore empty build log entries for all known apps
	buildLogsLock.Lock()
	for _, app := range apps {
		buildLogs[app.ID] = []string{}
	}
	buildLogsLock.Unlock()

	log.Printf("✅ Loaded %d apps and %d deployment records from database", len(apps), len(deployments))
}

// saveDB atomically writes state to disk.
// Callers must NOT hold appsLock or deploymentsLock.
func saveDB() {
	appsLock.Lock()
	deploymentsLock.Lock()

	state := dbState{
		Apps:        apps,
		Deployments: deployments,
	}

	appsLock.Unlock()
	deploymentsLock.Unlock()

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		log.Printf("Error encoding database: %v", err)
		return
	}

	tmpPath := dbPath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		log.Printf("Error writing temp database: %v", err)
		return
	}

	if err := os.Rename(tmpPath, dbPath); err != nil {
		log.Printf("Error persisting database: %v", err)
	}
}
