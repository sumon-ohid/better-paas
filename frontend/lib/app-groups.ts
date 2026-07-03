import type { App } from "./types"
import { compareByStatusPriority } from "./status"

export type AppGroup =
  | { kind: "standalone"; app: App }
  | { kind: "compose"; key: string; primary: App; services: App[] }

export function getGroupPrimary(group: AppGroup): App {
  return group.kind === "standalone" ? group.app : group.primary
}

export function getGroupServices(group: AppGroup): App[] {
  return group.kind === "standalone" ? [group.app] : group.services
}

export function isMultiServiceGroup(
  group: AppGroup,
): group is Extract<AppGroup, { kind: "compose" }> {
  return group.kind === "compose" && group.services.length > 1
}

export function getGroupKey(group: AppGroup): string {
  return group.kind === "compose" ? group.key : group.app.id
}

export function getComposeServices(app: App, allApps: App[]): App[] {
  if (!app.composeProject) return [app]
  return allApps
    .filter((candidate) => candidate.composeProject === app.composeProject)
    .sort((a, b) => {
      if (a.composePrimary !== b.composePrimary) return a.composePrimary ? -1 : 1
      return (a.composeService || "").localeCompare(b.composeService || "")
    })
}

export function resolveComposePrimary(app: App, allApps: App[]): App {
  if (!app.composeProject) return app
  const services = getComposeServices(app, allApps)
  return services.find((s) => s.composePrimary) ?? services[0] ?? app
}

/** True when viewing the project root - overview lists all services in the group. */
export function isProjectHub(app: App, allApps: App[]): boolean {
  const primary = resolveComposePrimary(app, allApps)
  if (app.id !== primary.id) return false
  return getComposeServices(app, allApps).length >= 1
}

/** @deprecated Use isProjectHub */
export function isComposeProjectHub(app: App, allApps: App[]): boolean {
  return isProjectHub(app, allApps)
}

export function aggregateGroupStatus(apps: App[]): string {
  if (apps.length === 0) return "stopped"
  let worst = apps[0].status
  for (const app of apps) {
    if (compareByStatusPriority(app.status, worst) < 0) {
      worst = app.status
    }
  }
  return worst
}

export function appMatchesSearch(app: App, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return true
  return (
    app.name.toLowerCase().includes(q) ||
    app.gitRepo.toLowerCase().includes(q) ||
    (app.composeService?.toLowerCase().includes(q) ?? false) ||
    (app.image?.toLowerCase().includes(q) ?? false)
  )
}

export function groupMatchesSearch(group: AppGroup, query: string): boolean {
  return getGroupServices(group).some((app) => appMatchesSearch(app, query))
}

export function groupMatchesStatus(group: AppGroup, statusFilter: string): boolean {
  if (statusFilter === "all") return true
  return getGroupServices(group).some((app) => app.status === statusFilter)
}

export function groupMatchesServer(group: AppGroup, targetServerId: string): boolean {
  if (targetServerId === "all") return true
  const primary = getGroupPrimary(group)
  const appServerId = primary.serverId || "localhost"
  return appServerId === targetServerId
}

export function groupApps(apps: App[]): AppGroup[] {
  const composeBuckets = new Map<string, App[]>()
  const standalone: App[] = []

  for (const app of apps) {
    if (app.composeProject) {
      const bucket = composeBuckets.get(app.composeProject) ?? []
      bucket.push(app)
      composeBuckets.set(app.composeProject, bucket)
    } else {
      standalone.push(app)
    }
  }

  const groups: AppGroup[] = standalone.map((app) => ({ kind: "standalone", app }))

  for (const [key, services] of composeBuckets) {
    const sorted = [...services].sort((a, b) => {
      if (a.composePrimary !== b.composePrimary) return a.composePrimary ? -1 : 1
      return (a.composeService || "").localeCompare(b.composeService || "")
    })
    const primary = sorted.find((a) => a.composePrimary) ?? sorted[0]
    groups.push({ kind: "compose", key, primary, services: sorted })
  }

  groups.sort((a, b) => {
    const statusCmp = compareByStatusPriority(
      aggregateGroupStatus(getGroupServices(a)),
      aggregateGroupStatus(getGroupServices(b)),
    )
    if (statusCmp !== 0) return statusCmp
    return getGroupPrimary(a).name.localeCompare(getGroupPrimary(b).name)
  })

  return groups
}

export function countGroupedApps(groups: AppGroup[]): {
  services: number
  projects: number
} {
  const services = groups.reduce((n, g) => n + getGroupServices(g).length, 0)
  return { services, projects: groups.length }
}

