"use client"

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react"
import { useRouter } from "next/navigation"
import { NucleoIcon } from "@/components/nucleo-icons"
import { DeleteConfirmModal } from "@/components/delete-confirm-modal"
import { AppShell, useToast } from "@/components/app-shell"
import { StatusBadge, StatusDot } from "@/components/status-badge"
import { compareByStatusPriority } from "@/lib/status"
import { useActiveServer } from "@/components/server-context"
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
import { getAppUrl } from "@/lib/utils"
import type { App } from "@/lib/types"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { Docker } from "@/components/ui/svgs/docker"
import {
  Card,
  CardAction,
  CardFrame,
  CardFrameFooter,
  CardHeader,
  CardTitle,
  CardPanel,
} from "@/components/ui/card"
import { Frame, FrameFooter } from "@/components/ui/frame"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />
const GitBranchIcon = (props: IconProps) => <NucleoIcon {...props} name="branch" />
const GitCommitIcon = (props: IconProps) => <NucleoIcon {...props} name="git-commit" />
const LayersIcon = (props: IconProps) => <NucleoIcon {...props} name="layers" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />
const SquareIcon = (props: IconProps) => <NucleoIcon {...props} name="square" />
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const Trash2Icon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const SearchIcon = (props: IconProps) => <NucleoIcon {...props} name="search" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const ExternalLinkIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const LinkIcon = (props: IconProps) => <NucleoIcon {...props} name="link" />
const NoUrlIcon = (props: IconProps) => <NucleoIcon {...props} name="link-2-off" />
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

// SourceLink shows where an app came from. Git-based apps link out to their
// repository; image-based (catalog) apps have no repo, so we surface the Docker
// image instead. Apps with neither fall back to a neutral placeholder so the
// badge never renders empty.
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

// BranchBadge renders the deployed git branch. Image-based apps have no branch,
// so it renders nothing rather than an empty pill.
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
    async (app: App, noCache: boolean = false) => {
      try {
        await api.apps.redeploy(app.id, noCache)
        showToast("Redeploying", `${app.name} rebuild triggered.`, "success")
      } catch {
        showToast("Error", "Redeploy failed.", "destructive")
      }
    },
    [showToast],
  )

  return { toggle, redeploy }
}

// ── Columns for list view ─────────────────────────────────────────────────────

