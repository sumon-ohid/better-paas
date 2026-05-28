"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { NucleoIcon } from "@/components/nucleo-icons"
import { AppShell, ToastContainer, useToast } from "@/components/app-shell"
import { api } from "@/lib/api"
import type { App, DeploymentRecord } from "@/lib/types"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />
const ChevronRightIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-right" />

export default function DeploymentsIndexPage() {
  const router = useRouter()
  const { toasts, dismissToast } = useToast()
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
            <h1 className="text-lg font-bold text-foreground">Deployments</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Select a project to view its deployment history.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 rounded-md border border-border bg-muted/15 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-all"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
            Refresh
          </button>
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
                  onClick={() => router.push(`/deployments/${app.id}`)}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 w-full px-4 py-3.5 items-center text-left hover:bg-accent/30 transition-colors cursor-pointer group"
                >
                  {/* Project info */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        app.status === "running"
                          ? "bg-[#69d1a7]"
                          : app.status === "building"
                            ? "bg-amber-400 animate-pulse"
                            : app.status === "failed"
                              ? "bg-rose-500"
                              : "bg-muted-foreground/40"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {app.name}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate max-w-xs">
                        {app.gitRepo}
                      </div>
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
                  <span className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded">
                    {counts.total}
                  </span>

                  {/* Failed count */}
                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded ${
                      counts.failed > 0
                        ? "bg-rose-500/10 text-rose-400"
                        : "text-muted-foreground bg-muted/30"
                    }`}
                  >
                    {counts.failed}
                  </span>

                  <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppShell>
  )
}
