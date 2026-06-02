// Typed API client for the PaaS backend

import type {
  App,
  Server,
  DeployRequest,
  DeploymentRecord,
  UpdateRequest,
  GitHubContent,
  GitHubFile,
  PerAppMetrics,
  Addon,
  CatalogTemplate,
  CatalogDeployRequest,
  ImageDeployRequest,
  DockerfileDeployRequest,
  CronJob,
  NotificationConfig,
  DbQueryResult,
  DbColumn,
  BackupInfo,
  BackupConfig,
  WebhookInfo,
  SystemVersion,
  UpdateStatus,
  UpdateProgress,
  AnalyticsSummary,
  AnalyticsOverviewRow,
} from "./types"
import { getToken } from "./auth"

// Resolve the backend base URL.
//
// Priority:
//   1. NEXT_PUBLIC_API_URL (explicit override for custom deployments)
//   2. Same host as the dashboard, port 8080 (correct for self-hosted: the
//      browser may be remote, so "localhost" would be wrong)
//   3. http://localhost:8080 (SSR / build-time fallback)
export function getApiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL
  if (explicit) return explicit.replace(/\/$/, "")
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8080`
  }
  return "http://localhost:8080"
}

const BASE_URL = getApiBase()

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = "ApiError"
  }
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new ApiError(body || `HTTP ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  // Validates a token against the backend without persisting it.
  verify: (token: string) =>
    req<{ valid: boolean }>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
}

// ── Apps ─────────────────────────────────────────────────────────────────────

