"use client"

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { NucleoIcon } from "@/components/nucleo-icons"
import { AppShell } from "@/components/app-shell"
import { StatusBadge } from "@/components/status-badge"
import { api, createBuildLogsWs, createRuntimeLogsWs } from "@/lib/api"
import type { App, LogEntry } from "@/lib/types"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const ChevronLeftIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-left" />
const GitBranchIcon = (props: IconProps) => <NucleoIcon {...props} name="branch" />
const ExternalIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />

type LogMode = "build" | "runtime"

function LogsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [apps, setApps] = useState<App[]>([])
  const [selectedAppId, setSelectedAppId] = useState<string>(searchParams.get("appId") ?? "")
  const [logMode, setLogMode] = useState<LogMode>(
    (searchParams.get("mode") as LogMode) ?? "build",
  )
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [connected, setConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const logBufferRef = useRef<LogEntry[]>([])
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const fetchApps = useCallback(async () => {
    try {
      const data = await api.apps.list()
      setApps(data)
    } catch (err) {
      console.error("Failed to fetch apps", err)
    }
  }, [])

  useEffect(() => {
    // fetchApps is async; setState runs after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchApps()
  }, [fetchApps])

  // Auto-scroll on new logs
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  const connectStream = useCallback((appId: string, mode: LogMode) => {
    // Teardown existing connection
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
        }, 80)
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
  }, [])

  // Connect when app or mode changes
  useEffect(() => {
    // connectStream resets/sets state inside async WS lifecycle callbacks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedAppId) connectStream(selectedAppId, logMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAppId, logMode])

  // Poll app list if building, to update status badge
  useEffect(() => {
    const selected = apps.find((a) => a.id === selectedAppId)
    if (selected?.status !== "building") return
    const interval = setInterval(fetchApps, 2500)
    return () => clearInterval(interval)
  }, [apps, selectedAppId, fetchApps])

  // Cleanup on unmount
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

  // ── Log line renderer ─────────────────────────────────────────────────────

  const lineColor = (msg: string) => {
    if (msg.startsWith("✖") || msg.includes(" Error") || msg.includes("failed"))
      return "text-destructive"
    if (msg.startsWith("✅") || msg.startsWith("✔") || msg.includes("successfully"))
      return "text-success"
    if (msg.startsWith("📦") || msg.startsWith("🔍") || msg.startsWith("🚀") ||
        msg.startsWith("🧹") || msg.startsWith("✨") || msg.startsWith("💡") ||
        msg.startsWith("⚠️") || msg.startsWith("📂"))
      return "text-warning"
    return "text-foreground dark:text-slate-200"
  }

  return (
    <AppShell hasActiveLogs={connected && logs.length > 0}>
      {/* Full-height flex column inside the shell's <main> */}
      <div className="flex flex-col h-full overflow-hidden">

        {/* ── Top toolbar ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-transparent px-4 py-2 shrink-0 select-none">

          {/* Back */}
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            Apps
          </button>

          <span className="h-4 w-px bg-border" />

          {/* App selector */}
          <Select
            value={selectedAppId}
            onValueChange={(v) => {
              const id = v ?? ""
              setSelectedAppId(id)
              const url = new URL(window.location.href)
              if (id) {
                url.searchParams.set("appId", id)
              } else {
                url.searchParams.delete("appId")
              }
              window.history.replaceState({}, "", url.toString())
            }}
          >
            <SelectTrigger className="h-8 text-xs w-48">
              <SelectValue placeholder="— Select app —" />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="">— Select app —</SelectItem>
              {apps.map((app) => (
                <SelectItem key={app.id} value={app.id}>
                  {app.name}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>

          {/* App status + URL */}
          {selectedApp && (
            <div className="flex items-center gap-2">
              <StatusBadge status={selectedApp.status} />

              {selectedApp.branch && (
                <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                  <GitBranchIcon className="h-3 w-3" />
                  {selectedApp.branch}
                </span>
              )}

              {selectedApp.url && (
                <a
                  href={selectedApp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalIcon className="h-3 w-3" />
                  {selectedApp.url.replace("http://", "")}
                </a>
              )}
            </div>
          )}

          <span className="h-4 w-px bg-border" />

          {/* Build / Runtime toggle */}
          <div className="flex items-center overflow-hidden rounded border border-border bg-muted/15">
            {(["build", "runtime"] as LogMode[]).map((m, i) => (
              <button
                key={m}
                onClick={() => setLogMode(m)}
                className={`px-2.5 py-1 text-xs cursor-pointer transition-all ${
                  i > 0 ? "border-l border-border" : ""
                } ${
                  logMode === m
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "build" ? "Build Logs" : "Runtime Logs"}
              </button>
            ))}
          </div>

          {/* Reconnect */}
          {selectedAppId && (
            <button
              onClick={() => connectStream(selectedAppId, logMode)}
              className="flex items-center gap-1.5 rounded border border-border bg-muted/15 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-all"
            >
              <RefreshIcon className="h-3 w-3" />
              Reconnect
            </button>
          )}

          {/* Clear */}
          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground cursor-pointer transition-colors"
            >
              Clear
            </button>
          )}

          {/* Connection dot — right side */}
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <TerminalIcon className="h-3.5 w-3.5" />
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? "bg-success animate-pulse" : "bg-muted-foreground/30"
              }`}
            />
            <span>{connected ? "Live" : "Disconnected"}</span>
            {logs.length > 0 && (
              <span className="font-mono text-muted-foreground/50">· {logs.length} lines</span>
            )}
          </div>
        </div>

        {/* ── Terminal — fills remaining height ────────────────────────── */}
        <div className="flex-1 min-h-0 flex flex-col bg-transparent overflow-hidden bg-card font-mono text-xs leading-relaxed">
          {/* Terminal body */}
          <div className="flex-1 overflow-y-auto bg-transparent">
          {logs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground/50 dark:text-slate-500 select-none">
              <TerminalIcon
                className={`h-8 w-8 opacity-25 ${connected ? "animate-pulse" : ""}`}
              />
              {!selectedAppId ? (
                <span>Select an application above to stream logs.</span>
              ) : connected ? (
                <span>Connected — waiting for output…</span>
              ) : (
                <span className="flex items-center gap-2">
                  <RefreshIcon className="h-3.5 w-3.5 animate-spin" />
                  Connecting to {logMode} log stream…
                </span>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-0.5">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-4 group hover:bg-foreground/2 dark:hover:bg-white/2 rounded px-1 -mx-1">
                  {/* Line number */}
                  <span className="select-none shrink-0 w-10 text-right text-muted-foreground/40 dark:text-slate-600 group-hover:text-muted-foreground/60 dark:group-hover:text-slate-500 transition-colors">
                    {i + 1}
                  </span>
                  {/* Timestamp */}
                  <span className="select-none shrink-0 text-muted-foreground/40 dark:text-slate-600">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  {/* Message */}
                  <span className={`${lineColor(log.message)} break-all`}>{log.message}</span>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
          </div>
        </div>

        {/* ── Status bar ───────────────────────────────────────────────── */}
        <div className="flex items-center  bg-transparent justify-between border-t border-border/50 px-4 py-1.5 text-[11px] font-mono text-muted-foreground/40 dark:text-slate-600 shrink-0 select-none">
          <span>
            {selectedApp
              ? `${selectedApp.name} · port ${selectedApp.port}`
              : "No app selected"}
          </span>
          <span>
            {connected
              ? `● streaming ${logMode} logs`
              : "○ disconnected"}
          </span>
        </div>
      </div>
    </AppShell>
  )
}

export default function LogsRoute() {
  return (
    <Suspense fallback={<div className="h-screen bg-card" />}>
      <LogsPage />
    </Suspense>
  )
}
