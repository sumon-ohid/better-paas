"use client"

import React, { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BreadcrumbLink, BreadcrumbPage } from "@/components/ui/breadcrumb"
import {
  BreadcrumbHeaderRow,
  BreadcrumbRenameIconButton,
  BreadcrumbRenameInput,
  ProjectBreadcrumb,
} from "@/components/project-breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardPanel,
} from "@/components/ui/card"
import { Frame, FrameFooter, FramePanel, FrameTitle, FrameDescription } from "@/components/ui/frame"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { NucleoIcon } from "@/components/nucleo-icons"
import { AppShell } from "@/components/app-shell"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { DeleteConfirmModal } from "@/components/delete-confirm-modal"
import { AppDomains } from "@/components/app-domains"
import { AppVulnerabilities } from "@/components/app-vulnerabilities"
import { SitePreview } from "@/components/site-preview"
import { EnvVarsCard } from "@/components/env-vars-card"
import { EnvVarsEditModal } from "@/components/env-vars-edit-modal"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
} from "@/components/ui/alert-dialog"
import { getAppUrl } from "@/lib/utils"
import type {
  App,
  DeploymentRecord,
  GitHubContent,
  LogEntry,
  Vulnerability,
} from "@/lib/types"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { Docker } from "@/components/ui/svgs/docker"
import { Nix } from "@/components/ui/svgs/nix"
import { useAppDetail } from "./app-detail-context"
import {
  githubCommitUrl,
  githubBranchUrl,
  lineColor,
  timeAgo,
} from "./app-detail-utils"
import type { AppTab } from "./app-detail-types"
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CopyIcon,
  EditIcon,
  ExternalIcon,
  FolderIcon,
  GitBranchIcon,
  GitCommitIcon,
  LoaderIcon,
  PlayIcon,
  RefreshIcon,
  SearchIcon,
  SquareIcon,
  TerminalIcon,
  Trash2Icon,
  XIcon,
} from "./app-detail-icons"

// The context is intentionally assembled in page.tsx; this view narrows the
// collections whose callbacks need concrete types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ViewContext = Record<string, any> & {
  app: App
  setApp: React.Dispatch<React.SetStateAction<App | null>>
  composePrimaryApp: App
  isComposeChild: boolean
  deployments: DeploymentRecord[]
  branches: string[]
  logs: LogEntry[]
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>
  termReconnectToken: number
  setTermReconnectToken: React.Dispatch<React.SetStateAction<number>>
  vulnerabilities: Vulnerability[]
  folderBrowserBreadcrumbs: string[]
  folderBrowserContents: GitHubContent[]
}

// xterm.js touches the DOM on import, so load the terminal client-side only.
const ContainerTerminal = dynamic(
  () =>
    import("@/components/container-terminal").then((m) => m.ContainerTerminal),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-border/80 bg-card text-xs text-muted-foreground">
        Loading terminal…
      </div>
    ),
  }
)