export const api = {
  apps: {
    list: () => req<App[]>("/api/apps"),
    deploy: (data: DeployRequest) =>
      req<App>("/api/deploy", { method: "POST", body: JSON.stringify(data) }),
    stop: (id: string) =>
      req<{ status: string }>("/api/apps/stop", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),
    start: (id: string) =>
      req<{ status: string }>("/api/apps/start", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),
    delete: (id: string) =>
      req<{ status: string }>("/api/apps/delete", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),
    update: (data: UpdateRequest) =>
      req<App>("/api/apps/update", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    rename: (id: string, name: string) =>
      req<App>("/api/apps/rename", {
        method: "POST",
        body: JSON.stringify({ id, name }),
      }),
    redeploy: (id: string) =>
      req<App>("/api/apps/redeploy", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),
    rollback: (id: string, deploymentId: string) =>
      req<App>("/api/apps/rollback", {
        method: "POST",
        body: JSON.stringify({ id, deploymentId }),
      }),
    webhook: (id: string) =>
      req<WebhookInfo>(`/api/apps/webhook?id=${encodeURIComponent(id)}`),
    regenerateWebhook: (id: string) =>
      req<{ secret: string }>("/api/apps/webhook/regenerate", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),
    addDomain: (id: string, domain: string) =>
      req<App>("/api/apps/domains/add", {
        method: "POST",
        body: JSON.stringify({ id, domain }),
      }),
    removeDomain: (id: string, domain: string) =>
      req<App>("/api/apps/domains/remove", {
        method: "POST",
        body: JSON.stringify({ id, domain }),
      }),
    runtimeLogs: (id: string, lines = 500) =>
      req<{ logs: string[] }>(
        `/api/apps/runtime-logs?id=${encodeURIComponent(id)}&lines=${lines}`
      ),
  },

  // ── Custom domains: server info + Cloudflare DNS ────────────────────────────
  server: {
    info: () => req<{ publicIp: string; localIp: string }>("/api/server/info"),
  },

  // ── Multi-server management ───────────────────────────────────────────────────
  servers: {
    list: () => req<Server[]>("/api/servers"),
    create: (data: {
      name: string
      description?: string
      ip: string
      port?: number
      sshUser?: string
    }) =>
      req<Server>("/api/servers/create", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    createCloud: (data: {
      provider: "hetzner" | "digitalocean" | "vultr"
      token: string
      name: string
      description?: string
      region?: string
      size?: string
      image?: string
      sshUser?: string
    }) =>
      req<Server>("/api/servers/cloud/create", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      req<{ status: string }>("/api/servers/delete", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),
    test: (id: string) =>
      req<{ status: string; dockerVersion?: string; error?: string }>(
        "/api/servers/test",
        { method: "POST", body: JSON.stringify({ id }) }
      ),
    publicKey: (id: string) =>
      req<{ publicKey: string }>(
        `/api/servers/keys/public?id=${encodeURIComponent(id)}`
      ),
  },
  cloudflare: {
    status: () => req<{ connected: boolean }>("/api/cloudflare/status"),
    saveToken: (token: string) =>
      req<{ status: string }>("/api/cloudflare/token/save", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    deleteToken: () =>
      req<{ status: string }>("/api/cloudflare/token/delete", {
        method: "DELETE",
      }),
    addDns: (domain: string) =>
      req<{
        status: string
        domain: string
        ip: string
        zone: string
        proxied: boolean
      }>("/api/cloudflare/dns", {
        method: "POST",
        body: JSON.stringify({ domain }),
      }),
  },

  // ── App catalog (one-click deploys) ─────────────────────────────────────────
  catalog: {
    list: () => req<CatalogTemplate[]>("/api/catalog"),
    deploy: (data: CatalogDeployRequest) =>
      req<App>("/api/catalog/deploy", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deployImage: (data: ImageDeployRequest) =>
      req<App>("/api/catalog/deploy-image", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deployDockerfile: (data: DockerfileDeployRequest) =>
      req<App>("/api/catalog/deploy-dockerfile", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // ── Managed add-ons (databases / caches) ────────────────────────────────────
  addons: {
    list: () => req<Addon[]>("/api/addons"),
    create: (type: string, name: string, serverId = "localhost") =>
      req<Addon>("/api/addons/create", {
        method: "POST",
        body: JSON.stringify({ type, name, serverId }),
      }),
    delete: (id: string, deleteData = false) =>
      req<{ status: string }>("/api/addons/delete", {
        method: "POST",
        body: JSON.stringify({ id, deleteData }),
      }),
    attach: (addonId: string, appId: string) =>
      req<App>("/api/addons/attach", {
        method: "POST",
        body: JSON.stringify({ addonId, appId }),
      }),
    detach: (addonId: string, appId: string) =>
      req<App>("/api/addons/detach", {
        method: "POST",
        body: JSON.stringify({ addonId, appId }),
      }),
    // ── Database explorer ─────────────────────────────────────────────────
    dbTables: (id: string) =>
      req<{ type: string; tables: string[] }>("/api/addons/db/tables", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),
    dbTable: (
      id: string,
      table: string,
      limit = 50,
      offset = 0,
      orderBy?: string,
      orderDir?: "asc" | "desc"
    ) =>
      req<DbQueryResult>("/api/addons/db/table", {
        method: "POST",
        body: JSON.stringify({ id, table, limit, offset, orderBy, orderDir }),
      }),
    dbQuery: (id: string, query: string) =>
      req<DbQueryResult>("/api/addons/db/query", {
        method: "POST",
        body: JSON.stringify({ id, query }),
      }),
    dbColumns: (id: string, table: string) =>
      req<{ columns: DbColumn[] }>("/api/addons/db/columns", {
        method: "POST",
        body: JSON.stringify({ id, table }),
      }),
    dbInsertRow: (
      id: string,
      table: string,
      values: Record<string, string | null>
    ) =>
      req<DbQueryResult>("/api/addons/db/row/insert", {
        method: "POST",
        body: JSON.stringify({ id, table, values }),
      }),
    dbUpdateRow: (
      id: string,
      table: string,
      set: Record<string, string | null>,
      where: Record<string, string | null>
    ) =>
      req<DbQueryResult>("/api/addons/db/row/update", {
        method: "POST",
        body: JSON.stringify({ id, table, set, where }),
      }),
    dbDeleteRow: (
      id: string,
      table: string,
      where: Record<string, string | null>
    ) =>
      req<DbQueryResult>("/api/addons/db/row/delete", {
        method: "POST",
        body: JSON.stringify({ id, table, where }),
      }),
  },

  // ── Scheduled jobs (cron) ───────────────────────────────────────────────────
  cron: {
    list: () => req<CronJob[]>("/api/cron"),
    create: (appId: string, schedule: string, command: string) =>
      req<CronJob>("/api/cron/create", {
        method: "POST",
        body: JSON.stringify({ appId, schedule, command }),
      }),
    update: (data: {
      id: string
      schedule?: string
      command?: string
      enabled?: boolean
    }) =>
      req<CronJob>("/api/cron/update", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      req<{ status: string }>("/api/cron/delete", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),
    run: (id: string) =>
      req<{ status: string }>("/api/cron/run", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),
  },

  // ── Deploy notifications ────────────────────────────────────────────────────
  notifications: {
    get: () => req<NotificationConfig>("/api/notifications"),
    save: (cfg: NotificationConfig) =>
      req<NotificationConfig>("/api/notifications/save", {
        method: "POST",
        body: JSON.stringify(cfg),
      }),
    test: () =>
      req<{ status: string }>("/api/notifications/test", { method: "POST" }),
  },

  // ── Backups ─────────────────────────────────────────────────────────────────
  backups: {
    list: () => req<BackupInfo[]>("/api/backups"),
    create: () => req<BackupInfo>("/api/backups/create", { method: "POST" }),
    delete: (name: string) =>
      req<{ status: string }>("/api/backups/delete", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    downloadUrl: (name: string) =>
      `${BASE_URL}/api/backups/download?name=${encodeURIComponent(name)}`,
    getConfig: () => req<BackupConfig>("/api/backups/config"),
    saveConfig: (cfg: BackupConfig) =>
      req<BackupConfig>("/api/backups/config/save", {
        method: "POST",
        body: JSON.stringify(cfg),
      }),
    testS3: (cfg: BackupConfig) =>
      req<{ status: string }>("/api/backups/s3/test", {
        method: "POST",
        body: JSON.stringify(cfg),
      }),
  },

  git: {
    branches: (gitRepo: string, gitToken?: string) =>
      req<string[]>("/api/git/branches", {
        method: "POST",
        body: JSON.stringify({ gitRepo, gitToken }),
      }),
    tokenStatus: () => req<{ connected: boolean }>("/api/git/token"),
    saveToken: (token: string) =>
      req<{ status: string }>("/api/git/token/save", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    deleteToken: () =>
      req<{ status: string }>("/api/git/token/delete", { method: "DELETE" }),
    repos: () =>
      req<
        Array<{
          full_name: string
          name: string
          clone_url: string
          html_url: string
          private: boolean
          description: string
          updated_at: string
        }>
      >("/api/git/repos"),
    contents: (repo: string, branch: string, path?: string) =>
      req<GitHubContent[]>(
        `/api/git/contents?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path || "")}`
      ),
    file: (repo: string, branch: string, path: string) =>
      req<GitHubFile>(
        `/api/git/file?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`
      ),
  },

  system: {
    health: () =>
      req<{ status: string; timestamp: string; uptime: string }>("/api/health"),
    prune: () =>
      req<{ status: string; output: string }>("/api/docker/prune", {
        method: "POST",
      }),
    appMetrics: () => req<PerAppMetrics[]>("/api/metrics/apps"),
    version: () => req<SystemVersion>("/api/system/version"),
    updateCheck: (force = false) =>
      req<UpdateStatus>(`/api/system/update/check${force ? "?force=1" : ""}`),
    updateStatus: () => req<UpdateProgress>("/api/system/update/status"),
    updateApply: () =>
      req<{ status: string; target: string; message: string }>(
        "/api/system/update/apply",
        { method: "POST" }
      ),
    onboarding: () => req<{ completed: boolean }>("/api/system/onboarding"),
    completeOnboarding: () =>
      req<{ completed: boolean }>("/api/system/onboarding/complete", {
        method: "POST",
      }),
    resetOnboarding: () =>
      req<{ completed: boolean }>("/api/system/onboarding/reset", {
        method: "POST",
      }),
  },

  deployments: {
    history: () => req<DeploymentRecord[]>("/api/deployments/history"),
  },

  // ── Website analytics ───────────────────────────────────────────────────────
  analytics: {
    summary: (appId: string, days: 1 | 7 | 30 | 90 = 7) =>
      req<AnalyticsSummary>(
        `/api/analytics?id=${encodeURIComponent(appId)}&days=${days}`
      ),
    overview: (days: 1 | 7 | 30 | 90 = 7) =>
      req<AnalyticsOverviewRow[]>(`/api/analytics/overview?days=${days}`),
    // URL of the embeddable tracking script (served by the backend).
    scriptUrl: () => `${BASE_URL}/api/analytics/script.js`,
    // The one-line snippet the operator pastes into their deployed site.
    snippet: (appId: string) =>
      `<script defer data-site="${appId}" src="${BASE_URL}/api/analytics/script.js"></script>`,
    // A ready-to-paste prompt for an AI coding assistant (Cursor, Copilot,
    // Claude, etc.) that explains how to install the tracking snippet into any
    // kind of project, framework by framework.
    installPrompt: (appId: string) => buildInstallPrompt(appId, BASE_URL),
  },
}

// buildInstallPrompt composes a self-contained instruction an operator can hand
// to any AI coding assistant. It embeds the exact snippet plus per-framework
// placement guidance so the assistant can install it correctly regardless of
// the target stack.
export function buildInstallPrompt(appId: string, baseUrl: string): string {
  const snippet = `<script defer data-site="${appId}" src="${baseUrl}/api/analytics/script.js"></script>`
  return `I want to add a lightweight, privacy-friendly web analytics tracking script to my website/app. Please add the following snippet so it loads on every page of the site:

${snippet}

Requirements:
- The script must load on EVERY page/route, ideally once globally (not per-page).
- Place it as close to the end of the <head> (or end of <body>) as the framework allows.
- It is a third-party <script> tag: keep the "defer" attribute and the "data-site" attribute exactly as given. Do not rename or remove them.
- Do NOT inline the script contents; load it from the given src URL.
- No cookie banner or consent gating is required (the script sets no cookies and stores nothing in the browser).
- It already tracks SPA / client-side route changes by hooking the History API, so I do NOT need to manually fire pageview events on navigation.

Framework-specific placement (use whichever matches my project):

1) Plain HTML / static site:
   Paste the snippet inside the <head> of every HTML page (or your shared layout/partial/include).

2) Next.js (App Router, app/ directory):
   Use the next/script component in app/layout.tsx, inside <body>:
     import Script from "next/script"
     <Script defer data-site="${appId}" src="${baseUrl}/api/analytics/script.js" strategy="afterInteractive" />
   (Do not paste a raw <script> tag into JSX.)

3) Next.js (Pages Router, pages/ directory):
   Add the same next/script component in pages/_app.tsx, OR add the raw tag in pages/_document.tsx inside <Head>.

4) Vite / Create React App / any plain SPA:
   Paste the raw snippet into the <head> of index.html.

5) Vue 3 / Nuxt:
   - Vue (Vite): paste the snippet into index.html <head>.
   - Nuxt: add it via app.head in nuxt.config (script array with src, defer, and the data-site attribute).

6) SvelteKit:
   Paste the snippet into src/app.html inside <head>.

7) Astro:
   Paste the snippet into the <head> of your base layout (e.g. src/layouts/Layout.astro).

8) Angular:
   Paste the raw snippet into the <head> of src/index.html.

After adding it, confirm the file you changed and verify the tag renders in the served HTML's <head>. Keep the src URL exactly as provided.`
}

// ── WebSocket helpers ─────────────────────────────────────────────────────────

export function getWsBase(): string {
  const base = getApiBase()
  // Convert http(s):// → ws(s)://
  return base.replace(/^http/, "ws")
}

// Appends the admin token to a WS URL so the backend can authenticate the
// handshake (browsers cannot set headers on WebSocket connections).
function withToken(url: string): string {
  const token = getToken()
  if (!token) return url
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}token=${encodeURIComponent(token)}`
}

export function createBuildLogsWs(appId: string): WebSocket {
  return new WebSocket(withToken(`${getWsBase()}/ws/logs?appId=${appId}`))
}

export function createRuntimeLogsWs(appId: string): WebSocket {
  return new WebSocket(
    withToken(`${getWsBase()}/ws/runtime-logs?appId=${appId}`)
  )
}

export function createStatsWs(serverId = "localhost"): WebSocket {
  return new WebSocket(
    withToken(
      `${getWsBase()}/ws/stats?serverId=${encodeURIComponent(serverId)}`
    )
  )
}

export function createTerminalWs(appId: string): WebSocket {
  return new WebSocket(withToken(`${getWsBase()}/ws/terminal?appId=${appId}`))
}

export function createHostTerminalWs(serverId?: string): WebSocket {
  const query = serverId && serverId !== "all" ? `?serverId=${serverId}` : ""
  return new WebSocket(withToken(`${getWsBase()}/ws/host-terminal${query}`))
}
