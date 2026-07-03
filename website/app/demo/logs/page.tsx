"use client"

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useAppRouter } from "@/dashboard/lib/app-router"
import { NucleoIcon } from "@/dashboard/components/nucleo-icons"
import { AppShell, useToast } from "@/dashboard/components/app-shell"
import { StatusBadge } from "@/dashboard/components/status-badge"
import { api, createBuildLogsWs, createRuntimeLogsWs } from "@/dashboard/lib/api"
import type { App, LogEntry } from "@/dashboard/lib/types"
import { useActiveServer } from "@/dashboard/components/server-context"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/dashboard/components/ui/select"
import { Button } from "@/dashboard/components/ui/button"
import { Tabs, TabsList, TabsTab } from "@/dashboard/components/ui/tabs"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/dashboard/components/ui/input-group"
import {
  Frame,
  FramePanel,
  FrameFooter,
} from "@/dashboard/components/ui/frame"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/dashboard/components/ui/menu"
import { lineColor } from "@/dashboard/lib/app-detail-utils"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const ChevronLeftIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-left" />
const ChevronDownIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-down" />
const SearchIcon = (props: IconProps) => <NucleoIcon {...props} name="search" />
const CopyIcon = (props: IconProps) => <NucleoIcon {...props} name="copy" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />

type LogMode = "build" | "runtime"