function createAppColumns(
  router: ReturnType<typeof useRouter>,
  actions: ReturnType<typeof useAppActions>
): ColumnDef<App>[] {
  return [
    {
      accessorKey: "name",
      header: "Project",
      size: 220,
      cell: ({ row }) => {
        const app = row.original
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-semibold text-sm text-foreground truncate">
              {app.name}
            </span>
            {app.vulnerabilitiesCount ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/app/${app.id}?tab=vulnerabilities`)
                      }}
                      className="flex cursor-pointer items-center text-amber-500 hover:text-amber-600 transition-colors shrink-0"
                    >
                      <NucleoIcon name="circle-alert" className="h-4 w-4" />
                    </span>
                  }
                />
                <TooltipContent>{app.vulnerabilitiesCount} package vulnerabilities detected. Click to view.</TooltipContent>
              </Tooltip>
            ) : null}
            {app.composeService && (
              <span
                title={`Compose service${app.composeWeb ? " (web-facing)" : ""}`}
                className="inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-mono text-sky-600 dark:text-sky-400"
              >
                <Docker className="h-3 w-3" />
                {app.composeService}
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 110,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "url",
      header: "URL",
      size: 200,
      cell: ({ row }) => <UrlLink url={getAppUrl(row.original)} />,
    },
    {
      accessorKey: "gitRepo",
      header: "Repository",
      size: 220,
      cell: ({ row }) => (
        <RepoLink gitRepo={row.original.gitRepo} image={row.original.image} />
      ),
    },
    {
      accessorKey: "branch",
      header: "Branch",
      size: 120,
      cell: ({ row }) => <BranchBadge branch={row.original.branch} />,
    },
    {
      accessorKey: "createdAt",
      header: "Deployed",
      size: 110,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatRelativeTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      size: 60,
      enableSorting: false,
      cell: ({ row }) => {
        const app = row.original
        const { toggle, redeploy } = actions
        return (
          <div className="text-right">
            <AppActionsMenu
              app={app}
              onDelete={() => {}}
              onToggle={(action) => toggle(app, action)}
              onRedeploy={(noCache) => redeploy(app, noCache)}
            />
          </div>
        )
      },
    },
  ]
}

function AppTable({
  apps,
  loading,
  isEmpty,
  noAppsAtAll,
  onRowClick,
}: {
  apps: App[]
  loading: boolean
  isEmpty: boolean
  noAppsAtAll: boolean
  onRowClick: (app: App) => void
}) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const actions = useAppActions()

  const columns = useMemo(
    () => createAppColumns(router, actions),
    [router, actions]
  )

  /* eslint-disable react-hooks/incompatible-library */
  const table = useReactTable({
    data: apps,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
    onSortingChange: setSorting,
    state: { sorting },
  })
  /* eslint-enable react-hooks/incompatible-library */

  const rows = table.getRowModel().rows

  return (
    <CardFrame className="w-full">
      <Table variant="card" className="table-fixed">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow className="hover:bg-transparent" key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const columnSize = header.column.getSize()
                return (
                  <TableHead
                    key={header.id}
                    style={columnSize ? { width: `${columnSize}px` } : undefined}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <div
                        className="flex h-full cursor-pointer select-none items-center justify-between gap-2"
                        onClick={header.column.getToggleSortingHandler()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            header.column.getToggleSortingHandler()?.(e)
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {{
                          asc: (
                            <ChevronUpIcon
                              aria-hidden="true"
                              className="size-4 shrink-0 opacity-80"
                            />
                          ),
                          desc: (
                            <ChevronDownIcon
                              aria-hidden="true"
                              className="size-4 shrink-0 opacity-80"
                            />
                          ),
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            <LoadingRows />
          ) : isEmpty ? (
            <TableRow>
                <TableCell className="h-24 text-center" colSpan={columns.length}>
                <DashboardEmpty noAppsAtAll={noAppsAtAll} onDeploy={() => router.push("/deploy")} />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                className="group cursor-pointer"
                data-state={row.getIsSelected() ? "selected" : undefined}
                key={row.id}
                onClick={() => onRowClick(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {!loading && !isEmpty && (
        <CardFrameFooter className="p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              <strong className="font-medium text-foreground">
                {apps.length}
              </strong>{" "}
              {apps.length === 1 ? "service" : "services"} deployed
            </p>
          </div>
        </CardFrameFooter>
      )}
    </CardFrame>
  )
}

// ── Desktop table row ─────────────────────────────────────────────────────────

// ── Mobile card (responsive) ──────────────────────────────────────────────────

function AppCard({ app, onDelete }: { app: App; onDelete: (app: App) => void }) {
  const router = useRouter()
  const { toggle, redeploy } = useAppActions()

  return (
    <Frame
      onClick={() => router.push(`/app/${app.id}`)}
      className="cursor-pointer border border-transparent transition-colors"
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
            <AppActionsMenu
              app={app}
              onDelete={onDelete}
              onToggle={(action) => toggle(app, action)}
              onRedeploy={(noCache) => redeploy(app, noCache)}
            />
          </CardAction>
        </CardHeader>
        <CardPanel>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={app.status} />
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
                      className="inline-flex cursor-pointer items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
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
                  detected. Click card to view details.
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>

          <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3" onClick={(e) => e.stopPropagation()}>
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
        </CardPanel>
      </Card>
      <FrameFooter className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Deployed</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatRelativeTime(app.createdAt)}
        </span>
      </FrameFooter>
    </Frame>
  )
}

// ── Desktop grid card (card view) ─────────────────────────────────────────────

function AppGridCard({ app, onDelete }: { app: App; onDelete: (app: App) => void }) {
  const router = useRouter()
  const { toggle, redeploy } = useAppActions()

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
            <AppActionsMenu
              app={app}
              onDelete={onDelete}
              onToggle={(action) => toggle(app, action)}
              onRedeploy={() => redeploy(app)}
            />
          </CardAction>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={app.status} />
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
                      className="inline-flex cursor-pointer items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
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
                  detected. Click card to view details.
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
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatRelativeTime(app.createdAt)}
        </span>
      </FrameFooter>
    </Frame>
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
  const { activeServerId } = useActiveServer()

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
      
      const appServerId = app.serverId || "localhost"
      const targetServerId = activeServerId === "all" ? "all" : (activeServerId === "localhost" ? "localhost" : activeServerId)
      const matchesServer = targetServerId === "all" || appServerId === targetServerId

      return matchesSearch && matchesStatus && matchesServer
    })
    .sort((a, b) => {
      // Keep compose-group rows adjacent (grouped by project, primary first),
      // while preserving status-priority ordering across groups/standalone apps.
      if (a.composeProject && b.composeProject && a.composeProject === b.composeProject) {
        if (a.composePrimary !== b.composePrimary) return a.composePrimary ? -1 : 1
        return (a.composeService || "").localeCompare(b.composeService || "")
      }
      return compareByStatusPriority(a.status, b.status)
    })

  const isEmpty = !loading && filteredApps.length === 0
  const noAppsAtAll = !loading && apps.length === 0

  return (
    <AppShell appCount={apps.length}>
      <div className="space-y-1 m-4 md:mx-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Deployed Services
          </h2>
        </div>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Manage your deployed services. You can filter by what&apos;s running, building, paused or failed to deploy.
        </p>
      </div>
      {/* Subheader toolbar */}
      <div className="flex flex-col justify-between gap-2 px-4 md:px-6 py-2.5 backdrop-blur-xl sm:flex-row sm:items-center select-none">

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/25 px-2.5 py-1">
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
        <div className={`hidden ${viewMode === "list" ? "md:block" : ""}`}>
          <AppTable
            apps={filteredApps}
            loading={loading}
            isEmpty={isEmpty}
            noAppsAtAll={noAppsAtAll}
            onRowClick={(app) => router.push(`/app/${app.id}`)}
          />
        </div>

        {/* Desktop card (grid) view */}
        <div className={`hidden ${viewMode === "card" ? "md:block" : ""}`}>
          {loading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="du-card rounded-xl">
              <DashboardEmpty noAppsAtAll={noAppsAtAll} onDeploy={() => router.push("/deploy")} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
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
