import { DEMO_READONLY_MESSAGE } from "./demo"
import {
  DEMO_ADDONS,
  DEMO_APPS,
  DEMO_BACKUP_CONFIG,
  DEMO_BACKUPS,
  DEMO_BUILD_LOG_LINES,
  DEMO_CATALOG,
  DEMO_CRON,
  DEMO_DB_COLUMNS,
  DEMO_DB_ROWS,
  DEMO_DB_TABLES,
  DEMO_DEPLOYMENTS,
  DEMO_GIT_CONTENTS,
  DEMO_GIT_REPOS,
  DEMO_LOG_LINES,
  DEMO_NOTIFICATIONS,
  DEMO_PROJECTS,
  DEMO_SERVERS,
  DEMO_SYSTEM_VERSION,
  DEMO_UPDATE_PROGRESS,
  DEMO_UPDATE_STATUS,
  DEMO_VULNERABILITIES,
  DEMO_DOMAIN,
  ago,
  demoAnalyticsOverview,
  demoAnalyticsSummary,
  demoPerAppMetrics,
  demoProjectDetail,
  getDemoApp,
} from "./demo-data"

function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function demoError(message: string, status: number): never {
  const err = new Error(message) as Error & { status: number; name: string }
  err.status = status
  err.name = "ApiError"
  throw err
}

function readOnly(): never {
  demoError(DEMO_READONLY_MESSAGE, 403)
}

function parseBody<T>(options?: RequestInit): T | null {
  if (!options?.body || typeof options.body !== "string") return null
  try {
    return JSON.parse(options.body) as T
  } catch {
    return null
  }
}

function queryParam(path: string, key: string): string | null {
  const q = path.indexOf("?")
  if (q === -1) return null
  return new URLSearchParams(path.slice(q)).get(key)
}

export async function demoReq<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase()
  const isWrite = method !== "GET" && method !== "HEAD"

  // Auth
  if (path === "/api/auth/verify" && method === "POST") {
    return delay({ valid: true } as T)
  }
  if (path === "/api/auth/ws-ticket" && method === "POST") {
    return delay({ ticket: "demo-ticket", expiresIn: 3600 } as T)
  }

  if (isWrite) {
    // Allow read-like POST bodies used for queries
    if (path.startsWith("/api/addons/db/")) {
      return handleDbExplorer<T>(path, options)
    }
    if (path === "/api/git/branches") {
      return delay(["main", "develop", "release"] as T)
    }
    readOnly()
  }

  // Reads
  if (path === "/api/apps") return delay([...DEMO_APPS] as T)
  if (path === "/api/projects") return delay([...DEMO_PROJECTS] as T)
  if (path.startsWith("/api/projects/get")) {
    const id = queryParam(path, "id")
    const detail = id ? demoProjectDetail(id) : null
    if (!detail) demoError("Project not found", 404)
    return delay(detail as T)
  }
  if (path === "/api/servers") return delay([...DEMO_SERVERS] as T)
  if (path === "/api/catalog") return delay([...DEMO_CATALOG] as T)
  if (path === "/api/addons") return delay([...DEMO_ADDONS] as T)
  if (path === "/api/cron") return delay([...DEMO_CRON] as T)
  if (path === "/api/backups") return delay([...DEMO_BACKUPS] as T)
  if (path === "/api/backups/config") return delay({ ...DEMO_BACKUP_CONFIG } as T)
  if (path === "/api/deployments/history") return delay([...DEMO_DEPLOYMENTS] as T)
  if (path === "/api/notifications") return delay({ ...DEMO_NOTIFICATIONS } as T)
  if (path === "/api/git/token") return delay({ connected: true } as T)
  if (path === "/api/git/repos") return delay([...DEMO_GIT_REPOS] as T)
  if (path.startsWith("/api/git/contents")) {
    return delay([...DEMO_GIT_CONTENTS] as T)
  }
  if (path.startsWith("/api/git/file")) {
    return delay({
      name: "package.json",
      path: "package.json",
      type: "file",
      content: "eyJuYW1lIjoiZGVtbyJ9",
      encoding: "base64",
      size: 16,
      download_url: "",
    } as T)
  }
  if (path === "/api/cloudflare/status") return delay({ connected: false } as T)
  if (path === "/api/server/info") {
    return delay({ publicIp: "203.0.113.42", localIp: "127.0.0.1" } as T)
  }
  if (path === "/api/health") {
    return delay({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: "14d 6h 22m",
      version: "1.4.0",
    } as T)
  }
  if (path === "/api/metrics/apps") return delay(demoPerAppMetrics() as T)
  if (path === "/api/system/version") return delay({ ...DEMO_SYSTEM_VERSION } as T)
  if (path.startsWith("/api/system/update/check")) {
    return delay({ ...DEMO_UPDATE_STATUS } as T)
  }
  if (path === "/api/system/update/status") {
    return delay({ ...DEMO_UPDATE_PROGRESS } as T)
  }
  if (path === "/api/system/onboarding") return delay({ completed: true } as T)
  if (path === "/api/system/domain") {
    return delay({ domain: DEMO_DOMAIN, envOverridden: false } as T)
  }
  if (path.startsWith("/api/analytics/overview")) {
    return delay(demoAnalyticsOverview() as T)
  }
  if (path.startsWith("/api/analytics?id=")) {
    const id = queryParam(path, "id") ?? DEMO_APPS[0].id
    return delay(demoAnalyticsSummary(id) as T)
  }
  if (path.startsWith("/api/apps/runtime-logs")) {
    return delay({
      logs: DEMO_LOG_LINES.map((l) => l.message),
    } as T)
  }
  if (path.startsWith("/api/apps/vulnerabilities/scan")) {
    return delay({
      vulnerabilities: DEMO_VULNERABILITIES,
      packageManager: "npm",
    } as T)
  }
  if (path.startsWith("/api/apps/webhook")) {
    const id = queryParam(path, "id") ?? "app-storefront"
    return delay({
      url: `https://${DEMO_DOMAIN}/api/webhooks/${id}`,
      secret: "demo-secret",
      event: "push",
    } as T)
  }

  demoError(`Demo: unhandled GET ${path}`, 404)
}

