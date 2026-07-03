package main

// Scope names match backend/internal/paas/models.go.
const (
	scopeAppsRead              = "apps:read"
	scopeAppsWrite             = "apps:write"
	scopeAppsDelete            = "apps:delete"
	scopeDeployTrigger         = "deploy:trigger"
	scopeLogsRead              = "logs:read"
	scopeMetricsRead           = "metrics:read"
	scopeAddonsManage          = "addons:manage"
	scopeServersManage         = "servers:manage"
	scopeCronManage            = "cron:manage"
	scopeBackupsManage         = "backups:manage"
	scopeNotificationsManage   = "notifications:manage"
)

type profile struct {
	Name        string
	Description string
	Scopes      []string
}

var profiles = map[string]profile{
	"observer": {
		Name:        "observer",
		Description: "Read-only: list apps, logs, and metrics",
		Scopes: []string{
			scopeAppsRead, scopeLogsRead, scopeMetricsRead,
		},
	},
	"deployer": {
		Name:        "deployer",
		Description: "Deploy and debug: observer + deploy, redeploy, stop/start",
		Scopes: []string{
			scopeAppsRead, scopeLogsRead, scopeMetricsRead,
			scopeAppsWrite, scopeDeployTrigger,
		},
	},
	"operator": {
		Name:        "operator",
		Description: "Full day-to-day ops: deployer + addons, cron, backups, servers",
		Scopes: []string{
			scopeAppsRead, scopeLogsRead, scopeMetricsRead,
			scopeAppsWrite, scopeDeployTrigger,
			scopeAddonsManage, scopeServersManage,
			scopeCronManage, scopeBackupsManage, scopeNotificationsManage,
		},
	},
}

func profileNames() []string {
	return []string{"observer", "deployer", "operator"}
}

func profileByName(name string) (profile, bool) {
	p, ok := profiles[name]
	return p, ok
}
