// Typed API client for the PaaS backend

import type { App, DeployRequest, DeploymentRecord, UpdateRequest, GitHubContent, GitHubFile } from "./types"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
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
  if (typeof window === "undefined") return "ws://localhost:8080"
  const host = window.location.hostname
  return `ws://${host}:8080`
}

export function createBuildLogsWs(appId: string): WebSocket {
  return new WebSocket(`${getWsBase()}/ws/logs?appId=${appId}`)
}

export function createRuntimeLogsWs(appId: string): WebSocket {
  return new WebSocket(`${getWsBase()}/ws/runtime-logs?appId=${appId}`)
}

export function createStatsWs(): WebSocket {
  return new WebSocket(`${getWsBase()}/ws/stats`)
}
