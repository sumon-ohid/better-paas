"use client"

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react"
import { useRouter } from "next/navigation"
import { NucleoIcon } from "@/components/nucleo-icons"
import { DeleteConfirmModal } from "@/components/delete-confirm-modal"
import { AppShell, useToast } from "@/components/app-shell"
import {
  DeployedTimeHover,
  StatusBadgeHover,
} from "@/components/hover-previews"
import { useActiveServer } from "@/components/server-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { api } from "@/lib/api"
import type { ProjectSummary } from "@/lib/types"
import { Docker } from "@/components/ui/svgs/docker"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { IconFolder } from "nucleo-isometric"
import {
  Card,
  CardAction,
  CardFooter,
  CardFrame,
  CardFrameFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { Frame, FrameFooter } from "@/components/ui/frame"
type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const Trash2Icon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const EditIcon = (props: IconProps) => <NucleoIcon {...props} name="edit" />
const MoreIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="more-horizontal" />
)
const GridIcon = (props: IconProps) => <NucleoIcon {...props} name="grid" />
const ListIcon = (props: IconProps) => <NucleoIcon {...props} name="list" />
const ChevronRightIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="chevron-right" />
)

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

const STATUS_FILTERS = ["all", "running", "building", "stopped", "failed"] as const

function filterLabel(f: string) {
  if (f === "all") return "All"
  if (f === "stopped") return "Paused"
  return f.charAt(0).toUpperCase() + f.slice(1)
}

function projectServerId(project: ProjectSummary): string {
  return project.serverId?.trim() || "localhost"
}

function shouldShowServerBadge(
  project: ProjectSummary,
  activeServerId: string,
): boolean {
  const sid = projectServerId(project)
  if (activeServerId === "all") return true
  if (activeServerId === "localhost") return sid !== "localhost"
  return sid !== activeServerId
}

function projectServiceLabel(project: ProjectSummary): string {
  if (project.serviceCount === 0) return "No services"
  return `${project.serviceCount} ${project.serviceCount === 1 ? "service" : "services"}`
}

function projectDescriptionText(project: ProjectSummary): string {
  const text = project.description?.trim()
  return text || "No description"
}

function projectHasDescription(project: ProjectSummary): boolean {
  return Boolean(project.description?.trim())
}

const PROJECT_DESCRIPTION_MAX = 100

function normalizeProjectNameInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
}

function projectTimeMeta(project: ProjectSummary): {
  label: string
  at: string
  dateStr: string
} {
  if (project.serviceCount > 0 && project.lastServiceAt) {
    return {
      label: "Last service",
      at: formatRelativeTime(project.lastServiceAt),
      dateStr: project.lastServiceAt,
    }
  }
  return {
    label: "Created",
    at: formatRelativeTime(project.createdAt),
    dateStr: project.createdAt,
  }
}

function projectServiceStatuses(
  project: ProjectSummary,
): { id: string; name: string; status: string }[] {
  return (project.serviceStatuses ?? []).map((service) => ({
    id: service.id,
    name: service.name,
    status: service.status,
  }))
}

function ProjectServerBadge({ serverId }: { serverId?: string }) {
  const { servers } = useActiveServer()

  const sid = serverId?.trim() || "localhost"
  const server =
    sid === "localhost"
      ? servers.find((s) => s.isLocal)
      : servers.find((s) => s.id === sid)

  const isLocal = sid === "localhost" || server?.isLocal
  const label = isLocal ? "local" : (server?.name ?? sid)
  const description = isLocal
    ? "Deployed on this machine"
    : server
      ? `${server.name} · ${server.ip}`
      : sid

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            size="sm"
            className="shrink-0 font-mono text-[10px] text-muted-foreground"
          />
        }
      >
        {label}
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  )
}

function CreateNewProjectCard({ onClick }: { onClick: () => void }) {
  return (
    <Frame
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Create new project"
      className="group flex h-full min-h-[8.5rem] flex-col cursor-pointer border border-dashed border-border/80 bg-muted/10 transition-colors hover:border-primary/40 hover:bg-muted/20"
    >
      <Card className="before:hidden flex flex-1 flex-col justify-center shadow-none">
        <CardHeader className="pb-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 transition-colors">
              <PlusIcon className="h-7 w-7 text-muted-foreground transition-colors" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5 ml-2">
              <p className="text-base font-semibold leading-snug text-foreground">
                Create new project
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Start empty, then add services
              </p>
            </div>
            <ChevronRightIcon className="mt-4 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </CardHeader>
      </Card>
    </Frame>
  )
}

