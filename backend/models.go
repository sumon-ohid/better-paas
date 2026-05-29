package main

import (
	"strings"
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

	// ── Custom domains + TLS (caddy auto-HTTPS) ──────────────────────────────
	Domains []string `json:"domains"` // extra hostnames served over HTTPS

	// ── Resource limits (passed to docker run) ───────────────────────────────
	Memory string `json:"memory"` // e.g. "512m", "1g" (empty = unlimited)
	CPUs   string `json:"cpus"`   // e.g. "0.5", "2" (empty = unlimited)

	// ── Persistent volumes ───────────────────────────────────────────────────
	// Each entry is "volumeName:/container/path". The named volume survives
	// redeploys so stateful apps keep their data.
	Volumes []string `json:"volumes"`

	// ── Zero-downtime deploy bookkeeping ─────────────────────────────────────
	HealthPath     string `json:"healthPath"`               // HTTP path probed before cutover (e.g. "/health"); empty = TCP check
	ActiveContainer string `json:"-"`                       // name of the live container (may differ from Name during cutover)
	ActiveImage     string `json:"activeImage,omitempty"`   // image tag currently serving traffic
	ActiveDeployID  string `json:"activeDeployId,omitempty"` // deployment that produced ActiveImage

	// ── Secret env vars ──────────────────────────────────────────────────────
	// Keys listed here have their values redacted in API responses (mirrors
	// how GitToken is handled). Values are still stored and injected at runtime.
	SecretKeys []string `json:"secretKeys"`

	// ── Auto-deploy ──────────────────────────────────────────────────────────
	WebhookSecret  string `json:"webhookSecret,omitempty"` // HMAC secret for GitHub push webhooks (redacted)
	AutoDeploy     bool   `json:"autoDeploy"`              // deploy automatically on matching push
}

// containerName returns the name of the container currently serving the app,
// falling back to the app name for legacy apps deployed before zero-downtime
// container naming existed.
func (a App) containerName() string {
	if a.ActiveContainer != "" {
		return a.ActiveContainer
	}
	return a.Name
}

// AppPublic is the safe view of an App (secrets redacted).
func (a App) Public() App {
	clone := a
	if clone.GitToken != "" {
		clone.GitToken = "***"
	}
	if clone.WebhookSecret != "" {
		clone.WebhookSecret = "***"
	}
	// Redact secret env var values while keeping their keys visible.
	if len(clone.SecretKeys) > 0 && clone.EnvVars != nil {
		secret := make(map[string]bool, len(clone.SecretKeys))
		for _, k := range clone.SecretKeys {
			secret[k] = true
		}
		redacted := make(map[string]string, len(clone.EnvVars))
		for k, v := range clone.EnvVars {
			if secret[k] && v != "" {
				redacted[k] = "***"
			} else {
				redacted[k] = v
			}
		}
		clone.EnvVars = redacted
	}
	return clone
}

// Addon is a managed backing service (database/cache) attached to apps.
type Addon struct {
	ID            string            `json:"id"`
	Type          string            `json:"type"` // "postgres","redis","mysql"
	Name          string            `json:"name"` // user-facing name
	ContainerName string            `json:"containerName"`
	Status        string            `json:"status"` // "running","stopped","failed"
	Volume        string            `json:"volume"`
	Port          int               `json:"port"`
	ConnEnv       map[string]string `json:"connEnv,omitempty"` // connection env vars (redacted in public view)
	CreatedAt     time.Time         `json:"createdAt"`
}

// Public redacts credential-bearing connection env vars.
func (a Addon) Public() Addon {
	clone := a
	if len(clone.ConnEnv) > 0 {
		red := make(map[string]string, len(clone.ConnEnv))
		for k, v := range clone.ConnEnv {
			// Redact anything that looks like a URL or password.
			if strings.Contains(strings.ToUpper(k), "PASSWORD") ||
				strings.Contains(strings.ToUpper(k), "URL") ||
				strings.Contains(strings.ToUpper(k), "DSN") {
				if v != "" {
					red[k] = "***"
				}
			} else {
				red[k] = v
			}
		}
		clone.ConnEnv = red
	}
	return clone
}

// CronJob is a scheduled command executed against an app's container.
type CronJob struct {
	ID         string    `json:"id"`
	AppID      string    `json:"appId"`
	AppName    string    `json:"appName"`
	Schedule   string    `json:"schedule"` // 5-field cron expression
	Command    string    `json:"command"`
	Enabled    bool      `json:"enabled"`
	LastRun    time.Time `json:"lastRun"`
	LastStatus string    `json:"lastStatus"` // "success","failed",""
	CreatedAt  time.Time `json:"createdAt"`
}

// NotificationConfig controls deploy notifications.
type NotificationConfig struct {
	SlackWebhookURL string `json:"slackWebhookUrl"`
	GenericURL      string `json:"genericUrl"` // generic POST endpoint
	OnSuccess       bool   `json:"onSuccess"`
	OnFailure       bool   `json:"onFailure"`
}

// PerAppMetrics is a point-in-time resource snapshot for one container.
type PerAppMetrics struct {
	AppID       string  `json:"appId"`
	Name        string  `json:"name"`
	CPUPercent  float64 `json:"cpuPercent"`
	MemUsageMB  float64 `json:"memUsageMb"`
	MemLimitMB  float64 `json:"memLimitMb"`
	MemPercent  float64 `json:"memPercent"`
	NetRxMB     float64 `json:"netRxMb"`
	NetTxMB     float64 `json:"netTxMb"`
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
	Image     string    `json:"image,omitempty"`     // docker image tag built by this deploy (enables rollback)
	Trigger   string    `json:"trigger,omitempty"`   // "manual","webhook","rollback"
	Commit    string    `json:"commit,omitempty"`    // git commit SHA, when known
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
