"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardPanel } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { NucleoIcon } from "@/components/nucleo-icons"
import { AppShell, Sparkline } from "@/components/app-shell"
import { StatusBadge, StatusDot } from "@/components/status-badge"
import { compareByStatusPriority } from "@/lib/status"
import { api, createStatsWs } from "@/lib/api"
import { Progress, ProgressIndicator } from "@/components/ui/progress"
import {
  Frame,
  FramePanel,
  FrameTitle,
  FrameDescription,
  FrameFooter,
} from "@/components/ui/frame"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ServerStats, App } from "@/lib/types"
import { useActiveServer } from "@/components/server-context"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const CpuIcon = (props: IconProps) => <NucleoIcon {...props} name="cpu" />
const ServerIcon = (props: IconProps) => <NucleoIcon {...props} name="server" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />

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

function indicatorColor(v: "success" | "warning" | "error") {
  return v === "error" ? "bg-destructive" : v === "warning" ? "bg-warning" : "bg-primary"
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
  const [health, setHealth] = useState<{ status: string; uptime: string; version?: string } | null>(null)
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
    let cancelled = false
    let ws: WebSocket | null = null
    createStatsWs(serverId)
      .then((socket) => {
        if (cancelled) {
          socket.close()
          return
        }
        ws = socket
        ws.onmessage = (event) => {
          const data: ServerStats = JSON.parse(event.data)
          setStats(data)
          setCpuHistory((prev) => [...prev.slice(1), data.cpuUsage])
          setMemHistory((prev) => [...prev.slice(1), data.memoryUsage])
        }
      })
      .catch((err) => console.error("Failed to open stats stream", err))

    return () => {
      cancelled = true
      if (ws) {
        ws.onclose = null
        ws.close()
      }
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
  const sortedApps = [...visibleApps].sort((a, b) => compareByStatusPriority(a.status, b.status))

  const runningCount = visibleApps.filter((a) => a.status === "running").length

  const statCards = [
    {
      label: "CPU Core Load",
      value: `${stats.cpuUsage.toFixed(1)}%`,
      icon: <CpuIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
      progress: stats.cpuUsage,
      aside: <Sparkline data={cpuHistory} colorStart="#8f99ff" colorEnd="#6874e8" />,
      variant: usageVariant(stats.cpuUsage),
    },
    {
      label: "Memory Buffer",
      value: `${stats.memoryUsage.toFixed(1)}%`,
      icon: <ServerIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
      progress: stats.memoryUsage,
      aside: <Sparkline data={memHistory} colorStart="#8f99ff" colorEnd="#ee7e96" />,
      variant: usageVariant(stats.memoryUsage),
    },
    {
      label: "Disk Capacity",
      value: `${stats.diskUsage.toFixed(1)}%`,
      icon: <ServerIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
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
      icon: <GlobeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
      progress: runtimePct,
      aside: (
        <Badge variant={nodeOnline ? "success" : "secondary"} size="sm" className="gap-1">
          <span
            className={`h-1.5 w-1.5 rounded-full ${nodeOnline ? "bg-success animate-pulse" : "bg-muted-foreground/50"}`}
          />
          {nodeOnline ? "Proxy up" : "Unknown"}
        </Badge>
      ),
      variant: "success" as const,
    },
  ]

  const systemFields: { label: string; value: string; icon: React.ReactNode }[] = [
    {
      label: "Engine",
      value: health?.version ? `Better-PaaS ${health.version}` : "Better-PaaS",
      icon: <NucleoIcon name="cloud" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
    },
    {
      label: "Node Status",
      value: health?.status ?? "Checking...",
      icon: <NucleoIcon name="activity" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
    },
    {
      label: "Uptime",
      value: health?.uptime ?? "—",
      icon: <NucleoIcon name="clock" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
    },
    {
      label: "Proxy",
      value: "Caddy (sslip.io)",
      icon: <NucleoIcon name="web" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
    },
    {
      label: "Builder",
      value: "Nixpacks + Docker",
      icon: <NucleoIcon name="layers" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
    },
    {
      label: "API Port",
      value: "8080",
      icon: <NucleoIcon name="server" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
    },
  ]

  return (
    <AppShell appCount={apps.length}>
      <div className="animate-in fade-in-50 p-4 duration-200 md:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Page header */}
          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Node Health</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Real-time system metrics for the active worker node.
              <span className="ml-2 font-medium text-foreground">{selectedServerName}</span>
              {health && (
                <span className="ml-2 font-mono text-xs text-muted-foreground/70">
                  Uptime: {health.uptime}
                </span>
              )}
            </p>
          </div>

          {/* Stat cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <Frame key={card.label}>
                <Card className="before:hidden shadow-none">
                  <CardPanel className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                      {card.icon}
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="shrink-0 font-mono text-2xl font-bold tabular-nums sm:text-3xl">
                        {card.value}
                      </span>
                      <div className="flex min-w-0 max-w-[120px] flex-1 justify-end">{card.aside}</div>
                    </div>
                    <Progress value={card.progress} className="h-1.5 bg-muted">
                      <ProgressIndicator className={indicatorColor(card.variant)} />
                    </Progress>
                  </CardPanel>
                </Card>
              </Frame>
            ))}
          </section>

          {/* Detail grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Service health */}
            <Frame className="flex max-h-[480px] w-full flex-col">
              <FramePanel className="shrink-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <FrameTitle>Service Health Summary</FrameTitle>
                    <FrameDescription>
                      Per-container status overview for {selectedServerName}.
                    </FrameDescription>
                  </div>
                  {visibleApps.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="success" size="sm">
                        {runningCount} running
                      </Badge>
                      <Badge variant="secondary" size="sm">
                        {visibleApps.length} total
                      </Badge>
                    </div>
                  )}
                </div>
              </FramePanel>

              {visibleApps.length === 0 ? (
                <FramePanel className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <GlobeIcon className="h-6 w-6 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No deployed services on this node yet.</p>
                </FramePanel>
              ) : (
                <div className="min-h-0 overflow-y-auto">
                  <Table variant="card">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead className="w-20">Port</TableHead>
                        <TableHead className="w-28 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedApps.map((app) => (
                        <TableRow key={app.id}>
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-2.5">
                              <StatusDot status={app.status} />
                              <span className="truncate text-sm font-medium text-foreground">
                                {app.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-muted-foreground tabular-nums">
                              :{app.port}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <StatusBadge status={app.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {visibleApps.length > 0 && (
                <FrameFooter className="shrink-0">
                  <div className="flex gap-1.5 text-xs text-muted-foreground">
                    <NucleoIcon name="activity" className="mt-0.5 size-3 shrink-0" />
                    <p>
                      {runningCount} of {visibleApps.length} services running on {selectedServerName}.
                    </p>
                  </div>
                </FrameFooter>
              )}
            </Frame>

            {/* System information */}
            <Frame className="w-full">
              <FramePanel className="shrink-0 mb-2">
                <FrameTitle>System Information</FrameTitle>
                <FrameDescription>Node environment and runtime details.</FrameDescription>
              </FramePanel>
              <Card>
                <CardPanel>
                  <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                    {systemFields.map((field) => (
                      <div key={field.label} className="space-y-1.5">
                        <span className="block text-xs font-medium text-muted-foreground">
                          {field.label}
                        </span>
                        <div className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
                          {field.icon}
                          <span className="truncate font-mono font-medium tabular-nums">{field.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardPanel>
              </Card>
              <FrameFooter>
                <div className="flex gap-1.5 text-xs text-muted-foreground">
                  <NucleoIcon name="server" className="mt-0.5 size-3 shrink-0" />
                  <p>
                    Metrics stream live from the selected worker node via WebSocket.
                  </p>
                </div>
              </FrameFooter>
            </Frame>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
