"use client"

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { NucleoIcon } from "@/components/nucleo-icons"
import { AppShell, ToastContainer, useToast, LogTerminal } from "@/components/app-shell"
import { api, createBuildLogsWs, createRuntimeLogsWs } from "@/lib/api"
import type { App, LogEntry } from "@/lib/types"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />

type LogMode = "build" | "runtime"

function LogsPage() {
  const searchParams = useSearchParams()
  const { toasts, dismissToast } = useToast()

  const [apps, setApps] = useState<App[]>([])
  const [selectedAppId, setSelectedAppId] = useState<string>(searchParams.get("appId") ?? "")
  const [logMode, setLogMode] = useState<LogMode>("build")
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [connected, setConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const logBufferRef = useRef<LogEntry[]>([])
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchApps = useCallback(async () => {
    try {
      const data = await api.apps.list()
      setApps(data)
    } catch (err) {
      console.error("Failed to fetch apps", err)
    }
  }, [])

  useEffect(() => {
    fetchApps()
  }, [fetchApps])

  const connectStream = useCallback(
    (appId: string, mode: LogMode) => {
      // Teardown existing
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.onerror = null
        wsRef.current.onopen = null
        wsRef.current.onmessage = null
        wsRef.current.close()
        wsRef.current = null
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }

      setLogs([])
      setConnected(false)
      logBufferRef.current = []

      if (!appId) return

      const ws = mode === "build" ? createBuildLogsWs(appId) : createRuntimeLogsWs(appId)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        logBufferRef.current.push({ message: data.message, timestamp: data.timestamp })

        if (!flushTimerRef.current) {
          flushTimerRef.current = setTimeout(() => {
            const batch = [...logBufferRef.current]
            logBufferRef.current = []
            setLogs((prev) => [...prev, ...batch])
            flushTimerRef.current = null
          }, 100)
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (wsRef.current === ws) wsRef.current = null
        if (logBufferRef.current.length > 0) {
          const batch = [...logBufferRef.current]
          logBufferRef.current = []
          setLogs((prev) => [...prev, ...batch])
        }
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current)
          flushTimerRef.current = null
        }
      }
    },
    [],
  )

  useEffect(() => {
    if (selectedAppId) connectStream(selectedAppId, logMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAppId, logMode])

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    }
  }, [])

  const selectedApp = apps.find((a) => a.id === selectedAppId)

  return (
    <AppShell hasActiveLogs={connected && logs.length > 0}>
      <div className="p-4 md:p-6 space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* App selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground font-medium">Application:</label>
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="rounded-md border border-border bg-muted/20 px-2 py-1 text-sm text-foreground outline-none focus:border-primary/50 transition-colors cursor-pointer"
            >
              <option value="">— Select an app —</option>
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name} ({app.status})
                </option>
              ))}
            </select>
          </div>

          {/* Log mode toggle */}
          <div className="flex items-center overflow-hidden rounded-md border border-border bg-muted/15">
            <button
              onClick={() => setLogMode("build")}
              className={`px-2.5 py-1 text-xs cursor-pointer transition-all ${
                logMode === "build"
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Build Logs
            </button>
            <button
              onClick={() => setLogMode("runtime")}
              className={`px-2.5 py-1 text-xs border-l border-border cursor-pointer transition-all ${
                logMode === "runtime"
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Runtime Logs
            </button>
          </div>

          {/* Reconnect */}
          {selectedAppId && (
            <button
              onClick={() => connectStream(selectedAppId, logMode)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-muted/15 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-all"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              Reconnect
            </button>
          )}

          {/* Status indicator */}
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-[#69d1a7] animate-pulse" : "bg-muted-foreground/40"}`}
            />
            {connected ? "Connected" : "Disconnected"}
          </div>
        </div>

        {/* Terminal */}
        <Card className="flex flex-col border-border bg-card/72 shadow-[0_18px_64px_rgba(0,0,0,.12)] backdrop-blur-xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
            <div>
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <TerminalIcon className="h-4 w-4" />
                {selectedApp
                  ? `${logMode === "build" ? "Build" : "Runtime"} Logs — ${selectedApp.name}`
                  : "Log Console"}
              </CardTitle>
              <CardDescription className="text-xs">
                {logMode === "build"
                  ? "Deployment build pipeline output streamed via WebSocket."
                  : "Live Docker container stdout/stderr streamed via WebSocket."}
              </CardDescription>
            </div>
            {selectedApp?.status === "building" && logMode === "build" && (
              <span className="flex items-center gap-1 text-[11px] text-amber-500 font-mono animate-pulse">
                <RefreshIcon className="h-3.5 w-3.5 animate-spin" />
                Building...
              </span>
            )}
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-0 min-h-[520px]">
            <LogTerminal
              logs={logs}
              connected={connected}
              label={`${logMode} log stream`}
            />
          </CardContent>
        </Card>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppShell>
  )
}

export default function LogsRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0c10]" />}>
      <LogsPage />
    </Suspense>
  )
}
