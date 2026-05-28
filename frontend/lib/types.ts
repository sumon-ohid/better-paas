// Shared TypeScript types for the PaaS frontend

export interface App {
  id: string
  name: string
  status: "running" | "building" | "stopped" | "failed" | string
  gitRepo: string
  branch: string
  port: number
  url: string
  createdAt: string
  rootDir?: string
  envVars?: Record<string, string>
  buildCommand?: string
  startCommand?: string
  installCommand?: string
  portOverride?: number
}

export interface ServerStats {
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  activeApps: number
  timestamp: string
}

export interface LogEntry {
  message: string
  timestamp: string
}

export interface DeploymentRecord {
  id: string
  appId: string
  appName: string
  status: "success" | "failed" | string
  logs: string[]
  createdAt: string
  duration: string
}

export interface DeployRequest {
  name: string
  gitRepo: string
  branch: string
  gitToken?: string
  rootDir?: string
  envVars?: Record<string, string>
  buildCommand?: string
  startCommand?: string
  installCommand?: string
  portOverride?: number
}

export interface UpdateRequest {
  id: string
  gitRepo?: string
  branch?: string
  rootDir?: string
  envVars?: Record<string, string>
  buildCommand?: string
  startCommand?: string
  installCommand?: string
  portOverride?: number
}

export interface GitHubRepo {
  full_name: string
  name: string
  clone_url: string
  html_url: string
  private: boolean
  description: string
  updated_at: string
}

export interface GitHubContent {
  name: string
  path: string
  type: "file" | "dir"
}

export interface GitHubFile {
  name: string
  path: string
  type: string
  content: string
  encoding: string
  size: number
  download_url: string
}
