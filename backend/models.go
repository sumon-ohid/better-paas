package main

import (
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
	LogFile   string    `json:"-"`      // internal path, never sent to client
	CreatedAt time.Time `json:"createdAt"`
	Duration  string    `json:"duration"`
}

// ---------------------------------------------------------------------------
// Global State
// ---------------------------------------------------------------------------

const maxBuildLogLines = 5000

var (
	appsLock sync.Mutex
	apps     = []App{}

	buildLogsLock sync.RWMutex
	buildLogs     = make(map[string][]string)

	subscribersLock sync.Mutex
	subscribers     = make(map[string]map[chan string]bool)

	githubTokenLock sync.RWMutex
	githubToken     = ""

	startTime = time.Now()
)
