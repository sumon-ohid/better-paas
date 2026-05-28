"use client"

import React, { useState, useEffect, useRef, Suspense } from "react"
import { useTheme } from "next-themes"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress, ProgressIndicator } from "@/components/ui/progress"
import { Kbd } from "@/components/ui/kbd"
import { NucleoIcon } from "@/components/nucleo-icons"
import { AppDetailDrawer } from "@/components/app-detail-drawer"
import { DeleteConfirmModal } from "@/components/delete-confirm-modal"
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarInset,
  SidebarTrigger
} from "@/components/ui/sidebar"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">

const ServerIcon = (props: IconProps) => <NucleoIcon {...props} name="server" />
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const SettingsIcon = (props: IconProps) => <NucleoIcon {...props} name="settings" />
const ActivityIcon = (props: IconProps) => <NucleoIcon {...props} name="activity" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />
const GitBranchIcon = (props: IconProps) => <NucleoIcon {...props} name="branch" />
const CpuIcon = (props: IconProps) => <NucleoIcon {...props} name="cpu" />
const HardDriveIcon = (props: IconProps) => <NucleoIcon {...props} name="server" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />
const SquareIcon = (props: IconProps) => <NucleoIcon {...props} name="square" />
const RefreshCwIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const SearchIcon = (props: IconProps) => <NucleoIcon {...props} name="search" />
const ListIcon = (props: IconProps) => <NucleoIcon {...props} name="list" />
const LayoutGridIcon = (props: IconProps) => <NucleoIcon {...props} name="grid" />
const KeyboardIcon = (props: IconProps) => <NucleoIcon {...props} name="keyboard" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const ExternalLinkIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const CopyIcon = (props: IconProps) => <NucleoIcon {...props} name="copy" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const Trash2Icon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const SlidersHorizontalIcon = (props: IconProps) => <NucleoIcon {...props} name="activity" />
const HelpCircleIcon = (props: IconProps) => <NucleoIcon {...props} name="help" />

interface App {
  id: string
  name: string
  status: string // "running", "building", "stopped", "failed"
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
}

interface ServerStats {
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  activeApps: number
  timestamp: string
}

interface LogEntry {
  message: string
  timestamp: string
}

interface ToastMessage {
  id: string
  title: string
  description: string
  type?: "default" | "destructive"
}

