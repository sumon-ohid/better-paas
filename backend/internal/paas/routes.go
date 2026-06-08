package paas

import "net/http"

func newRouter() *http.ServeMux {
	mux := http.NewServeMux()

	registerAppRoutes(mux)
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

	return mux
}

func registerAppRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/apps", handleApps)
	mux.HandleFunc("/api/deploy", handleDeploy)
	mux.HandleFunc("/api/apps/stop", handleStop)
	mux.HandleFunc("/api/apps/start", handleStart)
	mux.HandleFunc("/api/apps/delete", handleDelete)
	mux.HandleFunc("/api/apps/update", handleUpdate)
	mux.HandleFunc("/api/apps/rename", handleRenameApp)
	mux.HandleFunc("/api/apps/redeploy", handleRedeploy)
	mux.HandleFunc("/api/apps/rollback", handleRollback)
	mux.HandleFunc("/api/apps/webhook", handleWebhookInfo)
	mux.HandleFunc("/api/apps/webhook/regenerate", handleWebhookRegenerate)
	mux.HandleFunc("/api/apps/webhook/github/create", handleGitHubWebhookCreate)
	mux.HandleFunc("/api/apps/domains/add", handleDomainAdd)
	mux.HandleFunc("/api/apps/domains/remove", handleDomainRemove)
	mux.HandleFunc("/api/apps/vulnerabilities/scan", handleVulnerabilitiesScan)
	mux.HandleFunc("/api/apps/vulnerabilities/fix", handleVulnerabilitiesFix)
	mux.HandleFunc("/api/apps/runtime-logs", handleRuntimeLogHistory)
}

func registerServerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/server/info", handleServerInfo)
	mux.HandleFunc("/api/servers", handleServersList)
	mux.HandleFunc("/api/servers/create", handleServerCreate)
	mux.HandleFunc("/api/servers/cloud/create", handleCloudServerCreate)
	mux.HandleFunc("/api/servers/delete", handleServerDelete)
	mux.HandleFunc("/api/servers/test", handleServerTest)
	mux.HandleFunc("/api/servers/keys/public", handleServerPublicKey)

	mux.HandleFunc("/api/cloudflare/status", handleCloudflareStatus)
	mux.HandleFunc("/api/cloudflare/token/save", handleCloudflareTokenSet)
	mux.HandleFunc("/api/cloudflare/token/delete", handleCloudflareTokenDelete)
	mux.HandleFunc("/api/cloudflare/dns", handleCloudflareDNS)
}

func registerGitRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/git/branches", handleGitBranches)
	mux.HandleFunc("/api/git/repos", handleGitRepos)
	mux.HandleFunc("/api/git/contents", handleGitContents)
	mux.HandleFunc("/api/git/file", handleGitFile)
	mux.HandleFunc("/api/git/token", handleGitTokenGet)
	mux.HandleFunc("/api/git/token/save", handleGitTokenSet)
	mux.HandleFunc("/api/git/token/delete", handleGitTokenDelete)
}

func registerCatalogRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/catalog", handleCatalog)
	mux.HandleFunc("/api/catalog/deploy", handleCatalogDeploy)
	mux.HandleFunc("/api/catalog/deploy-image", handleCatalogDeployImage)
	mux.HandleFunc("/api/catalog/deploy-dockerfile", handleCatalogDeployDockerfile)
}

func registerAddonRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/addons", handleAddons)
	mux.HandleFunc("/api/addons/create", handleAddonCreate)
	mux.HandleFunc("/api/addons/delete", handleAddonDelete)
	mux.HandleFunc("/api/addons/attach", handleAddonAttach)
	mux.HandleFunc("/api/addons/detach", handleAddonDetach)

	mux.HandleFunc("/api/addons/db/tables", handleAddonDBTables)
	mux.HandleFunc("/api/addons/db/table", handleAddonDBTable)
	mux.HandleFunc("/api/addons/db/query", handleAddonDBQuery)
	mux.HandleFunc("/api/addons/db/columns", handleAddonDBColumns)
	mux.HandleFunc("/api/addons/db/row/insert", handleAddonDBRowInsert)
	mux.HandleFunc("/api/addons/db/row/update", handleAddonDBRowUpdate)
	mux.HandleFunc("/api/addons/db/row/delete", handleAddonDBRowDelete)
}

func registerCronRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/cron", handleCronList)
	mux.HandleFunc("/api/cron/create", handleCronCreate)
	mux.HandleFunc("/api/cron/update", handleCronUpdate)
	mux.HandleFunc("/api/cron/delete", handleCronDelete)
	mux.HandleFunc("/api/cron/run", handleCronRunNow)
}

func registerNotificationRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/notifications", handleNotificationsGet)
	mux.HandleFunc("/api/notifications/save", handleNotificationsSave)
	mux.HandleFunc("/api/notifications/test", handleNotificationsTest)
}

func registerBackupRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/backups", handleBackupsList)
	mux.HandleFunc("/api/backups/create", handleBackupCreate)
	mux.HandleFunc("/api/backups/download", handleBackupDownload)
	mux.HandleFunc("/api/backups/delete", handleBackupDelete)
	mux.HandleFunc("/api/backups/config", handleBackupConfigGet)
	mux.HandleFunc("/api/backups/config/save", handleBackupConfigSave)
	mux.HandleFunc("/api/backups/s3/test", handleBackupS3Test)
}

func registerSystemRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/system/version", handleSystemVersion)
	mux.HandleFunc("/api/system/domain", handleSystemDomain)
	mux.HandleFunc("/api/system/update/check", handleUpdateCheck)
	mux.HandleFunc("/api/system/update/status", handleUpdateStatus)
	mux.HandleFunc("/api/system/update/apply", handleUpdateApply)
	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/api/auth/verify", handleAuthVerify)
	mux.HandleFunc("/api/auth/ws-ticket", handleAuthWSTicket)
	mux.HandleFunc("/api/system/onboarding", handleOnboardingGet)
	mux.HandleFunc("/api/system/onboarding/complete", handleOnboardingComplete)
	mux.HandleFunc("/api/system/onboarding/reset", handleOnboardingReset)
	mux.HandleFunc("/api/docker/prune", handleDockerPrune)
	mux.HandleFunc("/api/deployments/history", handleDeploymentHistory)
	mux.HandleFunc("/api/metrics/apps", handlePerAppMetrics)
}

func registerAnalyticsRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/analytics", handleAnalyticsQuery)
	mux.HandleFunc("/api/analytics/overview", handleAnalyticsOverview)
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
