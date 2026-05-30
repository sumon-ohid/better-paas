"use client"

import React, { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter } from "next/navigation"
import { NucleoIcon } from "@/components/nucleo-icons"
import { DeleteConfirmModal } from "@/components/delete-confirm-modal"
import { AppShell, useToast } from "@/components/app-shell"
import { StatusBadge, StatusDot } from "@/components/status-badge"
import { compareByStatusPriority } from "@/lib/status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
} from "@/components/ui/alert-dialog"
import { api } from "@/lib/api"
import type { App } from "@/lib/types"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { Docker } from "@/components/ui/svgs/docker"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />
const GitBranchIcon = (props: IconProps) => <NucleoIcon {...props} name="branch" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />
const SquareIcon = (props: IconProps) => <NucleoIcon {...props} name="square" />
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const Trash2Icon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const SearchIcon = (props: IconProps) => <NucleoIcon {...props} name="search" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const ExternalLinkIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const LinkIcon = (props: IconProps) => <NucleoIcon {...props} name="link" />
const EyeIcon = (props: IconProps) => <NucleoIcon {...props} name="eye" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const MoreIcon = (props: IconProps) => <NucleoIcon {...props} name="more-horizontal" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const GridIcon = (props: IconProps) => <NucleoIcon {...props} name="grid" />
const ListIcon = (props: IconProps) => <NucleoIcon {...props} name="list" />

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
  const cleaned = gitRepo.replace(/\.git$/, "").replace(/^https?:\/\//, "")
  const parts = cleaned.split("/")
  if (parts.length >= 2) return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
  return cleaned
}

const STATUS_FILTERS = ["all", "running", "building", "stopped", "failed"] as const

function filterLabel(f: string) {
  if (f === "all") return "All"
  if (f === "stopped") return "Paused"
  return f.charAt(0).toUpperCase() + f.slice(1)
}

// ── Repo cell (shared between table + cards) ──────────────────────────────────

function RepoLink({ gitRepo }: { gitRepo: string }) {
  return (
    <a
      href={gitRepo}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 text-sm font-mono text-muted-foreground hover:text-primary transition-colors"
    >
      {isGitHubRepo(gitRepo) ? (
        <>
          <GithubLight className="h-4 w-4 shrink-0 dark:hidden" />
          <GithubDark className="h-4 w-4 shrink-0 hidden dark:block" />
        </>
      ) : (
        <GitBranchIcon className="h-3.5 w-3.5" />
      )}
      <span className="truncate max-w-[140px]">{extractRepoName(gitRepo)}</span>
    </a>
  )
}

function UrlLink({ url }: { url: string | undefined }) {
  if (!url) return <span className="text-sm text-muted-foreground font-mono">—</span>
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-sm font-mono text-primary hover:underline transition-colors"
    >
      <LinkIcon className="h-3 w-3 shrink-0 opacity-60" />
      {url.replace("http://", "")}
      <ExternalLinkIcon className="h-3 w-3 opacity-60" />
    </a>
  )
}

// ── Row action menu (shared) ──────────────────────────────────────────────────