function DashboardContent() {
  const { resolvedTheme, setTheme } = useTheme()
  const router = useRouter()
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [stats, setStats] = useState<ServerStats>({
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    activeApps: 0,
    timestamp: new Date().toISOString(),
  })
  
  // History lists to render real-time graphs
  const [cpuHistory, setCpuHistory] = useState<number[]>(Array(15).fill(0))
  const [memHistory, setMemHistory] = useState<number[]>(Array(15).fill(0))
  

  
  // Navigation active state: "apps" | "metrics" | "logs" | "settings"
  const [currentNav, setCurrentNav] = useState<"apps" | "metrics" | "logs" | "settings">("apps")
  
  // View mode: "list" | "board"
  const [viewMode, setViewMode] = useState<"list" | "board">("list")
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  
  // Sliding details panel
  const [selectedApp, setSelectedApp] = useState<App | null>(null)
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)
  const [copiedAppId, setCopiedAppId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<App | null>(null)
  
  // Dialog overlays
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [commandQuery, setCommandQuery] = useState("")
  const [activeCommandIndex, setActiveCommandIndex] = useState(0)
  const runFilteredCommandRef = useRef<() => void>(() => {})
  const filteredCommandCountRef = useRef(1)
  
  // Keyboard sequences
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  
  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsConnected, setLogsConnected] = useState(false)
  
  // WebSocket references
  const statsWsRef = useRef<WebSocket | null>(null)
  const logsWsRef = useRef<WebSocket | null>(null)
  const logTerminalEndRef = useRef<HTMLDivElement | null>(null)
  const appsRef = useRef<App[]>([])
  const logBufferRef = useRef<{ message: string; timestamp: string }[]>([])
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Guards against re-connecting to the same appId
  const activeLogAppIdRef = useRef<string | null>(null)
  const handledQueryAppIdRef = useRef<string | null>(null)

  // Trigger custom toast notification
  const showToast = React.useCallback((title: string, description: string, type: "default" | "destructive" = "default") => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { id, title, description, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  // Fetch apps initially
  const fetchApps = async () => {
    try {
      const res = await fetch("http://localhost:8080/api/apps")
      if (res.ok) {
        const data = await res.json()
        setApps(data)
      }
    } catch (err) {
      console.error("Failed to fetch apps", err)
    }
  }

  // Connect WebSocket log stream with batching to avoid lag
  const connectLogsStream = React.useCallback((appId?: string) => {
    console.log('[connectLogsStream] called with appId:', appId)
    const targetId = appId ?? null

    // Already connected or connecting to the exact same app — do nothing
    if (
      activeLogAppIdRef.current === targetId &&
      logsWsRef.current &&
      (logsWsRef.current.readyState === WebSocket.OPEN ||
       logsWsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      console.log('[connectLogsStream] already connected or connecting to', targetId)
      return
    }

    // Tear down any existing connection
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

    activeLogAppIdRef.current = targetId
    setLogs([])
    setLogsConnected(false)
    logBufferRef.current = []

    const wsHost = typeof window !== "undefined" ? window.location.hostname : "localhost"
    const wsUrl = appId
      ? `ws://${wsHost}:8080/ws/logs?appId=${appId}`
      : `ws://${wsHost}:8080/ws/logs`
    console.log('[WS logs] Connecting to:', wsUrl)
    const logsWs = new WebSocket(wsUrl)
    logsWsRef.current = logsWs

    logsWs.onopen = () => {
      console.log('[WS logs] opened for', appId)
      setLogsConnected(true)
    }

    logsWs.onmessage = (event) => {
      const data = JSON.parse(event.data)
      logBufferRef.current.push({ message: data.message, timestamp: data.timestamp })

      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          const logsToAppend = [...logBufferRef.current]
          logBufferRef.current = []
          setLogs((prev) => [...prev, ...logsToAppend])
          flushTimerRef.current = null
        }, 100) // batch every 100ms
      }
    }

    logsWs.onclose = (event) => {
      console.log('[WS logs] closed for', appId, 'code:', event.code, 'reason:', event.reason)
      setLogsConnected(false)
      if (logsWsRef.current === logsWs) {
        logsWsRef.current = null
      }
      // Flush any remaining buffered logs
      if (logBufferRef.current.length > 0) {
        const logsToAppend = [...logBufferRef.current]
        logBufferRef.current = []
        setLogs((prev) => [...prev, ...logsToAppend])
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
    }

    logsWs.onerror = (err) => {
      console.error('[WS logs] error for', appId, 'error:', err)
      setLogsConnected(false)
      if (logsWsRef.current === logsWs) {
        logsWsRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const searchParams = useSearchParams()
  const queryAppId = searchParams.get("app")
  const queryTab = searchParams.get("tab")

  useEffect(() => {
    if (!queryAppId) return
    if (queryTab === "logs") {
      setCurrentNav("logs")
      connectLogsStream(queryAppId)
    }
  }, [queryAppId, queryTab, connectLogsStream])

  useEffect(() => {
    if (!queryAppId) return
    if (apps.length === 0) return
    if (handledQueryAppIdRef.current === queryAppId) return

    const found = apps.find((a) => a.id === queryAppId)
    if (found) {
      handledQueryAppIdRef.current = queryAppId
      setSelectedApp(found)
    }
  }, [queryAppId, apps])

  useEffect(() => {
    appsRef.current = apps
  }, [apps])

  // Connect to Go Server WebSocket for stats
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchApps()
    
    const wsHost = typeof window !== "undefined" ? window.location.hostname : "localhost"
    const statsWs = new WebSocket(`ws://${wsHost}:8080/ws/stats`)
    statsWsRef.current = statsWs
    
    statsWs.onmessage = (event) => {
      const newStats: ServerStats = JSON.parse(event.data)
      setStats(newStats)
      
      setCpuHistory((prev) => [...prev.slice(1), newStats.cpuUsage])
      setMemHistory((prev) => [...prev.slice(1), newStats.memoryUsage])
    }
    
    statsWs.onerror = () => {
      console.warn("WebSocket stats connection error, running in simulated mode.")
      const interval = setInterval(() => {
        const simCpu = 20 + Math.random() * 30
        const simMem = 45 + Math.random() * 10
        setStats({
          cpuUsage: simCpu,
          memoryUsage: simMem,
          diskUsage: 52.4,
          activeApps: appsRef.current.filter(a => a.status === "running").length,
          timestamp: new Date().toISOString()
        })
        setCpuHistory((prev) => [...prev.slice(1), simCpu])
        setMemHistory((prev) => [...prev.slice(1), simMem])
      }, 2000)
      return () => clearInterval(interval)
    }

    return () => {
      if (statsWsRef.current) {
        statsWsRef.current.close()
      }
    }
  }, [])

  // Scroll to bottom of terminal log window when new logs arrive
  useEffect(() => {
    if (logTerminalEndRef.current) {
      logTerminalEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs])

  // Cleanup logs WebSocket on unmount
  useEffect(() => {
    return () => {
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
    }
  }, [])

  // Auto-connect logs when on logs tab with a selected app but no active connection, or close if navigated away
  useEffect(() => {
    if (currentNav === "logs" && selectedApp) {
      const noActiveConnection = !logsWsRef.current || 
        (logsWsRef.current.readyState !== WebSocket.OPEN && 
         logsWsRef.current.readyState !== WebSocket.CONNECTING);
         
      const isDifferentApp = activeLogAppIdRef.current !== selectedApp.id;

      if (noActiveConnection || isDifferentApp) {
        connectLogsStream(selectedApp.id)
      }
    } else {
      // User is not on the logs tab, close connection to save resources
      if (logsWsRef.current) {
        logsWsRef.current.onclose = null
        logsWsRef.current.onerror = null
        logsWsRef.current.onopen = null
        logsWsRef.current.onmessage = null
        logsWsRef.current.close()
        logsWsRef.current = null
        activeLogAppIdRef.current = null
        setLogsConnected(false)
      }
    }
  }, [currentNav, selectedApp, connectLogsStream])

  // Poll apps list if there are any building apps to update status automatically in the UI
  useEffect(() => {
    const hasBuildingApp = apps.some((app) => app.status === "building")
    if (!hasBuildingApp) return

    const interval = setInterval(() => {
      fetchApps()
    }, 2500) // Poll every 2.5 seconds

    return () => clearInterval(interval)
  }, [apps])

  // Keep selectedApp state in sync with latest changes in the apps list (e.g. status changes from building to running)
  useEffect(() => {
    if (selectedApp) {
      const latest = apps.find((a) => a.id === selectedApp.id)
      if (latest && JSON.stringify(latest) !== JSON.stringify(selectedApp)) {
        setSelectedApp(latest)
      }
    }
  }, [apps, selectedApp])

  // Keyboard Shortcuts Engine
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when inside form elements or inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        // Submit command palette with Enter
        if (showCommandPalette && e.key === "Enter") {
          e.preventDefault()
          runFilteredCommandRef.current()
        }
        // Navigate command palette options
        if (showCommandPalette && e.key === "ArrowDown") {
          e.preventDefault()
          setActiveCommandIndex((prev) => (prev + 1) % Math.max(filteredCommandCountRef.current, 1))
        }
        if (showCommandPalette && e.key === "ArrowUp") {
          e.preventDefault()
          setActiveCommandIndex((prev) => (prev - 1 + filteredCommandCountRef.current) % Math.max(filteredCommandCountRef.current, 1))
        }
        if (e.key === "Escape") {
          setShowCommandPalette(false)
        }
        return
      }

      if (e.key === "Escape") {
        setShowShortcuts(false)
        setShowCommandPalette(false)
        setShowDetailDrawer(false)
        setPendingKey(null)
        return
      }

      // Command palette trigger
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setShowCommandPalette((prev) => !prev)
        setCommandQuery("")
        setActiveCommandIndex(0)
        return
      }

      // Keyboard sequence parser (g for go, v for view)
      if (pendingKey === "g") {
        e.preventDefault()
        setPendingKey(null)
        if (e.key.toLowerCase() === "a") {
          setCurrentNav("apps")
          showToast("Navigation", "Navigated to Applications")
        } else if (e.key.toLowerCase() === "m") {
          setCurrentNav("metrics")
          showToast("Navigation", "Navigated to Node Health")
        } else if (e.key.toLowerCase() === "l") {
          setCurrentNav("logs")
          showToast("Navigation", "Navigated to Live Logs")
        } else if (e.key.toLowerCase() === "s") {
          setCurrentNav("settings")
          showToast("Navigation", "Navigated to Node Settings")
        }
        return
      }

      if (pendingKey === "v") {
        e.preventDefault()
        setPendingKey(null)
        if (e.key.toLowerCase() === "l") {
          setViewMode("list")
          setCurrentNav("apps")
          showToast("View Switched", "List View active")
        } else if (e.key.toLowerCase() === "b") {
          setViewMode("board")
          setCurrentNav("apps")
          showToast("View Switched", "Board View active")
        }
        return
      }

      // Initial keys in sequence or single key shortcuts
      if (e.key.toLowerCase() === "g") {
        setPendingKey("g")
        return
      }
      if (e.key.toLowerCase() === "v") {
        setPendingKey("v")
        return
      }
      if (e.key.toLowerCase() === "c") {
        e.preventDefault()
        router.push("/deploy")
        return
      }
      if (e.key === "?") {
        e.preventDefault()
        setShowShortcuts((prev) => !prev)
        return
      }
      if (e.key.toLowerCase() === "d") {
        e.preventDefault()
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
        showToast("Theme Toggle", `Switched to ${resolvedTheme === "dark" ? "light" : "dark"} mode`)
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [pendingKey, resolvedTheme, showCommandPalette, setTheme, showToast])

  // Trigger app deployment


  const handleTogglePause = async (id: string, action: "stop" | "start") => {
    try {
      const endpoint = `http://localhost:8080/api/apps/${action}`
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        showToast(
          action === "stop" ? "Container Stopped" : "Container Started",
          `Application container state successfully toggled to ${action === "stop" ? "stopped" : "running"}.`
        )
        fetchApps()
      } else {
        showToast("Error", `Failed to toggle container status to ${action}.`, "destructive")
      }
    } catch (err) {
      console.error(err)
      // Local simulation toggle
      setApps((prev) =>
        prev.map((app) =>
          app.id === id ? { ...app, status: action === "stop" ? "stopped" : "running" } : app
        )
      )
      if (selectedApp && selectedApp.id === id) {
        setSelectedApp((prev) => prev ? { ...prev, status: action === "stop" ? "stopped" : "running" } : null)
      }
      showToast(
        action === "stop" ? "Container Stopped" : "Container Started",
        `[Simulated] Application state updated to ${action === "stop" ? "stopped" : "running"}.`
      )
    }
  }

  const handleDeleteApp = async (id: string) => {
    try {
      const res = await fetch("http://localhost:8080/api/apps/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        showToast("App Deleted", "Application container and workspace folder permanently purged.")
        setShowDetailDrawer(false)
        setDeleteTarget(null)
        fetchApps()
      } else {
        showToast("Error", "Failed to delete application container.", "destructive")
      }
    } catch (err) {
      console.error(err)
      setApps((prev) => prev.filter((app) => app.id !== id))
      setShowDetailDrawer(false)
      setDeleteTarget(null)
      showToast("App Deleted", "[Simulated] Container removed from dashboard view.")
    }
  }

  const openDeleteModal = (app: App) => {
    setDeleteTarget(app)
  }

  // Fallback logs simulation
  const simulateLocalLogs = (appId: string) => {
    const mockLogs = [
      "Initializing builder container...",
      "Loading cached layers from previous builds",
      "Detecting buildpacks environment...",
      "Node.js buildpack detected",
      "Installing dependencies using pnpm...",
      "dependencies: +345 package entries updated",
      "Running build script: next build",
      "▲ Next.js 16.1.7 completed production build",
      "Optimizing route files...",
      "Production bundle created successfully (1.2MB)",
      "Launching new application instance on port: 8081",
      "Health check passed!",
      "Traffic redirected to container successfully. Zero-downtime rollover complete.",
    ]

    mockLogs.forEach((line, index) => {
      setTimeout(() => {
        setLogs((prev) => [...prev, { message: line, timestamp: new Date().toISOString() }])
        if (index === mockLogs.length - 1) {
          setApps((prev) =>
            prev.map((app) => (app.id === appId ? { ...app, status: "running" } : app))
          )
          if (selectedApp && selectedApp.id === appId) {
            setSelectedApp((prev) => prev ? { ...prev, status: "running" } : null)
          }
        }
      }, (index + 1) * 1000)
    })
  }

  // Copy app details utility
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAppId(id)
    setTimeout(() => setCopiedAppId(null), 2000)
    showToast("Copied", "Url copied to clipboard!")
  }

  // Commands config for Palette
  const allCommands = React.useMemo(() => [
    { label: "Deploy new service", shortcut: "C", action: () => router.push("/deploy") },
    { label: "Switch to List View", shortcut: "V L", action: () => setViewMode("list") },
    { label: "Switch to Board View", shortcut: "V B", action: () => setViewMode("board") },
    { label: "Toggle Dark/Light Mode", shortcut: "D", action: () => setTheme(resolvedTheme === "dark" ? "light" : "dark") },
    { label: "Go to Applications Panel", shortcut: "G A", action: () => { setCurrentNav("apps"); setViewMode("list"); } },
    { label: "Go to Node Health", shortcut: "G M", action: () => setCurrentNav("metrics") },
    { label: "Go to Live Logs Console", shortcut: "G L", action: () => setCurrentNav("logs") },
    { label: "Go to Node Configuration Settings", shortcut: "G S", action: () => setCurrentNav("settings") },
    { label: "Open Keyboard Shortcuts Help", shortcut: "?", action: () => setShowShortcuts(true) },
  ], [resolvedTheme, setTheme])

  const filteredCommands = React.useMemo(() => allCommands.filter((c) =>
    c.label.toLowerCase().includes(commandQuery.toLowerCase())
  ), [allCommands, commandQuery])

  const runFilteredCommand = React.useCallback(() => {
    const cmd = filteredCommands[activeCommandIndex]
    if (cmd) {
      cmd.action()
      setShowCommandPalette(false)
    }
  }, [activeCommandIndex, filteredCommands])

  useEffect(() => {
    filteredCommandCountRef.current = filteredCommands.length
    runFilteredCommandRef.current = runFilteredCommand
  }, [filteredCommands.length, runFilteredCommand])

  // Filter application list
  const filteredApps = apps.filter((app) => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          app.gitRepo.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || app.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Render inline SVG sparklines
  const renderSparkline = (data: number[], colorStart: string, colorEnd: string) => {
    const width = 120
    const height = 40
    const padding = 2
    const maxVal = 100
    const minVal = 0
    const range = maxVal - minVal
    const id = `grad-${colorStart.replace("#", "")}`
    
    const points = data.map((val, index) => {
      const x = (index / (data.length - 1)) * (width - padding * 2) + padding
      const y = height - ((val - minVal) / range) * (height - padding * 2) - padding
      return `${x},${y}`
    }).join(" ")

    return (
      <svg className="overflow-visible" width={width} height={height}>
        <polyline
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={colorStart} />
            <stop offset="100%" stopColor={colorEnd} />
          </linearGradient>
        </defs>
      </svg>
    )
  }

  // Custom status indicator dots
  const renderStatusDot = (status: string) => {
    switch (status) {
      case "running":
        return <span className="h-2 w-2 rounded-full bg-[#69d1a7] shadow-[0_0_10px_rgba(105,209,167,.35)]" />
      case "building":
        return (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e7be75] opacity-60"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#e7be75]"></span>
          </span>
        )
      case "failed":
        return <span className="h-2 w-2 rounded-full bg-[#f26d78] shadow-[0_0_10px_rgba(242,109,120,.35)]" />
      default:
        return <span className="h-2 w-2 rounded-full bg-muted-foreground/55" />
    }
  }

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full overflow-hidden bg-background text-foreground transition-colors duration-200 selection:bg-primary/20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_55%_-20%,rgba(143,153,255,0.12),transparent_45rem)]" />
        
        {/* Navigation Sidebar */}
        <Sidebar className="border-r border-sidebar-border bg-sidebar/82 backdrop-blur-xl">
          <SidebarHeader className="flex flex-row items-center justify-between border-b border-sidebar-border px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold text-xs shadow-[0_0_28px_rgba(143,153,255,.28)] select-none">
                A
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm leading-none text-foreground">Antigravity</span>
                <span className="text-xs text-muted-foreground/80 font-mono mt-0.5">engine-01</span>
              </div>
            </div>
            <div className="flex h-5 w-5 items-center justify-center rounded border border-border text-[11px] text-muted-foreground font-mono bg-muted/30 select-none">
              w1
            </div>
          </SidebarHeader>

          <SidebarContent className="p-2 space-y-4">
            <div className="px-2 pt-2">
              <button 
                onClick={() => setShowCommandPalette(true)}
              className="flex w-full cursor-pointer items-center justify-between rounded-md border border-border/80 bg-muted/20 px-3 py-1.5 text-sm text-muted-foreground/80 transition-all duration-150 hover:border-primary/30 hover:bg-accent/50 hover:text-foreground"
              >
                <div className="flex items-center gap-1.5">
                  <SearchIcon className="h-3.5 w-3.5" />
                  <span>Search commands...</span>
                </div>
                <div className="flex items-center gap-0.5 text-xs font-mono text-muted-foreground bg-muted/40 px-1 rounded">
                  <span>⌘</span><span>K</span>
                </div>
              </button>
            </div>

            <SidebarMenu className="space-y-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={currentNav === "apps"} 
                  onClick={() => { setCurrentNav("apps"); setViewMode("list"); }}
                  className={`flex items-center justify-between px-3 py-1.5 w-full rounded text-sm transition-all ${
                    currentNav === "apps" 
                      ? "bg-accent text-foreground font-medium shadow-[inset_2px_0_0_var(--primary)]" 
                      : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <GlobeIcon className="h-3.5 w-3.5" />
                    <span>Applications</span>
                  </div>
                  <span className="text-xs font-mono bg-muted/40 px-1 rounded-sm text-muted-foreground/80">{apps.length}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={currentNav === "metrics"} 
                  onClick={() => setCurrentNav("metrics")}
                  className={`flex items-center gap-2 px-3 py-1.5 w-full rounded text-sm transition-all ${
                    currentNav === "metrics" 
                      ? "bg-accent text-foreground font-medium shadow-[inset_2px_0_0_var(--primary)]" 
                      : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                  }`}
                >
                  <ActivityIcon className="h-3.5 w-3.5" />
                  <span>Node Health</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={currentNav === "logs"} 
                  onClick={() => setCurrentNav("logs")}
                  className={`flex items-center justify-between px-3 py-1.5 w-full rounded text-sm transition-all ${
                    currentNav === "logs" 
                      ? "bg-accent text-foreground font-medium shadow-[inset_2px_0_0_var(--primary)]" 
                      : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TerminalIcon className="h-3.5 w-3.5" />
                    <span>Live logs</span>
                  </div>
                  {logs.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={currentNav === "settings"} 
                  onClick={() => setCurrentNav("settings")}
                  className={`flex items-center gap-2 px-3 py-1.5 w-full rounded text-sm transition-all ${
                    currentNav === "settings" 
                      ? "bg-accent text-foreground font-medium shadow-[inset_2px_0_0_var(--primary)]" 
                      : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                  }`}
                >
                  <SettingsIcon className="h-3.5 w-3.5" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>

          {/* Sidebar Footer Shortcut indicator */}
          <div className="mt-auto p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground/60">
            <button 
              onClick={() => setShowShortcuts(true)}
              className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors duration-150"
            >
              <KeyboardIcon className="h-3.5 w-3.5" />
              <span>Keyboard shortcuts</span>
            </button>
            <span className="font-mono text-xs bg-muted/40 px-1 rounded">?</span>
          </div>
        </Sidebar>

        {/* Dashboard Frame Content */}
        <SidebarInset className="relative z-10 flex min-w-0 flex-1 flex-col bg-transparent">
          
          {/* Header Bar */}
          <header className="flex h-13.5 items-center justify-between border-b border-border bg-background/70 px-4 backdrop-blur-xl select-none">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer" />
              <div className="h-3.5 w-px bg-border" />
              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-[#69d1a7] animate-pulse" />
                Active Node: vps-us-east-1
              </span>
            </div>

            {/* Breadcrumb Info / Deploy trigger */}
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => router.push("/deploy")}
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-primary/30 bg-primary px-3 text-xs font-medium text-primary-foreground shadow-[0_0_24px_rgba(143,153,255,.22)] hover:bg-primary/90"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span>Deploy service</span>
                <Kbd className="ml-1 h-3.5 rounded-sm border-0 bg-background/20 px-1 font-mono text-[11px] text-primary-foreground">C</Kbd>
              </Button>
            </div>
          </header>

          {/* Subheader Filter/View Toggle Bar (Visible under Apps navigation) */}
          {currentNav === "apps" && (
            <div className="flex flex-col justify-between gap-2 border-b border-border bg-background/54 px-4 py-2 text-sm backdrop-blur-xl sm:flex-row sm:items-center select-none">
              
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/25 px-2 py-1">
                  <SearchIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by name..."
                    className="bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/60 w-32 focus:w-44 transition-all duration-200"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="cursor-pointer text-muted-foreground hover:text-foreground">
                      <XIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center overflow-hidden rounded-md border border-border bg-muted/15">
                <button 
                  onClick={() => setStatusFilter("all")}
                    className={`px-2.5 py-1 transition-all cursor-pointer ${statusFilter === "all" ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent"}`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setStatusFilter("running")}
                    className={`px-2.5 py-1 border-l border-border transition-all cursor-pointer ${statusFilter === "running" ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent"}`}
                  >
                    Running
                  </button>
                  <button 
                    onClick={() => setStatusFilter("building")}
                    className={`px-2.5 py-1 border-l border-border transition-all cursor-pointer ${statusFilter === "building" ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent"}`}
                  >
                    Building
                  </button>
                  <button 
                    onClick={() => setStatusFilter("stopped")}
                    className={`px-2.5 py-1 border-l border-border transition-all cursor-pointer ${statusFilter === "stopped" ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent"}`}
                  >
                    Paused
                  </button>
                </div>
              </div>

              {/* View Switches */}
              <div className="ml-auto flex items-center overflow-hidden rounded-md border border-border bg-muted/15">
                <button 
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 cursor-pointer transition-all ${
                    viewMode === "list" ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ListIcon className="h-3.5 w-3.5" />
                  <span>List</span>
                </button>
                <button 
                  onClick={() => setViewMode("board")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 border-l border-border cursor-pointer transition-all ${
                    viewMode === "board" ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGridIcon className="h-3.5 w-3.5" />
                  <span>Board</span>
                </button>
              </div>

            </div>
          )}

          {/* Main Dashboard Space */}
          <main className="relative flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
            
            {/* Nav: Applications */}
            {currentNav === "apps" && (
              <div className="space-y-4">
                
                {/* List View */}
                {viewMode === "list" && (
                  <div className="overflow-hidden rounded-lg border border-border bg-card/72 backdrop-blur-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border/80 bg-muted/20 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4">Application</th>
                          <th className="py-2.5 px-4">Git Repository</th>
                          <th className="py-2.5 px-4">Branch</th>
                          <th className="py-2.5 px-4">Active Port</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredApps.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                              No matching applications found. Click &quot;Deploy service&quot; to launch one.
                            </td>
                          </tr>
                        ) : (
                          filteredApps.map((app) => (
                            <tr 
                              key={app.id} 
                              onClick={() => { setSelectedApp(app); setShowDetailDrawer(true); }}
                              className="group cursor-pointer border-b border-border/45 text-sm transition-colors duration-150 hover:bg-accent/45"
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {renderStatusDot(app.status)}
                                  <span className="text-xs text-muted-foreground uppercase font-mono">{app.status}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-semibold text-foreground group-hover:text-primary transition-colors">
                                {app.name}
                              </td>
                              <td className="py-3 px-4 text-muted-foreground font-mono text-xs max-w-xs truncate">
                                {app.gitRepo}
                              </td>
                              <td className="py-3 px-4">
                                <div className="inline-flex items-center gap-1 text-xs font-mono bg-muted/40 border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                                  <GitBranchIcon className="h-3 w-3" />
                                  {app.branch}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                                {app.port}
                              </td>
                              <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="inline-flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                  {app.status === "running" ? (
                                    <Button 
                                      onClick={() => handleTogglePause(app.id, "stop")}
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 cursor-pointer"
                                      aria-label="Pause Container"
                                    >
                                      <SquareIcon className="h-3 w-3" />
                                    </Button>
                                  ) : app.status === "stopped" ? (
                                    <Button 
                                      onClick={() => handleTogglePause(app.id, "start")}
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                                      aria-label="Start Container"
                                    >
                                      <PlayIcon className="h-3 w-3" />
                                    </Button>
                                  ) : (
                                    <Button disabled variant="ghost" size="icon" className="h-6 w-6 opacity-30">
                                      <SquareIcon className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button 
                                    onClick={() => {
                                      setSelectedApp(app);
                                      setCurrentNav("logs");
                                      connectLogsStream(app.id);
                                    }}
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/45 cursor-pointer"
                                    aria-label="View Logs"
                                  >
                                    <TerminalIcon className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    onClick={() => openDeleteModal(app)}
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                                    aria-label="Delete Container"
                                  >
                                    <Trash2Icon className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Board View */}
                {viewMode === "board" && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start select-none">
                    
                    {/* Columns definition */}
                    {[
                      { id: "building", label: "Building", color: "bg-[#e7be75]" },
                      { id: "running", label: "Running", color: "bg-[#69d1a7]" },
                      { id: "stopped", label: "Paused", color: "bg-muted-foreground/55" },
                      { id: "failed", label: "Failed", color: "bg-[#f26d78]" }
                    ].map((col) => {
                      const colApps = filteredApps.filter(app => app.status === col.id)
                      return (
                        <div key={col.id} className="flex min-h-[400px] flex-col space-y-3 rounded-lg border border-border/70 bg-card/55 p-3 backdrop-blur-xl">
                          <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${col.color}`} />
                              <span className="text-sm font-semibold text-foreground capitalize">{col.label}</span>
                            </div>
                            <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-sm">{colApps.length}</span>
                          </div>

                          <div className="flex flex-col gap-2">
                            {colApps.length === 0 ? (
                              <div className="border border-dashed border-border/50 rounded-md py-6 text-center text-xs text-muted-foreground/60">
                                No services
                              </div>
                            ) : (
                              colApps.map(app => (
                                <Card 
                                  key={app.id}
                                  onClick={() => { setSelectedApp(app); setShowDetailDrawer(true); }}
                                  className="group cursor-pointer space-y-3 border-border/80 bg-background/55 p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/45 hover:bg-accent/20 hover:shadow-[0_14px_34px_rgba(0,0,0,.16)]"
                                >
                                  <div className="flex justify-between items-start">
                                    <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{app.name}</span>
                                    <span className="text-[11px] font-mono text-muted-foreground bg-muted/40 px-1.5 rounded">{app.port}</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground/80 font-mono block truncate">{app.gitRepo}</span>
                                  
                                  <div className="flex items-center justify-between pt-2.5 border-t border-border/40 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1 font-mono">
                                      <GitBranchIcon className="h-3 w-3" />
                                      {app.branch}
                                    </span>
                                    <span className="text-[11px]">{new Date(app.createdAt).toLocaleDateString()}</span>
                                  </div>
                                </Card>
                              ))
                            )}
                          </div>
                        </div>
                      )
                    })}

                  </div>
                )}

              </div>
            )}

            {/* Nav: Metrics */}
            {currentNav === "metrics" && (
              <div className="space-y-6">
                
                {/* Real-time stats header widgets */}
                <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="space-y-3 border-border bg-card/72 p-4 shadow-[0_18px_64px_rgba(0,0,0,.12)] backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CPU Core Load</span>
                      <CpuIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold font-mono">{stats.cpuUsage.toFixed(1)}%</span>
                      {renderSparkline(cpuHistory, "#8f99ff", "#6874e8")}
                    </div>
                    <Progress value={stats.cpuUsage} className="h-1 bg-muted">
                      <ProgressIndicator className="bg-primary" />
                    </Progress>
                  </Card>

                  <Card className="space-y-3 border-border bg-card/72 p-4 shadow-[0_18px_64px_rgba(0,0,0,.12)] backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Memory Buffer</span>
                      <ServerIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold font-mono">{stats.memoryUsage.toFixed(1)}%</span>
                      {renderSparkline(memHistory, "#8f99ff", "#ee7e96")}
                    </div>
                    <Progress value={stats.memoryUsage} className="h-1 bg-muted">
                      <ProgressIndicator className="bg-primary" />
                    </Progress>
                  </Card>

                  <Card className="space-y-3 border-border bg-card/72 p-4 shadow-[0_18px_64px_rgba(0,0,0,.12)] backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Disk Capacity</span>
                      <HardDriveIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold font-mono">{stats.diskUsage}%</span>
                      <span className="text-xs font-mono text-[#69d1a7] font-medium">SSD HEALTH: OPTIMAL</span>
                    </div>
                    <Progress value={stats.diskUsage} className="h-1 bg-muted">
                      <ProgressIndicator className="bg-primary" />
                    </Progress>
                  </Card>

                  <Card className="space-y-3 border-border bg-card/72 p-4 shadow-[0_18px_64px_rgba(0,0,0,.12)] backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Runtimes</span>
                      <GlobeIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold font-mono">{stats.activeApps} / {apps.length}</span>
                      <span className="text-xs font-mono text-[#69d1a7] font-medium flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#69d1a7] animate-pulse" />
                        PROXY UP
                      </span>
                    </div>
                    <Progress value={(stats.activeApps / Math.max(apps.length, 1)) * 100} className="h-1 bg-muted">
                      <ProgressIndicator className="bg-primary" />
                    </Progress>
                  </Card>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-border bg-card/72 shadow-[0_18px_64px_rgba(0,0,0,.10)] backdrop-blur-xl">
                    <CardHeader className="pb-3 border-b border-border/40">
                      <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold">Host Load Average</CardTitle>
                      <CardDescription className="text-xs">Real-time load statistics mapped from Host Hypervisor daemon.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64 flex flex-col items-center justify-center text-sm text-muted-foreground space-y-2">
                      <SlidersHorizontalIcon className="h-6 w-6 opacity-30 animate-pulse" />
                      <span>Diagnostics visualization running under normal nodes.</span>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-border bg-card/72 shadow-[0_18px_64px_rgba(0,0,0,.10)] backdrop-blur-xl">
                    <CardHeader className="pb-3 border-b border-border/40">
                      <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold">Network I/O Streams</CardTitle>
                      <CardDescription className="text-xs">Dynamic tracking of incoming and outgoing proxy packet pipelines.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64 flex flex-col items-center justify-center text-xs text-muted-foreground space-y-2">
                      <ActivityIcon className="h-6 w-6 opacity-30 animate-pulse" />
                      <span>Traffic routing pipelines reporting healthy status.</span>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Nav: Logs Console */}
            {currentNav === "logs" && (
              <Card className="flex min-h-[500px] flex-col border-border bg-card/72 shadow-[0_18px_64px_rgba(0,0,0,.12)] backdrop-blur-xl">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
                  <div>
                    <CardTitle className="text-sm font-bold tracking-tight">
                      {selectedApp ? `Log Output: ${selectedApp.name}` : "System Build Pipeline Log Output"}
                    </CardTitle>
                    <CardDescription className="text-xs">Terminal console logs streamed via WebSocket.</CardDescription>
                  </div>
                  {selectedApp && selectedApp.status === "building" && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-500 font-mono animate-pulse">
                      <RefreshCwIcon className="h-3.5 w-3.5 animate-spin" />
                      analyzing project buildpacks...
                    </span>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col bg-[#090a0f] p-0">
                  <div className="p-4 font-mono text-xs text-slate-100 h-[450px] overflow-y-auto space-y-1.5 leading-relaxed">
                    {logs.length === 0 ? (
                      <div className="text-slate-400 italic h-full flex flex-col items-center justify-center gap-2 select-none">
                        <TerminalIcon className={`h-6 w-6 opacity-45 ${logsConnected ? "animate-pulse" : ""}`} />
                        {selectedApp ? (
                          logsConnected ? (
                            <span>Connected — waiting for log output...</span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <RefreshCwIcon className="h-3.5 w-3.5 animate-spin" />
                              Connecting to log stream...
                            </span>
                          )
                        ) : (
                          <span>No active container selected. Click the terminal icon on a service to view logs.</span>
                        )}
                      </div>
                    ) : (
                      logs.map((log, index) => (
                        <div key={index} className="flex gap-4">
                          <span className="text-slate-500 select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                          <span className={
                            (log.message || "").startsWith("Initializing") || (log.message || "").startsWith("Launching") ? "text-[#93e0c0] font-semibold" :
                            (log.message || "").startsWith("✖") || (log.message || "").includes("Error") ? "text-rose-400 font-semibold" : "text-slate-100"
                          }>
                            {log.message}
                          </span>
                        </div>
                      ))
                    )}
                    <div ref={logTerminalEndRef} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Nav: Settings */}
            {currentNav === "settings" && (
              <Card className="max-w-xl border-border bg-card/72 shadow-[0_18px_64px_rgba(0,0,0,.12)] backdrop-blur-xl">
                <CardHeader className="border-b border-border/40">
                  <CardTitle className="text-sm font-bold">Node configuration</CardTitle>
                  <CardDescription className="text-xs">Manage system configurations for local worker daemon environment.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Proxy Timeout Limits</Label>
                    <Input defaultValue="30s" className="bg-background border-border text-foreground text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Builder Worker Limit Threads</Label>
                    <Input defaultValue="2" className="bg-background border-border text-foreground text-sm" />
                  </div>
                  <div className="pt-2">
                    <Button className="h-8 cursor-pointer rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                      Save configurations
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sliding Drawer details panel (Linear style side pane) */}
            <AppDetailDrawer
              app={selectedApp}
              isOpen={showDetailDrawer}
              onClose={() => setShowDetailDrawer(false)}
              onTogglePause={handleTogglePause}
              onDelete={handleDeleteApp}
              onViewLogs={(app) => {
                setSelectedApp(app)
                setCurrentNav("logs")
                connectLogsStream(app.id)
              }}
              onUpdateAppList={fetchApps}
              stats={stats}
            />

            {/* Delete confirmation modal (table-level) */}
            <DeleteConfirmModal
              isOpen={!!deleteTarget}
              appName={deleteTarget?.name ?? ""}
              onConfirm={() => handleDeleteApp(deleteTarget!.id)}
              onCancel={() => setDeleteTarget(null)}
            />

            {/* Custom Keyboard Shortcuts Guide modal overlay */}
            {showShortcuts && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div 
                  className="fixed inset-0 cursor-pointer"
                  onClick={() => setShowShortcuts(false)}
                />
                <div className="relative w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card/95 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-1.5">
                      <KeyboardIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-base">Keyboard Shortcuts Cheat Sheet</span>
                    </div>
                    <button 
                      onClick={() => setShowShortcuts(false)}
                      className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-4 max-h-[400px] overflow-y-auto">
                    
                    {/* Column 1: Navigation */}
                    <div className="space-y-3.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Navigation</span>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Applications</span>
                        <div className="flex items-center gap-0.5">
                          <Kbd>g</Kbd><Kbd>a</Kbd>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Node Health</span>
                        <div className="flex items-center gap-0.5">
                          <Kbd>g</Kbd><Kbd>m</Kbd>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Live Logs</span>
                        <div className="flex items-center gap-0.5">
                          <Kbd>g</Kbd><Kbd>l</Kbd>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Node Settings</span>
                        <div className="flex items-center gap-0.5">
                          <Kbd>g</Kbd><Kbd>s</Kbd>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Actions & Views */}
                    <div className="space-y-3.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Actions & Views</span>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Deploy Service</span>
                        <Kbd>c</Kbd>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Command palette</span>
                        <div className="flex items-center gap-0.5">
                          <Kbd>⌘</Kbd><Kbd>K</Kbd>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Switch to List View</span>
                        <div className="flex items-center gap-0.5">
                          <Kbd>v</Kbd><Kbd>l</Kbd>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Switch to Board View</span>
                        <div className="flex items-center gap-0.5">
                          <Kbd>v</Kbd><Kbd>b</Kbd>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Toggle Dark Theme</span>
                        <Kbd>d</Kbd>
                      </div>
                    </div>

                  </div>
                  
                  <div className="bg-muted/30 px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>Press <kbd className="font-mono bg-muted px-1 rounded text-foreground">Esc</kbd> to close any overlay panel</span>
                    <HelpCircleIcon className="h-3.5 w-3.5 opacity-55" />
                  </div>
                </div>
              </div>
            )}

            {/* Custom Command Palette overlay */}
            {showCommandPalette && (
              <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh] bg-black/60 backdrop-blur-sm">
                <div 
                  className="fixed inset-0 cursor-pointer"
                  onClick={() => setShowCommandPalette(false)}
                />
                
                <div className="relative w-full max-w-lg overflow-hidden rounded-lg border border-border bg-popover/95 shadow-2xl backdrop-blur-xl animate-in zoom-in-98 duration-150">
                  
                  {/* Search Input */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                    <SearchIcon className="h-4 w-4 text-muted-foreground" />
                    <input
                      autoFocus
                      value={commandQuery}
                      onChange={(e) => {
                        setCommandQuery(e.target.value);
                        setActiveCommandIndex(0);
                      }}
                      placeholder="Type a command or search..."
                      className="w-full bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/60 text-foreground"
                    />
                    <div className="flex h-5 w-5 items-center justify-center rounded border border-border text-[9px] text-muted-foreground font-mono bg-muted/40 select-none">
                      Esc
                    </div>
                  </div>

                  {/* List of actions */}
                  <div className="py-2 max-h-[280px] overflow-y-auto">
                    {filteredCommands.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                        No commands matching your query.
                      </div>
                    ) : (
                      filteredCommands.map((cmd, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            cmd.action();
                            setShowCommandPalette(false);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-2 text-xs text-left cursor-pointer transition-colors ${
                            idx === activeCommandIndex 
                              ? "bg-muted text-foreground font-semibold" 
                              : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                          }`}
                        >
                          <span>{cmd.label}</span>
                          <span className="font-mono text-[9px] text-muted-foreground/80 bg-muted/50 border border-border/80 px-1 rounded">
                            {cmd.shortcut}
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Command Footer hints */}
                  <div className="bg-muted/30 px-4 py-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground select-none">
                    <div className="flex items-center gap-1.5">
                      <span>↑↓ to navigate</span>
                      <span className="h-3 w-px bg-border" />
                      <span>Enter to select</span>
                    </div>
                    <span>Command palette</span>
                  </div>

                </div>
              </div>
            )}



          </main>
        </SidebarInset>

      </div>

      {/* Local Toast UI Notification overlay */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`p-3.5 rounded-lg border shadow-2xl transition-all duration-300 pointer-events-auto flex justify-between items-start gap-3.5 ${
              t.type === "destructive"
                ? "bg-[#f26d78]/10 border-[#f26d78] text-[#ffc9cf]"
                : "bg-card/95 border-border text-foreground backdrop-blur-xl"
            }`}
          >
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold leading-none">{t.title}</h4>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{t.description}</p>
            </div>
            <button 
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-muted-foreground/60 hover:text-foreground cursor-pointer"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </SidebarProvider>
  )
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b0c10] text-[#f1f3f9] flex flex-col items-center justify-center font-mono text-xs gap-3">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Initializing Hypervisor Dashboard...</span>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