function LogsPage() {
  const router = useAppRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { activeServerId } = useActiveServer()

  const [apps, setApps] = useState<App[]>([])
  const [selectedAppId, setSelectedAppId] = useState<string>(searchParams.get("appId") ?? "")
  const [logMode, setLogMode] = useState<LogMode>(
    (searchParams.get("mode") as LogMode) ?? "build",
  )
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [connected, setConnected] = useState(false)
  const [isRedeploying, setIsRedeploying] = useState(false)
  const [logQuery, setLogQuery] = useState("")
  const [logCopied, setLogCopied] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const wsSeqRef = useRef(0)
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
    const seq = ++wsSeqRef.current
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

    const openWs = mode === "build" ? createBuildLogsWs : createRuntimeLogsWs
    openWs(appId)
      .then((ws) => {
        if (seq !== wsSeqRef.current) {
          ws.close()
          return
        }
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
      })
      .catch((err) => {
        if (seq !== wsSeqRef.current) return
        console.error("Failed to open log stream", err)
        setConnected(false)
      })
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
      wsSeqRef.current++
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    }
  }, [])

  const filteredApps = React.useMemo(() => {
    return apps.filter((app) => {
      const appServerId = app.serverId || "localhost"
      const targetServerId = activeServerId === "all" ? "all" : (activeServerId === "localhost" ? "localhost" : activeServerId)
      return targetServerId === "all" || appServerId === targetServerId
    })
  }, [apps, activeServerId])

  // Reset selected app if it doesn't belong to the active server context
  useEffect(() => {
    if (selectedAppId && apps.length > 0) {
      const app = apps.find((a) => a.id === selectedAppId)
      if (app) {
        const appServerId = app.serverId || "localhost"
        const targetServerId = activeServerId === "all" ? "all" : (activeServerId === "localhost" ? "localhost" : activeServerId)
        if (targetServerId !== "all" && appServerId !== targetServerId) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSelectedAppId("")
          const url = new URL(window.location.href)
          url.searchParams.delete("appId")
          window.history.replaceState({}, "", url.toString())
        }
      }
    }
  }, [activeServerId, apps, selectedAppId])

  const selectedApp = apps.find((a) => a.id === selectedAppId)

  const filteredLogs = logQuery.trim()
    ? logs.filter((l) =>
        l.message.toLowerCase().includes(logQuery.trim().toLowerCase()),
      )
    : logs

  const setLogModeWithUrl = (mode: LogMode) => {
    setLogMode(mode)
    setLogQuery("")
    const url = new URL(window.location.href)
    url.searchParams.set("mode", mode)
    window.history.replaceState({}, "", url.toString())
  }

  const handleCopyLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.message}`,
      )
      .join("\n")
    navigator.clipboard.writeText(text)
    setLogCopied(true)
    setTimeout(() => setLogCopied(false), 2000)
  }

  const handleRedeploy = useCallback(
    async (noCache: boolean = false) => {
      if (!selectedApp || isRedeploying) return
      setIsRedeploying(true)
      try {
        await api.apps.redeploy(selectedApp.id, noCache)
        showToast(
          "Redeploy Started",
          noCache
            ? `Clearing cache and rebuilding ${selectedApp.name}...`
            : `Triggering new build for ${selectedApp.name}...`,
          "success",
        )
        fetchApps()
        setLogModeWithUrl("build")
        connectStream(selectedApp.id, "build")
      } catch (err) {
        showToast("Error", "Failed to trigger redeployment.", "destructive")
        console.error(err)
      } finally {
        setIsRedeploying(false)
      }
    },
    [selectedApp, isRedeploying, showToast, fetchApps, connectStream],
  )

  const logModeLabel = logMode === "build" ? "Build Logs" : "Runtime Logs"

  return (
    <AppShell hasActiveLogs={connected && logs.length > 0}>
      <div className="animate-in fade-in-50 flex h-full min-h-0 flex-1 flex-col p-4 duration-200 md:p-6">
        <Frame className="h-full w-full">
          <FramePanel className="shrink-0 !py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                <button
                  onClick={() => router.push("/")}
                  className="flex h-7 shrink-0 cursor-pointer items-center gap-1 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronLeftIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Apps</span>
                </button>

                <span className="hidden h-4 w-px bg-border sm:block" />

                <Select
                  value={selectedAppId}
                  onValueChange={(v) => {
                    const id = v ?? ""
                    setSelectedAppId(id)
                    setLogQuery("")
                    const url = new URL(window.location.href)
                    if (id) {
                      url.searchParams.set("appId", id)
                    } else {
                      url.searchParams.delete("appId")
                    }
                    window.history.replaceState({}, "", url.toString())
                  }}
                >
                  <SelectTrigger size="sm" className="h-7 w-full min-w-0 text-xs sm:w-44">
                    <SelectValue placeholder="Select app">
                      {selectedApp ? selectedApp.name : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="">Select app</SelectItem>
                    {filteredApps.map((app) => (
                      <SelectItem key={app.id} value={app.id}>
                        {app.name}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>

                <Tabs
                  value={logMode}
                  onValueChange={(value) => {
                    if (value === "build" || value === "runtime") {
                      setLogModeWithUrl(value)
                    }
                  }}
                >
                  <TabsList className="h-7 w-auto shrink-0 p-0.5 [&>[data-slot=tabs-tab]]:h-6 [&>[data-slot=tabs-tab]]:px-2.5 [&>[data-slot=tabs-tab]]:text-xs">
                    <TabsTab value="build">Build</TabsTab>
                    <TabsTab value="runtime">Runtime</TabsTab>
                  </TabsList>
                </Tabs>

                {selectedApp && <StatusBadge status={selectedApp.status} />}

                <div className="hidden min-w-2 flex-1 sm:block" />

                <div className="flex w-full items-center gap-1 sm:ml-auto sm:w-auto">
                  {logs.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyLogs}
                      title={logCopied ? "Copied" : "Copy all"}
                      aria-label={logCopied ? "Copied" : "Copy all"}
                      className="h-7 w-7 shrink-0 p-0 sm:w-auto sm:px-2.5"
                    >
                      {logCopied ? (
                        <CheckIcon className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <CopyIcon className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden md:inline">
                        {logCopied ? "Copied" : "Copy"}
                      </span>
                    </Button>
                  )}

                  {selectedAppId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => connectStream(selectedAppId, logMode)}
                      title="Reconnect"
                      aria-label="Reconnect"
                      className="h-7 w-7 shrink-0 p-0 sm:w-auto sm:px-2.5"
                    >
                      <RefreshIcon className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Reconnect</span>
                    </Button>
                  )}

                  {selectedAppId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            size="sm"
                            variant="outline"
                            loading={isRedeploying || selectedApp?.status === "building"}
                            disabled={isRedeploying || selectedApp?.status === "building"}
                            className="h-7 shrink-0 gap-1.5 border-primary/30 px-2.5 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                          >
                            <RefreshIcon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">
                              {isRedeploying
                                ? "Deploying…"
                                : selectedApp?.status === "building"
                                  ? "Building…"
                                  : "Redeploy"}
                            </span>
                            <ChevronDownIcon className="h-3 w-3 opacity-80" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => handleRedeploy(false)}>
                          <RefreshIcon className="h-4 w-4" />
                          Redeploy
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRedeploy(true)}>
                          <TrashIcon className="h-4 w-4 text-destructive-foreground" />
                          Clear cache & redeploy
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {logs.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setLogs([])
                        setLogQuery("")
                      }}
                      title="Clear logs"
                      aria-label="Clear logs"
                      className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground sm:w-auto sm:px-2.5"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Clear</span>
                    </Button>
                  )}

                  {logs.length > 0 && (
                    <InputGroup className="h-7 min-w-0 flex-1 sm:ml-1 sm:w-36 sm:flex-none">
                      <InputGroupInput
                        value={logQuery}
                        onChange={(e) => setLogQuery(e.target.value)}
                        placeholder="Filter…"
                        type="search"
                        className="text-xs"
                      />
                      <InputGroupAddon align="inline-end">
                        <SearchIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      </InputGroupAddon>
                    </InputGroup>
                  )}
                </div>
            </div>
          </FramePanel>

          <FramePanel className="relative flex min-h-0 flex-1 flex-col overflow-hidden !p-0">
            <div className="min-h-0 flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
              {logs.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground/50 select-none">
                  <TerminalIcon
                    className={`h-8 w-8 opacity-25 ${connected ? "animate-pulse" : ""}`}
                  />
                  {!selectedAppId ? (
                    <span>Select an application above to stream logs.</span>
                  ) : connected ? (
                    <span>Connected - waiting for output…</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <RefreshIcon className="h-3.5 w-3.5 animate-spin" />
                      Connecting to {logMode} log stream…
                    </span>
                  )}
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/50 select-none">
                  <SearchIcon className="h-6 w-6 opacity-25" />
                  <span>
                    No logs match &ldquo;{logQuery.trim()}&rdquo;
                  </span>
                </div>
              ) : (
                <>
                  {filteredLogs.map((log, i) => {
                    const lineNum = logQuery.trim()
                      ? logs.indexOf(log) + 1
                      : i + 1
                    return (
                      <div
                        key={`${lineNum}-${log.timestamp}`}
                        className="group -mx-1 flex gap-3 rounded px-1 transition-colors hover:bg-foreground/[0.03] dark:hover:bg-white/[0.03]"
                      >
                        <span className="w-8 shrink-0 select-none text-right text-[10px] leading-loose text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/50">
                          {lineNum}
                        </span>
                        <span className="mt-px shrink-0 select-none text-[10px] leading-loose text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/50">
                          {new Date(log.timestamp).toLocaleTimeString(undefined, {
                            hour12: false,
                          })}
                        </span>
                        <span
                          className={`${lineColor(log.message)} break-all leading-loose`}
                        >
                          {log.message}
                        </span>
                      </div>
                    )
                  })}
                  <div ref={endRef} />
                </>
              )}
            </div>
          </FramePanel>

          {(selectedApp || logs.length > 0) && (
            <FrameFooter className="shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {selectedApp
                    ? `${selectedApp.name} · port ${selectedApp.port} · ${logModeLabel}`
                    : "No app selected"}
                </span>
                <div className="flex items-center gap-3">
                  {logs.length > 0 && (
                    <span>
                      {filteredLogs.length.toLocaleString()}
                      {logQuery.trim() && filteredLogs.length !== logs.length
                        ? ` of ${logs.length.toLocaleString()}`
                        : ""}{" "}
                      lines
                    </span>
                  )}
                  {logQuery.trim() && filteredLogs.length !== logs.length && (
                    <button
                      onClick={() => setLogQuery("")}
                      className="cursor-pointer text-primary underline-offset-2 hover:underline"
                    >
                      Clear filter
                    </button>
                  )}
                  {connected ? (
                    <span className="flex items-center gap-1.5 text-success">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                      Live
                    </span>
                  ) : (
                    <span>Disconnected</span>
                  )}
                </div>
              </div>
            </FrameFooter>
          )}
        </Frame>
      </div>
    </AppShell>
  )
}

export default function LogsRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center p-6">
          <span className="animate-pulse text-sm text-muted-foreground">
            Loading logs…
          </span>
        </div>
      }
    >
      <LogsPage />
    </Suspense>
  )
}
