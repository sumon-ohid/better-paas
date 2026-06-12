"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { NucleoIcon } from "@/components/nucleo-icons"
import { DeleteConfirmModal } from "@/components/delete-confirm-modal"
import {
  DeployedTimeHover,
  StatusBadgeHover,
} from "@/components/hover-previews"
import { StatusDot } from "@/components/status-badge"
import { useToast } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardFrame,
  CardFrameFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
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
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Frame, FrameFooter } from "@/components/ui/frame"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { Docker } from "@/components/ui/svgs/docker"
import { api } from "@/lib/api"
import { getAppUrl } from "@/lib/utils"
import type { App } from "@/lib/types"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const GitBranchIcon = (props: IconProps) => <NucleoIcon {...props} name="branch" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />
const SquareIcon = (props: IconProps) => <NucleoIcon {...props} name="square" />
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const Trash2Icon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const ExternalLinkIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const LinkIcon = (props: IconProps) => <NucleoIcon {...props} name="link" />
const EyeIcon = (props: IconProps) => <NucleoIcon {...props} name="eye" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const MoreIcon = (props: IconProps) => <NucleoIcon {...props} name="more-horizontal" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const GridIcon = (props: IconProps) => <NucleoIcon {...props} name="grid" />
const ListIcon = (props: IconProps) => <NucleoIcon {...props} name="list" />
const NoUrlIcon = (props: IconProps) => <NucleoIcon {...props} name="link-2-off" />
const GitCommitIcon = (props: IconProps) => <NucleoIcon {...props} name="git-commit" />
const LayersIcon = (props: IconProps) => <NucleoIcon {...props} name="layers" />

const STATUS_FILTERS = ["all", "running", "building", "stopped", "failed"] as const

