"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu"
import { EnvVarsEditModal } from "@/components/env-vars-edit-modal"
import { NucleoIcon } from "@/components/nucleo-icons"
import { Docker } from "@/components/ui/svgs/docker"
import { useToast } from "@/components/app-shell"
import { api } from "@/lib/api"
import {
  findComposeFile,
  findDockerfile,
  makeRepoRef,
} from "@/lib/framework-detection"
import type { GitHubContent, ProjectDeployConfig } from "@/lib/types"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const SaveIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const ChevronDownIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-down" />
const ChevronRightIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-right" />
const FolderIcon = (props: IconProps) => <NucleoIcon {...props} name="folder" />

export function ProjectDeployConfigPanel({
  projectId,
  deployType,
  primaryServiceId,
  serviceCount,
  onRefresh,
}: {
  projectId: string
  deployType: string
  primaryServiceId: string
  serviceCount: number
  onRefresh: () => void
}) {
  const { showToast } = useToast()
  const [config, setConfig] = useState<ProjectDeployConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [redeploying, setRedeploying] = useState(false)
  const [showEnvModal, setShowEnvModal] = useState(false)

  const [gitRepo, setGitRepo] = useState("")
  const [branch, setBranch] = useState("")
  const [rootDir, setRootDir] = useState("")
  const [composePath, setComposePath] = useState("")
  const [composeContent, setComposeContent] = useState("")
  const [dockerfilePath, setDockerfilePath] = useState("")
  const [dockerfileContent, setDockerfileContent] = useState("")
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const [secretKeys, setSecretKeys] = useState<string[]>([])
  const [autoDeploy, setAutoDeploy] = useState(false)
  const [isDetectingPaths, setIsDetectingPaths] = useState(false)
  const [pathsScanComplete, setPathsScanComplete] = useState(false)
  const [detectedComposePath, setDetectedComposePath] = useState<string | null>(null)
  const [detectedDockerfilePath, setDetectedDockerfilePath] = useState<string | null>(null)

  const [showFolderBrowser, setShowFolderBrowser] = useState(false)
  const [folderBrowserPath, setFolderBrowserPath] = useState("")
  const [folderBrowserBreadcrumbs, setFolderBrowserBreadcrumbs] = useState<string[]>([])
  const [folderBrowserContents, setFolderBrowserContents] = useState<GitHubContent[]>([])
  const [folderBrowserLoading, setFolderBrowserLoading] = useState(false)

  const rootDirDetectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canBrowseRepo =
    deployType !== "dockerfile-inline" && Boolean(gitRepo.trim()) && Boolean(branch.trim())

  const applyConfig = useCallback((data: ProjectDeployConfig) => {
    setConfig(data)
    setGitRepo(data.gitRepo ?? "")
    setBranch(data.branch ?? "")
    setRootDir(data.rootDir ?? "")
    setComposePath(data.composePath ?? "docker-compose.yml")
    setComposeContent(data.composeContent ?? "")
    setDockerfilePath(data.dockerfilePath ?? "Dockerfile")
    setDockerfileContent(data.dockerfileContent ?? "")
    setEnvVars(data.envVars ?? {})
    setSecretKeys(data.secretKeys ?? [])
    setAutoDeploy(Boolean(data.autoDeploy))
  }, [])

  const detectBuildPaths = useCallback(
    async (dir: string, repoUrl: string, repoBranch: string) => {
      if (deployType === "dockerfile-inline" || !repoUrl.trim() || !repoBranch.trim()) {
        setDetectedComposePath(null)
        setDetectedDockerfilePath(null)
        setPathsScanComplete(false)
        return
      }
      const repo = makeRepoRef(repoUrl)
      const normalized = dir.replace(/^\.\//, "").replace(/\/+$/, "").trim()
      setIsDetectingPaths(true)
      setPathsScanComplete(false)
      try {
        if (deployType === "compose") {
          const compose = await findComposeFile(repo, repoBranch, normalized)
          setDetectedComposePath(compose)
          if (compose) setComposePath(compose)
        } else if (deployType === "dockerfile") {
          const dockerfile = await findDockerfile(repo, repoBranch, normalized)
          setDetectedDockerfilePath(dockerfile)
          if (dockerfile) setDockerfilePath(dockerfile)
        }
      } catch (err) {
        console.error("Failed to detect build files:", err)
        setDetectedComposePath(null)
        setDetectedDockerfilePath(null)
      } finally {
        setIsDetectingPaths(false)
        setPathsScanComplete(true)
      }
    },
    [deployType],
  )

  const scheduleDetectBuildPaths = useCallback(
    (dir: string, repoUrl: string, repoBranch: string) => {
      if (rootDirDetectTimer.current) clearTimeout(rootDirDetectTimer.current)
      rootDirDetectTimer.current = setTimeout(() => {
        void detectBuildPaths(dir, repoUrl, repoBranch)
      }, 600)
    },
    [detectBuildPaths],
  )

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.projects.getConfig(projectId)
      applyConfig(data)
      void detectBuildPaths(data.rootDir ?? "", data.gitRepo ?? "", data.branch ?? "")
    } catch (err) {
      console.error(err)
      showToast("Error", "Failed to load project configuration.", "destructive")
    } finally {
      setLoading(false)
    }
  }, [projectId, showToast, applyConfig, detectBuildPaths])

  useEffect(() => {
    let cancelled = false
    void api.projects
      .getConfig(projectId)
      .then((data) => {
        if (cancelled) return
        applyConfig(data)
        setLoading(false)
        void detectBuildPaths(data.rootDir ?? "", data.gitRepo ?? "", data.branch ?? "")
      })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        showToast("Error", "Failed to load project configuration.", "destructive")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId, showToast, applyConfig, detectBuildPaths])

  useEffect(() => {
    return () => {
      if (rootDirDetectTimer.current) clearTimeout(rootDirDetectTimer.current)
    }
  }, [])

  const handleRootDirChange = (value: string) => {
    setRootDir(value)
    scheduleDetectBuildPaths(value, gitRepo, branch)
  }

  const handleBranchChange = (value: string) => {
    setBranch(value)
    scheduleDetectBuildPaths(rootDir, gitRepo, value)
  }

  const loadFolderContents = useCallback(
    async (path: string) => {
      if (!gitRepo || !branch) return
      setFolderBrowserLoading(true)
      try {
        const repo = makeRepoRef(gitRepo)
        const data = await api.git.contents(repo.full_name, branch, path)
        setFolderBrowserContents(data ?? [])
        setFolderBrowserPath(path)
      } catch (err) {
        console.error("Failed to load folder contents:", err)
        setFolderBrowserContents([])
      } finally {
        setFolderBrowserLoading(false)
      }
    },
    [gitRepo, branch],
  )

  const openFolderBrowser = async () => {
    if (!canBrowseRepo) return
    setShowFolderBrowser(true)
    setFolderBrowserPath("")
    setFolderBrowserBreadcrumbs([])
    await loadFolderContents("")
  }

  const navigateIntoFolder = (folderName: string) => {
    const newPath = folderBrowserPath
      ? `${folderBrowserPath}/${folderName}`
      : folderName
    setFolderBrowserBreadcrumbs((prev) => [...prev, folderName])
    void loadFolderContents(newPath)
  }

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setFolderBrowserBreadcrumbs([])
      void loadFolderContents("")
    } else {
      const newCrumbs = folderBrowserBreadcrumbs.slice(0, index + 1)
      setFolderBrowserBreadcrumbs(newCrumbs)
      void loadFolderContents(newCrumbs.join("/"))
    }
  }

  const selectFolder = (path: string) => {
    setRootDir(path)
    setShowFolderBrowser(false)
    if (rootDirDetectTimer.current) clearTimeout(rootDirDetectTimer.current)
    void detectBuildPaths(path, gitRepo, branch)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.projects.updateConfig({
        projectId,
        gitRepo,
        branch,
        rootDir,
        composePath: deployType === "compose" ? composePath : undefined,
        composeContent: deployType === "compose" ? composeContent : undefined,
        dockerfilePath:
          deployType === "dockerfile" || deployType === "dockerfile-inline"
            ? dockerfilePath
            : undefined,
        dockerfileContent:
          deployType === "dockerfile" || deployType === "dockerfile-inline"
            ? dockerfileContent
            : undefined,
        envVars,
        secretKeys,
        autoDeploy,
      })
      showToast("Saved", "Project configuration updated.", "success")
      await loadConfig()
      onRefresh()
    } catch {
      showToast("Error", "Failed to save configuration.", "destructive")
    } finally {
      setSaving(false)
    }
  }

  const handleRedeploy = async (noCache: boolean) => {
    setRedeploying(true)
    try {
      await api.projects.redeploy(projectId, noCache)
      showToast(
        "Redeploying",
        deployType === "compose"
          ? `Rebuilding all ${serviceCount} compose services.`
          : "Rebuild triggered.",
        "success",
      )
      onRefresh()
    } catch {
      showToast("Error", "Redeploy failed.", "destructive")
    } finally {
      setRedeploying(false)
    }
  }

  const deployLabel =
    deployType === "compose"
      ? "Docker Compose"
      : deployType === "dockerfile-inline"
        ? "Inline Dockerfile"
        : "Dockerfile"

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <Frame className="w-full">
          <FramePanel className="!py-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="mt-2 h-4 w-full" />
          </FramePanel>
          <FramePanel className="!py-4">
            <Skeleton className="h-48 w-full" />
          </FramePanel>
        </Frame>
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="mx-auto max-w-2xl">
      <Frame className="w-full">
        <FramePanel className="shrink-0 space-y-4 !py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-2.5">
              <Docker className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <div className="min-w-0 space-y-1">
                <FrameTitle className="text-base">
                  Project-wide {deployLabel} configuration
                </FrameTitle>
                <FrameDescription className="text-xs sm:text-sm">
                  {deployType === "compose"
                    ? `Settings for the entire compose stack (${serviceCount} services). Saving updates the shared source; redeploy rebuilds every service together.`
                    : "Settings for the Dockerfile build. Redeploy rebuilds the container from the saved configuration."}
                </FrameDescription>
              </div>
            </div>
          </div>
        </FramePanel>

        <FramePanel className="space-y-4 !py-4">
          <div>
            <FrameTitle>Source</FrameTitle>
            <FrameDescription className="text-xs">
              Repository and directory used when deploying this project.
            </FrameDescription>
          </div>
          <Field>
            <FieldLabel className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Git repository URL
            </FieldLabel>
            <Input
              value={gitRepo}
              onChange={(e) => setGitRepo(e.target.value)}
              placeholder="https://github.com/org/repo"
              className="h-9 font-mono text-sm"
              disabled={deployType === "dockerfile-inline"}
            />
            {deployType === "dockerfile-inline" ? (
              <FieldDescription>
                Inline Dockerfile projects have no git repository.
              </FieldDescription>
            ) : null}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel className="text-xs mb-1 font-bold tracking-wider text-muted-foreground uppercase">
                Branch
              </FieldLabel>
              <Input
                value={branch}
                onChange={(e) => handleBranchChange(e.target.value)}
                placeholder="main"
                className="h-9 text-sm"
                disabled={deployType === "dockerfile-inline"}
              />
            </Field>
            <Field>
              <div className="flex items-center justify-between pb-1">
                <FieldLabel className="text-xs mr-2 font-bold tracking-wider text-muted-foreground uppercase">
                  Root directory
                </FieldLabel>
                <button
                  type="button"
                  onClick={() => void openFolderBrowser()}
                  disabled={!canBrowseRepo}
                  className="text-[11px] text-primary hover:underline disabled:pointer-events-none disabled:opacity-40"
                >
                  Browse…
                </button>
              </div>
              <Input
                value={rootDir}
                onChange={(e) => handleRootDirChange(e.target.value)}
                placeholder="."
                className="h-9 font-mono text-sm"
              />
              <FieldDescription>
                Subdirectory containing your project files. Leave empty for repo root.
              </FieldDescription>
            </Field>
          </div>
          {deployType === "compose" ? (
            <Field>
              <FieldLabel className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Compose file path
              </FieldLabel>
              <Input
                value={composePath}
                onChange={(e) => setComposePath(e.target.value)}
                placeholder="docker-compose.yml"
                className={`h-9 font-mono text-sm ${
                  !isDetectingPaths && pathsScanComplete
                    ? detectedComposePath
                      ? "border-success/40 focus-visible:border-success/60"
                      : "border-amber-500/35 focus-visible:border-amber-500/55"
                    : ""
                }`}
              />
              {isDetectingPaths ? (
                <FieldDescription className="flex items-center gap-1.5">
                  <RefreshIcon className="h-3 w-3 animate-spin" />
                  Detecting compose file…
                </FieldDescription>
              ) : detectedComposePath ? (
                <FieldDescription className="text-success">
                  Auto-detected:{" "}
                  <span className="font-mono">{detectedComposePath}</span>
                </FieldDescription>
              ) : pathsScanComplete ? (
                <FieldDescription className="text-amber-600 dark:text-amber-400">
                  No compose file found in this directory. Enter the path manually or
                  adjust the root directory.
                </FieldDescription>
              ) : (
                <FieldDescription>
                  Relative to root directory. Looks for compose.yaml, compose.yml,
                  docker-compose.yaml, or docker-compose.yml.
                </FieldDescription>
              )}
            </Field>
          ) : (
            <Field>
              <FieldLabel className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Dockerfile path
              </FieldLabel>
              <Input
                value={dockerfilePath}
                onChange={(e) => setDockerfilePath(e.target.value)}
                placeholder="Dockerfile"
                className={`h-9 font-mono text-sm ${
                  deployType === "dockerfile" && !isDetectingPaths && pathsScanComplete
                    ? detectedDockerfilePath
                      ? "border-success/40 focus-visible:border-success/60"
                      : "border-amber-500/35 focus-visible:border-amber-500/55"
                    : ""
                }`}
                disabled={deployType === "dockerfile-inline"}
              />
              {deployType === "dockerfile" ? (
                isDetectingPaths ? (
                  <FieldDescription className="flex items-center gap-1.5">
                    <RefreshIcon className="h-3 w-3 animate-spin" />
                    Detecting Dockerfile…
                  </FieldDescription>
                ) : detectedDockerfilePath ? (
                  <FieldDescription className="text-success">
                    Auto-detected:{" "}
                    <span className="font-mono">{detectedDockerfilePath}</span>
                  </FieldDescription>
                ) : pathsScanComplete ? (
                  <FieldDescription className="text-amber-600 dark:text-amber-400">
                    No Dockerfile found in this directory. Enter the path manually or
                    adjust the root directory.
                  </FieldDescription>
                ) : (
                  <FieldDescription>
                    Relative to root directory.
                  </FieldDescription>
                )
              ) : null}
            </Field>
          )}
        </FramePanel>

        <FramePanel className="space-y-4 !py-4">
          <div>
            <FrameTitle>
              {deployType === "compose" ? "Compose file" : "Dockerfile"}
            </FrameTitle>
            <FrameDescription className="text-xs">
              {deployType === "compose"
                ? "Override the compose file from git on the next deploy. Changes are stored here until you push to the repository."
                : "Override the Dockerfile used for builds on the next deploy."}
            </FrameDescription>
          </div>
          <Textarea
            value={deployType === "compose" ? composeContent : dockerfileContent}
            onChange={(e) =>
              deployType === "compose"
                ? setComposeContent(e.target.value)
                : setDockerfileContent(e.target.value)
            }
            className="min-h-[280px] font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
        </FramePanel>

        <FramePanel className="space-y-4 !py-4">
          <div>
            <FrameTitle>Environment variables</FrameTitle>
            <FrameDescription className="text-xs">
              {deployType === "compose"
                ? "Shared variables for compose interpolation (${VAR} in the compose file)."
                : "Build and runtime environment variables for the container."}
            </FrameDescription>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <p className="text-sm text-muted-foreground">
              {Object.keys(envVars).length}{" "}
              {Object.keys(envVars).length === 1 ? "variable" : "variables"}{" "}
              configured
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowEnvModal(true)}>
              Edit variables
            </Button>
          </div>
        </FramePanel>

        <FramePanel className="space-y-4 !py-4">
          <div>
            <FrameTitle>Auto-deploy</FrameTitle>
            <FrameDescription className="text-xs">
              Redeploy automatically when matching commits are pushed to the
              configured branch.
            </FrameDescription>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={autoDeploy}
                onCheckedChange={(v) => setAutoDeploy(v === true)}
                disabled={deployType === "dockerfile-inline"}
              />
              <span className="text-sm text-muted-foreground">
                {autoDeploy ? "Enabled" : "Disabled"}
              </span>
            </div>
            {primaryServiceId ? (
              <Link
                href={`/app/${primaryServiceId}?tab=deployments`}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                View deployment history →
              </Link>
            ) : null}
          </div>
        </FramePanel>

        <FrameFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end !py-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={redeploying || saving}
                >
                  <RefreshIcon className="h-3.5 w-3.5" />
                  Redeploy stack
                  <ChevronDownIcon className="h-3.5 w-3.5 opacity-60" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => void handleRedeploy(false)}>
                Default build
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleRedeploy(true)}>
                Clear cache & deploy
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            disabled={saving || redeploying}
            onClick={() => void handleSave()}
          >
            <SaveIcon className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save configuration"}
          </Button>
        </FrameFooter>
      </Frame>

      <EnvVarsEditModal
        isOpen={showEnvModal}
        onClose={() => setShowEnvModal(false)}
        envVars={envVars}
        secretKeys={secretKeys}
        onSave={async (vars) => {
          setEnvVars(vars)
        }}
      />

      <Dialog open={showFolderBrowser} onOpenChange={setShowFolderBrowser}>
        <DialogContent className="flex max-h-[70vh] flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              Select root directory
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Choose the directory containing your project files.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-1 overflow-x-auto px-6 pb-1 text-xs text-muted-foreground">
            <button
              type="button"
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
                  type="button"
                  className={`shrink-0 hover:text-foreground ${i === folderBrowserBreadcrumbs.length - 1 ? "font-medium text-foreground" : ""}`}
                  onClick={() => navigateToBreadcrumb(i)}
                >
                  {crumb}
                </button>
              </React.Fragment>
            ))}
          </div>

          {folderBrowserPath ? (
            <div className="mx-6 mb-2 rounded border border-primary/20 bg-primary/5 px-2 py-1 text-xs font-medium text-primary">
              Selected: ./{folderBrowserPath}
            </div>
          ) : null}

          <div className="mx-6 mb-2 flex-1 overflow-y-auto rounded-md border border-border">
            {folderBrowserLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <RefreshIcon className="mr-2 h-4 w-4 animate-spin" />
                Loading folders…
              </div>
            ) : folderBrowserContents.filter((i) => i.type === "dir").length === 0 ? (
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

          <div className="flex items-center justify-between gap-3 border-t border-border/40 px-6 pt-3 pb-6">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                selectFolder("")
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
              className="flex min-w-0 shrink items-center gap-1 text-xs"
            >
              <span className="shrink-0">Select</span>
              <span className="truncate font-mono">
                {folderBrowserPath || "Root (./)"}
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