function projectMatchesSearch(project: ProjectSummary, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    project.name.toLowerCase().includes(q) ||
    (project.description?.toLowerCase().includes(q) ?? false)
  )
}

function projectMatchesStatus(project: ProjectSummary, filter: string): boolean {
  if (filter === "all") return true
  return project.status === filter
}

function projectMatchesServer(project: ProjectSummary, serverId: string): boolean {
  if (serverId === "all") return true
  const sid = project.serverId || "localhost"
  return sid === serverId
}

function ProjectActionsMenu({
  project,
  onAddService,
  onEdit,
  onDelete,
  triggerClassName,
}: {
  project: ProjectSummary
  onAddService: () => void
  onEdit: () => void
  onDelete: () => void
  triggerClassName?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${project.name}`}
            onClick={(e) => e.stopPropagation()}
            className={triggerClassName}
          >
            <MoreIcon className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onAddService()
          }}
        >
          <PlusIcon className="text-muted-foreground" />
          Add service
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          <EditIcon className="text-muted-foreground" />
          Edit project
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2Icon />
          Delete project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProjectTableRow({
  project,
  onOpen,
  onEdit,
  onDelete,
  onAddService,
  onViewLogs,
  activeServerId,
}: {
  project: ProjectSummary
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  onAddService: () => void
  onViewLogs: () => void
  activeServerId: string
}) {
  const timeMeta = projectTimeMeta(project)

  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
            <IconFolder className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-sm text-foreground truncate block">
              {project.name}
            </span>
            <p
              className={`line-clamp-2 text-xs mb-2${
                projectHasDescription(project)
                  ? " text-muted-foreground"
                  : " italic text-muted-foreground/70"
              }`}
            >
              {projectDescriptionText(project)}
            </p>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="text-xs text-muted-foreground">
                {projectServiceLabel(project)}
              </span>
              {project.status === "failed" && project.focusServiceId ? (
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto min-h-0 px-0 py-0 text-xs text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewLogs()
                  }}
                >
                  View logs
                </Button>
              ) : null}
            </div>
          </div>
          {shouldShowServerBadge(project, activeServerId) ? (
            <ProjectServerBadge serverId={project.serverId} />
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <StatusBadgeHover
          status={project.status}
          services={projectServiceStatuses(project)}
        />
      </TableCell>
      <TableCell>
        <ProjectSourceIcons project={project} compact />
      </TableCell>
      <TableCell>
        <DeployedTimeHover
          dateStr={timeMeta.dateStr}
          label={timeMeta.label}
          relative={timeMeta.at}
          size="sm"
        />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end">
          <ProjectActionsMenu
            project={project}
            onAddService={onAddService}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </TableCell>
    </TableRow>
  )
}

const TABLE_COLUMN_COUNT = 5

function AppTable({
  projects,
  counts,
  loading,
  isEmpty,
  noProjectsAtAll,
  onOpenProject,
  onEdit,
  onDelete,
  onAddService,
  onViewLogs,
  onCreateProject,
  activeServerId,
}: {
  projects: ProjectSummary[]
  counts: { services: number; projects: number }
  loading: boolean
  isEmpty: boolean
  noProjectsAtAll: boolean
  onOpenProject: (project: ProjectSummary) => void
  onEdit: (project: ProjectSummary) => void
  onDelete: (project: ProjectSummary) => void
  onAddService: (project: ProjectSummary) => void
  onViewLogs: (project: ProjectSummary) => void
  onCreateProject: () => void
  activeServerId: string
}) {
  return (
    <CardFrame className="w-full">
      <Table variant="card" className="table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead style={{ width: "240px" }}>Name</TableHead>
            <TableHead style={{ width: "120px" }}>Status</TableHead>
            <TableHead style={{ width: "180px" }}>Deployed with</TableHead>
            <TableHead style={{ width: "130px" }}>Activity</TableHead>
            <TableHead style={{ width: "72px" }}>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <LoadingRows />
          ) : (
            <>
              <TableRow
                className="cursor-pointer border-dashed bg-muted/10 hover:bg-muted/20"
                onClick={onCreateProject}
              >
                <TableCell colSpan={TABLE_COLUMN_COUNT} className="text-center">
                  <div className="flex items-center justify-center gap-2.5 py-1 text-sm font-medium text-muted-foreground">
                    <PlusIcon className="h-4 w-4" />
                    Create new project
                  </div>
                </TableCell>
              </TableRow>
              {projects.map((project) => (
                <ProjectTableRow
                  key={project.id}
                  project={project}
                  activeServerId={activeServerId}
                  onOpen={() => onOpenProject(project)}
                  onEdit={() => onEdit(project)}
                  onDelete={() => onDelete(project)}
                  onAddService={() => onAddService(project)}
                  onViewLogs={() => onViewLogs(project)}
                />
              ))}
              {isEmpty && (
                <TableRow>
                  <TableCell className="h-20 text-center" colSpan={TABLE_COLUMN_COUNT}>
                    <p className="text-sm text-muted-foreground">
                      {noProjectsAtAll
                        ? "No projects yet. Create one above."
                        : "No projects match the current filters."}
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
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              <strong className="font-medium text-foreground">
                {counts.services}
              </strong>{" "}
              {counts.services === 1 ? "service" : "services"} in{" "}
              <strong className="font-medium text-foreground">
                {counts.projects}
              </strong>{" "}
              {counts.projects === 1 ? "project" : "projects"}
            </p>
          </div>
        </CardFrameFooter>
      )}
    </CardFrame>
  )
}

function ProjectSourceIcons({
  project,
  compact = false,
}: {
  project: ProjectSummary
  compact?: boolean
}) {
  if (!project.hasGit && !project.hasDocker) {
    return (
      <span className="text-xs text-muted-foreground">
        {compact
          ? project.serviceCount === 0
            ? "Empty"
            : "—"
          : project.serviceCount === 0
            ? "Empty project"
            : "No deploy source"}
      </span>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {!compact ? (
        <span className="shrink-0 text-xs text-muted-foreground">Deployed with</span>
      ) : null}
      {project.hasGit ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className="inline-flex opacity-70 transition-opacity hover:opacity-100"
                aria-label="Git deployments"
              />
            }
          >
            <GithubLight className="h-3.5 w-3.5 dark:hidden" />
            <GithubDark className="hidden h-3.5 w-3.5 dark:block" />
          </TooltipTrigger>
          <TooltipContent>Git repository</TooltipContent>
        </Tooltip>
      ) : null}
      {project.hasDocker ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className="inline-flex opacity-70 transition-opacity hover:opacity-100"
                aria-label="Docker deployments"
              />
            }
          >
            <Docker className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent>Docker image / Dockerfile / Compose</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}

// ── Compose project card (one card per project, click to reveal services) ─────

function ProjectSummaryCard({
  project,
  onOpen,
  onEdit,
  onDelete,
  onAddService,
  onViewLogs,
  activeServerId,
}: {
  project: ProjectSummary
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  onAddService: () => void
  onViewLogs: () => void
  activeServerId: string
}) {
  const timeMeta = projectTimeMeta(project)

  return (
    <Frame
      className="group flex h-full flex-col cursor-pointer border border-transparent transition-all hover:border-border/60 hover:bg-muted/10"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open project ${project.name}`}
    >
      <Card className="before:hidden flex flex-1 flex-col shadow-none">
        <CardHeader className="pb-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground transition-colors group-hover:bg-muted/70">
              <IconFolder className="h-10 w-10" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <CardTitle className="min-w-0 truncate text-base leading-snug">
                  {project.name}
                </CardTitle>
                <CardAction
                  onClick={(e) => e.stopPropagation()}
                  className="-mr-1.5 -mt-0.5"
                >
                  <ProjectActionsMenu
                    project={project}
                    onAddService={onAddService}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    triggerClassName="shrink-0 border border-transparent bg-transparent text-muted-foreground transition-colors hover:border-border/60 hover:bg-muted/60 hover:text-foreground"
                  />
                </CardAction>
              </div>
              <p
                className={`mb-2 mt-1 line-clamp-2 text-xs leading-relaxed ${
                  projectHasDescription(project)
                    ? "text-muted-foreground"
                    : "italic text-muted-foreground/70"
                }`}
              >
                {projectDescriptionText(project)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <StatusBadgeHover
                  status={project.status}
                  services={projectServiceStatuses(project)}
                />
                <span className="text-xs text-muted-foreground" aria-hidden>
                  ·
                </span>
                <span className="text-xs text-muted-foreground">
                  {projectServiceLabel(project)}
                </span>
                {project.status === "failed" && project.focusServiceId ? (
                  <Button
                    variant="link"
                    size="xs"
                    className="h-auto min-h-0 px-0 py-0 text-xs text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      onViewLogs()
                    }}
                  >
                    View logs
                  </Button>
                ) : null}
                {shouldShowServerBadge(project, activeServerId) ? (
                  <>
                    <span className="text-xs text-muted-foreground" aria-hidden>
                      ·
                    </span>
                    <ProjectServerBadge serverId={project.serverId} />
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
      <FrameFooter className="flex items-center justify-between gap-2">
        <ProjectSourceIcons project={project} />
        <div className="flex shrink-0 items-center gap-1.5">
          <DeployedTimeHover
            dateStr={timeMeta.dateStr}
            label={timeMeta.label}
            relative={timeMeta.at}
          />
          <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
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
          {Array.from({ length: TABLE_COLUMN_COUNT }).map((__, j) => (
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

  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null)
  const [editTarget, setEditTarget] = useState<ProjectSummary | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [showPruneModal, setShowPruneModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)
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

  const openProject = useCallback(
    (project: ProjectSummary) => {
      router.push(`/project/${project.id}`)
    },
    [router],
  )

  const addServiceToProject = useCallback(
    (project: ProjectSummary) => {
      router.push(`/deploy?projectId=${project.id}`)
    },
    [router],
  )

  const viewProjectLogs = useCallback(
    (project: ProjectSummary) => {
      if (project.focusServiceId) {
        router.push(`/logs?appId=${project.focusServiceId}&mode=build`)
        return
      }
      openProject(project)
    },
    [router, openProject],
  )

  const fetchProjects = useCallback(async () => {
    try {
      const data = await api.projects.list()
      setProjects(data)
    } catch (err) {
      console.error("Failed to fetch projects", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    const hasBuilding = projects.some((p) => p.status === "building")
    if (!hasBuilding) return
    const interval = setInterval(fetchProjects, 2500)
    return () => clearInterval(interval)
  }, [projects, fetchProjects])

  const handleCreateProject = async () => {
    const name = createName.trim()
    if (!name) return
    setIsCreating(true)
    try {
      const created = await api.projects.create({
        name,
        description: createDescription.trim() || undefined,
        serverId:
          activeServerId === "all" || activeServerId === "localhost"
            ? "localhost"
            : activeServerId,
      })
      setShowCreateModal(false)
      setCreateName("")
      setCreateDescription("")
      router.push(`/project/${created.id}`)
    } catch (err) {
      showToast(
        "Error",
        err instanceof Error ? err.message : "Failed to create project.",
        "destructive",
      )
    } finally {
      setIsCreating(false)
    }
  }

  const openEditProject = useCallback((project: ProjectSummary) => {
    setEditTarget(project)
    setEditName(project.name)
    setEditDescription(project.description?.trim() ?? "")
  }, [])

  const handleUpdateProject = async () => {
    if (!editTarget) return
    const name = editName.trim()
    if (name.length < 2 || name.length > 40) return
    setIsSavingEdit(true)
    try {
      await api.projects.update(
        editTarget.id,
        name,
        editDescription.trim(),
      )
      setEditTarget(null)
      setEditName("")
      setEditDescription("")
      showToast("Project updated", `"${name}" saved.`, "success")
      fetchProjects()
    } catch (err) {
      showToast(
        "Error",
        err instanceof Error ? err.message : "Failed to update project.",
        "destructive",
      )
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteProject = async (id: string) => {
    try {
      await api.projects.delete(id)
      showToast("Project deleted", "Project and all services removed.", "success")
      setDeleteTarget(null)
      fetchProjects()
    } catch (err) {
      showToast("Error", "Failed to delete project.", "destructive")
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

  const targetServerId =
    activeServerId === "all"
      ? "all"
      : activeServerId === "localhost"
        ? "localhost"
        : activeServerId

  const filteredProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          projectMatchesSearch(project, searchQuery) &&
          projectMatchesStatus(project, statusFilter) &&
          projectMatchesServer(project, targetServerId),
      ),
    [projects, searchQuery, statusFilter, targetServerId],
  )

  const projectCounts = useMemo(
    () => ({
      projects: filteredProjects.length,
      services: filteredProjects.reduce((n, p) => n + p.serviceCount, 0),
    }),
    [filteredProjects],
  )

  const isEmpty = !loading && filteredProjects.length === 0
  const noProjectsAtAll = !loading && projects.length === 0

  return (
    <AppShell appCount={projectCounts.services}>
      <div className="space-y-1 m-4 md:mx-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Projects
          </h2>
        </div>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Each project groups one or more services. Open a project to manage its services.
        </p>
      </div>
      {/* Subheader toolbar */}
      <div className="flex flex-col justify-between gap-2 px-4 md:px-6 py-2.5 backdrop-blur-xl sm:flex-row sm:items-center select-none">

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <InputGroup className="min-w-0 w-full sm:w-48">
            <InputGroupInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name..."
              type="search"
              aria-label="Filter applications by name"
            />
            <InputGroupAddon align="inline-end">
              <Button size="xs" variant="secondary">
                Search
              </Button>
            </InputGroupAddon>
          </InputGroup>

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
            projects={filteredProjects}
            counts={projectCounts}
            loading={loading}
            isEmpty={isEmpty}
            noProjectsAtAll={noProjectsAtAll}
            activeServerId={activeServerId}
            onOpenProject={openProject}
            onEdit={openEditProject}
            onDelete={(project) => setDeleteTarget(project)}
            onAddService={addServiceToProject}
            onViewLogs={viewProjectLogs}
            onCreateProject={() => setShowCreateModal(true)}
          />
        </div>

        {/* Desktop card (grid) view */}
        <div className={`hidden ${viewMode === "card" ? "md:block" : ""}`}>
          {loading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <CreateNewProjectCard onClick={() => setShowCreateModal(true)} />
              {filteredProjects.map((project) => (
                <ProjectSummaryCard
                  key={project.id}
                  project={project}
                  activeServerId={activeServerId}
                  onOpen={() => openProject(project)}
                  onEdit={() => openEditProject(project)}
                  onDelete={() => setDeleteTarget(project)}
                  onAddService={() => addServiceToProject(project)}
                  onViewLogs={() => viewProjectLogs(project)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))
          ) : (
            <>
              <CreateNewProjectCard onClick={() => setShowCreateModal(true)} />
              {filteredProjects.map((project) => (
                <ProjectSummaryCard
                  key={project.id}
                  project={project}
                  activeServerId={activeServerId}
                  onOpen={() => openProject(project)}
                  onEdit={() => openEditProject(project)}
                  onDelete={() => setDeleteTarget(project)}
                  onAddService={() => addServiceToProject(project)}
                  onViewLogs={() => viewProjectLogs(project)}
                />
              ))}
            </>
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
      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          setShowCreateModal(open)
          if (!open) {
            setCreateName("")
            setCreateDescription("")
          }
        }}
      >
        <DialogContent
          className="max-w-lg border-0 bg-transparent p-0 shadow-none before:hidden [&::after]:hidden"
          closeProps={{ className: "absolute end-3.5 top-3.5 z-10" }}
        >
          <Frame className="w-full border border-border/80 bg-muted/55 p-1 shadow-xs/5 dark:border-border/35 dark:bg-muted/25 dark:shadow-none">
            <Card className="border-0 bg-background shadow-none before:hidden after:hidden dark:bg-card">
              <CardHeader className="">
                <div className="flex items-start gap-3 pr-8">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
                    <IconFolder className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <DialogTitle className="text-lg font-semibold leading-snug">
                      Create new project
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed">
                      Group services under one project.
                    </DialogDescription>
                  </div>
                </div>
              </CardHeader>

              <CardPanel className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="project-name"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Project name
                  </Label>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <IconFolder className="h-4 w-4 opacity-70" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="project-name"
                      value={createName}
                      onChange={(e) =>
                        setCreateName(normalizeProjectNameInput(e.target.value))
                      }
                      placeholder="my-app"
                      className="font-mono text-sm"
                      autoFocus
                      aria-invalid={
                        createName.length > 0 &&
                        (createName.length < 2 || createName.length > 40)
                          ? true
                          : undefined
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) handleCreateProject()
                      }}
                    />
                  </InputGroup>
                  <p className="text-[11px] text-muted-foreground">
                    Lowercase letters, digits, and hyphens · spaces become hyphens · 2–40 characters
                    {createName.length > 0 ? (
                      <span
                        className={
                          createName.length >= 2 && createName.length <= 40
                            ? " text-foreground/70"
                            : " text-destructive"
                        }
                      >
                        {" "}
                        · {createName.length}/40
                      </span>
                    ) : null}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="project-description"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Description
                    <span className="ml-1 font-normal normal-case">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    id="project-description"
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="What is this project for?"
                    rows={3}
                    maxLength={PROJECT_DESCRIPTION_MAX}
                    className="max-h-32 min-h-20 resize-y overflow-y-auto text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Shown on the project card
                    {createDescription.length > 0
                      ? ` · ${createDescription.length}/${PROJECT_DESCRIPTION_MAX}`
                      : ` · up to ${PROJECT_DESCRIPTION_MAX} characters`}
                  </p>
                </div>

                <div className="flex gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-[11px] leading-snug text-muted-foreground">
                  <NucleoIcon
                    name="info"
                    className="h-3.5 w-3.5 shrink-0 text-primary"
                  />
                  <span>
                    After creating the project, add services from Git, Docker, or
                    the catalog.
                  </span>
                </div>
              </CardPanel>

              <CardFooter className="justify-end gap-2 mt-4">
                <DialogClose
                  render={
                    <Button variant="ghost" disabled={isCreating}>
                      Cancel
                    </Button>
                  }
                />
                <Button
                  onClick={handleCreateProject}
                  disabled={
                    isCreating ||
                    createName.length < 2 ||
                    createName.length > 40
                  }
                  loading={isCreating}
                  className="gap-1.5"
                >
                  Create project
                </Button>
              </CardFooter>
            </Card>
          </Frame>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null)
            setEditName("")
            setEditDescription("")
          }
        }}
      >
        <DialogContent
          className="max-w-lg border-0 bg-transparent p-0 shadow-none before:hidden [&::after]:hidden"
          closeProps={{ className: "absolute end-3.5 top-3.5 z-10" }}
        >
          <Frame className="w-full border border-border/80 bg-muted/55 p-1 shadow-xs/5 dark:border-border/35 dark:bg-muted/25 dark:shadow-none">
            <Card className="border-0 bg-background shadow-none before:hidden after:hidden dark:bg-card">
              <CardHeader className="">
                <div className="flex items-start gap-3 pr-8">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
                    <EditIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <DialogTitle className="text-lg font-semibold leading-snug">
                      Edit project
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed">
                      Update the project name and description.
                    </DialogDescription>
                  </div>
                </div>
              </CardHeader>

              <CardPanel className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="edit-project-name"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Project name
                  </Label>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <IconFolder className="h-4 w-4 opacity-70" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="edit-project-name"
                      value={editName}
                      onChange={(e) =>
                        setEditName(normalizeProjectNameInput(e.target.value))
                      }
                      placeholder="my-app"
                      className="font-mono text-sm"
                      autoFocus
                      aria-invalid={
                        editName.length > 0 &&
                        (editName.length < 2 || editName.length > 40)
                          ? true
                          : undefined
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) handleUpdateProject()
                      }}
                    />
                  </InputGroup>
                  <p className="text-[11px] text-muted-foreground">
                    Lowercase letters, digits, and hyphens · spaces become hyphens · 2–40 characters
                    {editName.length > 0 ? (
                      <span
                        className={
                          editName.length >= 2 && editName.length <= 40
                            ? " text-foreground/70"
                            : " text-destructive"
                        }
                      >
                        {" "}
                        · {editName.length}/40
                      </span>
                    ) : null}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="edit-project-description"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Description
                    <span className="ml-1 font-normal normal-case">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    id="edit-project-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="What is this project for?"
                    rows={3}
                    maxLength={PROJECT_DESCRIPTION_MAX}
                    className="max-h-32 min-h-20 resize-y overflow-y-auto text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Shown on the project card
                    {editDescription.length > 0
                      ? ` · ${editDescription.length}/${PROJECT_DESCRIPTION_MAX}`
                      : ` · up to ${PROJECT_DESCRIPTION_MAX} characters`}
                  </p>
                </div>
              </CardPanel>

              <CardFooter className="mt-4 justify-end gap-2">
                <DialogClose
                  render={
                    <Button variant="ghost" disabled={isSavingEdit}>
                      Cancel
                    </Button>
                  }
                />
                <Button
                  onClick={handleUpdateProject}
                  disabled={
                    isSavingEdit ||
                    editName.length < 2 ||
                    editName.length > 40
                  }
                  loading={isSavingEdit}
                >
                  Save changes
                </Button>
              </CardFooter>
            </Card>
          </Frame>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        appName={deleteTarget?.name ?? ""}
        onConfirm={() =>
          deleteTarget ? handleDeleteProject(deleteTarget.id) : Promise.resolve()
        }
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
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
