"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NucleoIcon } from "@/components/nucleo-icons"
import { DeleteConfirmModal } from "@/components/delete-confirm-modal"
import { api, createRuntimeLogsWs } from "@/lib/api"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />
const SquareIcon = (props: IconProps) => <NucleoIcon {...props} name="square" />
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const Trash2Icon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const ExternalLinkIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const CopyIcon = (props: IconProps) => <NucleoIcon {...props} name="copy" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const CpuIcon = (props: IconProps) => <NucleoIcon {...props} name="cpu" />
const ServerIcon = (props: IconProps) => <NucleoIcon {...props} name="server" />
const GitBranchIcon = (props: IconProps) => <NucleoIcon {...props} name="branch" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const RefreshCwIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />

interface App {
  id: string
  name: string
  status: string
  gitRepo: string
  branch: string
  port: number
  url: string
  createdAt: string
  rootDir?: string
  envVars?: Record<string, string>
  buildCommand?: string
  startCommand?: string
  installCommand?: string
  portOverride?: number
  domains?: string[]
  memory?: string
  cpus?: string
  volumes?: string[]
  healthPath?: string
  secretKeys?: string[]
  autoDeploy?: boolean
  image?: string
}

interface ServerStats {
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  activeApps: number
  timestamp: string
}

interface AppDetailDrawerProps {
  app: App | null
  isOpen: boolean
  onClose: () => void
  onTogglePause: (id: string, action: "stop" | "start") => Promise<void>
  onDelete: (id: string) => Promise<void>
  onViewLogs: (app: App, isRedeploy?: boolean) => void
  onUpdateAppList: () => Promise<void>
  stats: ServerStats
}