function filterLabel(f: string) {
  if (f === "all") return "All"
  if (f === "stopped") return "Paused"
  return f.charAt(0).toUpperCase() + f.slice(1)
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  if (diffSec < 60) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function serviceLabel(app: App): string {
  return app.serviceName || app.composeService || app.name
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

function RepoLink({ gitRepo, image }: { gitRepo: string; image?: string }) {
  if (!gitRepo) {
    if (image) {
      return (
        <span
          title={image}
          className="inline-flex mt-1 max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1 text-xs font-mono text-muted-foreground"
        >
          <Docker className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{image}</span>
        </span>
      )
    }
    return (
      <span className="inline-flex max-w-full mt-1 items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/20 px-2.5 py-1 text-xs font-mono text-muted-foreground/70">
        <GitBranchIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">No repository</span>
      </span>
    )
  }
  return (
    <a
      href={gitRepo}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={gitRepo}
      className="inline-flex max-w-full mt-1 items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1 text-xs font-mono text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {isGitHubRepo(gitRepo) ? (
        <>
          <GithubLight className="h-3.5 w-3.5 shrink-0 dark:hidden" />
          <GithubDark className="h-3.5 w-3.5 shrink-0 hidden dark:block" />
        </>
      ) : (
        <GitBranchIcon className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="truncate">{extractRepoName(gitRepo)}</span>
    </a>
  )
}

function BranchBadge({ branch }: { branch: string }) {
  if (!branch) return null
  return (
    <Badge variant="outline" size="sm" className="gap-1 rounded-lg font-mono py-2.5 px-1.5">
      <GitBranchIcon className="h-3 w-3" />
      {branch}
    </Badge>
  )
}

function UrlLink({ url }: { url: string | undefined }) {
  if (!url) return <span className="text-sm text-muted-foreground font-mono">—</span>
  const displayUrl = url.replace(/^https?:\/\//, "")
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={displayUrl}
      className="flex min-w-0 items-center gap-1 text-sm font-mono hover:underline transition-colors"
    >
      <LinkIcon className="h-3 w-3 shrink-0 opacity-60" />
      <span className="truncate">{displayUrl}</span>
      <ExternalLinkIcon className="h-3 w-3 shrink-0 opacity-60" />
    </a>
  )
}

function ServiceActionsMenu({
  app,
  onDelete,
  onToggle,
  onRedeploy,
}: {
  app: App
  onDelete: (app: App) => void
  onToggle: (action: "stop" | "start") => void
  onRedeploy: (noCache: boolean) => void
}) {
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${serviceLabel(app)}`}
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
        <DropdownMenuItem onClick={() => router.push(`/app/${app.id}?tab=terminal`)}>
          <TerminalIcon className="text-muted-foreground" />
          Terminal
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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <RefreshIcon className="text-muted-foreground" />
            Redeploy
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            <DropdownMenuItem onClick={() => onRedeploy(false)}>
              Default build
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRedeploy(true)}>
              Clear cache & deploy
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(app)}>
          <Trash2Icon />
          Delete service
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function useServiceActions(onRefresh: () => void) {
  const { showToast } = useToast()

  const toggle = useCallback(
    async (app: App, action: "stop" | "start") => {
      try {
        if (action === "stop") await api.apps.stop(app.id)
        else await api.apps.start(app.id)
        showToast(
          action === "stop" ? "Stopped" : "Started",
          `${serviceLabel(app)} ${action}ed.`,
          action === "stop" ? "warning" : "success",
        )
        onRefresh()
      } catch {
        showToast("Error", `Failed to ${action} ${serviceLabel(app)}.`, "destructive")
      }
    },
    [showToast, onRefresh],
  )

  const redeploy = useCallback(
    async (app: App, noCache: boolean = false) => {
      try {
        await api.apps.redeploy(app.id, noCache)
        showToast("Redeploying", `${serviceLabel(app)} rebuild triggered.`, "success")
        onRefresh()
      } catch {
        showToast("Error", "Redeploy failed.", "destructive")
      }
    },
    [showToast, onRefresh],
  )

  return { toggle, redeploy }
}

function CreateServiceCard({ onClick }: { onClick: () => void }) {
  return (
    <Frame
      onClick={onClick}
      className="flex h-full min-h-44 cursor-pointer border border-dashed border-border/80 bg-muted/10 transition-colors hover:border-primary/40 hover:bg-muted/20 md:min-h-0"
    >
      <Card className="before:hidden flex min-h-0 flex-1 flex-col shadow-none">
        <CardPanel className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-border bg-muted/30">
            <PlusIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Add service</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Deploy a new service into this project
            </p>
          </div>
        </CardPanel>
      </Card>
    </Frame>
  )
}

const TABLE_COLUMN_COUNT = 7

function ServiceTable({
  services,
  loading,
  isEmpty,
  noServicesAtAll,
  onOpen,
  onDelete,
  onAddService,
  onRefresh,
}: {
  services: App[]
  loading: boolean
  isEmpty: boolean
  noServicesAtAll: boolean
  onOpen: (app: App) => void
  onDelete: (app: App) => void
  onAddService: () => void
  onRefresh: () => void
}) {
  const { toggle, redeploy } = useServiceActions(onRefresh)

  return (
    <CardFrame className="w-full">
      <Table variant="card" className="table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead style={{ width: "220px" }}>Service</TableHead>
            <TableHead style={{ width: "110px" }}>Status</TableHead>
            <TableHead style={{ width: "200px" }}>URL</TableHead>
            <TableHead style={{ width: "220px" }}>Repository</TableHead>
            <TableHead style={{ width: "120px" }}>Branch</TableHead>
            <TableHead style={{ width: "110px" }}>Deployed</TableHead>
            <TableHead style={{ width: "60px" }}>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: TABLE_COLUMN_COUNT }).map((__, j) => (
                    <TableCell key={j} className="py-3.5">
                      <Skeleton className="h-4 w-full max-w-[120px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </>
          ) : (
            <>
              <TableRow
                className="cursor-pointer border-dashed bg-muted/10 hover:bg-muted/20"
                onClick={onAddService}
              >
                <TableCell colSpan={TABLE_COLUMN_COUNT} className="text-center">
                  <div className="flex items-center justify-center gap-2.5 py-1 text-sm font-medium text-muted-foreground">
                    <PlusIcon className="h-4 w-4" />
                    Add service
                  </div>
                </TableCell>
              </TableRow>
              {services.map((app) => (
                <TableRow
                  key={app.id}
                  className="cursor-pointer"
                  onClick={() => onOpen(app)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <StatusDot status={app.status} />
                      <span className="font-semibold text-sm text-foreground truncate">
                        {serviceLabel(app)}
                      </span>
                      {app.composeService && (
                        <Badge variant="outline" size="sm" className="gap-1 font-mono shrink-0">
                          <Docker className="h-3 w-3" />
                          compose
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadgeHover
                      status={app.status}
                      title="Service"
                      services={[
                        {
                          id: app.id,
                          name: serviceLabel(app),
                          status: app.status,
                        },
                      ]}
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <UrlLink url={getAppUrl(app)} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <RepoLink gitRepo={app.gitRepo} image={app.image} />
                  </TableCell>
                  <TableCell>
                    <BranchBadge branch={app.branch} />
                  </TableCell>
                  <TableCell>
                    <DeployedTimeHover
                      dateStr={app.createdAt}
                      label="Deployed"
                      relative={formatRelativeTime(app.createdAt)}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="text-right">
                      <ServiceActionsMenu
                        app={app}
                        onDelete={onDelete}
                        onToggle={(action) => toggle(app, action)}
                        onRedeploy={(noCache) => redeploy(app, noCache)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {isEmpty && (
                <TableRow>
                  <TableCell className="h-20 text-center" colSpan={TABLE_COLUMN_COUNT}>
                    <p className="text-sm text-muted-foreground">
                      {noServicesAtAll
                        ? "No services yet. Add one above."
                        : "No services match the current filters."}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </>
          )}
        </TableBody>
      </Table>
      {!loading && !isEmpty && (
        <CardFrameFooter className="p-2">
          <p className="text-muted-foreground text-sm">
            <strong className="font-medium text-foreground">{services.length}</strong>{" "}
            {services.length === 1 ? "service" : "services"} in this project
          </p>
        </CardFrameFooter>
      )}
    </CardFrame>
  )
}

function ServiceCard({
  app,
  onDelete,
  onRefresh,
}: {
  app: App
  onDelete: (app: App) => void
  onRefresh: () => void
}) {
  const router = useRouter()
  const { toggle, redeploy } = useServiceActions(onRefresh)

  return (
    <Frame
      onClick={() => router.push(`/app/${app.id}`)}
      className="group cursor-pointer border border-transparent transition-colors"
    >
      <Card className="before:hidden shadow-none">
        <CardHeader>
          <div className="flex min-w-0 items-center gap-2.5">
            <StatusDot status={app.status} />
            <CardTitle className="truncate text-base">{app.name}</CardTitle>
            {app.composeService && (
              <span
                title={`Compose service${app.composeWeb ? " (web-facing)" : ""}`}
                className="inline-flex shrink-0 items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-mono text-sky-600 dark:text-sky-400"
              >
                <Docker className="h-3 w-3" />
                {app.composeService}
              </span>
            )}
          </div>
          <CardAction onClick={(e) => e.stopPropagation()}>
            <ServiceActionsMenu
              app={app}
              onDelete={onDelete}
              onToggle={(action) => toggle(app, action)}
              onRedeploy={(noCache) => redeploy(app, noCache)}
            />
          </CardAction>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadgeHover
              status={app.status}
              title="Service"
              services={[
                {
                  id: app.id,
                  name: serviceLabel(app),
                  status: app.status,
                },
              ]}
            />
            <BranchBadge branch={app.branch} />
            {app.vulnerabilitiesCount !== undefined && app.vulnerabilitiesCount > 0 ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/app/${app.id}?tab=vulnerabilities`)
                      }}
                      className="inline-flex h-5.5 cursor-pointer items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                    >
                      <NucleoIcon name="circle-alert" className="h-3 w-3 animate-pulse" />
                      <span>
                        {app.vulnerabilitiesCount}{" "}
                        {app.vulnerabilitiesCount === 1
                          ? "vulnerability"
                          : "vulnerabilities"}
                      </span>
                    </span>
                  }
                />
                <TooltipContent>
                  {app.vulnerabilitiesCount} package{" "}
                  {app.vulnerabilitiesCount === 1 ? "vulnerability" : "vulnerabilities"}{" "}
                  detected. Click to view details.
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </CardHeader>
        <CardPanel>
          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            {getAppUrl(app) ? (
              <UrlLink url={getAppUrl(app)} />
            ) : (
              <span className="flex items-center gap-1 text-sm font-mono text-muted-foreground">
                <NoUrlIcon className="h-3 w-3 shrink-0 opacity-60" />
                No URL assigned
              </span>
            )}
            <RepoLink gitRepo={app.gitRepo} image={app.image} />
          </div>

          {app.composeService ? (
            <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Docker className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="line-clamp-1 min-w-0">
                Compose service{app.composeWeb ? "" : " · internal"}
              </span>
            </div>
          ) : app.activeCommitMsg ? (
            <div
              className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground"
              title={app.activeCommitMsg}
            >
              <GitCommitIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="line-clamp-1 min-w-0">{app.activeCommitMsg}</span>
            </div>
          ) : !app.gitRepo ? (
            <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <LayersIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="line-clamp-1 min-w-0">
                {app.catalogId ? "Deployed from catalog" : "Prebuilt image deployment"}
              </span>
            </div>
          ) : null}
        </CardPanel>
      </Card>
      <FrameFooter className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Deployed</span>
        <DeployedTimeHover
          dateStr={app.createdAt}
          label="Deployed"
          relative={formatRelativeTime(app.createdAt)}
        >
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatRelativeTime(app.createdAt)}
          </span>
        </DeployedTimeHover>
      </FrameFooter>
    </Frame>
  )
}

