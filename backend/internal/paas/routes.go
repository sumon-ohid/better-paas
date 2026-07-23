package paas

import "net/http"

func newRouter() *http.ServeMux {
	mux := http.NewServeMux()

	registerAppRoutes(mux)
	registerProjectRoutes(mux)
	registerServerRoutes(mux)
	registerGitRoutes(mux)
	registerCatalogRoutes(mux)
	registerAddonRoutes(mux)
	registerCronRoutes(mux)
	registerNotificationRoutes(mux)
	registerBackupRoutes(mux)
	registerSystemRoutes(mux)
	registerAnalyticsRoutes(mux)
	registerWebSocketRoutes(mux)
	registerAgentRoutes(mux)
	registerAuditRoutes(mux)

	return mux
}

func registerAppRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/apps", scoped(handleApps, ScopeAppsRead))
	mux.HandleFunc("/api/apps/get", scoped(handleGetApp, ScopeAppsRead))
	mux.HandleFunc("/api/deploy", scoped(handleDeploy, ScopeDeployTrigger, ScopeAppsWrite))
	mux.HandleFunc("/api/deploy/upload", scoped(handleDeployUpload, ScopeDeployTrigger, ScopeAppsWrite))
	mux.HandleFunc("/api/apps/stop", scoped(handleStop, ScopeAppsWrite))
	mux.HandleFunc("/api/apps/start", scoped(handleStart, ScopeAppsWrite))
	mux.HandleFunc("/api/apps/delete", scoped(handleDelete, ScopeAppsDelete))
	mux.HandleFunc("/api/apps/update", scoped(handleUpdate, ScopeAppsWrite))
	mux.HandleFunc("/api/apps/rename", scoped(handleRenameApp, ScopeAppsWrite))
	mux.HandleFunc("/api/apps/redeploy", scoped(handleRedeploy, ScopeAppsWrite))
	mux.HandleFunc("/api/apps/rollback", scoped(handleRollback, ScopeAppsWrite))
	mux.HandleFunc("/api/apps/webhook", scoped(handleWebhookInfo, ScopeAppsRead))
	mux.HandleFunc("/api/apps/webhook/regenerate", scoped(handleWebhookRegenerate, ScopeAppsWrite))
	mux.HandleFunc("/api/apps/webhook/github/create", scoped(handleGitHubWebhookCreate, ScopeAppsWrite))
	mux.HandleFunc("/api/apps/domains/add", scoped(handleDomainAdd, ScopeAppsWrite))
	mux.HandleFunc("/api/apps/domains/remove", scoped(handleDomainRemove, ScopeAppsWrite))
	mux.HandleFunc("/api/apps/vulnerabilities/scan", scoped(handleVulnerabilitiesScan, ScopeAppsRead))
	mux.HandleFunc("/api/apps/vulnerabilities/fix", scoped(handleVulnerabilitiesFix, ScopeAppsWrite))
	mux.HandleFunc("/api/apps/runtime-logs", scopedAny(handleRuntimeLogHistory, ScopeAppsRead, ScopeLogsRead))
}

func registerProjectRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/projects", scoped(handleProjectsList, ScopeAppsRead))
	mux.HandleFunc("/api/projects/get", scoped(handleProjectGet, ScopeAppsRead))
	mux.HandleFunc("/api/projects/create", scoped(handleProjectCreate, ScopeAppsWrite))
	mux.HandleFunc("/api/projects/rename", scoped(handleProjectRename, ScopeAppsWrite))
	mux.HandleFunc("/api/projects/delete", scoped(handleProjectDelete, ScopeAppsDelete))
	mux.HandleFunc("/api/projects/services/deploy", scoped(handleProjectServiceDeploy, ScopeDeployTrigger, ScopeAppsWrite))
	mux.HandleFunc("/api/projects/services/deploy/upload", scoped(handleProjectServiceDeployUpload, ScopeDeployTrigger, ScopeAppsWrite))
	mux.HandleFunc("/api/projects/config", scoped(handleProjectConfigGet, ScopeAppsRead))
	mux.HandleFunc("/api/projects/config/update", scoped(handleProjectConfigUpdate, ScopeAppsWrite))
	mux.HandleFunc("/api/projects/redeploy", scoped(handleProjectRedeploy, ScopeDeployTrigger, ScopeAppsWrite))
}

func registerServerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/server/info", scopedAny(handleServerInfo, ScopeAppsRead, ScopeMetricsRead))
	mux.HandleFunc("/api/servers", scoped(handleServersList, ScopeServersManage))
	mux.HandleFunc("/api/servers/create", scoped(handleServerCreate, ScopeServersManage))
	mux.HandleFunc("/api/servers/cloud/create", scoped(handleCloudServerCreate, ScopeServersManage))
	mux.HandleFunc("/api/servers/update", scoped(handleServerUpdate, ScopeServersManage))
	mux.HandleFunc("/api/servers/delete", scoped(handleServerDelete, ScopeServersManage))
	mux.HandleFunc("/api/servers/test", scoped(handleServerTest, ScopeServersManage))
	mux.HandleFunc("/api/servers/keys/public", scoped(handleServerPublicKey, ScopeServersManage))

	mux.HandleFunc("/api/cloudflare/status", scoped(handleCloudflareStatus, ScopeServersManage))
	mux.HandleFunc("/api/cloudflare/token/save", scoped(handleCloudflareTokenSet, ScopeServersManage))
	mux.HandleFunc("/api/cloudflare/token/delete", scoped(handleCloudflareTokenDelete, ScopeServersManage))
	mux.HandleFunc("/api/cloudflare/dns", scoped(handleCloudflareDNS, ScopeServersManage))
}

func registerGitRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/git/branches", scoped(handleGitBranches, ScopeAppsRead))
	mux.HandleFunc("/api/git/repos", scoped(handleGitRepos, ScopeAppsRead))
	mux.HandleFunc("/api/git/contents", scoped(handleGitContents, ScopeAppsRead))
	mux.HandleFunc("/api/git/file", scoped(handleGitFile, ScopeAppsRead))
	mux.HandleFunc("/api/git/token", adminGate(handleGitTokenGet))
	mux.HandleFunc("/api/git/token/save", adminGate(handleGitTokenSet))
	mux.HandleFunc("/api/git/token/delete", adminGate(handleGitTokenDelete))
}

func registerCatalogRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/catalog", scoped(handleCatalog, ScopeAppsRead))
	mux.HandleFunc("/api/catalog/deploy", scoped(handleCatalogDeploy, ScopeDeployTrigger, ScopeAppsWrite))
	mux.HandleFunc("/api/catalog/deploy-image", scoped(handleCatalogDeployImage, ScopeDeployTrigger, ScopeAppsWrite))
	mux.HandleFunc("/api/catalog/deploy-dockerfile", scoped(handleCatalogDeployDockerfile, ScopeDeployTrigger, ScopeAppsWrite))
}

func registerAddonRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/addons", scoped(handleAddons, ScopeAppsRead))
	mux.HandleFunc("/api/addons/get", scoped(handleGetAddon, ScopeAppsRead))
	mux.HandleFunc("/api/addons/create", scoped(handleAddonCreate, ScopeAddonsManage))
	mux.HandleFunc("/api/addons/delete", scoped(handleAddonDelete, ScopeAddonsManage))
	mux.HandleFunc("/api/addons/attach", scoped(handleAddonAttach, ScopeAddonsManage))
	mux.HandleFunc("/api/addons/detach", scoped(handleAddonDetach, ScopeAddonsManage))

	mux.HandleFunc("/api/addons/db/tables", scoped(handleAddonDBTables, ScopeAddonsManage))
	mux.HandleFunc("/api/addons/db/table", scoped(handleAddonDBTable, ScopeAddonsManage))
	mux.HandleFunc("/api/addons/db/query", scoped(handleAddonDBQuery, ScopeAddonsManage))
	mux.HandleFunc("/api/addons/db/columns", scoped(handleAddonDBColumns, ScopeAddonsManage))
	mux.HandleFunc("/api/addons/db/row/insert", scoped(handleAddonDBRowInsert, ScopeAddonsManage))
	mux.HandleFunc("/api/addons/db/row/update", scoped(handleAddonDBRowUpdate, ScopeAddonsManage))
	mux.HandleFunc("/api/addons/db/row/delete", scoped(handleAddonDBRowDelete, ScopeAddonsManage))
}

func registerCronRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/cron", scoped(handleCronList, ScopeCronManage))
	mux.HandleFunc("/api/cron/create", scoped(handleCronCreate, ScopeCronManage))
	mux.HandleFunc("/api/cron/update", scoped(handleCronUpdate, ScopeCronManage))
	mux.HandleFunc("/api/cron/delete", scoped(handleCronDelete, ScopeCronManage))
	mux.HandleFunc("/api/cron/run", scoped(handleCronRunNow, ScopeCronManage))
}

func registerNotificationRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/notifications", scoped(handleNotificationsGet, ScopeNotificationsManage))
	mux.HandleFunc("/api/notifications/save", scoped(handleNotificationsSave, ScopeNotificationsManage))
	mux.HandleFunc("/api/notifications/test", scoped(handleNotificationsTest, ScopeNotificationsManage))
}

func registerBackupRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/backups", scoped(handleBackupsList, ScopeBackupsManage))
	mux.HandleFunc("/api/backups/create", scoped(handleBackupCreate, ScopeBackupsManage))
	mux.HandleFunc("/api/backups/download", scoped(handleBackupDownload, ScopeBackupsManage))
	mux.HandleFunc("/api/backups/restore", scoped(handleBackupRestore, ScopeBackupsManage))
	mux.HandleFunc("/api/backups/delete", scoped(handleBackupDelete, ScopeBackupsManage))
	mux.HandleFunc("/api/backups/config", scoped(handleBackupConfigGet, ScopeBackupsManage))
	mux.HandleFunc("/api/backups/config/save", scoped(handleBackupConfigSave, ScopeBackupsManage))
	mux.HandleFunc("/api/backups/s3/test", scoped(handleBackupS3Test, ScopeBackupsManage))
}

func registerSystemRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/system/version", scoped(handleSystemVersion, ScopeAppsRead))
	mux.HandleFunc("/api/system/domain", adminGate(handleSystemDomain))
	mux.HandleFunc("/api/system/update/check", scoped(handleUpdateCheck, ScopeSystemManage))
	mux.HandleFunc("/api/system/update/status", scoped(handleUpdateStatus, ScopeSystemManage))
	mux.HandleFunc("/api/system/update/apply", scoped(handleUpdateApply, ScopeSystemManage))
	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/.well-known/better-paas.json", handleWellKnown)
	mux.HandleFunc("/api/auth/verify", handleAuthVerify)
	mux.HandleFunc("/api/auth/ws-ticket", handleAuthWSTicket)
	mux.HandleFunc("/api/system/onboarding", adminGate(handleOnboardingGet))
	mux.HandleFunc("/api/system/onboarding/complete", adminGate(handleOnboardingComplete))
	mux.HandleFunc("/api/system/onboarding/reset", adminGate(handleOnboardingReset))
	mux.HandleFunc("/api/docker/prune", scoped(handleDockerPrune, ScopeSystemManage))
	mux.HandleFunc("/api/deployments/history", scoped(handleDeploymentHistory, ScopeAppsRead))
	mux.HandleFunc("/api/metrics/apps", scoped(handlePerAppMetrics, ScopeMetricsRead))
}

func registerAnalyticsRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/analytics", scoped(handleAnalyticsQuery, ScopeAppsRead))
	mux.HandleFunc("/api/analytics/overview", scoped(handleAnalyticsOverview, ScopeAppsRead))
	mux.HandleFunc("/api/track", handleTrack)
	mux.HandleFunc("/api/analytics/script.js", handleAnalyticsScript)
	mux.HandleFunc("/api/webhooks/github/", handleGitHubWebhook)
}

func registerWebSocketRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/ws/stats", handleStatsWS)
	mux.HandleFunc("/ws/logs", handleLogsWS)
	mux.HandleFunc("/ws/runtime-logs", handleRuntimeLogsWS)
	mux.HandleFunc("/ws/terminal", handleTerminalWS)
	mux.HandleFunc("/ws/host-terminal", handleHostTerminalWS)
}

func registerAgentRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/agents", adminGate(handleAgentsList))
	mux.HandleFunc("/api/agents/create", adminGate(handleAgentCreate))
	mux.HandleFunc("/api/agents/delete", adminGate(handleAgentDelete))
	mux.HandleFunc("/api/agents/rotate", adminGate(handleAgentRotate))

	mux.HandleFunc("/api/connect/agent/approve", adminGate(handleConnectAgentApprove))
	mux.HandleFunc("/api/connect/agent/exchange", handleConnectAgentExchange)
}

func registerAuditRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/audit-logs", adminGate(handleAuditLogs))
}

// adminGate wraps a handler so only the admin token (not agent tokens) can
// access it. Use this for sensitive management endpoints.
func adminGate(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !actorIsAdmin(r) {
			jsonError(w, "Forbidden: admin token required", http.StatusForbidden)
			return
		}
		h(w, r)
	}
}