export function AppDetailDrawer({
  app,
  isOpen,
  onClose,
  onTogglePause,
  onDelete,
  onViewLogs,
  onUpdateAppList,
  stats
}: AppDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "settings">("overview")
  const [runtimeLogs, setRuntimeLogs] = useState<{ message: string; timestamp: string }[]>([])
  const [runtimeLogsConnected, setRuntimeLogsConnected] = useState(false)
  const [appMetrics, setAppMetrics] = useState<{ cpuPercent: number; memUsageMb: number; memLimitMb: number; memPercent: number } | null>(null)
  const runtimeLogsWsRef = useRef<WebSocket | null>(null)
  const runtimeLogsWsSeqRef = useRef(0)
  const runtimeLogEndRef = useRef<HTMLDivElement | null>(null)

  const connectRuntimeLogs = (appId: string) => {
    const seq = ++runtimeLogsWsSeqRef.current
    if (runtimeLogsWsRef.current) {
      runtimeLogsWsRef.current.onclose = null
      runtimeLogsWsRef.current.onerror = null
      runtimeLogsWsRef.current.onopen = null
      runtimeLogsWsRef.current.onmessage = null
      runtimeLogsWsRef.current.close()
      runtimeLogsWsRef.current = null
    }

    setRuntimeLogs([])
    setRuntimeLogsConnected(false)

    createRuntimeLogsWs(appId)
      .then((ws) => {
        if (seq !== runtimeLogsWsSeqRef.current) {
          ws.close()
          return
        }
        runtimeLogsWsRef.current = ws

        ws.onopen = () => {
          console.log('[WS runtime-logs] opened for', appId)
          setRuntimeLogsConnected(true)
        }

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)
          setRuntimeLogs((prev) => [...prev, { message: data.message, timestamp: data.timestamp }])
        }

        ws.onclose = (event) => {
          console.log('[WS runtime-logs] closed:', event.code, event.reason)
          setRuntimeLogsConnected(false)
          if (runtimeLogsWsRef.current === ws) {
            runtimeLogsWsRef.current = null
          }
        }

        ws.onerror = (err) => {
          console.error('[WS runtime-logs] error:', err)
          setRuntimeLogsConnected(false)
          if (runtimeLogsWsRef.current === ws) {
            runtimeLogsWsRef.current = null
          }
        }
      })
      .catch((err) => {
        if (seq !== runtimeLogsWsSeqRef.current) return
        console.error('[WS runtime-logs] error:', err)
        setRuntimeLogsConnected(false)
      })
  }

  useEffect(() => {
    if (isOpen && activeTab === "logs" && app) {
      // connectRuntimeLogs manages WS lifecycle; state updates fire in callbacks.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      connectRuntimeLogs(app.id)
    } else {
      runtimeLogsWsSeqRef.current++
      if (runtimeLogsWsRef.current) {
        runtimeLogsWsRef.current.close()
        runtimeLogsWsRef.current = null
      }
      setRuntimeLogsConnected(false)
    }
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      runtimeLogsWsSeqRef.current++
      if (runtimeLogsWsRef.current) {
        runtimeLogsWsRef.current.close()
        runtimeLogsWsRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab, app?.id])

  useEffect(() => {
    if (runtimeLogEndRef.current) {
      runtimeLogEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [runtimeLogs])

  useEffect(() => {
    if (isOpen) {
      // Reset to the overview tab whenever the drawer opens.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab("overview")
    }
  }, [isOpen])

  // Webhook info
  const [webhookUrl, setWebhookUrl] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")
  const [webhookCopied, setWebhookCopied] = useState(false)

  // Declared before the effect that uses it so the reference is stable and the
  // effect dependency list stays honest.
  const loadWebhook = useCallback(async () => {
    if (!app) return
    try {
      const info = await api.apps.webhook(app.id)
      setWebhookUrl(info.url)
      setWebhookSecret(info.secret)
    } catch (err) {
      console.error(err)
    }
  }, [app])

  // Load webhook info when entering the settings tab.
  useEffect(() => {
    if (isOpen && activeTab === "settings" && app) {
      // loadWebhook is async; setState runs after awaits, not synchronously.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadWebhook()
    }
  }, [isOpen, activeTab, app, loadWebhook])

  // Poll per-container metrics while the drawer is open for a running app.
  useEffect(() => {
    if (!isOpen || !app || app.status !== "running") {
      // Clear stale metrics when the drawer closes or the app isn't running.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAppMetrics(null)
      return
    }
    let cancelled = false
    const fetchMetrics = async () => {
      try {
        const all = await api.system.appMetrics()
        if (cancelled) return
        const m = all.find((x) => x.appId === app.id)
        setAppMetrics(m ? { cpuPercent: m.cpuPercent, memUsageMb: m.memUsageMb, memLimitMb: m.memLimitMb, memPercent: m.memPercent } : null)
      } catch {
        // ignore
      }
    }
    fetchMetrics()
    const t = setInterval(fetchMetrics, 4000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, app?.id, app?.status])
  const [copied, setCopied] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRedeploying, setIsRedeploying] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Edit states
  const [gitRepo, setGitRepo] = useState("")
  const [branch, setBranch] = useState("")
  const [rootDir, setRootDir] = useState("")
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([])
  const [buildCommand, setBuildCommand] = useState("")
  const [startCommand, setStartCommand] = useState("")
  const [installCommand, setInstallCommand] = useState("")
  const [portOverride, setPortOverride] = useState("")
  const [memory, setMemory] = useState("")
  const [cpus, setCpus] = useState("")
  const [healthPath, setHealthPath] = useState("")
  const [domains, setDomains] = useState("")
  const [volumes, setVolumes] = useState("")
  const [autoDeploy, setAutoDeploy] = useState(false)

  useEffect(() => {
    if (app) {
      // Intentionally syncs the edit form to the selected app's props.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGitRepo(app.gitRepo || "")
      setBranch(app.branch || "main")
      setRootDir(app.rootDir || "")
      setBuildCommand(app.buildCommand || "")
      setStartCommand(app.startCommand || "")
      setInstallCommand(app.installCommand || "")
      setPortOverride(app.portOverride ? app.portOverride.toString() : "")
      setMemory(app.memory || "")
      setCpus(app.cpus || "")
      setHealthPath(app.healthPath || "")
      setDomains((app.domains || []).join(", "))
      setVolumes((app.volumes || []).join(", "))
      setAutoDeploy(!!app.autoDeploy)

      const loadedVars: { key: string; value: string }[] = []
      if (app.envVars) {
        Object.entries(app.envVars).forEach(([k, v]) => {
          loadedVars.push({ key: k, value: v })
        })
      }
      setEnvVars(loadedVars.length > 0 ? loadedVars : [{ key: "", value: "" }])
    }
  }, [app])

  if (!isOpen || !app) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(app.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveChanges = async () => {
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
        memory: memory.trim(),
        cpus: cpus.trim(),
        healthPath: healthPath.trim(),
        domains: domains.split(/[\n,]/).map((d) => d.trim()).filter(Boolean),
        volumes: volumes.split(/[\n,]/).map((v) => v.trim()).filter(Boolean),
        secretKeys: app.secretKeys || [],
        autoDeploy,
      })
      await onUpdateAppList()
      setActiveTab("overview")
    } catch (err) {
      console.error(err)
      alert("Failed to update application settings.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleRegenerateWebhook = async () => {
    try {
      const res = await api.apps.regenerateWebhook(app.id)
      setWebhookSecret(res.secret)
    } catch (err) {
      console.error(err)
      alert("Failed to regenerate webhook secret.")
    }
  }

  const copyWebhook = () => {
    navigator.clipboard.writeText(`${webhookUrl}\nSecret: ${webhookSecret}`)
    setWebhookCopied(true)
    setTimeout(() => setWebhookCopied(false), 2000)
  }

  const handleRedeploy = async () => {
    setIsRedeploying(true)
    try {
      const updatedApp = await api.apps.redeploy(app.id)
      await onUpdateAppList()
      onViewLogs(updatedApp, true)
      onClose()
    } catch (err) {
      console.error(err)
      alert("Error starting redeployment.")
    } finally {
      setIsRedeploying(false)
    }
  }

  const handleConfirmDelete = async () => {
    await onDelete(app.id)
    setShowDeleteConfirm(false)
    onClose()
  }

  const renderStatusDot = (status: string) => {
    switch (status) {
      case "running": return <span className="h-2 w-2 rounded-full bg-[#69d1a7] shadow-[0_0_8px_#69d1a7]" />
      case "building": return <span className="h-2 w-2 rounded-full bg-[#e7be75] animate-pulse" />
      case "stopped": return <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
      case "failed": return <span className="h-2 w-2 rounded-full bg-[#f26d78]" />
      default: return null
    }
  }

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 z-30 bg-black/15 backdrop-blur-[1px] transition-all"
        onClick={onClose}
      />

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        appName={app.name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      
      {/* Drawer panel */}
      <div className="fixed top-0 right-0 bottom-0 z-40 flex w-[390px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto border-l border-border bg-card/95 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/5">
          <div className="flex items-center gap-2">
            {renderStatusDot(app.status)}
            <span className="font-semibold text-sm text-foreground uppercase font-mono">{app.status}</span>
          </div>
          <button 
            onClick={onClose}
            className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-150 border-0"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Navigation Tabs */}
        <div className="flex border-b border-border/80 text-xs uppercase font-bold tracking-wider text-muted-foreground px-4 bg-muted/10">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-2 px-3 border-b-2 transition-all cursor-pointer border-0 ${
              activeTab === "overview"
                ? "border-primary text-foreground"
                : "border-transparent hover:text-foreground"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`py-2 px-3 border-b-2 transition-all cursor-pointer border-0 ${
              activeTab === "logs"
                ? "border-primary text-foreground"
                : "border-transparent hover:text-foreground"
            }`}
          >
            Runtime Logs
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`py-2 px-3 border-b-2 transition-all cursor-pointer border-0 ${
              activeTab === "settings"
                ? "border-primary text-foreground"
                : "border-transparent hover:text-foreground"
            }`}
          >
            Modify Config
          </button>
        </div>

        {/* Drawer Content */}
        <div className="p-4 flex-1 space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* App Name */}
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Service Title</span>
                <h2 className="text-base font-bold text-foreground">{app.name}</h2>
              </div>

              {/* Actions Grid */}
              <div className="space-y-2 pt-2">
                {app.status === "running" ? (
                  <Button 
                    onClick={() => onTogglePause(app.id, "stop")}
                    className="h-9 w-full cursor-pointer rounded-md border border-[#e7be75]/25 bg-[#e7be75]/10 text-sm font-semibold text-[#e7be75] transition-colors hover:bg-[#e7be75]/15"
                  >
                    <SquareIcon className="h-3.5 w-3.5 mr-1.5" />
                    Pause Container
                  </Button>
                ) : app.status === "stopped" ? (
                  <Button 
                    onClick={() => onTogglePause(app.id, "start")}
                    className="h-9 w-full cursor-pointer rounded-md border border-[#69d1a7]/25 bg-[#69d1a7]/10 text-sm font-semibold text-[#69d1a7] transition-colors hover:bg-[#69d1a7]/15"
                  >
                    <PlayIcon className="h-3.5 w-3.5 mr-1.5" />
                    Start Container
                  </Button>
                ) : (
                  <Button disabled className="w-full opacity-50 text-sm h-9 rounded border-0">
                    Container Transitioning
                  </Button>
                )}
                
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={() => onViewLogs(app)}
                    className="h-9 cursor-pointer rounded-md border border-border bg-muted/40 text-sm font-semibold text-foreground transition-colors hover:bg-accent/55"
                  >
                    <TerminalIcon className="h-3.5 w-3.5 mr-1.5" />
                    Deploy Logs
                  </Button>
                  
                  <Button 
                    onClick={handleRedeploy}
                    disabled={isRedeploying || app.status === "building"}
                    className="h-9 cursor-pointer rounded-md border border-primary/20 bg-primary/10 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                  >
                    <RefreshCwIcon className={`h-3.5 w-3.5 mr-1.5 ${isRedeploying ? "animate-spin" : ""}`} />
                    {isRedeploying ? "Rebuilding..." : "Redeploy"}
                  </Button>
                </div>

                <Button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="h-9 w-full cursor-pointer rounded-md border border-[#f26d78]/25 bg-[#f26d78]/10 text-sm font-semibold text-[#f26d78] transition-colors hover:bg-[#f26d78]/15"
                >
                  <Trash2Icon className="h-3.5 w-3.5 mr-1.5" />
                  Purge Application
                </Button>
              </div>

              {/* Metadata details */}
              <div className="space-y-3.5 pt-4 border-t border-border text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Domain Url</span>
                  <div className="flex items-center gap-1.5">
                    <a 
                      href={app.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-foreground hover:underline flex items-center gap-1 font-mono text-xs"
                    >
                      <span>Live preview</span>
                      <ExternalLinkIcon className="h-3 w-3" />
                    </a>
                    <button 
                      onClick={handleCopy}
                      className="h-5 w-5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors border-0"
                    >
                      {copied ? <CheckIcon className="h-3 w-3 text-[#69d1a7]" /> : <CopyIcon className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                 <div className="flex justify-between items-center">
                   <span className="text-muted-foreground font-medium">Repository URL</span>
                   {app.gitRepo ? (
                     <a
                       href={app.gitRepo}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="font-mono text-xs text-foreground max-w-[180px] truncate hover:text-primary transition-colors"
                     >
                       {app.gitRepo}
                     </a>
                   ) : (
                     <span className="font-mono text-xs text-muted-foreground max-w-[180px] truncate">
                       {app.image || "—"}
                     </span>
                   )}
                 </div>

                {app.branch && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Branch</span>
                    <span className="inline-flex items-center gap-1 font-mono text-xs bg-muted/40 border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                      <GitBranchIcon className="h-2.5 w-2.5" />
                      {app.branch}
                    </span>
                  </div>
                )}

                {app.rootDir && app.rootDir !== "." && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Root Directory</span>
                    <span className="font-mono text-xs text-foreground">{app.rootDir}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Port Routing</span>
                  <span className="font-mono text-xs text-foreground">
                    {app.port}{app.portOverride ? ` → ${app.portOverride}` : ""}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Provisioned At</span>
                  <span className="text-foreground">{new Date(app.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Custom environment variables readout */}
              {app.envVars && Object.keys(app.envVars).length > 0 && (
                <div className="space-y-2 pt-4 border-t border-border">
                  <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block">Configured Environment</span>
                  <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-1.5 max-h-[140px] overflow-y-auto font-mono text-xs leading-tight">
                    {Object.entries(app.envVars).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2 text-muted-foreground">
                        <span className="text-foreground/90 font-semibold truncate select-all">{k}</span>
                        <span className="truncate max-w-[150px] select-all">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resource Diagnostics */}
              {app.status === "running" && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Resource Allocation</span>
                    <span className="text-sm text-muted-foreground block">Active container resource consumption logs</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-sm">
                        <CpuIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">CPU usage</span>
                      </div>
                      <span className="font-mono text-sm font-semibold">
                        {appMetrics ? `${appMetrics.cpuPercent.toFixed(1)}%` : `${stats.cpuUsage.toFixed(1)}%`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-sm">
                        <ServerIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">RAM usage</span>
                      </div>
                      <span className="font-mono text-sm font-semibold">
                        {appMetrics
                          ? `${appMetrics.memUsageMb.toFixed(0)}${appMetrics.memLimitMb > 0 ? ` / ${appMetrics.memLimitMb.toFixed(0)} MB` : " MB"}`
                          : `${stats.memoryUsage.toFixed(1)}%`}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50">
                      {appMetrics ? "Live container usage" : "Host-level usage (container stats unavailable)"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "logs" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200 flex flex-col h-full">
              <div className="flex flex-col h-full min-h-[400px] bg-[#090a0f] border border-border/80 rounded-lg overflow-hidden font-mono text-xs text-slate-100">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/10 text-[11px] uppercase font-bold text-slate-400 select-none">
                  <span>Container Runtime Output</span>
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${runtimeLogsConnected ? "bg-[#69d1a7] animate-pulse" : "bg-rose-500"}`} />
                    {runtimeLogsConnected ? "Live" : "Offline"}
                  </span>
                </div>
                <div className="p-3 overflow-y-auto flex-1 h-[380px] max-h-[450px] space-y-1.5 leading-relaxed selection:bg-primary/20">
                  {runtimeLogs.length === 0 ? (
                    <div className="text-slate-400 italic text-center py-12 flex flex-col items-center justify-center gap-2">
                      <TerminalIcon className={`h-5 w-5 opacity-40 ${runtimeLogsConnected ? "animate-pulse" : ""}`} />
                      {runtimeLogsConnected ? (
                        <span>Connected — waiting for container output...</span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <RefreshCwIcon className="h-3 w-3 animate-spin" />
                          Connecting to runtime log stream...
                        </span>
                      )}
                    </div>
                  ) : (
                    runtimeLogs.map((log, index) => (
                      <div key={index} className="flex gap-2.5">
                        <span className="text-slate-500 select-none text-[11px]">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span className="text-slate-100 whitespace-pre-wrap break-all flex-1">{log.message}</span>
                      </div>
                    ))
                  )}
                  <div ref={runtimeLogEndRef} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            /* Settings Tab Form */
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="space-y-1">
                <Label htmlFor="editGit" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Git Repository URL</Label>
                <Input
                  id="editGit"
                  value={gitRepo}
                  onChange={(e) => setGitRepo(e.target.value)}
                  className="h-9 border-border bg-background text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="editBranch" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Branch</Label>
                  <Input
                    id="editBranch"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="h-9 border-border bg-background text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editRootDir" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Root Directory</Label>
                  <Input
                    id="editRootDir"
                    value={rootDir}
                    onChange={(e) => setRootDir(e.target.value)}
                    placeholder="./"
                    className="h-9 border-border bg-background text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="editPortOverride" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Port Override</Label>
                  <Input
                    id="editPortOverride"
                    value={portOverride}
                    onChange={(e) => setPortOverride(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 3000"
                    className="h-9 border-border bg-background text-sm"
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
                <Label htmlFor="editInstall" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Install Command</Label>
                <Input
                  id="editInstall"
                  value={installCommand}
                  onChange={(e) => setInstallCommand(e.target.value)}
                  placeholder="Installation script"
                  className="h-9 border-border bg-background text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="editBuild" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Build Command</Label>
                  <Input
                    id="editBuild"
                    value={buildCommand}
                    onChange={(e) => setBuildCommand(e.target.value)}
                    placeholder="Build script"
                    className="h-9 border-border bg-background text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editStart" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start Command</Label>
                  <Input
                    id="editStart"
                    value={startCommand}
                    onChange={(e) => setStartCommand(e.target.value)}
                    placeholder="Execution script"
                    className="h-9 border-border bg-background text-sm"
                  />
                </div>
              </div>

              {/* Resource limits */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Memory Limit</Label>
                  <Input
                    value={memory}
                    onChange={(e) => setMemory(e.target.value)}
                    placeholder="e.g. 512m, 1g"
                    className="h-9 border-border bg-background text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CPU Limit</Label>
                  <Input
                    value={cpus}
                    onChange={(e) => setCpus(e.target.value)}
                    placeholder="e.g. 0.5, 1, 2"
                    className="h-9 border-border bg-background text-sm font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Health Check Path</Label>
                <Input
                  value={healthPath}
                  onChange={(e) => setHealthPath(e.target.value)}
                  placeholder="/health (blank = TCP check)"
                  className="h-9 border-border bg-background text-sm font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custom Domains</Label>
                <Input
                  value={domains}
                  onChange={(e) => setDomains(e.target.value)}
                  placeholder="app.example.com, www.example.com"
                  className="h-9 border-border bg-background text-sm font-mono"
                />
                <p className="text-[10px] text-muted-foreground/60">Comma-separated. HTTPS issued automatically. Point DNS here first.</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Persistent Volumes</Label>
                <Input
                  value={volumes}
                  onChange={(e) => setVolumes(e.target.value)}
                  placeholder="myapp-data:/data"
                  className="h-9 border-border bg-background text-sm font-mono"
                />
              </div>

              {/* Auto-deploy + webhook */}
              <div className="space-y-3 pt-2 border-t border-border">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDeploy}
                    onChange={(e) => setAutoDeploy(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-xs font-medium text-foreground">Auto-deploy on git push</span>
                </label>

                <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">GitHub Webhook</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={copyWebhook}
                        className="text-[10px] text-primary hover:underline"
                      >
                        {webhookCopied ? "Copied!" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={handleRegenerateWebhook}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 font-mono text-[10px] text-muted-foreground break-all">
                    <div><span className="text-foreground/80 font-semibold">URL: </span><span className="select-all">{webhookUrl || "—"}</span></div>
                    <div><span className="text-foreground/80 font-semibold">Secret: </span><span className="select-all">{webhookSecret || "—"}</span></div>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                    Add this as a <span className="font-mono">push</span> webhook (content type
                    <span className="font-mono"> application/json</span>) in your repo settings, then enable auto-deploy.
                  </p>
                </div>
              </div>

              {/* Environment Variables edit list */}
              <div className="space-y-3.5 pt-2 border-t border-border">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Environment Variables</Label>
                  <Button
                    type="button"
                    onClick={() => setEnvVars((prev) => [...prev, { key: "", value: "" }])}
                    className="h-5 cursor-pointer rounded bg-secondary text-secondary-foreground text-xs px-2 hover:bg-secondary/85 flex items-center gap-1 font-semibold border-0"
                  >
                    <PlusIcon className="h-3 w-3" /> Add Var
                  </Button>
                </div>

                <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1">
                  {envVars.map((env, index) => (
                    <div key={index} className="flex gap-1.5 items-center">
                      <Input
                        value={env.key}
                        onChange={(e) => {
                          const updated = [...envVars]
                          updated[index].key = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "")
                          setEnvVars(updated)
                        }}
                        placeholder="NAME"
                        className="h-8 border-border bg-background text-xs font-mono flex-1"
                      />
                      <Input
                        value={env.value}
                        onChange={(e) => {
                          const updated = [...envVars]
                          updated[index].value = e.target.value
                          setEnvVars(updated)
                        }}
                        placeholder="value"
                        className="h-8 border-border bg-background text-xs font-mono flex-1"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          setEnvVars((prev) => prev.filter((_, i) => i !== index))
                        }}
                        variant="ghost"
                        className="h-7 w-7 hover:bg-rose-500/10 text-rose-400 p-0 shrink-0 border-0"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-2 border-t border-border">
                <Button
                  onClick={() => setActiveTab("overview")}
                  variant="outline"
                  className="h-9 rounded-md border-border bg-background text-sm text-foreground px-3 flex-1"
                >
                  Discard
                </Button>
                <Button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="h-9 rounded-md bg-primary text-primary-foreground text-sm font-semibold px-4 flex-1"
                >
                  {isSaving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
