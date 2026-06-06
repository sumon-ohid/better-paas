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
  serverId?: string
  // Docker Compose grouping: a compose deploy is one project surfaced as one
  // App row per service. These tie the rows together for grouped display.
  composeProject?: string
  composeService?: string
  composeWeb?: boolean
  composePrimary?: boolean
  image?: string
  catalogId?: string
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
  serverId?: string
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
  serverId?: string
}

// ── App catalog (one-click deploys) ───────────────────────────────────────────

export interface CatalogEnv {
  key: string
  value: string
  description: string
  required: boolean
  secret: boolean
  generate: boolean
}

export interface CatalogTemplate {
  id: string
  name: string
  description: string
  category: string
  image: string
  port: number
  volumePath: string
  volumePaths?: string[]
  requiredAddons?: Array<{ type: string }>
  env: CatalogEnv[] | null
  healthPath: string
  website: string
  icon: string
  notes: string
  imageSize?: string // e.g. "~85 MB" — compressed pull size from Docker Hub
}

export interface CatalogDeployRequest {
  templateId: string
  name?: string
  envVars?: Record<string, string>
  domains?: string[]
  memory?: string
  cpus?: string
  serverId?: string
}

// Shared fields for custom (non-template) deploys.
export interface CustomDeployBase {
  name?: string
  envVars?: Record<string, string>
  secretKeys?: string[]
  domains?: string[]
  memory?: string
  cpus?: string
  volumes?: string[]
  port?: number
  healthPath?: string
  serverId?: string
}

export interface ImageDeployRequest extends CustomDeployBase {
  image: string
}

export interface DockerfileDeployRequest extends CustomDeployBase {
  dockerfile: string
}

// Result of a database explorer operation (table browse or ad-hoc query).
// A cell is `null` when the underlying value is a real SQL NULL.
export interface DbQueryResult {
  columns: string[]
  rows: (string | null)[][]
  message?: string
  error?: string
  total?: number
}

// Column metadata for the editable grid (add row / edit cell).
export interface DbColumn {
  name: string
  type: string
  nullable: boolean
  primaryKey: boolean
  default: string | null
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

export interface GitHubWebhookInstallResult {
  status: string
  action: "created" | "updated"
  hookId: number
  url: string
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

// ── Website analytics ─────────────────────────────────────────────────────────

export interface AnalyticsBucket {
  date: string
  views: number
  visitors: number
}

export interface AnalyticsBreakdown {
  label: string
  count: number
}

export interface AnalyticsSummary {
  appId: string
  appName: string
  rangeDays: number
  totalViews: number
  totalVisitors: number
  timeseries: AnalyticsBucket[]
  topPages: AnalyticsBreakdown[]
  topReferrers: AnalyticsBreakdown[]
  browsers: AnalyticsBreakdown[]
  os: AnalyticsBreakdown[]
  devices: AnalyticsBreakdown[]
}

// ── Multi-server support ─────────────────────────────────────────────────────

export interface Server {
  id: string
  name: string
  description: string
  ip: string
  port: number
  sshUser: string
  isLocal: boolean
  status: "connected" | "error" | "unknown"
  lastChecked: string
  createdAt: string
  /** Only populated in create and public-key API responses. */
  publicKey?: string
}

export interface AnalyticsOverviewRow {
  appId: string
  appName: string
  views: number
  visitors: number
}
