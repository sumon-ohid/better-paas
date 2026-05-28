"use client"

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NucleoIcon } from "@/components/nucleo-icons"
import { AppShell, ToastContainer, useToast, StatusDot } from "@/components/app-shell"
import { api, createRuntimeLogsWs } from "@/lib/api"
import type { App, DeploymentRecord, LogEntry } from "@/lib/types"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const ChevronLeftIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-left" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />
const SquareIcon = (props: IconProps) => <NucleoIcon {...props} name="square" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const Trash2Icon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const ExternalIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const CopyIcon = (props: IconProps) => <NucleoIcon {...props} name="copy" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const GitBranchIcon = (props: IconProps) => <NucleoIcon {...props} name="branch" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />

export type AppTab = "overview" | "config" | "logs" | "deployments"

function AppDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const appId = params.id as string
  const { toasts, showToast, dismissToast } = useToast()

  const [app, setApp] = useState<App | null>(null)
  const [loading, setLoading] = useState(true)
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([])

  const currentTab = (searchParams.get("tab") as AppTab) || "overview"
  const setTab = useCallback(
    (tab: AppTab) => {
      router.replace(`/app/${appId}?tab=${tab}`, { scroll: false })
    },
    [router, appId],
  )

  // ── Actions ────────────────────────────────────────────────────────────────
  const [isToggling, setIsToggling] = useState(false)
  const [isRedeploying, setIsRedeploying] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedDepl, setExpandedDepl] = useState<string | null>(null)

  // ── Config edit states ─────────────────────────────────────────────────────
  const [gitRepo, setGitRepo] = useState("")
  const [branch, setBranch] = useState("")
  const [rootDir, setRootDir] = useState("")
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([])
  const [buildCommand, setBuildCommand] = useState("")
  const [startCommand, setStartCommand] = useState("")
  const [installCommand, setInstallCommand] = useState("")
  const [portOverride, setPortOverride] = useState("")

  // ── Logs ───────────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsConnected, setLogsConnected] = useState(false)
  const logsWsRef = useRef<WebSocket | null>(null)
  const logBufferRef = useRef<LogEntry[]>([])
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null)
  const logEndRef = useRef<HTMLDivElement | null>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [appsData, deplData] = await Promise.all([
        api.apps.list(),
        api.deployments.history().catch(() => [] as DeploymentRecord[]),
      ])
      const found = appsData.find((a) => a.id === appId) ?? null
      setApp(found)
      setDeployments(deplData.filter((d) => d.appId === appId))

      if (found) {
        setGitRepo(found.gitRepo || "")
        setBranch(found.branch || "")
        setRootDir(found.rootDir || "")
        setBuildCommand(found.buildCommand || "")
        setStartCommand(found.startCommand || "")
        setInstallCommand(found.installCommand || "")
        setPortOverride(found.portOverride ? String(found.portOverride) : "")

        const loadedVars: { key: string; value: string }[] = []
        if (found.envVars) {
          Object.entries(found.envVars).forEach(([k, v]) => loadedVars.push({ key: k, value: v }))
        }
        setEnvVars(loadedVars.length > 0 ? loadedVars : [{ key: "", value: "" }])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [appId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Poll while building
  useEffect(() => {
    if (app?.status !== "building") return
    const interval = setInterval(fetchData, 2500)
    return () => clearInterval(interval)
  }, [app?.status, fetchData])

  // ── WebSocket Logs ─────────────────────────────────────────────────────────
  const connectLogs = useCallback(() => {
    if (!appId) return

    // Teardown
    if (logsWsRef.current) {
      logsWsRef.current.onclose = null
      logsWsRef.current.onerror = null
      logsWsRef.current.onopen = null
      logsWsRef.current.onmessage = null
      logsWsRef.current.close()
      logsWsRef.current = null
    }
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }

    setLogs([])
    setLogsConnected(false)
    logBufferRef.current = []

    const ws = createRuntimeLogsWs(appId)
    logsWsRef.current = ws

    ws.onopen = () => setLogsConnected(true)

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
      setLogsConnected(false)
      if (logsWsRef.current === ws) logsWsRef.current = null
      if (logBufferRef.current.length > 0) {
        setLogs((prev) => [...prev, ...logBufferRef.current])
        logBufferRef.current = []
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
    }

    ws.onerror = () => setLogsConnected(false)
  }, [appId])

  useEffect(() => {
    if (currentTab === "logs" && appId) {
      connectLogs()
    }
    return () => {
      if (logsWsRef.current) {
        logsWsRef.current.onclose = null
        logsWsRef.current.close()
        logsWsRef.current = null
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
    }
  }, [currentTab, appId, connectLogs])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleToggle = async (action: "stop" | "start") => {
    if (!app) return
    setIsToggling(true)
    try {
      if (action === "stop") {
        await api.apps.stop(app.id)
      } else {
        await api.apps.start(app.id)
      }
      showToast(
        action === "stop" ? "Container Stopped" : "Container Started",
        `${app.name} is now ${action === "stop" ? "stopped" : "running"}.`,
      )
      fetchData()
    } catch (err) {
      showToast("Error", `Failed to ${action} container.`, "destructive")
      console.error(err)
    } finally {
      setIsToggling(false)
    }
  }

  const handleRedeploy = async () => {
    if (!app) return
    setIsRedeploying(true)
    try {
      await api.apps.redeploy(app.id)
      showToast("Redeploy Started", `Triggering new build for ${app.name}...`)
      fetchData()
      setTab("logs")
      setTimeout(() => connectLogs(), 500)
    } catch (err) {
      showToast("Error", "Failed to trigger redeployment.", "destructive")
      console.error(err)
    } finally {
      setIsRedeploying(false)
    }
  }

  const handleDelete = async () => {
    if (!app) return
    try {
      await api.apps.delete(app.id)
      showToast("App Deleted", `${app.name} has been removed.`)
      router.push("/")
    } catch (err) {
      showToast("Error", "Failed to delete application.", "destructive")
      console.error(err)
    }
  }

  const handleSaveConfig = async () => {
    if (!app) return
    setIsSaving(true)
    const envVarsRecord: Record<string, string> = {}
    envVars.forEach((item) => {
      if (item.key.trim() && item.value.trim()) {
        envVarsRecord[item.key.trim()] = item.value.trim()
      }
    })

    try {
      await api.apps.update({
        id: app.id,
        gitRepo,
        branch,
        rootDir,
        envVars: envVarsRecord,
        buildCommand,
        startCommand,
        installCommand,
        portOverride: portOverride ? parseInt(portOverride, 10) : 0,
      })
      showToast("Settings Saved", "Application configuration updated.")
      fetchData()
    } catch (err) {
      showToast("Error", "Failed to save configuration.", "destructive")
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false)
  const handleCopyUrl = () => {
    if (!app?.url) return
    navigator.clipboard.writeText(app.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast("Copied", "URL copied to clipboard.")
  }

  const lineColor = (msg: string) => {
    if (msg.startsWith("✖") || msg.includes(" Error") || msg.includes("failed")) return "text-rose-400"
    if (msg.startsWith("✅") || msg.startsWith("✔") || msg.includes("successfully")) return "text-[#93e0c0]"
    if (
      msg.startsWith("📦") ||
      msg.startsWith("🔍") ||
      msg.startsWith("🚀") ||
      msg.startsWith("🧹") ||
      msg.startsWith("✨") ||
      msg.startsWith("💡") ||
      msg.startsWith("⚠️") ||
      msg.startsWith("📂")
    )
      return "text-amber-300"
    return "text-slate-200"
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <span className="text-sm text-muted-foreground animate-pulse">Loading application...</span>
        </div>
      </AppShell>
    )
  }

  if (!app) {
    return (
      <AppShell>
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">Application not found.</p>
          <Button onClick={() => router.push("/")} className="h-8 text-xs">
            Back to Dashboard
          </Button>
        </div>
      </AppShell>
    )
  }

  const tabs: { id: AppTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "config", label: "Configuration" },
    { id: "logs", label: "Logs" },
    { id: "deployments", label: "Deployments" },
  ]

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-border bg-background/80 backdrop-blur-sm px-4 py-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
                Dashboard
              </button>
              <span className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <StatusDot status={app.status} />
                <h1 className="text-base font-bold text-foreground">{app.name}</h1>
                <span
                  className={`text-[11px] font-mono px-1.5 py-0.5 rounded-full ${
                    app.status === "running"
                      ? "bg-[#69d1a7]/15 text-[#69d1a7]"
                      : app.status === "building"
                        ? "bg-amber-400/15 text-amber-400"
                        : app.status === "failed"
                          ? "bg-rose-500/15 text-rose-400"
                          : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {app.status}
                </span>
              </div>
              {app.branch && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                  <GitBranchIcon className="h-3 w-3" />
                  {app.branch}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {app.status === "running" ? (
                <Button
                  onClick={() => handleToggle("stop")}
                  disabled={isToggling}
                  variant="outline"
                  className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-600"
                >
                  <SquareIcon className="h-3 w-3 mr-1" />
                  Stop
                </Button>
              ) : app.status === "stopped" ? (
                <Button
                  onClick={() => handleToggle("start")}
                  disabled={isToggling}
                  variant="outline"
                  className="h-7 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600"
                >
                  <PlayIcon className="h-3 w-3 mr-1" />
                  Start
                </Button>
              ) : null}

              <Button
                onClick={handleRedeploy}
                disabled={isRedeploying || app.status === "building"}
                className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <RefreshIcon className={`h-3 w-3 mr-1 ${isRedeploying ? "animate-spin" : ""}`} />
                {isRedeploying ? "Redeploying..." : "Redeploy"}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-3 border-b border-border/50">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-all cursor-pointer border-b-2 -mb-px ${
                  currentTab === t.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* ── Overview ───────────────────────────────────────────────── */}
          {currentTab === "overview" && (
            <div className="h-full overflow-y-auto p-4 md:p-6">
              <div className="max-w-2xl space-y-6 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="border-border bg-card/72 backdrop-blur-xl p-4 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Service URL
                  </span>
                  <div className="flex items-center justify-between">
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-foreground hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <ExternalIcon className="h-3 w-3" />
                      {app.url.replace("http://", "")}
                    </a>
                    <button
                      onClick={handleCopyUrl}
                      className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors border-0"
                    >
                      {copied ? <CheckIcon className="h-3 w-3 text-[#69d1a7]" /> : <CopyIcon className="h-3 w-3" />}
                    </button>
                  </div>
                </Card>

                <Card className="border-border bg-card/72 backdrop-blur-xl p-4 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Port Routing
                  </span>
                  <span className="text-sm font-mono text-foreground">
                    {app.port}
                    {app.portOverride ? ` → ${app.portOverride}` : ""}
                  </span>
                </Card>

                <Card className="border-border bg-card/72 backdrop-blur-xl p-4 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Git Repository
                  </span>
                  <span className="text-sm font-mono text-foreground truncate block">{app.gitRepo}</span>
                </Card>

                <Card className="border-border bg-card/72 backdrop-blur-xl p-4 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Provisioned
                  </span>
                  <span className="text-sm text-foreground">{new Date(app.createdAt).toLocaleString()}</span>
                </Card>
              </div>

              {app.envVars && Object.keys(app.envVars).length > 0 && (
                <Card className="border-border bg-card/72 backdrop-blur-xl p-4 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Environment Variables
                  </span>
                  <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1.5 font-mono text-xs">
                    {Object.entries(app.envVars).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="text-foreground font-semibold truncate">{k}</span>
                        <span className="text-muted-foreground truncate max-w-[200px]">{v}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button
                  onClick={() => setTab("config")}
                  variant="outline"
                  className="h-8 text-xs border-border"
                >
                  Edit Configuration
                </Button>
                <Button
                  onClick={handleDelete}
                  variant="outline"
                  className="h-8 text-xs border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                >
                  <Trash2Icon className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
          )}

          {/* ── Configuration ──────────────────────────────────────────── */}
          {currentTab === "config" && (
            <div className="h-full overflow-y-auto p-4 md:p-6">
              <div className="max-w-2xl space-y-5 animate-in fade-in-50 duration-200">
              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Git Repository URL
                </Label>
                <Input value={gitRepo} onChange={(e) => setGitRepo(e.target.value)} className="h-9 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Branch</Label>
                  <Input value={branch} onChange={(e) => setBranch(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Root Directory
                  </Label>
                  <Input value={rootDir} onChange={(e) => setRootDir(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Port Override
                  </Label>
                  <Input
                    value={portOverride}
                    onChange={(e) => setPortOverride(e.target.value.replace(/\D/g, ""))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Build Pack</Label>
                  <div className="h-9 px-2.5 bg-muted/40 border border-border rounded flex items-center text-xs text-muted-foreground font-mono">
                    Nixpacks
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Install Command
                </Label>
                <Input
                  value={installCommand}
                  onChange={(e) => setInstallCommand(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Build Command
                  </Label>
                  <Input value={buildCommand} onChange={(e) => setBuildCommand(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Start Command
                  </Label>
                  <Input value={startCommand} onChange={(e) => setStartCommand(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Environment Variables
                  </Label>
                  <Button
                    type="button"
                    onClick={() => setEnvVars((prev) => [...prev, { key: "", value: "" }])}
                    className="h-6 cursor-pointer rounded bg-secondary text-secondary-foreground text-xs px-2 hover:bg-secondary/85 flex items-center gap-1 font-semibold border-0"
                  >
                    <PlusIcon className="h-3 w-3" /> Add Var
                  </Button>
                </div>
                <div className="space-y-2">
                  {envVars.map((env, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        value={env.key}
                        onChange={(e) => {
                          const updated = [...envVars]
                          updated[index].key = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "")
                          setEnvVars(updated)
                        }}
                        placeholder="NAME"
                        className="h-8 text-xs font-mono flex-1"
                      />
                      <Input
                        value={env.value}
                        onChange={(e) => {
                          const updated = [...envVars]
                          updated[index].value = e.target.value
                          setEnvVars(updated)
                        }}
                        placeholder="value"
                        className="h-8 text-xs font-mono flex-1"
                      />
                      <Button
                        type="button"
                        onClick={() => setEnvVars((prev) => prev.filter((_, i) => i !== index))}
                        variant="ghost"
                        className="h-7 w-7 hover:bg-rose-500/10 text-rose-400 p-0 shrink-0 border-0"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button onClick={() => setTab("overview")} variant="outline" className="h-8 text-xs border-border">
                  Discard
                </Button>
                <Button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSaving ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </div>
          </div>
          )}

          {/* ── Logs ───────────────────────────────────────────────────── */}
          {currentTab === "logs" && (
            <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TerminalIcon className="h-3.5 w-3.5" />
                  <span>Runtime Logs</span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${logsConnected ? "bg-[#69d1a7] animate-pulse" : "bg-muted-foreground/30"}`}
                  />
                  <span>{logsConnected ? "Live" : "Disconnected"}</span>
                  {logs.length > 0 && (
                    <span className="font-mono text-muted-foreground/50">· {logs.length} lines</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => connectLogs()}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    Reconnect
                  </button>
                  {logs.length > 0 && (
                    <button
                      onClick={() => setLogs([])}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 mt-4 min-h-0 bg-[#080910] border border-border/80 rounded-lg overflow-hidden font-mono text-xs leading-relaxed">
                <div className="h-full overflow-y-auto p-4 space-y-0.5">
                  {logs.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500 select-none">
                      <TerminalIcon className={`h-8 w-8 opacity-25 ${logsConnected ? "animate-pulse" : ""}`} />
                      {logsConnected ? (
                        <span>Connected — waiting for output…</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <RefreshIcon className="h-3.5 w-3.5 animate-spin" />
                          Connecting to runtime log stream…
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      {logs.map((log, i) => (
                        <div key={i} className="flex gap-4 group hover:bg-white/[0.02] rounded px-1 -mx-1">
                          <span className="select-none text-slate-600 w-10 text-right shrink-0 group-hover:text-slate-500 transition-colors">
                            {i + 1}
                          </span>
                          <span className="select-none text-slate-600 shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className={`${lineColor(log.message)} break-all`}>{log.message}</span>
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Deployments ────────────────────────────────────────────── */}
          {currentTab === "deployments" && (
            <div className="h-full overflow-y-auto p-4 md:p-6 space-y-5 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Deployment History</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {deployments.length} deployment{deployments.length !== 1 ? "s" : ""} recorded.
                  </p>
                </div>
                <Button
                  onClick={handleRedeploy}
                  disabled={isRedeploying || app.status === "building"}
                  className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <RefreshIcon className={`h-3 w-3 mr-1 ${isRedeploying ? "animate-spin" : ""}`} />
                  {isRedeploying ? "Redeploying..." : "Redeploy"}
                </Button>
              </div>

              {deployments.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                  <RefreshIcon className="h-6 w-6 mx-auto mb-3 opacity-20" />
                  No deployments recorded for this project yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-card/72 backdrop-blur-xl divide-y divide-border/40">
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground bg-muted/20">
                    <span>#</span>
                    <span>Deployment ID</span>
                    <span>Status</span>
                    <span>Duration</span>
                    <span>Started</span>
                  </div>
                  {deployments.map((dep, idx) => (
                    <div key={dep.id}>
                      <div
                        className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-3 items-center hover:bg-accent/30 transition-colors cursor-pointer group"
                        onClick={() => setExpandedDepl(expandedDepl === dep.id ? null : dep.id)}
                      >
                        <span className="text-xs font-mono text-muted-foreground w-6 text-right">
                          {deployments.length - idx}
                        </span>
                        <span className="text-sm font-mono text-foreground truncate">{dep.id}</span>
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded-full w-fit ${
                            dep.status === "success"
                              ? "bg-[#69d1a7]/15 text-[#69d1a7]"
                              : "bg-rose-500/15 text-rose-400"
                          }`}
                        >
                          {dep.status}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">{dep.duration}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(dep.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {expandedDepl === dep.id && (
                        <div className="border-t border-border/30 bg-[#080910] px-4 py-3 font-mono text-xs text-slate-300 max-h-80 overflow-y-auto space-y-0.5">
                          {dep.logs.length === 0 ? (
                            <span className="text-slate-600 italic">No log output recorded.</span>
                          ) : (
                            dep.logs.map((line, i) => (
                              <div key={i} className="flex gap-4">
                                <span className="select-none text-slate-600 w-8 text-right shrink-0">
                                  {i + 1}
                                </span>
                                <span className={lineColor(line)}>{line}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppShell>
  )
}

export default function AppDetailRoute() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AppDetailPage />
    </Suspense>
  )
}
