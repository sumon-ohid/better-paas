"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useAppRouter } from "@/dashboard/lib/app-router"
import { NucleoIcon } from "@/dashboard/components/nucleo-icons"
import { AppShell } from "@/dashboard/components/app-shell"
import { StatusDot } from "@/dashboard/components/status-badge"
import { Badge } from "@/dashboard/components/ui/badge"
import { Button } from "@/dashboard/components/ui/button"
import { api } from "@/dashboard/lib/api"
import {
  aggregateGroupStatus,
  getGroupKey,
  getGroupPrimary,
  getGroupServices,
  groupApps,
  isMultiServiceGroup,
  type AppGroup,
} from "@/dashboard/lib/app-groups"
import type { App, DeploymentRecord } from "@/dashboard/lib/types"
import { Docker } from "@/dashboard/components/ui/svgs/docker"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />
const ChevronRightIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-right" />

function getProjectDeploymentStats(
  group: AppGroup,
  deployments: DeploymentRecord[],
): { total: number; failed: number; latest: DeploymentRecord | null } {
  const primaryId = getGroupPrimary(group).id
  const projectDeployments = deployments.filter((d) => d.appId === primaryId)
  const failed = projectDeployments.filter((d) => d.status === "failed").length
  const latest =
    projectDeployments.reduce<DeploymentRecord | null>((best, d) => {
      if (!best || new Date(d.createdAt) > new Date(best.createdAt)) return d
      return best
    }, null) ?? null

  return {
    total: projectDeployments.length,
    failed,
    latest,
  }
}

export default function DeploymentsIndexPage() {
  const router = useAppRouter()
  const [apps, setApps] = useState<App[]>([])
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [appsData, deplData] = await Promise.all([
        api.apps.list(),
        api.deployments.history(),
      ])
      setApps(appsData)
      setDeployments(deplData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // fetchData is async; setState runs after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [fetchData])

  const projectGroups = useMemo(() => groupApps(apps), [apps])

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1>Deployments</h1>
            <p className="text-sm text-muted-foreground">
              Select a project to view its deployment history.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
            <RefreshIcon className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            <RefreshIcon className="h-5 w-5 mx-auto mb-3 opacity-30 animate-spin" />
            Loading projects...
          </div>
        ) : projectGroups.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            <GlobeIcon className="h-6 w-6 mx-auto mb-3 opacity-20" />
            No projects deployed yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card/72 backdrop-blur-xl divide-y divide-border/50">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground bg-muted/20">
              <span>Project</span>
              <span>Last Deploy</span>
              <span>Total</span>
              <span>Failed</span>
              <span />
            </div>

            {projectGroups.map((group) => {
              const primary = getGroupPrimary(group)
              const aggregateStatus = aggregateGroupStatus(getGroupServices(group))
              const { total, failed, latest } = getProjectDeploymentStats(
                group,
                deployments,
              )

              return (
                <button
                  key={getGroupKey(group)}
                  onClick={() => router.push(`/app/${primary.id}?tab=deployments`)}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 w-full px-4 py-3.5 items-center text-left hover:bg-accent/30 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusDot status={aggregateStatus} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {primary.name}
                        </span>
                        {isMultiServiceGroup(group) && (
                          <Badge variant="outline" size="sm" className="gap-1 font-mono shrink-0">
                            <Docker className="h-3 w-3" />
                            {group.services.length} services
                          </Badge>
                        )}
                      </div>
                      {primary.gitRepo ? (
                        <a
                          href={primary.gitRepo}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] font-mono text-muted-foreground hover:text-primary transition-colors truncate max-w-xs block"
                        >
                          {primary.gitRepo}
                        </a>
                      ) : (
                        <span className="text-[11px] font-mono text-muted-foreground/70 truncate max-w-xs block">
                          {primary.image || "No repository"}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {latest
                      ? new Date(latest.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </span>

                  <Badge variant="secondary" size="sm" className="font-mono">
                    {total}
                  </Badge>

                  <Badge
                    variant={failed > 0 ? "error" : "secondary"}
                    size="sm"
                    className="font-mono"
                  >
                    {failed}
                  </Badge>

                  <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
