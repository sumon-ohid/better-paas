"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { NucleoIcon } from "@/components/nucleo-icons"
import { AppShell, ToastContainer, useToast, Sparkline } from "@/components/app-shell"
import { api, createStatsWs } from "@/lib/api"
import { Progress, ProgressIndicator } from "@/components/ui/progress"
import type { ServerStats, App } from "@/lib/types"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const CpuIcon = (props: IconProps) => <NucleoIcon {...props} name="cpu" />
const ServerIcon = (props: IconProps) => <NucleoIcon {...props} name="server" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />

export default function HealthPage() {
  const { toasts, dismissToast } = useToast()
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
    // fetchData is async; stats updates arrive via WS callbacks. Neither sets
    // state synchronously during the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()

    const ws = createStatsWs()
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
  }, [fetchData])

  const statCards = [
    {
      label: "CPU Core Load",
      value: `${stats.cpuUsage.toFixed(1)}%`,
      icon: <CpuIcon className="h-4 w-4 text-muted-foreground" />,
      progress: stats.cpuUsage,
      sparkline: <Sparkline data={cpuHistory} colorStart="#8f99ff" colorEnd="#6874e8" />,
    },
    {
      label: "Memory Buffer",
      value: `${stats.memoryUsage.toFixed(1)}%`,
      icon: <ServerIcon className="h-4 w-4 text-muted-foreground" />,
      progress: stats.memoryUsage,
      sparkline: <Sparkline data={memHistory} colorStart="#8f99ff" colorEnd="#ee7e96" />,
    },
    {
      label: "Disk Capacity",
      value: `${stats.diskUsage.toFixed(1)}%`,
      icon: <ServerIcon className="h-4 w-4 text-muted-foreground" />,
      progress: stats.diskUsage,
      badge: <span className="text-xs font-mono text-[#69d1a7] font-medium">HEALTH: OPTIMAL</span>,
    },
    {
      label: "Active Runtimes",
      value: `${stats.activeApps} / ${apps.length}`,
      icon: <GlobeIcon className="h-4 w-4 text-muted-foreground" />,
      progress: (stats.activeApps / Math.max(apps.length, 1)) * 100,
      badge: (
        <span className="text-xs font-mono text-[#69d1a7] font-medium flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#69d1a7] animate-pulse" />
          PROXY UP
        </span>
      ),
    },
  ]

  return (
    <AppShell appCount={apps.length}>
      <div className="p-4 md:p-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-lg font-bold text-foreground">Node Health</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time system metrics for the active worker node.
            {health && (
              <span className="ml-2 font-mono text-xs text-muted-foreground/70">
                Uptime: {health.uptime}
              </span>
            )}
          </p>
        </div>

        {/* Stat Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card
              key={card.label}
              className="space-y-3 border-border bg-card/72 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </span>
                {card.icon}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono">{card.value}</span>
                {card.sparkline ?? card.badge}
              </div>
              <Progress value={card.progress} className="h-1 bg-muted">
                <ProgressIndicator className="bg-primary" />
              </Progress>
            </Card>
          ))}
        </section>

        {/* Health Detail Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border bg-card/72">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold">
                Service Health Summary
              </CardTitle>
              <CardDescription className="text-xs">
                Per-container status overview for all deployed services.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              {apps.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No deployed services yet.
                </div>
              ) : (
                apps.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between rounded-md border border-border/50 bg-muted/10 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          app.status === "running"
                            ? "bg-[#69d1a7]"
                            : app.status === "building"
                              ? "bg-[#e7be75] animate-pulse"
                              : app.status === "failed"
                                ? "bg-[#f26d78]"
                                : "bg-muted-foreground/40"
                        }`}
                      />
                      <span className="text-sm font-medium text-foreground">{app.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">:{app.port}</span>
                      <span className="uppercase font-mono">{app.status}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card/72">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold">
                System Information
              </CardTitle>
              <CardDescription className="text-xs">
                Node environment and runtime details.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {[
                ["Engine", "Antigravity PaaS v1.0"],
                ["Node Status", health?.status ?? "Checking..."],
                ["Uptime", health?.uptime ?? "—"],
                ["Proxy", "Caddy (sslip.io)"],
                ["Builder", "Nixpacks + Docker"],
                ["API Port", "8080"],
              ].map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center justify-between text-sm border-b border-border/30 pb-2 last:border-0"
                >
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-mono text-xs text-foreground">{val}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppShell>
  )
}
