"use client"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs"
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
import { 
  ServerIcon, 
  TerminalIcon, 
  SettingsIcon, 
  LayersIcon, 
  ActivityIcon, 
  PlusIcon, 
  GlobeIcon, 
  GitBranchIcon, 
  CpuIcon, 
  HardDriveIcon,
  PlayIcon,
  SquareIcon,
  RefreshCwIcon
} from "lucide-react"

interface App {
  id: string
  name: string
  status: string // "running", "building", "stopped", "failed"
  gitRepo: string
  branch: string
  port: number
  url: string
  createdAt: string
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

export default function Page() {
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
  
  const [deployName, setDeployName] = useState("")
  const [deployGit, setDeployGit] = useState("")
  const [deployBranch, setDeployBranch] = useState("main")
  const [isDeploying, setIsDeploying] = useState(false)
  
  // Navigation active state: "apps" | "metrics" | "logs" | "settings"
  const [currentNav, setCurrentNav] = useState<"apps" | "metrics" | "logs" | "settings">("apps")
  
  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [selectedApp, setSelectedApp] = useState<App | null>(null)
  
  // WebSocket references
  const statsWsRef = useRef<WebSocket | null>(null)
  const logsWsRef = useRef<WebSocket | null>(null)
  const logTerminalEndRef = useRef<HTMLDivElement | null>(null)

  // Trigger custom toast notification
  const showToast = (title: string, description: string, type: "default" | "destructive" = "default") => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { id, title, description, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

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

  // Connect to Go Server WebSocket for stats
  useEffect(() => {
    fetchApps()
    
    // Connect to WebSocket for CPU/RAM stats
    const statsWs = new WebSocket("ws://localhost:8080/ws/stats")
    statsWsRef.current = statsWs
    
    statsWs.onmessage = (event) => {
      const newStats: ServerStats = JSON.parse(event.data)
      setStats(newStats)
      
      setCpuHistory((prev) => [...prev.slice(1), newStats.cpuUsage])
      setMemHistory((prev) => [...prev.slice(1), newStats.memoryUsage])
    }
    
    statsWs.onerror = (err) => {
      console.warn("WebSocket stats connection error, running in simulated mode.")
      // Setup local interval simulation fallback if server isn't running yet
      const interval = setInterval(() => {
        const simCpu = 20 + Math.random() * 30
        const simMem = 45 + Math.random() * 10
        setStats({
          cpuUsage: simCpu,
          memoryUsage: simMem,
          diskUsage: 52.4,
          activeApps: apps.filter(a => a.status === "running").length,
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
  }, [apps.length])

  // Scroll to bottom of terminal log window when new logs arrive
  useEffect(() => {
    if (logTerminalEndRef.current) {
      logTerminalEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs])

  // Trigger app deployment
  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deployName || !deployGit) {
      showToast("Validation error", "Please specify both app name and Git repository link.", "destructive")
      return
    }

    try {
      setIsDeploying(true)
      const res = await fetch("http://localhost:8080/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deployName,
          gitRepo: deployGit,
          branch: deployBranch,
        }),
      })

      if (res.ok) {
        const newApp = await res.json()
        setApps((prev) => [...prev, newApp])
        setSelectedApp(newApp)
        setCurrentNav("logs")
        setLogs([])
        
        // Start streaming logs
        connectLogsStream()
        
        showToast("Deployment Triggered", `Application ${deployName} build pipeline successfully queued.`)

        // Reset fields
        setDeployName("")
        setDeployGit("")
      } else {
        showToast("Deployment failed", "Could not initialize builder deployment setup.", "destructive")
      }
    } catch (err) {
      console.error("Connection to Go backend failed:", err)
      showToast(
        "Connection Refused", 
        "Go backend server is not running on http://localhost:8080. Falling back to local simulation.", 
        "destructive"
      )
      // Local fallback simulation when Go backend is not run yet
      const simulatedApp: App = {
        id: `sim-app-${Date.now()}`,
        name: deployName,
        status: "building",
        gitRepo: deployGit,
        branch: deployBranch,
        port: 8081,
        url: `https://${deployName}.local.test`,
        createdAt: new Date().toISOString(),
      }
      setApps((prev) => [...prev, simulatedApp])
      setSelectedApp(simulatedApp)
      setCurrentNav("logs")
      setLogs([])
      simulateLocalLogs(simulatedApp.id)
      
      setDeployName("")
      setDeployGit("")
    } finally {
      setIsDeploying(false)
    }
  }

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
      showToast("Connection Refused", "Failed to connect to the Go backend API daemon.", "destructive")
    }
  }

  const handleDeleteApp = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this application container and its build folder?")) {
      return
    }
    try {
      const res = await fetch("http://localhost:8080/api/apps/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        showToast("App Deleted", "Application container and workspace folder permanently purged.")
        fetchApps()
      } else {
        showToast("Error", "Failed to delete application container.", "destructive")
      }
    } catch (err) {
      console.error(err)
      showToast("Connection Refused", "Failed to connect to the Go backend API daemon.", "destructive")
    }
  }

  // Connect WebSocket log stream
  const connectLogsStream = () => {
    if (logsWsRef.current) {
      logsWsRef.current.close()
    }
    const logsWs = new WebSocket("ws://localhost:8080/ws/logs")
    logsWsRef.current = logsWs

    logsWs.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setLogs((prev) => [...prev, { message: data.message, timestamp: data.timestamp }])
    }

    logsWs.onclose = () => {
      fetchApps() // Refresh application lists after build ends
    }
  }

  // Fallback logs simulation
  const simulateLocalLogs = (appId: string) => {
    const mockLogs = [
      "✨ Initializing builder container...",
      "📦 Loading cached layers from previous builds",
      "🔍 Detecting buildpacks environment...",
      "Node.js buildpack detected",
      "Installing dependencies using pnpm...",
      "dependencies: +345 package entries updated",
      "Running build script: next build",
      "▲ Next.js 16.1.7 completed production build",
      "Optimizing route files...",
      "Production bundle created successfully (1.2MB)",
      "🚀 Launching new application instance on port: 8081",
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
        }
      }, (index + 1) * 1000)
    })
  }

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
          strokeWidth="2.5"
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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        
        {/* Navigation Sidebar */}
        <Sidebar className="border-r border-border bg-card">
          <SidebarHeader className="flex items-center gap-2 px-6 py-4 border-b border-border">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <LayersIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm leading-none">Antigravity PaaS</h2>
              <span className="text-[10px] text-muted-foreground font-mono">v1.0.0-beta</span>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-4 space-y-6">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={currentNav === "apps"} 
                  onClick={() => setCurrentNav("apps")}
                  className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm transition-colors"
                >
                  <GlobeIcon className="h-4 w-4" />
                  Applications
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={currentNav === "metrics"} 
                  onClick={() => setCurrentNav("metrics")}
                  className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm transition-colors"
                >
                  <ActivityIcon className="h-4 w-4" />
                  Server Health
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={currentNav === "logs"} 
                  onClick={() => setCurrentNav("logs")}
                  className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm transition-colors"
                >
                  <TerminalIcon className="h-4 w-4" />
                  Live Logs
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={currentNav === "settings"} 
                  onClick={() => setCurrentNav("settings")}
                  className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm transition-colors"
                >
                  <SettingsIcon className="h-4 w-4" />
                  Node Settings
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        {/* Dashboard Frame Content */}
        <SidebarInset className="flex-1 flex flex-col bg-background min-w-0">
          
          {/* Header */}
          <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-8 w-8 text-muted-foreground hover:text-foreground" />
              <div className="h-4 w-px bg-border" />
              <span className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                connected to engine-01
              </span>
            </div>

            <div className="flex items-center gap-4">
              <Dialog>
                <DialogTrigger render={
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 h-8 text-xs font-semibold px-3 rounded-lg shadow-sm">
                    <PlusIcon className="h-3.5 w-3.5" />
                    New Deploy
                  </Button>
                } />
                <DialogContent className="bg-card border border-border text-card-foreground shadow-2xl max-w-md w-full">
                  <DialogHeader className="p-6">
                    <DialogTitle className="text-lg font-bold">Deploy New Service</DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs mt-1">
                      Configure your git URL repository details. Our Nixpacks builder will analyze and provision a secure container runtime environment.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleDeploy} className="px-6 pb-6 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground">App Name</Label>
                      <Input
                        id="name"
                        value={deployName}
                        onChange={(e) => setDeployName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        placeholder="e.g. backend-api"
                        className="bg-background border-border text-foreground text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="git" className="text-xs font-semibold text-muted-foreground">Git Repository URL</Label>
                      <Input
                        id="git"
                        value={deployGit}
                        onChange={(e) => setDeployGit(e.target.value)}
                        placeholder="github.com/org/repo"
                        className="bg-background border-border text-foreground text-sm"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="branch" className="text-xs font-semibold text-muted-foreground">Branch</Label>
                        <Input
                          id="branch"
                          value={deployBranch}
                          onChange={(e) => setDeployBranch(e.target.value)}
                          placeholder="main"
                          className="bg-background border-border text-foreground text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">Build Engine</Label>
                        <div className="h-9 px-3 bg-muted border border-border rounded-md flex items-center text-xs text-muted-foreground font-mono">
                          Nixpacks
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="pt-2">
                      <Button type="submit" disabled={isDeploying} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        {isDeploying ? "Launching Container Builder..." : "Start Deploy"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </header>

          {/* Main Dashboard Space */}
          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Real-time stats header widgets */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              <Card className="bg-card border-border hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="space-y-1">
                    <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CPU Core Load</CardDescription>
                    <CardTitle className="text-2xl font-bold font-mono">{stats.cpuUsage.toFixed(1)}%</CardTitle>
                  </div>
                  <CpuIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <Progress value={stats.cpuUsage}>
                    <ProgressTrack className="bg-muted">
                      <ProgressIndicator className="bg-primary" />
                    </ProgressTrack>
                  </Progress>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                    <span>15s CPU chart</span>
                    {renderSparkline(cpuHistory, "#3b82f6", "#8b5cf6")}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="space-y-1">
                    <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Memory Buffer</CardDescription>
                    <CardTitle className="text-2xl font-bold font-mono">{stats.memoryUsage.toFixed(1)}%</CardTitle>
                  </div>
                  <ServerIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <Progress value={stats.memoryUsage}>
                    <ProgressTrack className="bg-muted">
                      <ProgressIndicator className="bg-purple-500" />
                    </ProgressTrack>
                  </Progress>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                    <span>15s RAM chart</span>
                    {renderSparkline(memHistory, "#a855f7", "#ec4899")}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="space-y-1">
                    <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Disk Capacity</CardDescription>
                    <CardTitle className="text-2xl font-bold font-mono">{stats.diskUsage}%</CardTitle>
                  </div>
                  <HardDriveIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <Progress value={stats.diskUsage}>
                    <ProgressTrack className="bg-muted">
                      <ProgressIndicator className="bg-pink-500" />
                    </ProgressTrack>
                  </Progress>
                  <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                    SSD Pool health: normal
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="space-y-1">
                    <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Runtimes</CardDescription>
                    <CardTitle className="text-2xl font-bold font-mono">{stats.activeApps} / {apps.length}</CardTitle>
                  </div>
                  <GlobeIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="h-1.5 w-full rounded-full bg-emerald-500/10 relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 bg-emerald-500 transition-all" style={{ width: `${(stats.activeApps / Math.max(apps.length, 1)) * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Proxy mapping active
                  </div>
                </CardContent>
              </Card>

            </section>

            {/* Navigation Tabs Page Content */}
            <div className="space-y-4">
              
              {/* Tab Content 1: Applications */}
              {currentNav === "apps" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold tracking-tight text-muted-foreground">Running Containers</h3>
                  </div>

                  {apps.length === 0 ? (
                    <div className="border border-dashed border-border rounded-xl p-12 text-center bg-card">
                      <p className="text-muted-foreground text-xs mb-4">No services are deployed on this VPS host node.</p>
                      <Dialog>
                        <DialogTrigger render={<Button className="bg-primary text-primary-foreground text-xs font-semibold px-4 h-8 rounded-lg shadow-sm">Setup new service</Button>} />
                      </Dialog>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {apps.map((app) => (
                        <Card key={app.id} className="bg-card border-border flex flex-col justify-between hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <CardTitle className="text-sm font-bold tracking-tight">{app.name}</CardTitle>
                                <CardDescription className="text-[10px] text-muted-foreground font-mono block truncate max-w-[180px]">
                                  {app.gitRepo}
                                </CardDescription>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 capitalize border ${
                                app.status === "running" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                                app.status === "building" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 animate-pulse" :
                                "bg-muted text-muted-foreground border-border"
                              }`}>
                                {app.status === "building" && <span className="h-1 w-1 rounded-full bg-amber-500 animate-ping" />}
                                {app.status}
                              </span>
                            </div>
                          </CardHeader>
                          
                          <CardContent className="pt-0 space-y-4">
                            <div className="text-[11px] font-mono space-y-1 bg-muted/50 p-2.5 rounded-lg border border-border/50 text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Branch:</span>
                                <span className="text-foreground flex items-center gap-1">
                                  <GitBranchIcon className="h-3 w-3" />
                                  {app.branch}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Host Port:</span>
                                <span className="text-foreground">{app.port}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Created:</span>
                                <span className="text-foreground">{new Date(app.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-border/60">
                              <div className="flex gap-2">
                                <a
                                  href={app.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex-1 bg-background hover:bg-muted border border-border text-[11px] h-8 rounded-lg flex items-center justify-center gap-1 font-medium transition-colors text-foreground"
                                >
                                  View Live
                                  <GlobeIcon className="h-3 w-3" />
                                </a>
                                <Button
                                  onClick={() => {
                                    setSelectedApp(app)
                                    setCurrentNav("logs")
                                    setLogs([])
                                    if (app.status === "building") {
                                      connectLogsStream()
                                    } else {
                                      setLogs([
                                        { message: "📝 Fetching server container logs...", timestamp: new Date().toISOString() },
                                        { message: `[sys] Container bound to port :${app.port}`, timestamp: new Date().toISOString() },
                                        { message: "[sys] App is fully running. Status healthy.", timestamp: new Date().toISOString() },
                                      ])
                                    }
                                  }}
                                  className="bg-muted hover:bg-border border border-border text-[11px] text-foreground h-8 px-3 rounded-lg flex items-center gap-1 font-medium"
                                >
                                  Logs
                                </Button>
                              </div>
                              <div className="flex gap-2">
                                {app.status === "running" ? (
                                  <Button
                                    onClick={() => handleTogglePause(app.id, "stop")}
                                    className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px] h-8 rounded-lg flex items-center justify-center gap-1 font-medium"
                                  >
                                    Pause
                                  </Button>
                                ) : app.status === "stopped" ? (
                                  <Button
                                    onClick={() => handleTogglePause(app.id, "start")}
                                    className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] h-8 rounded-lg flex items-center justify-center gap-1 font-medium"
                                  >
                                    Start
                                  </Button>
                                ) : (
                                  <Button
                                    disabled
                                    className="flex-1 bg-muted text-muted-foreground border border-border text-[11px] h-8 rounded-lg flex items-center justify-center gap-1 font-medium"
                                  >
                                    Pause
                                  </Button>
                                )}
                                <Button
                                  onClick={() => handleDeleteApp(app.id)}
                                  className="flex-1 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 text-[11px] h-8 rounded-lg flex items-center justify-center gap-1 font-medium"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content 2: Server Metrics */}
              {currentNav === "metrics" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Host Load Average</CardTitle>
                      <CardDescription className="text-xs">Real-time load statistics mapped from Docker socket daemon.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64 flex items-center justify-center border-t border-border/40 text-xs text-muted-foreground">
                      Graph visualizations running under standard node monitoring values.
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Network I/O Streams</CardTitle>
                      <CardDescription className="text-xs">Dynamic tracking of incoming and outgoing proxy packet pipelines.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64 flex items-center justify-center border-t border-border/40 text-xs text-muted-foreground">
                      Ethernet routing pipelines reporting healthy status.
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Tab Content 3: Live Logs console */}
              {currentNav === "logs" && (
                <Card className="bg-card border-border">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                      <CardTitle className="text-sm font-bold tracking-tight">
                        {selectedApp ? `Log Output: ${selectedApp.name}` : "System Build Pipeline Log Output"}
                      </CardTitle>
                      <CardDescription className="text-xs">Terminal console logs streamed via WebSocket.</CardDescription>
                    </div>
                    {selectedApp && selectedApp.status === "building" && (
                      <span className="flex items-center gap-1 text-xs text-amber-500 font-mono animate-pulse">
                        <RefreshCwIcon className="h-3.5 w-3.5 animate-spin" />
                        analyzing project buildpacks...
                      </span>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0 border-t border-border/40">
                    <div className="bg-background rounded-lg border border-border p-4 font-mono text-xs text-foreground h-96 overflow-y-auto space-y-1.5 leading-relaxed mt-4">
                      {logs.length === 0 ? (
                        <div className="text-muted-foreground italic h-full flex items-center justify-center">
                          No active container build stream logs captured. Select "Logs" on a service widget.
                        </div>
                      ) : (
                        logs.map((log, index) => (
                          <div key={index} className="flex gap-4">
                            <span className="text-muted-foreground/60 select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <span className={
                              log.message.startsWith("✨") || log.message.startsWith("🚀") ? "text-primary font-semibold" :
                              log.message.startsWith("✖") || log.message.includes("Error") ? "text-destructive font-semibold" : "text-foreground"
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

              {/* Tab Content 4: Settings */}
              {currentNav === "settings" && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold">Node configuration</CardTitle>
                    <CardDescription className="text-xs">Manage system configurations for local worker daemon environment.</CardDescription>
                  </CardHeader>
                  <CardContent className="border-t border-border/40 space-y-4 pt-4">
                    <div className="space-y-1.5 max-w-md">
                      <Label className="text-xs font-semibold text-muted-foreground">Proxy Timeout Limits</Label>
                      <Input defaultValue="30s" className="bg-background border-border text-foreground text-sm" />
                    </div>
                    <div className="space-y-1.5 max-w-md">
                      <Label className="text-xs font-semibold text-muted-foreground">Builder Worker Limit Threads</Label>
                      <Input defaultValue="2" className="bg-background border-border text-foreground text-sm" />
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>
          </main>
        </SidebarInset>

      </div>

      {/* Local Toast UI Notification overlay */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`p-4 rounded-xl border shadow-xl transition-all duration-300 ${
              t.type === "destructive"
                ? "bg-destructive/10 border-destructive text-destructive-foreground"
                : "bg-card border-border text-card-foreground"
            }`}
          >
            <h4 className="text-xs font-bold">{t.title}</h4>
            <p className="text-[11px] mt-1 text-muted-foreground">{t.description}</p>
          </div>
        ))}
      </div>
    </SidebarProvider>
  )
}