function serviceMatchesSearch(app: App, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const label = serviceLabel(app).toLowerCase()
  return (
    label.includes(q) ||
    app.name.toLowerCase().includes(q) ||
    (app.gitRepo?.toLowerCase().includes(q) ?? false)
  )
}

function serviceMatchesStatus(app: App, filter: string): boolean {
  if (filter === "all") return true
  return app.status === filter
}

export function ProjectServicesOverview({
  services,
  loading = false,
  onRefresh,
  onAddService,
  onDeleteProject,
}: {
  services: App[]
  loading?: boolean
  onRefresh: () => void
  onAddService: () => void
  onDeleteProject?: () => void
}) {
  const router = useRouter()
  const { showToast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteTarget, setDeleteTarget] = useState<App | null>(null)
  const [viewMode, setViewMode] = useState<"card" | "list">("card")

  useEffect(() => {
    const saved = localStorage.getItem("project-services-view-mode")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "card" || saved === "list") setViewMode(saved)
  }, [])

  const handleViewModeChange = useCallback((mode: "card" | "list") => {
    setViewMode(mode)
    localStorage.setItem("project-services-view-mode", mode)
  }, [])

  const filteredServices = useMemo(
    () =>
      services.filter(
        (app) =>
          serviceMatchesSearch(app, searchQuery) &&
          serviceMatchesStatus(app, statusFilter),
      ),
    [services, searchQuery, statusFilter],
  )

  const isEmpty = !loading && filteredServices.length === 0
  const noServicesAtAll = !loading && services.length === 0

  const handleDeleteService = async (id: string) => {
    try {
      await api.apps.delete(id)
      showToast("Service deleted", "Container and workspace removed.", "success")
      setDeleteTarget(null)
      onRefresh()
    } catch {
      showToast("Error", "Failed to delete service.", "destructive")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="min-w-0 w-full sm:w-48">
            <InputGroupInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name..."
              type="search"
              aria-label="Filter services by name"
            />
            <InputGroupAddon align="inline-end">
              <Button size="xs" variant="secondary">
                Search
              </Button>
            </InputGroupAddon>
          </InputGroup>
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
          {onDeleteProject ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={onDeleteProject}
            >
              Delete project
            </Button>
          ) : null}
        </div>
      </div>

      <div className={`hidden ${viewMode === "list" ? "md:block" : ""}`}>
        <ServiceTable
          services={filteredServices}
          loading={loading}
          isEmpty={isEmpty}
          noServicesAtAll={noServicesAtAll}
          onOpen={(app) => router.push(`/app/${app.id}`)}
          onDelete={(app) => setDeleteTarget(app)}
          onAddService={onAddService}
          onRefresh={onRefresh}
        />
      </div>

      <div className={`hidden ${viewMode === "card" ? "md:block" : ""}`}>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <CreateServiceCard onClick={onAddService} />
            {filteredServices.map((app) => (
              <ServiceCard
                key={app.id}
                app={app}
                onDelete={(a) => setDeleteTarget(a)}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))
        ) : (
          <>
            <CreateServiceCard onClick={onAddService} />
            {filteredServices.map((app) => (
              <ServiceCard
                key={app.id}
                app={app}
                onDelete={(a) => setDeleteTarget(a)}
                onRefresh={onRefresh}
              />
            ))}
          </>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        appName={deleteTarget ? serviceLabel(deleteTarget) : ""}
        onConfirm={() =>
          deleteTarget ? handleDeleteService(deleteTarget.id) : Promise.resolve()
        }
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
