"use client"

import React from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu"
import {
  Card,
  CardFrame,
  CardHeader,
  CardTitle,
  CardDescription,
  CardPanel,
} from "@/components/ui/card"
import { Frame, FrameFooter, FramePanel } from "@/components/ui/frame"
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
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Nix } from "@/components/ui/svgs/nix"
import { IconShield } from "nucleo-isometric"
import { useAppDetail } from "./app-detail-context"
import {
  githubCommitUrl,
  lineColor,
  parseEnvBlock,
  serializeEnvVars,
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
  PlusIcon,
  RefreshIcon,
  SquareIcon,
  TerminalIcon,
  Trash2Icon,
  XIcon,
} from "./app-detail-icons"

type EnvVar = { key: string; value: string }

// The context is intentionally assembled in page.tsx; this view narrows the
// collections whose callbacks need concrete types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ViewContext = Record<string, any> & {
  app: App
  setApp: React.Dispatch<React.SetStateAction<App | null>>
  deployments: DeploymentRecord[]
  branches: string[]
  envVars: EnvVar[]
  setEnvVars: React.Dispatch<React.SetStateAction<EnvVar[]>>
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
    installCommand,
    setInstallCommand,
    buildCommand,
    setBuildCommand,
    startCommand,
    setStartCommand,
    envMode,
    setEnvMode,
    rawEnvText,
    setRawEnvText,
    envVars,
    setEnvVars,
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
    vulnerabilities,
    packageManager,
    fixingVul,
    fixVulnerability,
    setFixPackage,
    fixPackage,
    fixOption,
    setFixOption,
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant={"link"}
                onClick={() => router.push("/")}
                className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
                Dashboard
              </Button>
              <span className="h-4 w-px shrink-0 bg-border" />
              <div className="flex min-w-0 items-center gap-2.5">
                {isEditingName ? (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) =>
                        setRenameValue(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, "")
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleRename()
                        if (e.key === "Escape") cancelRename()
                      }}
                      disabled={isRenaming}
                      className="h-8 w-[min(52vw,280px)] text-lg font-bold sm:text-xl"
                      aria-label="Project name"
                    />
                    <button
                      type="button"
                      onClick={handleRename}
                      disabled={isRenaming}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-success/10 hover:text-success disabled:cursor-not-allowed disabled:opacity-50"
                      title="Save name"
                      aria-label="Save name"
                    >
                      {isRenaming ? (
                        <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={cancelRename}
                      disabled={isRenaming}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      title="Cancel"
                      aria-label="Cancel rename"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">
                      {app.name}
                    </h1>
                    <button
                      type="button"
                      onClick={startRename}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Edit project name"
                      aria-label="Edit project name"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <StatusBadge status={app.status} />
              </div>
              {app.branch && (
                <span className="hidden shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground sm:inline-flex">
                  <GitBranchIcon className="h-3 w-3" />
                  {app.branch}
                </span>
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
              <div className="animate-in fade-in-50 mx-auto max-w-4xl space-y-6 duration-200">
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
                  <FrameFooter>
                    <div className="flex gap-1.5 text-muted-foreground text-xs">
                      <CircleAlertIcon className="size-3 shrink-0 mt-0.5" />
                      <p>
                        {app.composeService
                          ? "This is a Docker Compose service. Build settings are controlled by the compose file."
                          : activeDeployment
                            ? `Last deployment ${timeAgo(activeDeployment.createdAt)} · ${activeDeployment.status}.`
                            : "No deployments yet."}
                      </p>
                    </div>
                  </FrameFooter>
                </Frame>

                {app.envVars && Object.keys(app.envVars).length > 0 && (
                  <EnvVarsCard
                    envVars={app.envVars}
                    secretKeys={app.secretKeys}
                    onEdit={() => setShowEnvVarsModal(true)}
                  />
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={() => setTab("config")}
                    variant="outline"
                    className="h-8 border-border text-xs"
                  >
                    Edit Configuration
                  </Button>
                  <Button
                    onClick={() => setShowDeleteModal(true)}
                    variant="outline"
                    className="h-8 border-rose-500/30 text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    <Trash2Icon className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </TabsPanel>

          {/* ── Configuration ──────────────────────────────────────────── */}
          <TabsPanel value="config">
            <div className="h-full overflow-y-auto p-4 md:p-6">
              <div className="animate-in fade-in-50 mx-auto max-w-4xl space-y-4 duration-200">
                <Frame className="w-full">
                  {/* Compose notice */}
                  {app.composeService && (
                    <FramePanel className="border-amber-500/20 bg-amber-500/5">
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
                    </CardPanel>
                  </Card>

                  {/* Actions */}
                  <FrameFooter>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                      <Button
                        onClick={() => {
                          setTab("overview")
                          setEnvMode("list")
                          setRawEnvText("")
                        }}
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
            <div className="animate-in fade-in-50 flex min-h-0 flex-1 flex-col p-4 duration-200 md:p-6">
              <div className="flex shrink-0 items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TerminalIcon className="h-3.5 w-3.5" />
                  <span>Runtime Logs</span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${logsConnected ? "animate-pulse bg-success" : "bg-muted-foreground/30"}`}
                  />
                  <span>{logsConnected ? "Live" : "Disconnected"}</span>
                  {logs.length > 0 && (
                    <span className="font-mono text-muted-foreground/50">
                      · {logs.length} lines
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => connectLogs()}
                    className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Reconnect
                  </button>
                  {logs.length > 0 && (
                    <button
                      onClick={() => setLogs([])}
                      className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/80 bg-transparent font-mono text-xs leading-relaxed">
                <div className="flex shrink-0 items-center gap-2 px-4 py-2 select-none">
                  {logsConnected && (
                    <span className="ml-auto flex items-center gap-1.5 text-[10px] tracking-wider text-success uppercase">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                      Live
                    </span>
                  )}
                </div>
                <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-4">
                  {logs.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground/50 select-none dark:text-slate-500">
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
                  ) : (
                    <>
                      {logs.map((log, i) => (
                        <div
                          key={i}
                          className="group -mx-1 flex gap-4 rounded px-1 hover:bg-foreground/2 dark:hover:bg-white/2"
                        >
                          <span className="w-10 shrink-0 text-right text-muted-foreground/40 transition-colors select-none group-hover:text-muted-foreground/60 dark:text-slate-600 dark:group-hover:text-slate-500">
                            {i + 1}
                          </span>
                          <span className="shrink-0 text-muted-foreground/40 select-none dark:text-slate-600">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span
                            className={`${lineColor(log.message)} break-all`}
                          >
                            {log.message}
                          </span>
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </>
                  )}
                </div>
              </div>
            </div>
          </TabsPanel>

          {/* ── Terminal ───────────────────────────────────────────────── */}
          <TabsPanel value="terminal">
            <div className="animate-in fade-in-50 flex min-h-0 flex-1 flex-col p-4 duration-200 md:p-6">
              <div className="flex shrink-0 items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TerminalIcon className="h-3.5 w-3.5" />
                  <span>Container Shell</span>
                </div>
                {app.status === "running" && (
                  <button
                    onClick={() => setTermReconnectToken((t) => t + 1)}
                    className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RefreshIcon className="h-3 w-3" />
                    Reconnect
                  </button>
                )}
              </div>

              {app.status !== "running" ? (
                <div className="mt-4 flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-border/80 bg-card text-muted-foreground/60 select-none">
                  <TerminalIcon className="h-8 w-8 opacity-25" />
                  <span className="text-sm">
                    The container must be running to open a terminal.
                  </span>
                  {app.status === "stopped" && (
                    <Button
                      onClick={() => handleToggle("start")}
                      disabled={isToggling}
                      variant="outline"
                      className="h-7 gap-1.5 border-emerald-500/30 text-xs text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600"
                    >
                      <PlayIcon className="h-3 w-3" />
                      Start container
                    </Button>
                  )}
                </div>
              ) : (
                <div className="mt-4 min-h-0 flex-1">
                  <ContainerTerminal
                    appId={appId}
                    appName={app.name}
                    reconnectToken={termReconnectToken}
                  />
                </div>
              )}
            </div>
          </TabsPanel>

          {/* ── Deployments ────────────────────────────────────────────── */}
          <TabsPanel value="deployments">
            <div className="animate-in fade-in-50 h-full space-y-4 overflow-y-auto p-4 duration-200 md:p-6">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Deployment History
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {deployments.length} deployment
                  {deployments.length !== 1 ? "s" : ""} recorded.
                </p>
              </div>

              {deployments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
                  <RefreshIcon className="mx-auto mb-3 h-6 w-6 opacity-20" />
                  {app.status === "building"
                    ? "Waiting for the current build to finish…"
                    : "No deployments recorded for this project yet."}
                </div>
              ) : (
               <CardFrame className="w-full">
                  <Table variant="card">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-right">#</TableHead>
                        <TableHead>Deployment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead className="text-right">Started</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deployments.map((dep, idx) => {
                        const isExpanded = expandedDepl === dep.id
                        const isBuilding =
                          dep.status === "building" || dep.status === "in_progress"
                        const isSuccess = dep.status === "success"
                        const deployNumber = deployments.length - idx
                        const isLive = !!dep.image && dep.image === app.activeImage
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
                                setExpandedDepl(isExpanded ? null : dep.id)
                              }
                            >
                              <TableCell className="text-right">
                                <span className="text-xs font-mono text-muted-foreground">
                                  #{deployNumber}
                                </span>
                              </TableCell>

                              <TableCell>
                                <div className="flex flex-col gap-0.5 min-w-0">
                                  <span className="text-sm font-medium text-foreground truncate">
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
                                          onClick={(e) => e.stopPropagation()}
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
                                  {isBuilding ? "in progress" : dep.duration}
                                </span>
                              </TableCell>

                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    {new Date(dep.createdAt).toLocaleString(
                                      undefined,
                                      {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )}
                                  </span>
                                  <ChevronLeftIcon
                                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                                      isExpanded ? "-rotate-90" : "rotate-180"
                                    }`}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>

                            {isExpanded && (
                              <TableRow className="hover:bg-transparent">
                                <TableCell
                                  colSpan={5}
                                  className="p-0 !border-0 !bg-transparent"
                                >
                                  <div className="border-t border-border/30 bg-transparent">
                                    <div className="flex items-center justify-between border-b border-border/20 px-4 py-2">
                                      <span className="font-mono text-[11px] text-muted-foreground/50 dark:text-slate-500">
                                        Build log · {dep.logs.length} lines ·{" "}
                                        {dep.duration}
                                        {dep.trigger && (
                                          <span className="ml-2">
                                            · {dep.trigger}
                                          </span>
                                        )}
                                        {dep.commit && (
                                          <span className="ml-2">
                                            · {dep.commit.slice(0, 7)}
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
                                            className="flex cursor-pointer items-center gap-1 font-mono text-[11px] text-primary transition-colors hover:text-primary/80"
                                          >
                                            <RefreshIcon className="h-3 w-3" />
                                            Rollback to this
                                          </button>
                                        )}
                                        {isLive && (
                                          <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground/50">
                                            <CheckIcon className="h-3 w-3 text-info" />
                                            Currently live
                                          </span>
                                        )}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            router.push(
                                              `/logs?appId=${appId}&mode=build`
                                            )
                                          }}
                                          className="flex cursor-pointer items-center gap-1 font-mono text-[11px] text-muted-foreground/50 transition-colors hover:text-foreground dark:text-slate-500 dark:hover:text-slate-300"
                                        >
                                          <TerminalIcon className="h-3 w-3" />
                                          Open full log
                                        </button>
                                      </div>
                                    </div>
                                    <div className="max-h-80 space-y-0.5 overflow-y-auto px-4 py-3 font-mono text-xs text-foreground dark:text-slate-300">
                                      {dep.logs.length === 0 ? (
                                        <span className="text-muted-foreground/40 italic dark:text-slate-600">
                                          No log output recorded.
                                        </span>
                                      ) : (
                                        dep.logs.map((line, i) => (
                                          <div
                                            key={i}
                                            className="flex gap-4"
                                          >
                                            <span className="w-8 shrink-0 text-right text-muted-foreground/40 select-none dark:text-slate-600">
                                              {i + 1}
                                            </span>
                                            <span className={lineColor(line)}>
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
                </CardFrame>
              )}
            </div>
          </TabsPanel>

          {/* ── Vulnerabilities ─────────────────────────────────────────── */}
          <TabsPanel value="vulnerabilities">
            <div className="animate-in fade-in-50 h-full space-y-6 overflow-y-auto p-4 duration-200 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    Security Vulnerabilities
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Scan and update package dependencies for your application.
                  </p>
                </div>
                <Button
                  onClick={scanVulnerabilities}
                  disabled={loadingVul}
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                >
                  <RefreshIcon
                    className={`h-3 w-3 ${loadingVul ? "animate-spin" : ""}`}
                  />
                  {loadingVul ? "Scanning..." : "Rescan"}
                </Button>
              </div>

              {loadingVul ? (
                <div className="flex flex-col items-center justify-center space-y-3 py-12">
                  <LoaderIcon className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Running package audit scan...
                  </span>
                </div>
              ) : !vulScanRun ? (
                <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                  <CircleAlertIcon className="mx-auto mb-3 h-6 w-6 opacity-20" />
                  Click scan or wait for results to load.
                </div>
              ) : vulnerabilities.length === 0 ? (
                <Card className="relative overflow-hidden bg-card/72 p-8 text-center backdrop-blur-xl md:p-10">
                  <div className="relative mx-auto flex max-w-xl flex-col items-center">
                    <IconShield className="h-20 w-20" />
                    <h3 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
                      No package vulnerabilities found
                    </h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      {packageManager
                        ? `The ${packageManager} audit found no vulnerable advisories for this deployment.`
                        : "Package vulnerability scanning is not applicable for this deployment."}
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
                  {/* Vulnerabilities List */}
                  <div className="space-y-4">
                    <Card className="flex h-full flex-col border-border bg-card/72 p-5 backdrop-blur-xl">
                      <div className="mb-4 flex items-center justify-between border-b border-border/40 pb-4">
                        <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                          Detected Advisories ({vulnerabilities.length})
                        </span>
                        <Button
                          onClick={() => fixVulnerability("")}
                          disabled={fixingVul || app.status === "building"}
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 border-amber-500/20 px-2.5 text-xs text-amber-500 hover:bg-amber-500/10"
                        >
                          <RefreshIcon className="h-3 w-3" />
                          Update All
                        </Button>
                      </div>

                      <div className="max-h-[50vh] divide-y divide-border/40 overflow-y-auto pr-1">
                        {vulnerabilities.map((vul, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start"
                          >
                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant={
                                    vul.severity === "critical" ||
                                    vul.severity === "high"
                                      ? "error"
                                      : vul.severity === "moderate"
                                        ? "warning"
                                        : "secondary"
                                  }
                                  size="sm"
                                  className="font-mono text-[10px] uppercase"
                                >
                                  {vul.severity}
                                </Badge>
                                <span className="font-mono text-sm font-semibold text-foreground">
                                  {vul.package}
                                </span>
                                {vul.range && (
                                  <span className="font-mono text-xs text-muted-foreground">
                                    ({vul.range})
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm leading-relaxed font-medium text-foreground">
                                {vul.title}
                              </h4>
                              {vul.url && (
                                <a
                                  href={vul.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  More details
                                  <ExternalIcon className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <Button
                              onClick={() => {
                                setFixPackage(vul.package)
                                void fixVulnerability(vul.package)
                              }}
                              variant="outline"
                              size="sm"
                              className="h-7 self-start border-border text-xs hover:bg-muted/50 sm:self-center"
                            >
                              Update
                            </Button>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  {/* Manual Fix Panel */}
                  <div className="space-y-4">
                    <Card className="border-border bg-card/72 p-5 backdrop-blur-xl">
                      <h3 className="mb-4 text-sm font-bold text-foreground">
                        Manual Package Update
                      </h3>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-muted-foreground uppercase">
                            Package Name
                          </Label>
                          <Input
                            value={fixPackage}
                            onChange={(e) => setFixPackage(e.target.value)}
                            placeholder="e.g., lodash (leave blank for general audit fix)"
                            className="h-9 text-sm"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-muted-foreground uppercase">
                            Update Option
                          </Label>
                          <Select
                            value={fixOption}
                            onValueChange={(val) =>
                              setFixOption(val as "git" | "local")
                            }
                          >
                            <SelectTrigger className="h-9 w-full text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectPopup>
                              <SelectItem value="local">
                                Option 2: Keep update locally and redeploy
                              </SelectItem>
                              <SelectItem value="git">
                                Option 1: Push update to Git and redeploy
                              </SelectItem>
                            </SelectPopup>
                          </Select>
                          <p className="text-[10px] text-muted-foreground">
                            {fixOption === "git"
                              ? "Updates files, commits, and pushes back to your repository branch before triggering a deployment."
                              : "Updates packages directly in the server's build directory and deploys. The Git remote is not modified."}
                          </p>
                        </div>

                        <Button
                          onClick={() => fixVulnerability()}
                          disabled={fixingVul || app.status === "building"}
                          className="h-9 w-full text-xs"
                        >
                          {fixingVul ? (
                            <>
                              <LoaderIcon className="mr-2 h-3 w-3 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            "Update and Redeploy"
                          )}
                        </Button>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
            </div>
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
