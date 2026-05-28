"use client"

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { NucleoIcon } from "@/components/nucleo-icons"
import { DeleteConfirmModal } from "@/components/delete-confirm-modal"
import { AppShell, ToastContainer, useToast, StatusDot } from "@/components/app-shell"
import { api } from "@/lib/api"
import type { App, ServerStats } from "@/lib/types"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />
const GitBranchIcon = (props: IconProps) => <NucleoIcon {...props} name="branch" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />
const SquareIcon = (props: IconProps) => <NucleoIcon {...props} name="square" />
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const Trash2Icon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const SearchIcon = (props: IconProps) => <NucleoIcon {...props} name="search" />
const ListIcon = (props: IconProps) => <NucleoIcon {...props} name="list" />
const LayoutGridIcon = (props: IconProps) => <NucleoIcon {...props} name="grid" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const TrashIcon2 = (props: IconProps) => <NucleoIcon {...props} name="trash" />

function ApplicationsDashboard() {
  const router = useRouter()
  const { toasts, showToast, dismissToast } = useToast()

  const [apps, setApps] = useState<App[]>([])
  const [stats, setStats] = useState<ServerStats>({
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    activeApps: 0,
    timestamp: new Date().toISOString(),
  })
  const [viewMode, setViewMode] = useState<"list" | "board">("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteTarget, setDeleteTarget] = useState<App | null>(null)

  const appsRef = useRef<App[]>([])
  const statsWsRef = useRef<WebSocket | null>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchApps = useCallback(async () => {
    try {
      const data = await api.apps.list()
      setApps(data)
    } catch (err) {
      console.error("Failed to fetch apps", err)
    }
  }, [])

  useEffect(() => {
    appsRef.current = apps
  }, [apps])

  // ── WebSocket: Stats ───────────────────────────────────────────────────────

  useEffect(() => {
    fetchApps()

    const wsHost = typeof window !== "undefined" ? window.location.hostname : "localhost"
    const statsWs = new WebSocket(`ws://${wsHost}:8080/ws/stats`)
    statsWsRef.current = statsWs

    statsWs.onmessage = (event) => {
      const data: ServerStats = JSON.parse(event.data)
      setStats(data)
    }

    statsWs.onerror = () => {
      console.warn("Stats WebSocket error, falling back to simulation")
    }

    return () => {
      statsWs.onclose = null
      statsWs.close()
    }
  }, [fetchApps])

  // Poll while building
  useEffect(() => {
    const hasBuildingApp = apps.some((a) => a.status === "building")
    if (!hasBuildingApp) return
    const interval = setInterval(fetchApps, 2500)
    return () => clearInterval(interval)
  }, [apps, fetchApps])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statsWsRef.current) {
        statsWsRef.current.onclose = null
        statsWsRef.current.close()
      }
    }
  }, [])

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleTogglePause = async (id: string, action: "stop" | "start") => {
    try {
      if (action === "stop") {
        await api.apps.stop(id)
      } else {
        await api.apps.start(id)
      }
      showToast(
        action === "stop" ? "Container Stopped" : "Container Started",
        `Application successfully ${action === "stop" ? "stopped" : "started"}.`,
      )
      fetchApps()
    } catch (err) {
      showToast("Error", `Failed to ${action} container.`, "destructive")
      console.error(err)
    }
  }

  const handleDeleteApp = async (id: string) => {
    try {
      await api.apps.delete(id)
      showToast("App Deleted", "Application container and workspace permanently removed.")
      setDeleteTarget(null)
      fetchApps()
    } catch (err) {
      showToast("Error", "Failed to delete application.", "destructive")
      console.error(err)
    }
  }

  const handleDockerPrune = async () => {
    try {
      showToast("Pruning...", "Running docker system prune, please wait.")
      const result = await api.system.prune()
      showToast("Pruned", "Docker system prune completed successfully.")
      console.log(result.output)
    } catch (err) {
      showToast("Prune Failed", "Docker prune encountered an error.", "destructive")
      console.error(err)
    }
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.gitRepo.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || app.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <AppShell appCount={apps.length}>
      <div className="space-y-0">
        {/* Subheader toolbar */}
        <div className="flex flex-col justify-between gap-2 border-b border-border bg-background/54 px-4 py-2 text-sm backdrop-blur-xl sm:flex-row sm:items-center select-none">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/25 px-2 py-1">
              <SearchIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name..."
                className="bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/60 w-32 focus:w-44 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="flex items-center overflow-hidden rounded-md border border-border bg-muted/15">
              {["all", "running", "building", "stopped", "failed"].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-2.5 py-1 border-l first:border-l-0 border-border transition-all cursor-pointer capitalize ${
                    statusFilter === f
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground bg-transparent"
                  }`}
                >
                  {f === "all" ? "All" : f === "stopped" ? "Paused" : f}
                </button>
              ))}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Docker Prune */}
            <button
              onClick={handleDockerPrune}
              className="flex items-center gap-1.5 rounded-md border border-border bg-muted/15 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-rose-500/50 hover:bg-rose-500/5 transition-all cursor-pointer"
            >
              <TrashIcon2 className="h-3 w-3" />
              <span>Prune Docker</span>
            </button>

            {/* View toggle */}
            <div className="flex items-center overflow-hidden rounded-md border border-border bg-muted/15">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-2.5 py-1 cursor-pointer transition-all ${
                  viewMode === "list"
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ListIcon className="h-3.5 w-3.5" />
                <span>List</span>
              </button>
              <button
                onClick={() => setViewMode("board")}
                className={`flex items-center gap-1.5 px-2.5 py-1 border-l border-border cursor-pointer transition-all ${
                  viewMode === "board"
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGridIcon className="h-3.5 w-3.5" />
                <span>Board</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-4">
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
                    <th className="py-2.5 px-4">Port</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <GlobeIcon className="h-8 w-8 opacity-20" />
                          <span className="text-sm">
                            No applications yet.{" "}
                            <button
                              onClick={() => router.push("/deploy")}
                              className="text-primary hover:underline cursor-pointer"
                            >
                              Deploy your first service →
                            </button>
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredApps.map((app) => (
                      <tr
                        key={app.id}
                        onClick={() => router.push(`/app/${app.id}`)}
                        className="group cursor-pointer border-b border-border/45 text-sm transition-colors duration-150 hover:bg-accent/45"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <StatusDot status={app.status} />
                            <span className="text-xs text-muted-foreground uppercase font-mono">
                              {app.status}
                            </span>
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
                        <td
                          className="py-3 px-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            {app.status === "running" ? (
                              <Button
                                onClick={() => handleTogglePause(app.id, "stop")}
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 cursor-pointer"
                              >
                                <SquareIcon className="h-3 w-3" />
                              </Button>
                            ) : app.status === "stopped" ? (
                              <Button
                                onClick={() => handleTogglePause(app.id, "start")}
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                              >
                                <PlayIcon className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button
                                disabled
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-30"
                              >
                                <SquareIcon className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              onClick={() => router.push(`/app/${app.id}?tab=logs`)}
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/45 cursor-pointer"
                            >
                              <TerminalIcon className="h-3 w-3" />
                            </Button>
                            <Button
                              onClick={() => setDeleteTarget(app)}
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
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
              {[
                { id: "building", label: "Building", color: "bg-[#e7be75]" },
                { id: "running", label: "Running", color: "bg-[#69d1a7]" },
                { id: "stopped", label: "Paused", color: "bg-muted-foreground/55" },
                { id: "failed", label: "Failed", color: "bg-[#f26d78]" },
              ].map((col) => {
                const colApps = filteredApps.filter((a) => a.status === col.id)
                return (
                  <div
                    key={col.id}
                    className="flex min-h-[400px] flex-col space-y-3 rounded-lg border border-border/70 bg-card/55 p-3 backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${col.color}`} />
                        <span className="text-sm font-semibold text-foreground">{col.label}</span>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-sm">
                        {colApps.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {colApps.length === 0 ? (
                        <div className="border border-dashed border-border/50 rounded-md py-6 text-center text-xs text-muted-foreground/60">
                          No services
                        </div>
                      ) : (
                        colApps.map((app) => (
                          <Card
                            key={app.id}
                            onClick={() => router.push(`/app/${app.id}`)}
                            className="group cursor-pointer space-y-3 border-border/80 bg-background/55 p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/45 hover:bg-accent/20 hover:shadow-[0_14px_34px_rgba(0,0,0,.16)]"
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                {app.name}
                              </span>
                              <span className="text-[11px] font-mono text-muted-foreground bg-muted/40 px-1.5 rounded">
                                :{app.port}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground/80 font-mono block truncate">
                              {app.gitRepo}
                            </span>
                            <div className="flex items-center justify-between pt-2.5 border-t border-border/40 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1 font-mono">
                                <GitBranchIcon className="h-3 w-3" />
                                {app.branch}
                              </span>
                              <span className="text-[11px]">
                                {new Date(app.createdAt).toLocaleDateString()}
                              </span>
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
      </div>

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        appName={deleteTarget?.name ?? ""}
        onConfirm={() => deleteTarget ? handleDeleteApp(deleteTarget.id) : Promise.resolve()}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppShell>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0c10] text-[#f1f3f9] flex flex-col items-center justify-center font-mono text-xs gap-3">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Initializing Dashboard...</span>
        </div>
      }
    >
      <ApplicationsDashboard />
    </Suspense>
  )
}