function AppActionsMenu({
  app,
  onDelete,
  onToggle,
  onRedeploy,
}: {
  app: App
  onDelete: (app: App) => void
  onToggle: (action: "stop" | "start") => void
  onRedeploy: () => void
}) {
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${app.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreIcon className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => router.push(`/app/${app.id}`)}>
          <EyeIcon className="text-muted-foreground" />
          View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/app/${app.id}?tab=logs`)}>
          <TerminalIcon className="text-muted-foreground" />
          View logs
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {app.status === "running" ? (
          <DropdownMenuItem onClick={() => onToggle("stop")}>
            <SquareIcon className="text-warning" />
            Stop container
          </DropdownMenuItem>
        ) : app.status === "stopped" ? (
          <DropdownMenuItem onClick={() => onToggle("start")}>
            <PlayIcon className="text-success" />
            Start container
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={onRedeploy}>
          <RefreshIcon className="text-muted-foreground" />
          Redeploy
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(app)}>
          <Trash2Icon />
          Delete project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function useAppActions() {
  const { showToast } = useToast()

  const toggle = useCallback(
    async (app: App, action: "stop" | "start") => {
      try {
        if (action === "stop") await api.apps.stop(app.id)
        else await api.apps.start(app.id)
        showToast(
          action === "stop" ? "Stopped" : "Started",
          `${app.name} ${action}ed.`,
          action === "stop" ? "warning" : "success",
        )
      } catch {
        showToast("Error", `Failed to ${action} ${app.name}.`, "destructive")
      }
    },
    [showToast],
  )

  const redeploy = useCallback(
    async (app: App) => {
      try {
        await api.apps.redeploy(app.id)
        showToast("Redeploying", `${app.name} rebuild triggered.`, "success")
      } catch {
        showToast("Error", "Redeploy failed.", "destructive")
      }
    },
    [showToast],
  )

  return { toggle, redeploy }
}

// ── Desktop table row ─────────────────────────────────────────────────────────

function AppRow({ app, onDelete }: { app: App; onDelete: (app: App) => void }) {
  const router = useRouter()
  const { toggle, redeploy } = useAppActions()

  return (
    <TableRow
      className="group cursor-pointer"
      onClick={() => router.push(`/app/${app.id}`)}
    >
      {/* Project name — primary attention anchor */}
      <TableCell className="py-4">
        <div className="flex items-center gap-2.5">
          <StatusDot status={app.status} />
          <span className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
            {app.name}
          </span>
        </div>
      </TableCell>

      <TableCell className="py-4">
        <StatusBadge status={app.status} />
      </TableCell>

      <TableCell className="py-4" onClick={(e) => e.stopPropagation()}>
        <UrlLink url={app.url} />
      </TableCell>

      <TableCell className="py-4" onClick={(e) => e.stopPropagation()}>
        <RepoLink gitRepo={app.gitRepo} />
      </TableCell>

      <TableCell className="py-4">
        <Badge variant="outline" size="sm" className="gap-1 font-mono">
          <GitBranchIcon className="h-3 w-3" />
          {app.branch}
        </Badge>
      </TableCell>

      <TableCell className="py-4">
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatRelativeTime(app.createdAt)}
        </span>
      </TableCell>

      <TableCell className="py-4 text-right" onClick={(e) => e.stopPropagation()}>
        <AppActionsMenu
          app={app}
          onDelete={onDelete}
          onToggle={(action) => toggle(app, action)}
          onRedeploy={() => redeploy(app)}
        />
      </TableCell>
    </TableRow>
  )
}

// ── Mobile card (responsive) ──────────────────────────────────────────────────

function AppCard({ app, onDelete }: { app: App; onDelete: (app: App) => void }) {
  const router = useRouter()
  const { toggle, redeploy } = useAppActions()

  return (
    <div
      onClick={() => router.push(`/app/${app.id}`)}
      className="du-card cursor-pointer rounded-xl p-4 transition-colors hover:border-primary/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <StatusDot status={app.status} />
          <span className="font-semibold text-base text-foreground truncate">{app.name}</span>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <AppActionsMenu
            app={app}
            onDelete={onDelete}
            onToggle={(action) => toggle(app, action)}
            onRedeploy={() => redeploy(app)}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <StatusBadge status={app.status} />
        <Badge variant="outline" size="sm" className="gap-1 font-mono">
          <GitBranchIcon className="h-3 w-3" />
          {app.branch}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {formatRelativeTime(app.createdAt)}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3" onClick={(e) => e.stopPropagation()}>
        <UrlLink url={app.url} />
        <RepoLink gitRepo={app.gitRepo} />
      </div>
    </div>
  )
}

// ── Desktop grid card (card view) ─────────────────────────────────────────────

function AppGridCard({ app, onDelete }: { app: App; onDelete: (app: App) => void }) {
  const router = useRouter()
  const { toggle, redeploy } = useAppActions()

  return (
    <div
      onClick={() => router.push(`/app/${app.id}`)}
      className="du-card group flex cursor-pointer flex-col rounded-xl p-4 transition-colors hover:border-primary/30"
    >
      {/* Header: name + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <StatusDot status={app.status} />
          <span className="truncate font-semibold text-base text-foreground group-hover:text-primary transition-colors">
            {app.name}
          </span>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <AppActionsMenu
            app={app}
            onDelete={onDelete}
            onToggle={(action) => toggle(app, action)}
            onRedeploy={() => redeploy(app)}
          />
        </div>
      </div>

      {/* Status + branch */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={app.status} />
        <Badge variant="outline" size="sm" className="gap-1 font-mono">
          <GitBranchIcon className="h-3 w-3" />
          {app.branch}
        </Badge>
      </div>

      {/* URL + repo */}
      <div
        className="mt-3 space-y-1.5 border-t border-border/50 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <UrlLink url={app.url} />
        <RepoLink gitRepo={app.gitRepo} />
      </div>

      {/* Footer: deployed time */}
      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
        <span className="text-xs text-muted-foreground">Deployed</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatRelativeTime(app.createdAt)}
        </span>
      </div>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 7 }).map((__, j) => (
            <TableCell key={j} className="py-3.5">
              <Skeleton className="h-4 w-full max-w-[120px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

function ApplicationsDashboard() {
  const router = useRouter()
  const { showToast } = useToast()

  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteTarget, setDeleteTarget] = useState<App | null>(null)
  const [showPruneModal, setShowPruneModal] = useState(false)
  const [viewMode, setViewMode] = useState<"card" | "list">("card")

  // Restore the saved desktop view preference (card is the default).
  useEffect(() => {
    const saved = localStorage.getItem("apps-view-mode")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "card" || saved === "list") setViewMode(saved)
  }, [])

  const handleViewModeChange = useCallback((mode: "card" | "list") => {
    setViewMode(mode)
    localStorage.setItem("apps-view-mode", mode)
  }, [])

  const fetchApps = useCallback(async () => {
    try {
      const data = await api.apps.list()
      setApps(data)
    } catch (err) {
      console.error("Failed to fetch apps", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchApps()
  }, [fetchApps])

  // Poll while building
  useEffect(() => {
    const hasBuildingApp = apps.some((a) => a.status === "building")
    if (!hasBuildingApp) return
    const interval = setInterval(fetchApps, 2500)
    return () => clearInterval(interval)
  }, [apps, fetchApps])

  const handleDeleteApp = async (id: string) => {
    try {
      await api.apps.delete(id)
      showToast("App deleted", "Application container and workspace permanently removed.", "success")
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
      showToast("Pruned", "Docker system prune completed successfully.", "success")
      console.log(result.output)
    } catch (err) {
      showToast("Prune failed", "Docker prune encountered an error.", "destructive")
      console.error(err)
    }
  }

  // Filter + sort so attention-worthy states (building, failed) surface first.
  const filteredApps = apps
    .filter((app) => {
      const matchesSearch =
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.gitRepo.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || app.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => compareByStatusPriority(a.status, b.status))

  const isEmpty = !loading && filteredApps.length === 0
  const noAppsAtAll = !loading && apps.length === 0

  return (
    <AppShell appCount={apps.length}>
      {/* Subheader toolbar */}
      <div className="flex flex-col justify-between gap-2 border-b border-border px-4 py-2.5 backdrop-blur-xl sm:flex-row sm:items-center select-none">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/25 px-2.5 py-1.5">
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name..."
              aria-label="Filter applications by name"
              className="bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/60 w-40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Clear filter"
                className="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[statusFilter]}
            onValueChange={(v) => setStatusFilter(v[0] ?? "all")}
          >
            {STATUS_FILTERS.map((f) => (
              <ToggleGroupItem key={f} value={f} className="px-2.5 text-sm">
                {filterLabel(f)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* View toggle — desktop only; mobile always uses cards */}
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[viewMode]}
            onValueChange={(v) => {
              const next = v[0]
              if (next === "card" || next === "list") handleViewModeChange(next)
            }}
            className="hidden md:inline-flex"
            aria-label="Toggle view layout"
          >
            <ToggleGroupItem value="card" aria-label="Card view" className="px-2">
              <GridIcon className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="px-2">
              <ListIcon className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPruneModal(true)}
                  className="hidden gap-1.5 sm:inline-flex"
                >
                  <Docker className="h-4 w-4" />
                  Prune Docker
                </Button>
              }
            />
            <TooltipContent>Reclaim disk: remove stopped containers, dangling images and build cache</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6">
        {/* Desktop list (table) view */}
        <div className={`du-card hidden overflow-hidden rounded-xl ${viewMode === "list" ? "md:block" : ""}`}>
          <Table className="[&_td]:px-5 [&_th]:px-5">
            <TableHeader>
              <TableRow className="bg-muted/20 text-xs uppercase tracking-[0.08em] select-none">
                <TableHead className="py-3.5">Project</TableHead>
                <TableHead className="py-3.5">Status</TableHead>
                <TableHead className="py-3.5">URL</TableHead>
                <TableHead className="py-3.5">Repository</TableHead>
                <TableHead className="py-3.5">Branch</TableHead>
                <TableHead className="py-3.5">Deployed</TableHead>
                <TableHead className="py-3.5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows />
              ) : isEmpty ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <DashboardEmpty noAppsAtAll={noAppsAtAll} onDeploy={() => router.push("/deploy")} />
                  </TableCell>
                </TableRow>
              ) : (
                filteredApps.map((app) => (
                  <AppRow key={app.id} app={app} onDelete={(a) => setDeleteTarget(a)} />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Desktop card (grid) view */}
        <div className={`hidden ${viewMode === "card" ? "md:block" : ""}`}>
          {loading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="du-card rounded-xl">
              <DashboardEmpty noAppsAtAll={noAppsAtAll} onDeploy={() => router.push("/deploy")} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {filteredApps.map((app) => (
                <AppGridCard key={app.id} app={app} onDelete={(a) => setDeleteTarget(a)} />
              ))}
            </div>
          )}
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))
          ) : isEmpty ? (
            <div className="du-card rounded-xl">
              <DashboardEmpty noAppsAtAll={noAppsAtAll} onDeploy={() => router.push("/deploy")} />
            </div>
          ) : (
            filteredApps.map((app) => (
              <AppCard key={app.id} app={app} onDelete={(a) => setDeleteTarget(a)} />
            ))
          )}
        </div>
      </div>

      {/* Docker Prune Confirm Modal — reuses shared AlertDialog */}
      <AlertDialog open={showPruneModal} onOpenChange={setShowPruneModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-info/10 text-info sm:mx-0">
              <Docker className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Prune Docker system</AlertDialogTitle>
            <AlertDialogDescription>
              This runs{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">docker system prune</code>{" "}
              and permanently removes stopped containers, unused networks, dangling images, and build
              cache. Active running containers are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
            <AlertDialogClose
              render={
                <Button variant="destructive" onClick={handleDockerPrune} className="gap-1.5">
                  <Trash2Icon className="h-4 w-4" />
                  Confirm prune
                </Button>
              }
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        appName={deleteTarget?.name ?? ""}
        onConfirm={() => (deleteTarget ? handleDeleteApp(deleteTarget.id) : Promise.resolve())}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  )
}

function DashboardEmpty({
  noAppsAtAll,
  onDeploy,
}: {
  noAppsAtAll: boolean
  onDeploy: () => void
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <GlobeIcon />
        </EmptyMedia>
        <EmptyTitle>{noAppsAtAll ? "No applications yet" : "No matches"}</EmptyTitle>
        <EmptyDescription>
          {noAppsAtAll
            ? "Deploy your first service to see it appear here."
            : "No applications match the current filters."}
        </EmptyDescription>
      </EmptyHeader>
      {noAppsAtAll && (
        <EmptyContent>
          <Button onClick={onDeploy} className="gap-1.5">
            <PlusIcon className="h-4 w-4" />
            Deploy a service
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background font-mono text-xs text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Initializing dashboard...</span>
        </div>
      }
    >
      <ApplicationsDashboard />
    </Suspense>
  )
}
