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
  // New capabilities
  domains?: string[]
  memory?: string
  cpus?: string
  volumes?: string[]
  healthPath?: string
  secretKeys?: string[]
  autoDeploy?: boolean
  buildMethod?: string
  dockerfilePath?: string
  composePath?: string
  activeImage?: string
  activeDeployId?: string
  activeCommit?: string
  activeCommitMsg?: string
}

export interface ServerStats {
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  activeApps: number
  timestamp: string
}

export interface PerAppMetrics {
  appId: string
  name: string
  cpuPercent: number
  memUsageMb: number
  memLimitMb: number
  memPercent: number
  netRxMb: number
  netTxMb: number
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
  image?: string
  trigger?: string
  commit?: string
  commitMsg?: string
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
  domains?: string[]
  memory?: string
  cpus?: string
  volumes?: string[]
  healthPath?: string
  secretKeys?: string[]
  autoDeploy?: boolean
  buildMethod?: string
  dockerfilePath?: string
  composePath?: string
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
  domains?: string[]
  memory?: string
  cpus?: string
  volumes?: string[]
  healthPath?: string
  secretKeys?: string[]
  autoDeploy?: boolean
  buildMethod?: string
  dockerfilePath?: string
}

export interface Addon {
  id: string
  type: "postgres" | "redis" | "mysql" | string
  name: string
  containerName: string
  status: string
  volume: string
  port: number
  connEnv?: Record<string, string>
  attachedApps?: string[]
  createdAt: string
}

export interface CronJob {
  id: string
  appId: string
  appName: string
  schedule: string
  command: string
  enabled: boolean
  lastRun: string
  lastStatus: string
  createdAt: string
}

export interface NotificationConfig {
  slackWebhookUrl: string
  genericUrl: string
  onSuccess: boolean
  onFailure: boolean
}

export interface BackupInfo {
  name: string
  sizeBytes: number
  createdAt: string
}

export interface BackupConfig {
  autoEnabled: boolean
  intervalHours: number
  retention: number
  includeDatabases: boolean
  s3Enabled: boolean
  s3Endpoint: string
  s3Region: string
  s3Bucket: string
  s3Prefix: string
  s3AccessKeyId: string
  s3SecretKey?: string
  s3SecretKeySet?: boolean
}

export interface WebhookInfo {
  url: string
  secret: string
  event: string
}

export interface UpdateRelease {
  tagName: string
  name: string
  notes: string
  url: string
  publishedAt: string
}

export interface UpdateStatus {
  current: string
  latest: string
  hasUpdate: boolean
  configured: boolean
  release?: UpdateRelease
  checkedAt: string
}

export interface SystemVersion {
  version: string
  gitCheckout: boolean
  updateRepo: string
}

export interface UpdateProgress {
  state: string
  inProgress: boolean
  log: string
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
