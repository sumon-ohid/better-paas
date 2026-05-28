"use client"

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { NucleoIcon } from "@/components/nucleo-icons"
import { DeleteConfirmModal } from "@/components/delete-confirm-modal"
import { AppShell, ToastContainer, useToast, StatusDot } from "@/components/app-shell"
import { api } from "@/lib/api"
import type { App, ServerStats } from "@/lib/types"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { Docker } from "@/components/ui/svgs/docker"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />
const GitBranchIcon = (props: IconProps) => <NucleoIcon {...props} name="branch" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />
const SquareIcon = (props: IconProps) => <NucleoIcon {...props} name="square" />
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const Trash2Icon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const SearchIcon = (props: IconProps) => <NucleoIcon {...props} name="search" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const TrashIcon2 = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const ExternalLinkIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const EyeIcon = (props: IconProps) => <NucleoIcon {...props} name="eye" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const MoreIcon = (props: IconProps) => <NucleoIcon {...props} name="more-horizontal" />


// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function isGitHubRepo(gitRepo: string): boolean {
  return gitRepo.includes("github.com")
}

function extractRepoName(gitRepo: string): string {
  // Handle https://github.com/owner/repo.git or github.com/owner/repo
  const cleaned = gitRepo.replace(/\.git$/, "").replace(/^https?:\/\//, "")
  const parts = cleaned.split("/")
  if (parts.length >= 2) return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
  return cleaned
}

function statusConfig(status: string) {
  switch (status) {
    case "running":
      return { dot: "bg-[#69d1a7]", label: "bg-[#69d1a7]/15 text-[#69d1a7]", text: "Running" }
    case "building":
      return { dot: "bg-amber-400", label: "bg-amber-400/15 text-amber-400", text: "Building" }
    case "stopped":
      return { dot: "bg-muted-foreground/50", label: "bg-muted/50 text-muted-foreground", text: "Paused" }
    case "failed":
      return { dot: "bg-rose-500", label: "bg-rose-500/15 text-rose-400", text: "Failed" }
    default:
      return { dot: "bg-muted-foreground/50", label: "bg-muted/50 text-muted-foreground", text: status }
  }
}

// ── Individual App Row ───────────────────────────────────────────────────────

function AppRow({ app, onDelete }: { app: App; onDelete: (app: App) => void }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const cfg = statusConfig(app.status)
  const repoName = extractRepoName(app.gitRepo)

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [dropdownOpen])

  const handleToggle = async (action: "stop" | "start") => {
    try {
      if (action === "stop") await api.apps.stop(app.id)
      else await api.apps.start(app.id)
      showToast(action === "stop" ? "Stopped" : "Started", `${app.name} ${action}ed.`)
    } catch {
      showToast("Error", `Failed to ${action} ${app.name}.`, "destructive")
    }
  }

  const handleRedeploy = async () => {
    try {
      await api.apps.redeploy(app.id)
      showToast("Redeploying", `${app.name} rebuild triggered.`)
    } catch {
      showToast("Error", "Redeploy failed.", "destructive")
    }
  }

  return (
    <tr className="group border-b border-border/40 text-sm transition-colors hover:bg-accent/30">
      {/* Project Name */}
      <td className="py-3 px-4">
        <button
          onClick={() => router.push(`/app/${app.id}`)}
          className="flex items-center gap-2.5 text-left cursor-pointer"
        >
          <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
          <div className="flex flex-col">
            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {app.name}
            </span>
          </div>
        </button>
      </td>

      {/* Status */}
      <td className="py-3 px-4">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded-full ${cfg.label}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${app.status === "building" ? "animate-pulse" : ""}`} />
          {cfg.text}
        </span>
      </td>

      {/* URL */}
      <td className="py-3 px-4">
        {app.url ? (
          <a
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-mono text-primary hover:underline transition-colors"
          >
            {app.url.replace("http://", "")}
            <ExternalLinkIcon className="h-3 w-3 opacity-60" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground font-mono">—</span>
        )}
      </td>

      {/* Repository */}
      <td className="py-3 px-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
          {isGitHubRepo(app.gitRepo) ? (
            <>
              <GithubLight className="h-4 w-4 shrink-0 dark:hidden" />
              <GithubDark className="h-4 w-4 shrink-0 hidden dark:block" />
            </>
          ) : (
            <GitBranchIcon className="h-3 w-3" />
          )}
          <span className="truncate max-w-[140px]">{repoName}</span>
        </span>
      </td>

      {/* Branch */}
      <td className="py-3 px-4">
        <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-muted/40 border border-border px-1.5 py-0.5 rounded text-muted-foreground">
          <GitBranchIcon className="h-3 w-3" />
          {app.branch}
        </span>
      </td>

      {/* Deployed */}
      <td className="py-3 px-4">
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatRelativeTime(app.createdAt)}
        </span>
      </td>

      {/* Actions Dropdown */}
      <td className="py-3 px-4 text-right">
        <div className="relative inline-block" ref={dropdownRef}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDropdownOpen((v) => !v)
            }}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <MoreIcon className="h-4 w-4" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-popover shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
              <div className="py-1">
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    router.push(`/app/${app.id}`)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  <EyeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  View Details
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    router.push(`/app/${app.id}?tab=logs`)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  <TerminalIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  View Logs
                </button>
                <div className="my-1 border-t border-border" />
                {app.status === "running" ? (
                  <button
                    onClick={() => {
                      setDropdownOpen(false)
                      handleToggle("stop")
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                  >
                    <SquareIcon className="h-3.5 w-3.5" />
                    Stop Container
                  </button>
                ) : app.status === "stopped" ? (
                  <button
                    onClick={() => {
                      setDropdownOpen(false)
                      handleToggle("start")
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                  >
                    <PlayIcon className="h-3.5 w-3.5" />
                    Start Container
                  </button>
                ) : null}
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    handleRedeploy()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  <RefreshIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  Redeploy
                </button>
                <div className="my-1 border-t border-border" />
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    onDelete(app)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                  Delete Project
                </button>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

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
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteTarget, setDeleteTarget] = useState<App | null>(null)
  const [showPruneModal, setShowPruneModal] = useState(false)

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
              onClick={() => setShowPruneModal(true)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-muted/15 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-[#008fe2]/40 hover:bg-[#008fe2]/5 transition-all cursor-pointer"
            >
              <Docker className="h-3.5 w-3.5" />
              <span>Prune Docker</span>
            </button>


          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6">
          <div className="rounded-lg border border-border bg-card/72 backdrop-blur-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-muted/20 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground select-none">
                  <th className="py-2.5 px-4">Project</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">URL</th>
                  <th className="py-2.5 px-4">Repository</th>
                  <th className="py-2.5 px-4">Branch</th>
                  <th className="py-2.5 px-4">Deployed</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
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
                    <AppRow key={app.id} app={app} onDelete={(a) => setDeleteTarget(a)} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Docker Prune Confirm Modal */}
      {showPruneModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setShowPruneModal(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="p-6 pb-4 space-y-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-amber-500/10 border border-amber-500/20 mx-auto">
                <TrashIcon2 className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="text-base font-semibold text-foreground">Prune Docker System</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This will run <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">docker system prune</code> which permanently removes:
                </p>
                <ul className="text-sm text-muted-foreground text-left space-y-1 max-w-xs mx-auto list-disc pl-4">
                  <li>All stopped containers</li>
                  <li>All unused networks</li>
                  <li>All dangling images</li>
                  <li>All build cache</li>
                </ul>
                <p className="text-sm text-rose-500 font-semibold pt-1">
                  Active running containers will NOT be affected.
                </p>
              </div>
            </div>
            <div className="p-6 pt-2 flex gap-2">
              <button
                onClick={() => setShowPruneModal(false)}
                className="flex-1 h-10 rounded-md border border-border bg-background text-sm font-semibold text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowPruneModal(false)
                  await handleDockerPrune()
                }}
                className="flex-1 h-10 rounded-md bg-[#008fe2] hover:bg-[#0074b5] text-white text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Docker className="h-4 w-4" />
                Confirm Prune
              </button>
            </div>
          </div>
        </div>
      )}

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