async function handleDbExplorer<T>(path: string, options?: RequestInit): Promise<T> {
  const body = parseBody<{ id?: string; table?: string }>(options)
  if (path === "/api/addons/db/tables") {
    return delay({ type: "postgres", tables: DEMO_DB_TABLES } as T)
  }
  if (path === "/api/addons/db/columns") {
    return delay({ columns: DEMO_DB_COLUMNS } as T)
  }
  if (path === "/api/addons/db/table" || path === "/api/addons/db/query") {
    return delay({ ...DEMO_DB_ROWS } as T)
  }
  if (
    path === "/api/addons/db/row/insert" ||
    path === "/api/addons/db/row/update" ||
    path === "/api/addons/db/row/delete"
  ) {
    readOnly()
  }
  demoError("Demo: unhandled db path", 404)
}

export async function demoUploadReq<T>(_path: string, _formData: FormData): Promise<T> {
  readOnly()
}

export function demoRuntimeLogsPayload() {
  const line = DEMO_LOG_LINES[Math.floor(Math.random() * DEMO_LOG_LINES.length)]
  return { message: line.message, timestamp: new Date().toISOString() }
}

export function demoBuildLogsPayload() {
  const line = DEMO_BUILD_LOG_LINES[Math.floor(Math.random() * DEMO_BUILD_LOG_LINES.length)]
  return { message: line.message, timestamp: new Date().toISOString() }
}

export function demoStatsPayload() {
  return {
    cpuUsage: 28 + Math.random() * 20,
    memoryUsage: 55 + Math.random() * 15,
    diskUsage: 41 + Math.random() * 5,
    activeApps: DEMO_APPS.filter((a) => a.status === "running").length,
    timestamp: new Date().toISOString(),
  }
}

export function demoTerminalBanner(): string {
  return "\r\n\x1b[38;5;244m[read-only demo - install Better-PaaS to get a real shell]\x1b[0m\r\n$ "
}

export function demoHostTerminalBanner(): string {
  return "sumon@localhost:~$ "
}

export function getDemoAppForWs(appId: string) {
  return getDemoApp(appId)
}
