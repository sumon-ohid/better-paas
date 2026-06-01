"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { NucleoIcon } from "@/components/nucleo-icons"
import { AppShell, Sparkline } from "@/components/app-shell"
import { StatusBadge, StatusDot } from "@/components/status-badge"
import { compareByStatusPriority } from "@/lib/status"
import { api, createStatsWs } from "@/lib/api"
import { Progress, ProgressIndicator } from "@/components/ui/progress"
import type { ServerStats, App } from "@/lib/types"
import { useActiveServer } from "@/components/server-context"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const CpuIcon = (props: IconProps) => <NucleoIcon {...props} name="cpu" />
const ServerIcon = (props: IconProps) => <NucleoIcon {...props} name="server" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />

// Maps a 0–100 utilization value to a semantic badge variant so the color
// reflects reality instead of a hard-coded "OPTIMAL".
function usageVariant(value: number): "success" | "warning" | "error" {
  if (value >= 90) return "error"
  if (value >= 75) return "warning"
  return "success"
}

function usageLabel(value: number): string {
  if (value >= 90) return "Critical"
  if (value >= 75) return "Elevated"
  return "Healthy"
}

export default function HealthPage() {
  const { activeServerId, servers } = useActiveServer()
  const [stats, setStats] = useState<ServerStats>({
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    activeApps: 0,
    timestamp: new Date().toISOString(),
  })
  const [apps, setApps] = useState<App[]>([])
  const [health, setHealth] = useState<{ status: string; uptime: string } | null>(null)
  const [cpuHistory, setCpuHistory] = useState<number[]>(Array(20).fill(0))
  const [memHistory, setMemHistory] = useState<number[]>(Array(20).fill(0))

  const fetchData = useCallback(async () => {
    try {
      const [appsData, healthData] = await Promise.all([api.apps.list(), api.system.health()])
      setApps(appsData)
      setHealth(healthData)
    } catch (err) {
      console.error("Failed to fetch health data", err)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()

    const serverId = activeServerId === "all" ? "localhost" : activeServerId
    setStats({
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      activeApps: 0,
      timestamp: new Date().toISOString(),
    })
    setCpuHistory(Array(20).fill(0))
    setMemHistory(Array(20).fill(0))
    const ws = createStatsWs(serverId)
    ws.onmessage = (event) => {
      const data: ServerStats = JSON.parse(event.data)
      setStats(data)
      setCpuHistory((prev) => [...prev.slice(1), data.cpuUsage])
      setMemHistory((prev) => [...prev.slice(1), data.memoryUsage])
    }

    return () => {
      ws.onclose = null
      ws.close()
    }
  }, [activeServerId, fetchData])

  const selectedServerName =
    activeServerId === "all"
      ? "Localhost"
      : activeServerId === "localhost"
        ? "Localhost"
        : servers.find((server) => server.id === activeServerId)?.name ?? "Selected server"
  const selectedServerId = activeServerId === "all" ? "localhost" : activeServerId
  const visibleApps = apps.filter((app) => (app.serverId || "localhost") === selectedServerId)
  const runtimePct = (stats.activeApps / Math.max(visibleApps.length, 1)) * 100
  const nodeOnline = health?.status?.toLowerCase() === "ok" || health?.status?.toLowerCase() === "healthy"

  const statCards = [
    {
      label: "CPU Core Load",
      value: `${stats.cpuUsage.toFixed(1)}%`,
      icon: <CpuIcon className="h-4 w-4 text-muted-foreground" />,
      progress: stats.cpuUsage,
      aside: <Sparkline data={cpuHistory} colorStart="#8f99ff" colorEnd="#6874e8" />,
      variant: usageVariant(stats.cpuUsage),
    },
    {
      label: "Memory Buffer",
      value: `${stats.memoryUsage.toFixed(1)}%`,
      icon: <ServerIcon className="h-4 w-4 text-muted-foreground" />,
      progress: stats.memoryUsage,
      aside: <Sparkline data={memHistory} colorStart="#8f99ff" colorEnd="#ee7e96" />,
      variant: usageVariant(stats.memoryUsage),
    },
    {
      label: "Disk Capacity",
      value: `${stats.diskUsage.toFixed(1)}%`,
      icon: <ServerIcon className="h-4 w-4 text-muted-foreground" />,
      progress: stats.diskUsage,
      aside: (
        <Badge variant={usageVariant(stats.diskUsage)} size="sm">
          {usageLabel(stats.diskUsage)}
        </Badge>
      ),
      variant: usageVariant(stats.diskUsage),
    },
    {
      label: "Active Runtimes",
      value: `${stats.activeApps} / ${visibleApps.length}`,
      icon: <GlobeIcon className="h-4 w-4 text-muted-foreground" />,
      progress: runtimePct,
      aside: (
        <Badge variant={nodeOnline ? "success" : "secondary"} size="sm" className="gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${nodeOnline ? "bg-success animate-pulse" : "bg-muted-foreground/50"}`} />
          {nodeOnline ? "Proxy up" : "Unknown"}
        </Badge>
      ),
      variant: "success" as const,
    },
  ]

  const indicatorColor = (v: "success" | "warning" | "error") =>
    v === "error" ? "bg-destructive" : v === "warning" ? "bg-warning" : "bg-primary"

  const sortedApps = [...visibleApps].sort((a, b) => compareByStatusPriority(a.status, b.status))

  return (
    <AppShell appCount={apps.length}>
      <div className="p-4 md:p-6 space-y-6">
        {/* Page header */}
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">Node Health</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Real-time system metrics for the active worker node.
            <span className="ml-2 font-medium text-foreground">{selectedServerName}</span>
            {health && (
              <span className="ml-2 font-mono text-xs text-muted-foreground/70">
                Uptime: {health.uptime}
              </span>
            )}
          </p>
        </div>

        {/* Stat Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {statCards.map((card) => (
            <Card key={card.label} className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </span>
                {card.icon}
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-3xl font-bold tabular-nums">{card.value}</span>
                {card.aside}
              </div>
              <Progress value={card.progress} className="h-1.5 bg-muted">
                <ProgressIndicator className={indicatorColor(card.variant)} />
              </Progress>
            </Card>
          ))}
        </section>

        {/* Health Detail Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="max-h-100">
            <CardHeader className="border-b border-border/40 pb-3">
              <CardTitle className="text-base">Service Health Summary</CardTitle>
              <CardDescription>
                Per-container status overview for {selectedServerName}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-4 overflow-y-auto">
              {apps.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No deployed services yet.
                </div>
              ) : (
                sortedApps.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <StatusDot status={app.status} />
                      <span className="text-sm font-medium text-foreground">{app.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">:{app.port}</span>
                      <StatusBadge status={app.status} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/40 pb-3">
              <CardTitle className="text-base">System Information</CardTitle>
              <CardDescription>Node environment and runtime details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {[
                ["Engine", "Better-PaaS v1.0"],
                ["Node Status", health?.status ?? "Checking..."],
                ["Uptime", health?.uptime ?? "—"],
                ["Proxy", "Caddy (sslip.io)"],
                ["Builder", "Nixpacks + Docker"],
                ["API Port", "8080"],
              ].map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center justify-between border-b border-border/30 pb-2 text-sm last:border-0"
                >
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-mono text-xs text-foreground">{val}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