export function AppDetailView() {
  const {
    app,
    setApp,
    router,
    appId,
    allProjects,
    resolvedProjectId,
    projectName,
    isComposeChild,
    deployments,
    isEditingName,
    renameInputRef,
    renameValue,
    setRenameValue,
    isRenaming,
    handleRename,
    cancelRename,
    startRename,
    isToggling,
    handleToggle,
    isRedeploying,
    handleRedeploy,
    currentTab,
    setTab,
    copied,
    handleCopyUrl,
    setShowDeleteModal,
    showEnvVarsModal,
    setShowEnvVarsModal,
    handleSaveEnvVars,
    gitRepo,
    setGitRepo,
    branch,
    setBranch,
    branches,
    isFetchingBranches,
    rootDir,
    handleRootDirChange,
    openFolderBrowser,
    isDetectingFramework,
    detectedFramework,
    dockerfileAvailable,
    buildMethod,
    setBuildMethod,
    dockerfilePath,
    setDockerfilePath,
    portOverride,
    setPortOverride,
    autoDeploy,
    setAutoDeploy,
    installCommand,
    setInstallCommand,
    buildCommand,
    setBuildCommand,
    startCommand,
    setStartCommand,
    isSaving,
    handleSaveConfig,
    logsConnected,
    logs,
    connectLogs,
    setLogs,
    logEndRef,
    termReconnectToken,
    setTermReconnectToken,
    expandedDepl,
    setExpandedDepl,
    setRollbackTarget,
    scanVulnerabilities,
    loadingVul,
    vulScanRun,
    vulScannedAt,
    vulUpdatePending,
    vulnerabilities,
    packageManager,
    fixingVul,
    fixVulnerability,
    showDeleteModal,
    handleDelete,
    rollbackTarget,
    isRollingBack,
    handleRollback,
    showFolderBrowser,
    setShowFolderBrowser,
    folderBrowserPath,
    folderBrowserBreadcrumbs,
    navigateToBreadcrumb,
    folderBrowserLoading,
    folderBrowserContents,
    navigateIntoFolder,
    setRootDir,
    rootDirDetectTimer,
    redetectForRootDir,
    selectFolder,
  } = useAppDetail() as ViewContext

  const [logQuery, setLogQuery] = useState("")
  const [logCopied, setLogCopied] = useState(false)

  const filteredLogs = logQuery.trim()
    ? logs.filter((l) =>
        l.message.toLowerCase().includes(logQuery.trim().toLowerCase()),
      )
    : logs

  const handleCopyLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.message}`,
      )
      .join("\n")
    navigator.clipboard.writeText(text)
    setLogCopied(true)
    setTimeout(() => setLogCopied(false), 1500)
  }

  // The deployment currently serving traffic: prefer the one that produced the
  // live image, otherwise fall back to the most recent successful build.
  const activeDeployment =
    deployments.find((d) => d.id === app.activeDeployId) ??
    deployments.find((d) => !!d.image && d.image === app.activeImage) ??
    deployments.find((d) => d.status === "success") ??
    deployments[0] ??
    null

  const overviewCommit = app.activeCommit || activeDeployment?.commit || ""
  const overviewCommitMsg =
    app.activeCommitMsg || activeDeployment?.commitMsg || ""
  const overviewCommitUrl = overviewCommit
    ? githubCommitUrl(app.gitRepo, overviewCommit)
    : ""
  const overviewBranchUrl = app.branch
    ? githubBranchUrl(app.gitRepo, app.branch)
    : ""
  const overviewDomains = (
    app.domains && app.domains.length > 0 ? app.domains : [app.url]
  ).filter(Boolean)

  const tabs: { id: AppTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "config", label: "Configuration" },
    { id: "domains", label: "Domains" },
    { id: "logs", label: "Logs" },
    { id: "terminal", label: "Terminal" },
    { id: "deployments", label: "Deployments" },
    { id: "vulnerabilities", label: "Vulnerabilities" },
  ]

  return (
    <AppShell>
      <Tabs value={currentTab} onValueChange={(value) => setTab(value as AppTab)} className="flex h-full flex-col">
        {/* Header */}
        <div className="shrink-0 bg-transparent px-4 py-3">
          <div className="space-y-3">
            <BreadcrumbHeaderRow
              trailing={
                <>
                  <StatusBadge status={app.status} />
                  {!isComposeChild && !isEditingName ? (
                    <button
                      type="button"
                      onClick={startRename}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Rename service"
                      aria-label="Rename service"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </>
              }
            >
              <ProjectBreadcrumb
                projects={allProjects ?? []}
                currentProjectId={resolvedProjectId}
                projectCrumb={
                  <BreadcrumbLink
                    render={<Link href={`/project/${resolvedProjectId}`} />}
                  >
                    {projectName}
                  </BreadcrumbLink>
                }
                serviceCrumb={
                  isEditingName ? (
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <BreadcrumbRenameInput
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) =>
                          setRenameValue(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, ""),
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename()
                          if (e.key === "Escape") cancelRename()
                        }}
                        disabled={isRenaming}
                        aria-label="Service name"
                      />
                      <BreadcrumbRenameIconButton
                        onClick={() => void handleRename()}
                        disabled={isRenaming}
                        label="Save name"
                        variant="success"
                      >
                        {isRenaming ? (
                          <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckIcon className="h-3.5 w-3.5" />
                        )}
                      </BreadcrumbRenameIconButton>
                      <BreadcrumbRenameIconButton
                        onClick={cancelRename}
                        disabled={isRenaming}
                        label="Cancel rename"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </BreadcrumbRenameIconButton>
                    </div>
                  ) : (
                    <BreadcrumbPage>
                      {app.composeService || app.serviceName || app.name}
                    </BreadcrumbPage>
                  )
                }
              />
            </BreadcrumbHeaderRow>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {app.composeService && (
                  <Badge variant="outline" size="sm" className="gap-1 font-mono shrink-0">
                    <Docker className="h-3 w-3" />
                    compose
                  </Badge>
                )}
                {app.branch && (
                  <div className="flex min-w-0 items-center gap-1.5 text-xs">
                    <span className="shrink-0 text-muted-foreground">
                      Current Branch
                    </span>
                    {overviewBranchUrl ? (
                      <a
                        href={overviewBranchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-w-0 items-center gap-1 font-mono text-foreground transition-colors hover:text-primary"
                      >
                        <GitBranchIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{app.branch}</span>
                      </a>
                    ) : (
                      <span className="inline-flex min-w-0 items-center gap-1 font-mono text-muted-foreground">
                        <GitBranchIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{app.branch}</span>
                      </span>
                    )}
                  </div>
                )}
                {overviewCommitMsg && (
                  <div className="flex min-w-0 items-center gap-1.5 text-xs">
                    {overviewCommitUrl ? (
                      <a
                        href={overviewCommitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-w-0 items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
                        title={overviewCommit}
                      >
                        <GitCommitIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{overviewCommitMsg}</span>
                      </a>
                    ) : (
                      <span
                        className="inline-flex min-w-0 items-center gap-1 text-muted-foreground"
                        title={overviewCommit || undefined}
                      >
                        <GitCommitIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{overviewCommitMsg}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
              {app.status === "running" ? (
                <Button
                  onClick={() => handleToggle("stop")}
                  disabled={isToggling}
                  variant="outline"
                  className="h-7 border-amber-500/30 text-xs text-amber-500 hover:bg-amber-500/10 hover:text-amber-600"
                >
                  <SquareIcon className="mr-1 h-3 w-3" />
                  Stop
                </Button>
              ) : app.status === "stopped" ? (
                <Button
                  onClick={() => handleToggle("start")}
                  disabled={isToggling}
                  variant="outline"
                  className="h-7 border-emerald-500/30 text-xs text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600"
                >
                  <PlayIcon className="mr-1 h-3 w-3" />
                  Start
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      disabled={isRedeploying || app.status === "building"}
                      variant="outline"
                      className="h-7 gap-1 border-primary/30 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <RefreshIcon
                        className={`h-3 w-3 ${isRedeploying ? "animate-spin" : ""}`}
                      />
                      {isRedeploying ? "Redeploying..." : "Redeploy"}
                      <ChevronDownIcon className="h-3 w-3 opacity-80" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => handleRedeploy(false)}>
                    <RefreshIcon className="mr-2 h-4 w-4" />
                    Redeploy (Default)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleRedeploy(true)}>
                    <Trash2Icon className="mr-2 h-4 w-4 text-destructive" />
                    Redeploy & Clear Cache
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="-mx-4 mt-3 border-b border-border/50 px-4 overflow-x-auto scrollbar-none">
            <TabsList variant="underline" className="w-auto [&>[data-slot=tabs-tab]]:grow-0">
              {tabs.map((t) => (
                <TabsTab key={t.id} value={t.id}>
                  {t.label}
                </TabsTab>
              ))}
            </TabsList>
          </div>
        </div>

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* ── Overview ───────────────────────────────────────────────── */}
          <TabsPanel value="overview">
            <div className="h-full overflow-y-auto p-4 md:p-6">
              <div className="animate-in fade-in-50 mx-auto max-w-6xl space-y-6 duration-200">
                {/* Overview card: Frame + Card with sticky preview and lighter metadata */}
                <Frame className="w-full">
                  <Card>
                    <CardPanel>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-0">
                        {/* Left: Live site preview — pinned on desktop */}
                        <div className="lg:sticky lg:top-4 lg:self-start">
                          <SitePreview
                            url={getAppUrl(app)}
                            status={app.status}
                            className="border-0 shadow-none lg:rounded-r-none"
                          />
                        </div>

                        {/* Right: Deployment summary — lighter background */}
                        <div className="rounded-xl lg:rounded-l-none lg:border-l-0 lg:px-6">
                          <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                            {/* Created */}
                            <div className="space-y-1.5">
                              <span className="block text-xs font-medium text-muted-foreground">
                                Created
                              </span>
                              <div className="flex items-center gap-1.5 text-sm text-foreground">
                                <NucleoIcon
                                  name="cloud"
                                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                />
                                <span className="font-medium">
                                  {new Date(app.createdAt).toLocaleDateString(
                                    undefined,
                                    { month: "short", day: "numeric" }
                                  )}
                                </span>
                                <span className="text-muted-foreground">
                                  {timeAgo(app.createdAt)}
                                </span>
                              </div>
                            </div>

                            {/* Status */}
                            <div className="space-y-1.5">
                              <span className="block text-xs font-medium text-muted-foreground">
                                Status
                              </span>
                              <StatusBadge status={app.status} />
                            </div>

                            {/* Duration */}
                            <div className="space-y-1.5">
                              <span className="block text-xs font-medium text-muted-foreground">
                                Duration
                              </span>
                              <div className="flex items-center gap-1.5 text-sm text-foreground">
                                <NucleoIcon
                                  name="activity"
                                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                />
                                <span className="font-medium tabular-nums">
                                  {activeDeployment?.duration || "—"}
                                </span>
                                {activeDeployment?.createdAt && (
                                  <span className="text-muted-foreground">
                                    {timeAgo(activeDeployment.createdAt)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Port Routing */}
                            <div className="space-y-1.5">
                              <span className="block text-xs font-medium text-muted-foreground">
                                Port Routing
                              </span>
                              <div className="flex items-center gap-1.5 text-sm text-foreground">
                                <NucleoIcon
                                  name="server"
                                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                />
                                <span className="font-mono font-medium tabular-nums">
                                  {app.port}
                                  {app.portOverride ? ` → ${app.portOverride}` : ""}
                                </span>
                              </div>
                            </div>

                            {/* Domains */}
                            <div className="space-y-1.5">
                              <span className="block text-xs font-medium text-muted-foreground">
                                Domains
                              </span>
                              <div className="space-y-1">
                                {overviewDomains.length === 0 ? (
                                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <NucleoIcon
                                      name="web"
                                      className="h-3.5 w-3.5 shrink-0"
                                    />
                                    <span>
                                      {app.composeService
                                        ? "Internal service — no public URL"
                                        : "No public URL"}
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <a
                                        href={getAppUrl(app)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
                                      >
                                        <NucleoIcon
                                          name="web"
                                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                        />
                                        <span className="truncate">
                                          {overviewDomains[0].replace(
                                            /^https?:\/\//,
                                            ""
                                          )}
                                        </span>
                                        {overviewDomains.length > 1 && (
                                          <Badge
                                            variant="secondary"
                                            size="sm"
                                            className="shrink-0"
                                          >
                                            +{overviewDomains.length - 1}
                                          </Badge>
                                        )}
                                      </a>
                                      <button
                                        onClick={handleCopyUrl}
                                        title="Copy URL"
                                        className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                      >
                                        {copied ? (
                                          <CheckIcon className="h-3 w-3 text-success" />
                                        ) : (
                                          <CopyIcon className="h-3 w-3" />
                                        )}
                                      </button>
                                    </div>
                                    {overviewDomains.slice(1, 3).map((d) => (
                                      <a
                                        key={d}
                                        href={
                                          d.startsWith("http") ? d : `https://${d}`
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                                      >
                                        <NucleoIcon
                                          name="link"
                                          className="h-3 w-3 shrink-0"
                                        />
                                        <span className="truncate">
                                          {d.replace(/^https?:\/\//, "")}
                                        </span>
                                      </a>
                                    ))}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Source */}
                            <div className="space-y-1.5 sm:col-span-2">
                              <span className="block text-xs font-medium text-muted-foreground">
                                Source
                              </span>
                              <div className="space-y-1">
                                <a
                                  href={app.gitRepo}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
                                >
                                  {app.gitRepo.includes("github.com") ? (
                                    <>
                                      <GithubLight className="h-3.5 w-3.5 shrink-0 dark:hidden" />
                                      <GithubDark className="hidden h-3.5 w-3.5 shrink-0 dark:block" />
                                    </>
                                  ) : (
                                    <NucleoIcon
                                      name="branch"
                                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                    />
                                  )}
                                  <span className="truncate font-mono">
                                    {app.gitRepo.replace(/^https?:\/\//, "")}
                                  </span>
                                  <ExternalIcon className="h-3 w-3 shrink-0 opacity-60" />
                                </a>
                                {app.branch && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <GitBranchIcon className="h-3 w-3 shrink-0" />
                                    <span className="truncate font-mono">
                                      {app.branch}
                                    </span>
                                  </div>
                                )}
                                {overviewCommit ? (
                                  overviewCommitUrl ? (
                                    <a
                                      href={overviewCommitUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                                      title={overviewCommitMsg || undefined}
                                    >
                                      <GitCommitIcon className="h-3 w-3 shrink-0" />
                                      <span className="font-mono">
                                        {overviewCommit.slice(0, 7)}
                                      </span>
                                      {overviewCommitMsg && (
                                        <span className="truncate">
                                          {overviewCommitMsg}
                                        </span>
                                      )}
                                    </a>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <GitCommitIcon className="h-3 w-3 shrink-0" />
                                      <span className="font-mono">
                                        {overviewCommit.slice(0, 7)}
                                      </span>
                                      {overviewCommitMsg && (
                                        <span className="truncate">
                                          {overviewCommitMsg}
                                        </span>
                                      )}
                                    </div>
                                  )
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardPanel>
                  </Card>
                </Frame>

                {app.envVars && Object.keys(app.envVars).length > 0 && (
                  <EnvVarsCard
                    envVars={app.envVars}
                    secretKeys={app.secretKeys}
                    onEdit={() => setShowEnvVarsModal(true)}
                  />
                )}

                <Frame className="w-full">
                  <Card>
                    <CardPanel>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">Delete project</p>
                          <p className="text-xs text-muted-foreground">
                            Permanently remove this app and all its data. This
                            cannot be undone.
                          </p>
                        </div>
                        <Button
                          onClick={() => setShowDeleteModal(true)}
                          variant="outline"
                          className="h-8 border-rose-500/30 text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                        >
                          <Trash2Icon className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </CardPanel>
                  </Card>
                  <FrameFooter>
                    <div className="flex gap-1.5 text-muted-foreground text-xs">
                      <CircleAlertIcon className="size-3 shrink-0 mt-0.5" />
                      <p>This action cannot be undone.</p>
                    </div>
                  </FrameFooter>
                </Frame>
              </div>
            </div>
          </TabsPanel>

          {/* ── Configuration ──────────────────────────────────────────── */}
          <TabsPanel value="config">
            <div className="h-full overflow-y-auto p-4 md:p-6">
              <div className="animate-in fade-in-50 mx-auto max-w-6xl space-y-4 duration-200">
                <Frame className="w-full">
                  {/* Compose notice */}
                  {app.composeService && (
                    <FramePanel className="mb-2">
                      <div className="flex items-start gap-2.5">
                        <Docker className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-foreground">
                            Docker Compose Service
                          </p>
                          <p className="text-xs text-muted-foreground">
                            This is the{" "}
                            <span className="font-mono font-semibold">
                              {app.composeService}
                            </span>{" "}
                            service of a Docker Compose project. Build settings
                            are controlled by the compose file in the repo, not
                            here. Redeploy rebuilds the whole project; deleting
                            any service removes the entire group.
                          </p>
                        </div>
                      </div>
                    </FramePanel>
                  )}

                  {/* Source + Build (combined card) */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Build &amp; Deploy</CardTitle>
                      <CardDescription>
                        Where your code lives and how it gets built.
                      </CardDescription>
                    </CardHeader>
                    <CardPanel className="space-y-4">
                      {/* Git Repository */}
                      <Field>
                        <FieldLabel className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                          Git Repository URL
                        </FieldLabel>
                        <div className="relative flex items-center gap-2 min-w-full">
                          <div className="relative flex-1">
                            {app?.gitRepo?.includes("github.com") && (
                              <div className="pointer-events-none absolute top-1/2 left-2.5 z-10 -translate-y-1/2">
                                <GithubLight className="h-4 w-4 dark:hidden" />
                                <GithubDark className="hidden h-4 w-4 dark:block" />
                              </div>
                            )}
                            <Input
                              value={gitRepo}
                              onChange={(e) => setGitRepo(e.target.value)}
                              className={`h-9 text-sm ${app?.gitRepo?.includes("github.com") ? "pl-8" : ""}`}
                            />
                          </div>
                          <a
                            href={app.gitRepo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                            title="Open repository"
                          >
                            <ExternalIcon className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </Field>

                      {/* Branch + Root Directory */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field>
                          <FieldLabel className="text-xs mb-2 font-bold tracking-wider text-muted-foreground uppercase">
                            Branch
                          </FieldLabel>
                          {isFetchingBranches ? (
                            <div className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
                              <RefreshIcon className="h-3 w-3 animate-spin" />
                              Fetching branches...
                            </div>
                          ) : branches.length > 0 ? (
                            <Select
                              value={branch}
                              onValueChange={(v) => setBranch(v ?? "")}
                            >
                              <SelectTrigger className="h-9 w-full text-sm">
                                <SelectValue placeholder="Select branch..." />
                              </SelectTrigger>
                              <SelectPopup>
                                {branches.map((b) => (
                                  <SelectItem key={b} value={b}>
                                    {b}
                                  </SelectItem>
                                ))}
                              </SelectPopup>
                            </Select>
                          ) : (
                            <Input
                              value={branch}
                              onChange={(e) => setBranch(e.target.value)}
                              placeholder="main"
                              className="h-9 text-sm"
                            />
                          )}
                        </Field>

                        <Field>
                          <div className="flex items-center justify-between">
                            <FieldLabel className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                              Root Directory
                            </FieldLabel>
                            <Button
                              size="xs"
                              variant="link"
                              onClick={openFolderBrowser}
                              disabled={!gitRepo || !branch}
                              className="h-auto px-0 ml-2 py-0 text-[10px] text-primary"
                            >
                              Browse…
                            </Button>
                          </div>
                          <Input
                            value={rootDir}
                            onChange={(e) =>
                              handleRootDirChange(e.target.value)
                            }
                            placeholder="./"
                            className="h-9 text-sm"
                          />
                        </Field>
                      </div>

                      {/* Framework detection */}
                      {(isDetectingFramework || detectedFramework) && (
                        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
                          {isDetectingFramework ? (
                            <>
                              <RefreshIcon className="h-4 w-4 animate-spin text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">
                                Scanning directory for a framework…
                              </p>
                            </>
                          ) : detectedFramework ? (
                            <>
                              {detectedFramework.icon ? (
                                <detectedFramework.icon className="h-5 w-5 shrink-0" />
                              ) : null}
                              <p className="text-xs text-foreground">
                                {detectedFramework.name} detected{" "}
                                <span className="text-muted-foreground">
                                  — commands updated below
                                </span>
                              </p>
                            </>
                          ) : null}
                        </div>
                      )}

                      {/* Divider */}
                      <div className="h-px bg-border" />

                      {/* Build method */}
                      {dockerfileAvailable && (
                        <Field>
                          <FieldLabel className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                            Build Method
                          </FieldLabel>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {[
                              {
                                id: "nixpacks" as const,
                                label: "Nixpacks",
                                desc: "Auto-detect framework and build",
                                icon: <Nix className="h-5 w-5 text-foreground" />,
                              },
                              {
                                id: "dockerfile" as const,
                                label: "Dockerfile",
                                desc: "Use a custom Dockerfile",
                                icon: <Docker className="h-5 w-5" />,
                              },
                            ].map((opt) => {
                              const active = buildMethod === opt.id
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => setBuildMethod(opt.id)}
                                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                    active
                                      ? "border-primary bg-primary/5"
                                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                                  }`}
                                >
                                  {opt.icon}
                                  <span className="flex flex-col">
                                    <span className="text-sm font-semibold text-foreground">
                                      {opt.label}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {opt.desc}
                                    </span>
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </Field>
                      )}

                      {dockerfileAvailable &&
                        buildMethod === "dockerfile" && (
                          <Field>
                            <FieldLabel className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                              Dockerfile Path
                            </FieldLabel>
                            <Input
                              value={dockerfilePath}
                              onChange={(e) =>
                                setDockerfilePath(e.target.value)
                              }
                              placeholder="Dockerfile"
                              className="h-9 font-mono text-sm"
                            />
                            <FieldDescription>
                              Relative to the root directory. Install/build/start
                              commands are ignored — your Dockerfile controls the
                              build. Make sure it exposes the app on the port
                              above.
                            </FieldDescription>
                          </Field>
                        )}

                      {/* Port + Install */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field>
                          <FieldLabel className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                            Port Override
                          </FieldLabel>
                          <Input
                            value={portOverride}
                            onChange={(e) =>
                              setPortOverride(
                                e.target.value.replace(/\D/g, "")
                              )
                            }
                            placeholder="3000"
                            className="h-9 text-sm"
                          />
                        </Field>
                        {buildMethod === "nixpacks" && (
                          <Field>
                            <FieldLabel className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                              Install Command
                            </FieldLabel>
                            <Input
                              value={installCommand}
                              onChange={(e) =>
                                setInstallCommand(e.target.value)
                              }
                              placeholder="npm install"
                              className="h-9 text-sm"
                            />
                          </Field>
                        )}
                      </div>

                      {/* Build + Start */}
                      {buildMethod === "nixpacks" && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Field>
                            <FieldLabel className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                              Build Command
                            </FieldLabel>
                            <Input
                              value={buildCommand}
                              onChange={(e) =>
                                setBuildCommand(e.target.value)
                              }
                              placeholder="npm run build"
                              className="h-9 text-sm"
                            />
                          </Field>
                          <Field>
                            <FieldLabel className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                              Start Command
                            </FieldLabel>
                            <Input
                              value={startCommand}
                              onChange={(e) =>
                                setStartCommand(e.target.value)
                              }
                              placeholder="npm start"
                              className="h-9 text-sm"
                            />
                          </Field>
                        </div>
                      )}

                      {app.gitRepo?.includes("github.com") && (
                        <label className="flex cursor-pointer items-start gap-2.5 border-t border-border pt-4">
                          <input
                            type="checkbox"
                            checked={autoDeploy}
                            onChange={(e) => setAutoDeploy(e.target.checked)}
                            className="mt-0.5 h-4 w-4 accent-primary"
                          />
                          <div>
                            <p className="text-xs font-medium text-foreground">
                              Auto-deploy on git push
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Redeploy when you push to the configured branch.
                            </p>
                          </div>
                        </label>
                      )}
                    </CardPanel>
                  </Card>

                  {/* Actions */}
                  <FrameFooter>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                      <Button
                        onClick={() => setTab("overview")}
                        variant="outline"
                        size="sm"
                      >
                        Discard
                      </Button>
                      <Button
                        onClick={handleSaveConfig}
                        disabled={isSaving}
                        size="sm"
                      >
                        {isSaving ? (
                          <>
                            <LoaderIcon className="mr-1 h-3 w-3 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Configuration"
                        )}
                      </Button>
                    </div>
                  </FrameFooter>
                </Frame>
              </div>
            </div>
          </TabsPanel>

          {/* ── Domains ────────────────────────────────────────────────── */}
          <TabsPanel value="domains">
            <AppDomains app={app} onChange={(updated) => setApp(updated)} />
          </TabsPanel>

          {/* ── Logs ───────────────────────────────────────────────────── */}
          <TabsPanel value="logs">
            <div className="animate-in fade-in-50 flex h-full min-h-0 flex-1 flex-col p-4 duration-200 md:p-6">
              <Frame className="h-full w-full">
                {/* Header */}
                <FramePanel className="shrink-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <FrameTitle>Runtime Logs</FrameTitle>
                      <FrameDescription className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${logsConnected ? "bg-success" : "bg-muted-foreground/30"}`}
                        />
                        {logsConnected
                          ? "Live stream connected"
                          : "Disconnected"}
                        {logs.length > 0 && (
                          <span className="text-muted-foreground/60">
                            · {logs.length.toLocaleString()} lines
                          </span>
                        )}
                      </FrameDescription>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {logs.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCopyLogs}
                          className="h-7 gap-1.5 text-xs"
                        >
                          {logCopied ? (
                            <CheckIcon className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <CopyIcon className="h-3.5 w-3.5" />
                          )}
                          {logCopied ? "Copied" : "Copy all"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => connectLogs()}
                        className="h-7 gap-1.5 text-xs"
                      >
                        <RefreshIcon className="h-3.5 w-3.5" />
                        Reconnect
                      </Button>
                      {logs.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setLogs([])
                            setLogQuery("")
                          }}
                          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                          Clear
                        </Button>
                      )}
                      {logs.length > 0 && (
                        <div className="relative mt-2 w-full sm:mt-0 sm:w-44">
                          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={logQuery}
                            onChange={(e) => setLogQuery(e.target.value)}
                            placeholder="Filter logs…"
                            className="h-7 w-full pl-7 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </FramePanel>

                {/* Log viewport */}
                <FramePanel className="relative flex min-h-0 flex-1 flex-col overflow-hidden !p-0">
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
                    {logs.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground/50 select-none">
                        <TerminalIcon
                          className={`h-8 w-8 opacity-25 ${logsConnected ? "animate-pulse" : ""}`}
                        />
                        {logsConnected ? (
                          <span>Connected — waiting for output…</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <RefreshIcon className="h-3.5 w-3.5 animate-spin" />
                            Connecting to runtime log stream…
                          </span>
                        )}
                      </div>
                    ) : filteredLogs.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/50 select-none">
                        <SearchIcon className="h-6 w-6 opacity-25" />
                        <span>
                          No logs match &ldquo;{logQuery.trim()}&rdquo;
                        </span>
                      </div>
                    ) : (
                      <>
                        {filteredLogs.map((log, i) => {
                          const lineNum =
                            logQuery.trim()
                              ? logs.indexOf(log) + 1
                              : i + 1
                          return (
                            <div
                              key={`${lineNum}-${log.timestamp}`}
                              className="group -mx-1 flex gap-3 rounded px-1 transition-colors hover:bg-foreground/[0.03] dark:hover:bg-white/[0.03]"
                            >
                              <span className="w-8 shrink-0 select-none text-right text-[10px] leading-loose text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/50">
                                {lineNum}
                              </span>
                              <span className="mt-px shrink-0 select-none text-[10px] leading-loose text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/50">
                                {new Date(
                                  log.timestamp,
                                ).toLocaleTimeString(undefined, {
                                  hour12: false,
                                })}
                              </span>
                              <span
                                className={`${lineColor(log.message)} break-all leading-loose`}
                              >
                                {log.message}
                              </span>
                            </div>
                          )
                        })}
                        <div ref={logEndRef} />
                      </>
                    )}
                  </div>
                </FramePanel>

                {/* Footer */}
                {logs.length > 0 && (
                  <FrameFooter className="shrink-0">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {logsConnected && (
                        <span className="flex items-center gap-1.5 text-success">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                          Live
                        </span>
                      )}
                      <span>
                        {filteredLogs.length.toLocaleString()}
                        {logQuery.trim() &&
                        filteredLogs.length !== logs.length
                          ? ` of ${logs.length.toLocaleString()}`
                          : ""}{" "}
                        lines
                      </span>
                      {logQuery.trim() &&
                        filteredLogs.length !== logs.length && (
                          <button
                            onClick={() => setLogQuery("")}
                            className="cursor-pointer text-primary underline-offset-2 hover:underline"
                          >
                            Clear filter
                          </button>
                        )}
                    </div>
                  </FrameFooter>
                )}
              </Frame>
            </div>
          </TabsPanel>

          {/* ── Terminal ───────────────────────────────────────────────── */}
          <TabsPanel value="terminal">
            <div className="animate-in fade-in-50 flex h-full min-h-0 flex-1 flex-col p-4 duration-200 md:p-6">
              <Frame className="h-full w-full">
                <FramePanel className="shrink-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <FrameTitle>Container Shell</FrameTitle>
                      <FrameDescription className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${app.status === "running" ? "bg-success" : app.status === "stopped" ? "bg-muted-foreground/30" : "bg-warning animate-pulse"}`}
                        />
                        {app.status === "running"
                          ? "Container is running — shell ready"
                          : app.status === "stopped"
                            ? "Container is stopped"
                            : app.status === "building"
                              ? "Build in progress…"
                              : `Status: ${app.status}`}
                      </FrameDescription>
                    </div>
                    {app.status === "running" && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setTermReconnectToken((t) => t + 1)
                          }
                          className="h-7 gap-1.5 text-xs"
                        >
                          <RefreshIcon className="h-3.5 w-3.5" />
                          Reconnect
                        </Button>
                      </div>
                    )}
                  </div>
                </FramePanel>

                {app.status !== "running" ? (
                  <FramePanel className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <TerminalIcon className="h-5 w-5 opacity-50" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">
                        Container not running
                      </p>
                      <p className="text-xs text-muted-foreground">
                        The shell needs a running container.
                      </p>
                    </div>
                    {app.status === "stopped" && (
                      <Button
                        onClick={() => handleToggle("start")}
                        disabled={isToggling}
                        variant="outline"
                        size="sm"
                        className="mt-1 h-8 gap-1.5 border-emerald-500/30 text-xs text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600"
                      >
                        <PlayIcon className="h-3.5 w-3.5" />
                        Start container
                      </Button>
                    )}
                  </FramePanel>
                ) : (
                  <FramePanel className="relative flex min-h-0 flex-1 flex-col overflow-hidden !p-0">
                    <ContainerTerminal
                      appId={appId}
                      appName={app.name}
                      reconnectToken={termReconnectToken}
                    />
                  </FramePanel>
                )}
              </Frame>
            </div>
          </TabsPanel>

          {/* ── Deployments ────────────────────────────────────────────── */}
          <TabsPanel value="deployments">
            <div className="animate-in fade-in-50 h-full overflow-y-auto p-4 duration-200 md:p-6">
              <div className="mx-auto max-w-6xl space-y-4">
                <Frame className="w-full">
                  {/* Header */}
                  <FramePanel className="shrink-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <FrameTitle>Deployment History</FrameTitle>
                        <FrameDescription>
                          {deployments.length === 0
                            ? app.status === "building"
                              ? "Waiting for the current build to finish…"
                              : "No deployments recorded yet."
                            : `${deployments.length} deployment${deployments.length !== 1 ? "s" : ""} recorded`}
                        </FrameDescription>
                      </div>

                      {deployments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {deployments.some(
                            (d) =>
                              d.status === "building" ||
                              d.status === "in_progress",
                          ) && (
                            <Badge variant="warning" size="sm">
                              Building
                            </Badge>
                          )}
                          <Badge variant="success" size="sm">
                            {
                              deployments.filter(
                                (d) => d.status === "success",
                              ).length
                            }{" "}
                            succeeded
                          </Badge>
                          <Badge variant="error" size="sm">
                            {
                              deployments.filter(
                                (d) =>
                                  d.status !== "success" &&
                                  d.status !== "building" &&
                                  d.status !== "in_progress",
                              ).length
                            }{" "}
                            failed
                          </Badge>
                        </div>
                      )}
                    </div>
                  </FramePanel>

                  {deployments.length === 0 ? (
                    <FramePanel className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                      <RefreshIcon className="h-6 w-6 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">
                        {app.status === "building"
                          ? "Waiting for the current build to finish…"
                          : "No deployments recorded for this project yet."}
                      </p>
                    </FramePanel>
                  ) : (
                    <>
                      <Table variant="card">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[1%] text-left pl-2">
                              #
                            </TableHead>
                            <TableHead className="w-[45%]">
                              Deployment
                            </TableHead>
                            <TableHead className="w-[15%]">Status</TableHead>
                            <TableHead className="w-[15%]">Duration</TableHead>
                            <TableHead className="w-[20%] text-right">
                              Started
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deployments.map((dep, idx) => {
                            const isExpanded = expandedDepl === dep.id
                            const isBuilding =
                              dep.status === "building" ||
                              dep.status === "in_progress"
                            const isSuccess = dep.status === "success"
                            const deployNumber = deployments.length - idx
                            const isLive =
                              !!dep.image && dep.image === app.activeImage
                            const canRollback =
                              isSuccess && !!dep.image && !isLive && !isBuilding
                            const commitUrl = dep.commit
                              ? githubCommitUrl(app.gitRepo, dep.commit)
                              : ""

                            return (
                              <React.Fragment key={dep.id}>
                                <TableRow
                                  className="cursor-pointer group"
                                  onClick={() =>
                                    setExpandedDepl(
                                      isExpanded ? null : dep.id,
                                    )
                                  }
                                >
                                  <TableCell className="text-left pl-6">
                                    <span className="text-[10px] font-mono text-muted-foreground/60">
                                      #{deployNumber}
                                    </span>
                                  </TableCell>

                                  <TableCell>
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                      <span className="truncate text-sm font-medium text-foreground">
                                        {dep.commitMsg ||
                                          (dep.trigger === "rollback"
                                            ? "Rollback"
                                            : "(no commit message)")}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {dep.commit &&
                                          (commitUrl ? (
                                            <a
                                              href={commitUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                              className="inline-flex items-center gap-1 rounded border border-border/80 bg-muted/30 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                                              title="View commit on GitHub"
                                            >
                                              <GitCommitIcon className="h-3 w-3" />
                                              {dep.commit.slice(0, 7)}
                                              <ExternalIcon className="h-2.5 w-2.5 opacity-60" />
                                            </a>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground/80">
                                              <GitCommitIcon className="h-3 w-3" />
                                              {dep.commit.slice(0, 7)}
                                            </span>
                                          ))}
                                        {app.branch && (
                                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground/80">
                                            <GitBranchIcon className="h-3 w-3" />
                                            {app.branch}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>

                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant={
                                          isBuilding
                                            ? "warning"
                                            : isSuccess
                                              ? "success"
                                              : "error"
                                        }
                                        size="sm"
                                        className="shrink-0"
                                      >
                                        {isBuilding ? (
                                          <LoaderIcon className="h-3 w-3 animate-spin" />
                                        ) : isSuccess ? (
                                          <CheckIcon className="h-3 w-3" />
                                        ) : (
                                          <XIcon className="h-3 w-3" />
                                        )}
                                        {isBuilding
                                          ? "Building"
                                          : isSuccess
                                            ? "Success"
                                            : "Failed"}
                                      </Badge>
                                      {isLive && (
                                        <Badge
                                          variant="info"
                                          size="sm"
                                          className="shrink-0 gap-1"
                                        >
                                          <span className="h-1.5 w-1.5 rounded-full bg-info" />
                                          Live
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>

                                  <TableCell>
                                    <span className="text-xs font-mono text-muted-foreground">
                                      {isBuilding
                                        ? "in progress"
                                        : dep.duration}
                                    </span>
                                  </TableCell>

                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <span className="text-xs text-muted-foreground tabular-nums">
                                        {new Date(
                                          dep.createdAt,
                                        ).toLocaleString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                      <ChevronLeftIcon
                                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                                          isExpanded
                                            ? "-rotate-90"
                                            : "rotate-180"
                                        }`}
                                      />
                                    </div>
                                  </TableCell>
                                </TableRow>

                                {isExpanded && (
                                  <TableRow className="hover:bg-transparent">
                                    <TableCell
                                      colSpan={5}
                                      className="max-w-full overflow-hidden whitespace-normal p-0"
                                    >
                                      <div className="max-w-full overflow-hidden border-t border-border/30 px-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/20 py-2">
                                          <span className="font-mono text-[11px] text-muted-foreground/50">
                                            Build log · {dep.logs.length} lines
                                            · {dep.duration}
                                            {dep.trigger && (
                                              <span className="ml-2">
                                                · {dep.trigger}
                                              </span>
                                            )}
                                          </span>
                                          <div className="flex items-center gap-3">
                                            {canRollback && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  setRollbackTarget(dep)
                                                }}
                                                className="flex cursor-pointer items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80"
                                              >
                                                <RefreshIcon className="h-3.5 w-3.5" />
                                                Rollback
                                              </button>
                                            )}
                                            {isLive && (
                                              <span className="flex items-center gap-1 text-xs text-info">
                                                <CheckIcon className="h-3.5 w-3.5" />
                                                Currently live
                                              </span>
                                            )}
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                router.push(
                                                  `/logs?appId=${appId}&mode=build`,
                                                )
                                              }}
                                              className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                                            >
                                              <TerminalIcon className="h-3.5 w-3.5" />
                                              Full log
                                            </button>
                                          </div>
                                        </div>
                                        <div className="max-h-80 space-y-0.5 overflow-y-auto overflow-x-hidden py-3 font-mono text-xs text-foreground">
                                          {dep.logs.length === 0 ? (
                                            <span className="text-muted-foreground/40 italic">
                                              No log output recorded.
                                            </span>
                                          ) : (
                                            dep.logs.map((line, i) => (
                                              <div
                                                key={i}
                                                className="flex min-w-0 gap-3"
                                              >
                                                <span className="w-6 shrink-0 select-none text-right text-[10px] leading-loose text-muted-foreground/30">
                                                  {i + 1}
                                                </span>
                                                <span
                                                  className={`min-w-0 ${lineColor(line)} break-all leading-loose`}
                                                >
                                                  {line}
                                                </span>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </TableBody>
                      </Table>

                      <FrameFooter className="shrink-0">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {deployments.filter((d) => d.status === "success")
                              .length}{" "}
                            successful ·{" "}
                            {
                              deployments.filter(
                                (d) =>
                                  d.status !== "success" &&
                                  d.status !== "building" &&
                                  d.status !== "in_progress",
                              ).length
                            }{" "}
                            failed
                          </span>
                          {deployments.some(
                            (d) =>
                              d.status === "building" ||
                              d.status === "in_progress",
                          ) && (
                            <span className="flex items-center gap-1.5 text-warning">
                              <LoaderIcon className="h-3 w-3 animate-spin" />
                              Build in progress
                            </span>
                          )}
                        </div>
                      </FrameFooter>
                    </>
                  )}
                </Frame>
              </div>
            </div>
          </TabsPanel>

          {/* ── Vulnerabilities ─────────────────────────────────────────── */}
          <TabsPanel value="vulnerabilities">
            <AppVulnerabilities
              app={app}
              vulnerabilities={vulnerabilities}
              packageManager={packageManager}
              loading={loadingVul}
              scanRun={vulScanRun}
              scannedAt={vulScannedAt}
              fixing={fixingVul}
              updatePending={vulUpdatePending}
              onScan={scanVulnerabilities}
              onFix={fixVulnerability}
            />
          </TabsPanel>
        </div>

      </Tabs>

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          appName={app?.name ?? ""}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />

        <EnvVarsEditModal
          isOpen={showEnvVarsModal}
          onClose={() => setShowEnvVarsModal(false)}
          envVars={app?.envVars ?? {}}
          secretKeys={app?.secretKeys ?? []}
          onSave={handleSaveEnvVars}
          isSaving={isSaving}
        />

        {/* Rollback Confirm Modal */}
        <AlertDialog
          open={!!rollbackTarget}
          onOpenChange={(open) => {
            if (!open) setRollbackTarget(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-info/10 text-info sm:mx-0">
                <RefreshIcon className="h-5 w-5" />
              </div>
              <AlertDialogTitle>Roll back deployment</AlertDialogTitle>
              <AlertDialogDescription>
                This re-releases the image built for{" "}
                {rollbackTarget?.commit ? (
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    {rollbackTarget.commit.slice(0, 7)}
                  </code>
                ) : (
                  "this deployment"
                )}
                {rollbackTarget?.commitMsg
                  ? ` — “${rollbackTarget.commitMsg}”`
                  : ""}
                . A new deployment will be created and your live container will
                be replaced with it. No rebuild happens, so it&apos;s fast.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose
                render={<Button variant="outline">Cancel</Button>}
              />
              <Button
                onClick={() => rollbackTarget && handleRollback(rollbackTarget)}
                disabled={isRollingBack}
                className="gap-1.5"
              >
                <RefreshIcon
                  className={`h-4 w-4 ${isRollingBack ? "animate-spin" : ""}`}
                />
                {isRollingBack ? "Rolling back…" : "Confirm rollback"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Folder Browser Modal */}
        <Dialog open={showFolderBrowser} onOpenChange={setShowFolderBrowser}>
          <DialogContent className="flex max-h-[70vh] flex-col sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">
                Select Root Directory
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Choose the directory containing your project files.
              </DialogDescription>
            </DialogHeader>

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 overflow-x-auto px-6 pb-1 text-xs text-muted-foreground">
              <button
                className={`flex shrink-0 items-center gap-0.5 hover:text-foreground ${folderBrowserPath === "" ? "font-medium text-foreground" : ""}`}
                onClick={() => navigateToBreadcrumb(-1)}
              >
                <NucleoIcon name="house" className="h-3 w-3" />
                Root
              </button>
              {folderBrowserBreadcrumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                  <ChevronRightIcon className="h-3 w-3 shrink-0" />
                  <button
                    className={`shrink-0 hover:text-foreground ${i === folderBrowserBreadcrumbs.length - 1 ? "font-medium text-foreground" : ""}`}
                    onClick={() => navigateToBreadcrumb(i)}
                  >
                    {crumb}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Current selection indicator */}
            {folderBrowserPath && (
              <div className="mx-6 mb-2 rounded border border-primary/20 bg-primary/5 px-2 py-1 text-xs font-medium text-primary">
                Selected: ./{folderBrowserPath}
              </div>
            )}

            {/* Folder list */}
            <div className="mx-6 mb-2 flex-1 overflow-y-auto rounded-md border border-border">
              {folderBrowserLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <RefreshIcon className="mr-2 h-4 w-4 animate-spin" />
                  Loading folders…
                </div>
              ) : folderBrowserContents.filter((i) => i.type === "dir")
                  .length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No subdirectories found.
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {folderBrowserContents
                    .filter((item) => item.type === "dir")
                    .map((item) => (
                      <div
                        key={item.path}
                        className="group flex cursor-pointer items-center justify-between px-4 py-2.5 hover:bg-muted/30"
                        onClick={() => navigateIntoFolder(item.name)}
                      >
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <FolderIcon className="h-4 w-4 text-muted-foreground group-hover:text-amber-400" />
                          {item.name}
                        </div>
                        <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 border-t border-border/40 px-6 pt-3 pb-6">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRootDir("")
                  setShowFolderBrowser(false)
                  if (rootDirDetectTimer.current)
                    clearTimeout(rootDirDetectTimer.current)
                  redetectForRootDir("")
                }}
                className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear selection
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => selectFolder(folderBrowserPath)}
                title={`Select ${folderBrowserPath || "Root (./)"}`}
                className="flex min-w-0 shrink items-center gap-1 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
              >
                <span className="shrink-0">Select</span>
                <span className="truncate font-mono">
                  {folderBrowserPath || "Root (./)"}
                </span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
    </AppShell>
  )
}
