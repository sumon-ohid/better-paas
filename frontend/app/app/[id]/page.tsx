"use client"

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
} from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AppShell, useToast } from "@/components/app-shell"
import { api, createRuntimeLogsWs } from "@/lib/api"
import { getAppUrl } from "@/lib/utils"
import type {
  App,
  DeploymentRecord,
  LogEntry,
  GitHubContent,
  Vulnerability,
} from "@/lib/types"
import {
  makeRepoRef,
  detectFrameworkByFiles,
  detectFrameworkForDir,
  findDockerfile,
  type Framework,
} from "@/lib/framework-detection"
import { AppDetailProvider } from "./app-detail-context"
import { AppDetailView } from "./app-detail-view"
import type { AppTab } from "./app-detail-types"
import { parseEnvBlock } from "./app-detail-utils"

function AppDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const appId = params.id as string
  const { showToast } = useToast()

  const [app, setApp] = useState<App | null>(null)
  const [loading, setLoading] = useState(true)
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([])

  const currentTab = (searchParams.get("tab") as AppTab) || "overview"
  const setTab = useCallback(
    (tab: AppTab) => {
      router.replace(`/app/${appId}?tab=${tab}`, { scroll: false })
    },
    [router, appId]
  )

  // ── Actions ────────────────────────────────────────────────────────────────
  const [isToggling, setIsToggling] = useState(false)
  const [isRedeploying, setIsRedeploying] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [isRenaming, setIsRenaming] = useState(false)
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const [expandedDepl, setExpandedDepl] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEnvVarsModal, setShowEnvVarsModal] = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState<DeploymentRecord | null>(
    null
  )
  const [isRollingBack, setIsRollingBack] = useState(false)

  // ── Vulnerabilities ────────────────────────────────────────────────────────
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([])
  const [packageManager, setPackageManager] = useState<string>("")
  const [loadingVul, setLoadingVul] = useState(false)
  const [fixingVul, setFixingVul] = useState(false)
  const [vulScanRun, setVulScanRun] = useState(false)
  const [vulScannedAt, setVulScannedAt] = useState<Date | null>(null)
  const [vulUpdatePending, setVulUpdatePending] = useState(false)

  // ── Config edit states ─────────────────────────────────────────────────────
  const [gitRepo, setGitRepo] = useState("")
  const [branch, setBranch] = useState("")
  const [branches, setBranches] = useState<string[]>([])
  const [isFetchingBranches, setIsFetchingBranches] = useState(false)
  const [rootDir, setRootDir] = useState("")
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([])
  const [buildCommand, setBuildCommand] = useState("")
  const [startCommand, setStartCommand] = useState("")
  const [installCommand, setInstallCommand] = useState("")
  const [portOverride, setPortOverride] = useState("")
  const [buildMethod, setBuildMethod] = useState<
    "nixpacks" | "dockerfile" | "compose"
  >("nixpacks")
  const [dockerfilePath, setDockerfilePath] = useState("Dockerfile")
  const [dockerfileAvailable, setDockerfileAvailable] = useState(false)

  // ── Framework detection (for the Root Directory field) ──────────────────────
  const [detectedFramework, setDetectedFramework] = useState<Framework | null>(
    null
  )
  const [isDetectingFramework, setIsDetectingFramework] = useState(false)
  const rootDirDetectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [envMode, setEnvMode] = useState<"list" | "raw">("list")
  const [rawEnvText, setRawEnvText] = useState("")

  // ── Folder browser ──────────────────────────────────────────────────────────
  const [showFolderBrowser, setShowFolderBrowser] = useState(false)
  const [folderBrowserPath, setFolderBrowserPath] = useState("")
  const [folderBrowserContents, setFolderBrowserContents] = useState<
    GitHubContent[]
  >([])
  const [folderBrowserLoading, setFolderBrowserLoading] = useState(false)
  const [folderBrowserBreadcrumbs, setFolderBrowserBreadcrumbs] = useState<
    string[]
  >([])

  // ── Logs ───────────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsConnected, setLogsConnected] = useState(false)
  const logsWsRef = useRef<WebSocket | null>(null)
  const logsWsSeqRef = useRef(0)
  const logBufferRef = useRef<LogEntry[]>([])
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null)
  const logEndRef = useRef<HTMLDivElement | null>(null)

  // ── Terminal ─────────────────────────────────────────────────────────────────
  // The interactive shell is a self-contained xterm.js component; we only track
  // a token here so the Reconnect button can force it to re-mount.
  const [termReconnectToken, setTermReconnectToken] = useState(0)

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [appsData, deplData] = await Promise.all([
        api.apps.list(),
        api.deployments.history().catch(() => [] as DeploymentRecord[]),
      ])
      const found = appsData.find((a) => a.id === appId) ?? null
      setApp(found)
      setDeployments(deplData.filter((d) => d.appId === appId))

      if (found) {
        setGitRepo(found.gitRepo || "")
        setBranch(found.branch || "")
        setRootDir(found.rootDir || "")
        setBuildCommand(found.buildCommand || "")
        setStartCommand(found.startCommand || "")
        setInstallCommand(found.installCommand || "")
        setPortOverride(found.portOverride ? String(found.portOverride) : "")
        setBuildMethod(
          found.buildMethod === "dockerfile"
            ? "dockerfile"
            : found.buildMethod === "compose"
              ? "compose"
              : "nixpacks"
        )
        setDockerfilePath(found.dockerfilePath || "Dockerfile")
        // If the app is already configured to use a Dockerfile, surface the
        // selector immediately. Otherwise we probe the repo below to decide.
        if (found.buildMethod === "dockerfile") setDockerfileAvailable(true)

        const loadedVars: { key: string; value: string }[] = []
        if (found.envVars) {
          Object.entries(found.envVars).forEach(([k, v]) =>
            loadedVars.push({ key: k, value: v })
          )
        }
        setEnvVars(
          loadedVars.length > 0 ? loadedVars : [{ key: "", value: "" }]
        )
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [appId])

  useEffect(() => {
    // fetchData is async; setState runs after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!isEditingName) return
    renameInputRef.current?.focus()
    renameInputRef.current?.select()
  }, [isEditingName])

  // Probe the chosen directory for a Dockerfile. The selector is only shown when
  // one exists; otherwise Nixpacks is forced. Declared before the effect that
  // uses it so the reference is stable and the effect deps stay honest.
  const checkDockerfile = useCallback(
    async (dir: string) => {
      if (!gitRepo || !branch) return
      // Compose rows aren't reconfigurable here (the compose file controls the
      // build); never override their method by probing for a Dockerfile.
      if (app?.composeProject) return
      try {
        const found = await findDockerfile(makeRepoRef(gitRepo), branch, dir)
        if (found) {
          setDockerfileAvailable(true)
          setDockerfilePath((p) => p || found)
        } else {
          setDockerfileAvailable(false)
          setBuildMethod("nixpacks")
        }
      } catch {
        setDockerfileAvailable(false)
        setBuildMethod("nixpacks")
      }
    },
    [gitRepo, branch, app?.composeProject]
  )

  // One-time probe for a Dockerfile in the app's current root dir, so the build
  // method selector appears for repos that have a Dockerfile even if the app is
  // currently built with Nixpacks. Runs once after the repo/branch load.
  const dockerfileProbed = useRef(false)
  useEffect(() => {
    if (dockerfileProbed.current) return
    if (!gitRepo || !branch) return
    dockerfileProbed.current = true
    // checkDockerfile is async; setState runs after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkDockerfile(rootDir || "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gitRepo, branch])

  // Fetch the repo's branches so the Configuration tab can offer a dropdown
  // instead of a free-text field. Refetches whenever the repo URL changes.
  const fetchBranches = useCallback(async (repoUrl: string) => {
    if (!repoUrl) return
    setIsFetchingBranches(true)
    try {
      const list = await api.git.branches(repoUrl)
      setBranches(list ?? [])
    } catch (err) {
      console.error("Failed to fetch branches:", err)
      setBranches([])
    } finally {
      setIsFetchingBranches(false)
    }
  }, [])

  const branchesRepo = useRef<string | null>(null)
  const branchesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!gitRepo) return
    if (branchesRepo.current === gitRepo) return
    if (branchesTimer.current) clearTimeout(branchesTimer.current)
    // Debounce so typing in the repo URL field doesn't fire a request per keystroke.
    branchesTimer.current = setTimeout(() => {
      branchesRepo.current = gitRepo
      fetchBranches(gitRepo)
    }, 500)
    return () => {
      if (branchesTimer.current) clearTimeout(branchesTimer.current)
    }
  }, [gitRepo, fetchBranches])

  // Poll while building
  useEffect(() => {
    if (app?.status !== "building") return
    const interval = setInterval(fetchData, 2500)
    return () => clearInterval(interval)
  }, [app?.status, fetchData])

  // ── WebSocket Logs ─────────────────────────────────────────────────────────
  const connectLogs = useCallback(() => {
    if (!appId) return

    // Teardown
    const seq = ++logsWsSeqRef.current
    if (logsWsRef.current) {
      logsWsRef.current.onclose = null
      logsWsRef.current.onerror = null
      logsWsRef.current.onopen = null
      logsWsRef.current.onmessage = null
      logsWsRef.current.close()
      logsWsRef.current = null
    }
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }

    setLogs([])
    setLogsConnected(false)
    logBufferRef.current = []

    createRuntimeLogsWs(appId)
      .then((ws) => {
        if (seq !== logsWsSeqRef.current) {
          ws.close()
          return
        }
        logsWsRef.current = ws

        ws.onopen = () => setLogsConnected(true)

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)
          logBufferRef.current.push({
            message: data.message,
            timestamp: data.timestamp,
          })
          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              const batch = [...logBufferRef.current]
              logBufferRef.current = []
              setLogs((prev) => [...prev, ...batch])
              flushTimerRef.current = null
            }, 100)
          }
        }

        ws.onclose = () => {
          setLogsConnected(false)
          if (logsWsRef.current === ws) logsWsRef.current = null
          if (logBufferRef.current.length > 0) {
            setLogs((prev) => [...prev, ...logBufferRef.current])
            logBufferRef.current = []
          }
          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current)
            flushTimerRef.current = null
          }
        }

        ws.onerror = () => setLogsConnected(false)
      })
      .catch((err) => {
        if (seq !== logsWsSeqRef.current) return
        console.error("Failed to open runtime logs stream", err)
        setLogsConnected(false)
      })
  }, [appId])

  useEffect(() => {
    if (currentTab === "logs" && appId) {
      // connectLogs sets state inside async WS callbacks, not synchronously.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      connectLogs()
    }
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      logsWsSeqRef.current++
      if (logsWsRef.current) {
        logsWsRef.current.onclose = null
        logsWsRef.current.close()
        logsWsRef.current = null
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
    }
  }, [currentTab, appId, connectLogs])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleToggle = async (action: "stop" | "start") => {
    if (!app) return
    setIsToggling(true)
    try {
      if (action === "stop") {
        await api.apps.stop(app.id)
      } else {
        await api.apps.start(app.id)
      }
      showToast(
        action === "stop" ? "Container Stopped" : "Container Started",
        `${app.name} is now ${action === "stop" ? "stopped" : "running"}.`
      )
      fetchData()
    } catch (err) {
      showToast("Error", `Failed to ${action} container.`, "destructive")
      console.error(err)
    } finally {
      setIsToggling(false)
    }
  }

  const handleRedeploy = async (noCache: boolean = false) => {
    if (!app) return
    setIsRedeploying(true)
    try {
      await api.apps.redeploy(app.id, noCache)
      showToast("Redeploy Started", `Triggering new build for ${app.name}...`)
      fetchData()
      setTab("deployments")
    } catch (err) {
      showToast("Error", "Failed to trigger redeployment.", "destructive")
      console.error(err)
    } finally {
      setIsRedeploying(false)
    }
  }

  const handleRollback = async (dep: DeploymentRecord) => {
    if (!app) return
    setIsRollingBack(true)
    try {
      await api.apps.rollback(app.id, dep.id)
      showToast(
        "Rollback Started",
        `Re-releasing ${dep.commit ? dep.commit.slice(0, 7) : "deployment"} for ${app.name}...`
      )
      setRollbackTarget(null)
      fetchData()
      setTab("deployments")
    } catch (err) {
      showToast("Error", "Failed to start rollback.", "destructive")
      console.error(err)
    } finally {
      setIsRollingBack(false)
    }
  }

  const handleDelete = async () => {
    if (!app) return
    try {
      await api.apps.delete(app.id)
      showToast("App Deleted", `${app.name} has been removed.`)
      router.push("/")
    } catch (err) {
      showToast("Error", "Failed to delete application.", "destructive")
      console.error(err)
    }
  }

  const handleSaveConfig = async () => {
    if (!app) return
    setIsSaving(true)
    const envVarsRecord: Record<string, string> = {}

    const activeVars = envMode === "raw" ? parseEnvBlock(rawEnvText) : envVars
    activeVars.forEach((item) => {
      if (item.key.trim() && item.value.trim()) {
        envVarsRecord[item.key.trim()] = item.value.trim()
      }
    })

    try {
      await api.apps.update({
        id: app.id,
        gitRepo,
        branch,
        rootDir,
        envVars: envVarsRecord,
        buildCommand,
        startCommand,
        installCommand,
        portOverride: portOverride ? parseInt(portOverride, 10) : 0,
        // Compose, image, and dockerfile-inline deploys don't expose a reconfigurable build method here; omit it
        // so we never overwrite the stored method with a default.
        ...(app.composeProject ||
        app.buildMethod === "image" ||
        app.buildMethod === "dockerfile-inline"
          ? {}
          : {
              buildMethod,
              dockerfilePath:
                buildMethod === "dockerfile"
                  ? dockerfilePath.trim() || "Dockerfile"
                  : undefined,
            }),
      })
      showToast("Settings Saved", "Application configuration updated.")
      setEnvMode("list")
      setRawEnvText("")
      fetchData()
    } catch (err) {
      showToast("Error", "Failed to save configuration.", "destructive")
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveEnvVars = async (vars: Record<string, string>) => {
    if (!app) return
    setIsSaving(true)
    try {
      await api.apps.update({
        id: app.id,
        envVars: vars,
      })
      showToast("Environment Variables Saved", "Application env vars updated.")
      fetchData()
    } catch (err) {
      showToast("Error", "Failed to save environment variables.", "destructive")
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const startRename = () => {
    if (!app) return
    setRenameValue(app.name)
    setIsEditingName(true)
  }

  const cancelRename = () => {
    setIsEditingName(false)
    setRenameValue(app?.name ?? "")
  }

  const handleRename = async () => {
    if (!app) return
    const nextName = renameValue.trim()
    if (nextName === app.name) {
      setIsEditingName(false)
      return
    }
    if (!/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])$/.test(nextName)) {
      showToast(
        "Invalid name",
        "Use 2-40 lowercase letters, digits, or hyphens.",
        "destructive"
      )
      return
    }

    setIsRenaming(true)
    try {
      const updated = await api.apps.rename(app.id, nextName)
      setApp(updated)
      setIsEditingName(false)
      showToast(
        "Name saved",
        updated.name === nextName
          ? "Project name updated."
          : `Project name saved as ${updated.name}.`
      )
    } catch (err) {
      showToast("Error", "Failed to save project name.", "destructive")
      console.error(err)
    } finally {
      setIsRenaming(false)
    }
  }

  // ── Framework detection + folder browser (mirrors the deploy wizard) ────────
  const applyDetectedFramework = (fwk: Framework | null) => {
    setDetectedFramework(fwk)
    if (fwk) {
      setBuildCommand(fwk.buildCmd)
      setStartCommand(fwk.startCmd)
      setInstallCommand(fwk.installCmd)
      setPortOverride(String(fwk.port))
    }
  }

  // Probe the chosen directory for a Dockerfile. The selector is only shown when
  // one exists; otherwise Nixpacks is forced.
  const redetectForRootDir = useCallback(
    async (dir: string) => {
      if (!gitRepo || !branch) return
      const repo = makeRepoRef(gitRepo)
      const normalized = dir.replace(/^\.\//, "").replace(/\/+$/, "").trim()
      setIsDetectingFramework(true)
      try {
        if (!normalized || normalized === ".") {
          const detected = await detectFrameworkByFiles(repo, branch)
          if (detected) applyDetectedFramework(detected.framework)
        } else {
          const fwForDir = await detectFrameworkForDir(repo, branch, normalized)
          if (fwForDir) applyDetectedFramework(fwForDir)
        }
        // Re-check Dockerfile presence for the chosen directory.
        await checkDockerfile(normalized)
      } finally {
        setIsDetectingFramework(false)
      }
    },
    [gitRepo, branch, checkDockerfile]
  )

  const handleRootDirChange = (value: string) => {
    setRootDir(value)
    if (rootDirDetectTimer.current) clearTimeout(rootDirDetectTimer.current)
    rootDirDetectTimer.current = setTimeout(
      () => redetectForRootDir(value),
      600
    )
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
    [gitRepo, branch]
  )

  const openFolderBrowser = async () => {
    if (!gitRepo || !branch) return
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
    loadFolderContents(newPath)
  }

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setFolderBrowserBreadcrumbs([])
      loadFolderContents("")
    } else {
      const newCrumbs = folderBrowserBreadcrumbs.slice(0, index + 1)
      setFolderBrowserBreadcrumbs(newCrumbs)
      loadFolderContents(newCrumbs.join("/"))
    }
  }

  const selectFolder = (path: string) => {
    setRootDir(path)
    setShowFolderBrowser(false)
    if (rootDirDetectTimer.current) clearTimeout(rootDirDetectTimer.current)
    redetectForRootDir(path)
  }

  // ── Vulnerabilities Callbacks ──────────────────────────────────────────────
  const scanVulnerabilities = useCallback(async () => {
    setLoadingVul(true)
    try {
      const res = await api.vulnerabilities.scan(appId)
      setVulnerabilities(res.vulnerabilities || [])
      setPackageManager(res.packageManager || "")
      setVulScanRun(true)
      setVulScannedAt(new Date())
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to scan package vulnerabilities."
      setVulnerabilities([])
      setPackageManager("")
      setVulScanRun(true)
      showToast("Scan Failed", message, "destructive")
    } finally {
      setLoadingVul(false)
    }
  }, [appId, showToast])

  const fixVulnerability = async (opts: {
    package?: string
    option: "git" | "local"
  }) => {
    setFixingVul(true)
    try {
      const targetPkg = opts.package
      showToast(
        "Updating package...",
        targetPkg
          ? `Updating ${targetPkg} to latest version...`
          : "Running audit fix..."
      )
      const res = await api.vulnerabilities.fix({
        id: appId,
        option: opts.option,
        package: targetPkg || undefined,
      })
      showToast(
        "Update Triggered",
        "Redeployment started. Check the Deployments tab for build progress.",
        "success"
      )
      setVulScanRun(false)
      setVulUpdatePending(true)
      if (res?.deployId) {
        setExpandedDepl(res.deployId)
      }
      void fetchData()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update package."
      showToast("Update Failed", message, "destructive")
    } finally {
      setFixingVul(false)
    }
  }

  // Invalidate vulnerability scan cache when a build finishes so the tab shows fresh findings
  const prevStatusRef = useRef(app?.status)
  useEffect(() => {
    if (prevStatusRef.current === "building" && app?.status !== "building") {
      setVulScanRun(false)
      setVulUpdatePending(false)
    }
    prevStatusRef.current = app?.status
  }, [app?.status])

  useEffect(() => {
    if (currentTab === "vulnerabilities" && !vulScanRun && !loadingVul) {
      const timeoutId = window.setTimeout(() => {
        void scanVulnerabilities()
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }
  }, [currentTab, vulScanRun, loadingVul, scanVulnerabilities])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false)
  const handleCopyUrl = () => {
    const url = app ? getAppUrl(app) : ""
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast("Copied", "URL copied to clipboard.")
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <span className="animate-pulse text-sm text-muted-foreground">
            Loading application...
          </span>
        </div>
      </AppShell>
    )
  }

  if (!app) {
    return (
      <AppShell>
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">
            Application not found.
          </p>
          <Button onClick={() => router.push("/")} className="h-8 text-xs">
            Back to Dashboard
          </Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppDetailProvider
      value={{
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
      }}
    >
      <AppDetailView />
    </AppDetailProvider>
  )
}

export default function AppDetailRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <AppDetailPage />
    </Suspense>
  )
}
