"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { NucleoIcon } from "@/components/nucleo-icons"
import { AppShell } from "@/components/app-shell"
import { StatusDot } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { App, DeploymentRecord } from "@/lib/types"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />
const ChevronRightIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-right" />

export default function DeploymentsIndexPage() {
  const router = useRouter()
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

  // Group deployment counts per app
  const countByApp = deployments.reduce<Record<string, { total: number; failed: number }>>(
    (acc, d) => {
      if (!acc[d.appId]) acc[d.appId] = { total: 0, failed: 0 }
      acc[d.appId].total++
      if (d.status === "failed") acc[d.appId].failed++
      return acc
    },
    {},
  )

  // Latest deployment per app
  const latestByApp = deployments.reduce<Record<string, DeploymentRecord>>((acc, d) => {
    if (!acc[d.appId] || new Date(d.createdAt) > new Date(acc[d.appId].createdAt)) {
      acc[d.appId] = d
    }
    return acc
  }, {})

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
        ) : apps.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            <GlobeIcon className="h-6 w-6 mx-auto mb-3 opacity-20" />
            No projects deployed yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card/72 backdrop-blur-xl divide-y divide-border/50">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground bg-muted/20">
              <span>Project</span>
              <span>Last Deploy</span>
              <span>Total</span>
              <span>Failed</span>
              <span />
            </div>

            {apps.map((app) => {
              const counts = countByApp[app.id] ?? { total: 0, failed: 0 }
              const latest = latestByApp[app.id]
              return (
                <button
                  key={app.id}
                  onClick={() => router.push(`/app/${app.id}?tab=deployments`)}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 w-full px-4 py-3.5 items-center text-left hover:bg-accent/30 transition-colors cursor-pointer group"
                >
                  {/* Project info */}
                  <div className="flex items-center gap-3">
                    <StatusDot status={app.status} />
                    <div>
                      <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {app.name}
                      </div>
                       {app.gitRepo ? (
                         <a
                           href={app.gitRepo}
                           target="_blank"
                           rel="noopener noreferrer"
                           onClick={(e) => e.stopPropagation()}
                           className="text-[11px] font-mono text-muted-foreground hover:text-primary transition-colors truncate max-w-xs block"
                         >
                           {app.gitRepo}
                         </a>
                       ) : (
                         <span className="text-[11px] font-mono text-muted-foreground/70 truncate max-w-xs block">
                           {app.image || "No repository"}
                         </span>
                       )}
                    </div>
                  </div>

                  {/* Last deploy time */}
                  <span className="text-xs text-muted-foreground">
                    {latest
                      ? new Date(latest.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>

                  {/* Total count */}
                  <Badge variant="secondary" size="sm" className="font-mono">
                    {counts.total}
                  </Badge>

                  {/* Failed count */}
                  <Badge
                    variant={counts.failed > 0 ? "error" : "secondary"}
                    size="sm"
                    className="font-mono"
                  >
                    {counts.failed}
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
