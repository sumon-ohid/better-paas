// Typed API client for the PaaS backend

import type { App, DeployRequest, DeploymentRecord, UpdateRequest, GitHubContent, GitHubFile } from "./types"
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
      req<{ status: string }>("/api/apps/stop", { method: "POST", body: JSON.stringify({ id }) }),
    start: (id: string) =>
      req<{ status: string }>("/api/apps/start", { method: "POST", body: JSON.stringify({ id }) }),
    delete: (id: string) =>
      req<{ status: string }>("/api/apps/delete", { method: "POST", body: JSON.stringify({ id }) }),
    update: (data: UpdateRequest) =>
      req<App>("/api/apps/update", { method: "POST", body: JSON.stringify(data) }),
    redeploy: (id: string) =>
      req<App>("/api/apps/redeploy", { method: "POST", body: JSON.stringify({ id }) }),
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
    repos: () => req<Array<{
      full_name: string
      name: string
      clone_url: string
      html_url: string
      private: boolean
      description: string
      updated_at: string
    }>>("/api/git/repos"),
    contents: (repo: string, branch: string, path?: string) =>
      req<GitHubContent[]>(`/api/git/contents?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path || "")}`),
    file: (repo: string, branch: string, path: string) =>
      req<GitHubFile>(`/api/git/file?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`),
  },

  system: {
    health: () =>
      req<{ status: string; timestamp: string; uptime: string }>("/api/health"),
    prune: () =>
      req<{ status: string; output: string }>("/api/docker/prune", { method: "POST" }),
  },

  deployments: {
    history: () => req<DeploymentRecord[]>("/api/deployments/history"),
  },
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
  return new WebSocket(withToken(`${getWsBase()}/ws/runtime-logs?appId=${appId}`))
}

export function createStatsWs(): WebSocket {
  return new WebSocket(withToken(`${getWsBase()}/ws/stats`))
}
