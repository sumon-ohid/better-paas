"use client"

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { NucleoIcon } from "@/components/nucleo-icons"
import { AppShell, useToast } from "@/components/app-shell"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { DeleteConfirmModal } from "@/components/delete-confirm-modal"
import { AppDomains } from "@/components/app-domains"
import { SitePreview } from "@/components/site-preview"
import { EnvVarsCard } from "@/components/env-vars-card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
} from "@/components/ui/alert-dialog"
import { api, createRuntimeLogsWs } from "@/lib/api"
import type { App, DeploymentRecord, LogEntry, GitHubContent } from "@/lib/types"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { Docker } from "@/components/ui/svgs/docker"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Nix } from "@/components/ui/svgs/nix"
import {
  makeRepoRef,
  detectFrameworkByFiles,
  detectFrameworkForDir,
  findDockerfile,
  type Framework,
} from "@/lib/framework-detection"
import dynamic from "next/dynamic"

// xterm.js touches the DOM on import, so load the terminal client-side only.
const ContainerTerminal = dynamic(
  () => import("@/components/container-terminal").then((m) => m.ContainerTerminal),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-border/80 bg-card text-xs text-muted-foreground">
        Loading terminal…
      </div>
    ),
  },
)

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const ChevronLeftIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-left" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />
const SquareIcon = (props: IconProps) => <NucleoIcon {...props} name="square" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const LoaderIcon = (props: IconProps) => <NucleoIcon {...props} name="loader" />
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const Trash2Icon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const ExternalIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const CopyIcon = (props: IconProps) => <NucleoIcon {...props} name="copy" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const GitBranchIcon = (props: IconProps) => <NucleoIcon {...props} name="branch" />
const GitCommitIcon = (props: IconProps) => <NucleoIcon {...props} name="git-commit" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const FolderIcon = (props: IconProps) => <NucleoIcon {...props} name="folder" />
const ChevronRightIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-right" />

export type AppTab = "overview" | "config" | "domains" | "logs" | "terminal" | "deployments"

// timeAgo renders a short, human-friendly relative time like "11d ago" or
// "just now". Falls back to an empty string for invalid dates.
function timeAgo(date: string | number | Date): string {
  const then = new Date(date).getTime()
  if (Number.isNaN(then)) return ""
  const secs = Math.round((Date.now() - then) / 1000)
  if (secs < 45) return "just now"
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

// githubCommitUrl builds a link to a specific commit on GitHub from the app's
// git repo URL. Returns "" for non-GitHub remotes or when the SHA is missing.
function githubCommitUrl(gitRepo: string, commit: string): string {
  if (!commit || !gitRepo.includes("github.com")) return ""
  const repoPath = gitRepo
    .replace(/\.git$/, "")
    .replace(/^git@github\.com:/, "")
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/^github\.com\//, "")
  return `https://github.com/${repoPath}/commit/${commit}`
}

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
    [router, appId],
  )

  // ── Actions ────────────────────────────────────────────────────────────────
    const [isToggling, setIsToggling] = useState(false)
    const [isRedeploying, setIsRedeploying] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
  const [expandedDepl, setExpandedDepl] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState<DeploymentRecord | null>(null)
  const [isRollingBack, setIsRollingBack] = useState(false)

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
  const [buildMethod, setBuildMethod] = useState<"nixpacks" | "dockerfile" | "compose">("nixpacks")
  const [dockerfilePath, setDockerfilePath] = useState("Dockerfile")
  const [dockerfileAvailable, setDockerfileAvailable] = useState(false)

  // ── Framework detection (for the Root Directory field) ──────────────────────
  const [detectedFramework, setDetectedFramework] = useState<Framework | null>(null)
  const [isDetectingFramework, setIsDetectingFramework] = useState(false)
  const rootDirDetectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Folder browser ──────────────────────────────────────────────────────────
  const [showFolderBrowser, setShowFolderBrowser] = useState(false)
  const [folderBrowserPath, setFolderBrowserPath] = useState("")
  const [folderBrowserContents, setFolderBrowserContents] = useState<GitHubContent[]>([])
  const [folderBrowserLoading, setFolderBrowserLoading] = useState(false)
  const [folderBrowserBreadcrumbs, setFolderBrowserBreadcrumbs] = useState<string[]>([])

  // ── Logs ───────────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsConnected, setLogsConnected] = useState(false)
  const logsWsRef = useRef<WebSocket | null>(null)
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
        setBuildMethod(found.buildMethod === "dockerfile" ? "dockerfile" : found.buildMethod === "compose" ? "compose" : "nixpacks")
        setDockerfilePath(found.dockerfilePath || "Dockerfile")
        // If the app is already configured to use a Dockerfile, surface the
        // selector immediately. Otherwise we probe the repo below to decide.
        if (found.buildMethod === "dockerfile") setDockerfileAvailable(true)

        const loadedVars: { key: string; value: string }[] = []
        if (found.envVars) {
          Object.entries(found.envVars).forEach(([k, v]) => loadedVars.push({ key: k, value: v }))
        }
        setEnvVars(loadedVars.length > 0 ? loadedVars : [{ key: "", value: "" }])
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
    [gitRepo, branch, app?.composeProject],
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

    const ws = createRuntimeLogsWs(appId)
    logsWsRef.current = ws

    ws.onopen = () => setLogsConnected(true)

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      logBufferRef.current.push({ message: data.message, timestamp: data.timestamp })
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
  }, [appId])

  useEffect(() => {
    if (currentTab === "logs" && appId) {
      // connectLogs sets state inside async WS callbacks, not synchronously.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      connectLogs()
    }
    return () => {
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
        `${app.name} is now ${action === "stop" ? "stopped" : "running"}.`,
      )
      fetchData()
    } catch (err) {
      showToast("Error", `Failed to ${action} container.`, "destructive")
      console.error(err)
     } finally {
       setIsToggling(false)
     }
   }
 
   const handleRedeploy = async () => {
     if (!app) return
     setIsRedeploying(true)
     try {
       await api.apps.redeploy(app.id)
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
          `Re-releasing ${dep.commit ? dep.commit.slice(0, 7) : "deployment"} for ${app.name}...`,
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
    envVars.forEach((item) => {
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
        // Compose rows don't expose a reconfigurable build method here; omit it
        // so we never overwrite the stored "compose" method with a default.
        ...(app.composeProject
          ? {}
          : {
              buildMethod,
              dockerfilePath: buildMethod === "dockerfile" ? dockerfilePath.trim() || "Dockerfile" : undefined,
            }),
      })
      showToast("Settings Saved", "Application configuration updated.")
      fetchData()
    } catch (err) {
      showToast("Error", "Failed to save configuration.", "destructive")
      console.error(err)
    } finally {
      setIsSaving(false)
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
    [gitRepo, branch, checkDockerfile],
  )

  const handleRootDirChange = (value: string) => {
    setRootDir(value)
    if (rootDirDetectTimer.current) clearTimeout(rootDirDetectTimer.current)
    rootDirDetectTimer.current = setTimeout(() => redetectForRootDir(value), 600)
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
    if (!gitRepo || !branch) return
    setShowFolderBrowser(true)
    setFolderBrowserPath("")
    setFolderBrowserBreadcrumbs([])
    await loadFolderContents("")
  }

  const navigateIntoFolder = (folderName: string) => {
    const newPath = folderBrowserPath ? `${folderBrowserPath}/${folderName}` : folderName
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

  // ── Helpers ────────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false)
  const handleCopyUrl = () => {
    if (!app?.url) return
    navigator.clipboard.writeText(app.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast("Copied", "URL copied to clipboard.")
  }

  const lineColor = (msg: string) => {
    if (msg.startsWith("✖") || msg.includes(" Error") || msg.includes("failed")) return "text-destructive"
    if (msg.startsWith("✅") || msg.startsWith("✔") || msg.includes("successfully")) return "text-success"
    if (
      msg.startsWith("📦") ||
      msg.startsWith("🔍") ||
      msg.startsWith("🚀") ||
      msg.startsWith("🧹") ||
      msg.startsWith("✨") ||
      msg.startsWith("💡") ||
      msg.startsWith("⚠️") ||
      msg.startsWith("📂")
    )
      return "text-warning"
    return "text-foreground dark:text-slate-200"
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <span className="text-sm text-muted-foreground animate-pulse">Loading application...</span>
        </div>
      </AppShell>
    )
  }

  if (!app) {
    return (
      <AppShell>
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">Application not found.</p>
          <Button onClick={() => router.push("/")} className="h-8 text-xs">
            Back to Dashboard
          </Button>
        </div>
      </AppShell>
    )
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
  const overviewCommitMsg = app.activeCommitMsg || activeDeployment?.commitMsg || ""
  const overviewCommitUrl = overviewCommit ? githubCommitUrl(app.gitRepo, overviewCommit) : ""
  const overviewDomains = (app.domains && app.domains.length > 0 ? app.domains : [app.url]).filter(
    Boolean,
  )

  const tabs: { id: AppTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "config", label: "Configuration" },
    { id: "domains", label: "Domains" },
    { id: "logs", label: "Logs" },
    { id: "terminal", label: "Terminal" },
    { id: "deployments", label: "Deployments" },
  ]

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-border bg-transparent px-4 py-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant={"link"}
                onClick={() => router.push("/")}
                className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
                Dashboard
              </Button>
              <span className="h-4 w-px bg-border shrink-0" />
              <div className="flex min-w-0 items-center gap-2.5">
                <h1 className="truncate text-lg sm:text-xl font-bold text-foreground">{app.name}</h1>
                <StatusBadge status={app.status} />
              </div>
              {app.branch && (
                <span className="hidden sm:inline-flex shrink-0 items-center gap-1 text-xs font-mono text-muted-foreground">
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
                    className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-600"
                  >
                    <SquareIcon className="h-3 w-3 mr-1" />
                    Stop
                  </Button>
                ) : app.status === "stopped" ? (
                  <Button
                    onClick={() => handleToggle("start")}
                    disabled={isToggling}
                    variant="outline"
                    className="h-7 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600"
                  >
                    <PlayIcon className="h-3 w-3 mr-1" />
                    Start
                  </Button>
                ) : null}
                <Button
                  onClick={handleRedeploy}
                  disabled={isRedeploying || app.status === "building"}
                  variant="outline"
                  className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <RefreshIcon className={`h-3 w-3 mr-1 ${isRedeploying ? "animate-spin" : ""}`} />
                  {isRedeploying ? "Redeploying..." : "Redeploy"}
                </Button>
              </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-3 border-b border-border/50 overflow-x-auto scrollbar-none -mx-4 px-4">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-t-md px-3 py-2 text-sm transition-all cursor-pointer border-b-2 -mb-px ${
                  currentTab === t.id
                    ? "border-primary bg-muted/40 font-semibold text-foreground"
                    : "border-transparent font-medium text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* ── Overview ───────────────────────────────────────────────── */}
          {currentTab === "overview" && (
            <div className="h-full overflow-y-auto p-4 md:p-6">
              <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in-50 duration-200">
              {/* Vercel-style hero: live site preview and deployment summary in one card */}
              <Card className="border-border bg-card/72 backdrop-blur-xl p-5">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                  {/* Live site preview (web-facing rows only). Non-web compose
                      services (workers, databases) have no URL to preview. */}
                  {app.url ? (
                    <SitePreview url={app.url} status={app.status} />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card/72 p-6 text-center backdrop-blur-xl">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
                        <NucleoIcon name="server" className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {app.composeService ? `Internal service: ${app.composeService}` : "Internal service"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This service has no public URL. Use the terminal and logs to inspect it.
                      </p>
                    </div>
                  )}

                  {/* Deployment summary — snapshot of the live release */}
                  <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                  {/* Created */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground block">Created</span>
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      <NucleoIcon name="cloud" className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{new Date(app.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                      <span className="text-muted-foreground">{timeAgo(app.createdAt)}</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground block">Status</span>
                    <StatusBadge status={app.status} />
                  </div>

                  {/* Duration */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground block">Duration</span>
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      <NucleoIcon name="activity" className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium tabular-nums">
                        {activeDeployment?.duration || "—"}
                      </span>
                      {activeDeployment?.createdAt && (
                        <span className="text-muted-foreground">{timeAgo(activeDeployment.createdAt)}</span>
                      )}
                    </div>
                  </div>

                  {/* Port Routing */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground block">Port Routing</span>
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      <NucleoIcon name="server" className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono font-medium tabular-nums">
                        {app.port}
                        {app.portOverride ? ` → ${app.portOverride}` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Domains */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground block">Domains</span>
                    <div className="space-y-1">
                      {overviewDomains.length === 0 ? (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <NucleoIcon name="web" className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {app.composeService ? "Internal service — no public URL" : "No public URL"}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={app.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
                            >
                              <NucleoIcon name="web" className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate">{overviewDomains[0].replace(/^https?:\/\//, "")}</span>
                              {overviewDomains.length > 1 && (
                                <Badge variant="secondary" size="sm" className="shrink-0">
                                  +{overviewDomains.length - 1}
                                </Badge>
                              )}
                            </a>
                            <button
                              onClick={handleCopyUrl}
                              title="Copy URL"
                              className="shrink-0 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors border-0"
                            >
                              {copied ? <CheckIcon className="h-3 w-3 text-success" /> : <CopyIcon className="h-3 w-3" />}
                            </button>
                          </div>
                          {overviewDomains.slice(1, 3).map((d) => (
                            <a
                              key={d}
                              href={d.startsWith("http") ? d : `https://${d}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                            >
                              <NucleoIcon name="link" className="h-3 w-3 shrink-0" />
                              <span className="truncate">{d.replace(/^https?:\/\//, "")}</span>
                            </a>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Source */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground block">Source</span>
                    <div className="space-y-1">
                      <a
                        href={app.gitRepo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {app.gitRepo.includes("github.com") ? (
                          <>
                            <GithubLight className="h-3.5 w-3.5 shrink-0 dark:hidden" />
                            <GithubDark className="h-3.5 w-3.5 shrink-0 hidden dark:block" />
                          </>
                        ) : (
                          <NucleoIcon name="branch" className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate font-mono">{app.gitRepo.replace(/^https?:\/\//, "")}</span>
                        <ExternalIcon className="h-3 w-3 opacity-60 shrink-0" />
                      </a>
                      {app.branch && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <GitBranchIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate font-mono">{app.branch}</span>
                        </div>
                      )}
                      {overviewCommit ? (
                        overviewCommitUrl ? (
                          <a
                            href={overviewCommitUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                            title={overviewCommitMsg || undefined}
                          >
                            <GitCommitIcon className="h-3 w-3 shrink-0" />
                            <span className="font-mono">{overviewCommit.slice(0, 7)}</span>
                            {overviewCommitMsg && <span className="truncate">{overviewCommitMsg}</span>}
                          </a>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <GitCommitIcon className="h-3 w-3 shrink-0" />
                            <span className="font-mono">{overviewCommit.slice(0, 7)}</span>
                            {overviewCommitMsg && <span className="truncate">{overviewCommitMsg}</span>}
                          </div>
                        )
                      ) : null}
                    </div>
                  </div>
                  </div>
                </div>
              </Card>

              {app.envVars && Object.keys(app.envVars).length > 0 && (
                <EnvVarsCard envVars={app.envVars} secretKeys={app.secretKeys} />
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button
                  onClick={() => setTab("config")}
                  variant="outline"
                  className="h-8 text-xs border-border"
                >
                  Edit Configuration
                </Button>
                <Button
                  onClick={() => setShowDeleteModal(true)}
                  variant="outline"
                  className="h-8 text-xs border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                >
                  <Trash2Icon className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
          )}

          {/* ── Configuration ──────────────────────────────────────────── */}
          {currentTab === "config" && (
            <div className="h-full overflow-y-auto p-4 md:p-6">
              <div className="mx-auto max-w-4xl space-y-5 animate-in fade-in-50 duration-200">
               {app.composeService && (
                 <Alert>
                   <Docker className="h-4 w-4" />
                   <AlertDescription>
                     This is the <span className="font-mono font-semibold">{app.composeService}</span> service of a
                     Docker Compose project. Build settings are controlled by the compose file in the repo, not here.
                     Redeploy rebuilds the whole project; deleting any service removes the entire group.
                   </AlertDescription>
                 </Alert>
               )}
               <div className="space-y-1">
                 <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                   Git Repository URL
                 </Label>
                   <div className="relative flex items-center gap-2">
                     <div className="relative flex-1">
                       {app?.gitRepo?.includes("github.com") && (
                         <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                           <GithubLight className="h-4 w-4 dark:hidden" />
                           <GithubDark className="h-4 w-4 hidden dark:block" />
                         </div>
                       )}
                       <Input
                         value={gitRepo}
                         onChange={(e) => setGitRepo(e.target.value)}
                         className={`h-9 text-sm ${app?.gitRepo?.includes("github.com") ? "pl-7" : ""}`}
                       />
                     </div>
                     <a
                       href={app.gitRepo}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="h-9 w-9 rounded-md border border-border bg-muted/20 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
                       title="Open repository"
                     >
                       <ExternalIcon className="h-3.5 w-3.5" />
                     </a>
                   </div>
               </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Branch</Label>
                  {isFetchingBranches ? (
                    <div className="h-9 flex items-center gap-2 text-xs text-muted-foreground">
                      <RefreshIcon className="h-3 w-3 animate-spin" />
                      Fetching branches...
                    </div>
                  ) : branches.length > 0 ? (
                    <Select value={branch} onValueChange={(v) => setBranch(v ?? "")}>
                      <SelectTrigger className="h-9 text-sm w-full">
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
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Root Directory
                    </Label>
                    <button
                      type="button"
                      onClick={openFolderBrowser}
                      disabled={!gitRepo || !branch}
                      className="text-[10px] text-primary hover:underline disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Browse…
                    </button>
                  </div>
                  <Input
                    value={rootDir}
                    onChange={(e) => handleRootDirChange(e.target.value)}
                    placeholder="./"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {(isDetectingFramework || detectedFramework) && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  {isDetectingFramework ? (
                    <>
                      <RefreshIcon className="h-4 w-4 animate-spin text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Scanning directory for a framework…</p>
                    </>
                  ) : detectedFramework ? (
                    <>
                      {detectedFramework.icon ? (
                        <detectedFramework.icon className="h-5 w-5 shrink-0" />
                      ) : null}
                      <p className="text-xs text-foreground">
                        {detectedFramework.name} detected{" "}
                        <span className="text-muted-foreground">— commands updated below</span>
                      </p>
                    </>
                  ) : null}
                </div>
              )}

              {/* Build method selector — only when a Dockerfile exists in the
                  chosen directory; otherwise Nixpacks is used. */}
              {dockerfileAvailable && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Build Method
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "nixpacks" as const, label: "Nixpacks", desc: "Auto-detect", icon: <Nix className="h-5 w-5 text-foreground" /> },
                    { id: "dockerfile" as const, label: "Dockerfile", desc: "Use Dockerfile", icon: <Docker className="h-5 w-5" /> },
                  ].map((opt) => {
                    const active = buildMethod === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setBuildMethod(opt.id)}
                        className={`flex flex-col items-start gap-1.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                          active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
                        }`}
                      >
                        {opt.icon}
                        <span className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                          <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              )}

              {dockerfileAvailable && buildMethod === "dockerfile" && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Dockerfile Path
                  </Label>
                  <Input
                    value={dockerfilePath}
                    onChange={(e) => setDockerfilePath(e.target.value)}
                    placeholder="Dockerfile"
                    className="h-9 text-sm font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Relative to the root directory. Install/build/start commands are ignored — your
                    Dockerfile controls the build. Make sure it exposes the app on the port above.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Port Override
                  </Label>
                  <Input
                    value={portOverride}
                    onChange={(e) => setPortOverride(e.target.value.replace(/\D/g, ""))}
                    className="h-9 text-sm"
                  />
                </div>
                {buildMethod === "nixpacks" && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Install Command
                  </Label>
                  <Input
                    value={installCommand}
                    onChange={(e) => setInstallCommand(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                )}
              </div>

              {buildMethod === "nixpacks" && (
              <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Build Command
                  </Label>
                  <Input value={buildCommand} onChange={(e) => setBuildCommand(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Start Command
                  </Label>
                  <Input value={startCommand} onChange={(e) => setStartCommand(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
              </>
              )}

              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Environment Variables
                  </Label>
                  <Button
                    type="button"
                    onClick={() => setEnvVars((prev) => [...prev, { key: "", value: "" }])}
                    className="h-6 cursor-pointer rounded bg-secondary text-secondary-foreground text-xs px-2 hover:bg-secondary/85 flex items-center gap-1 font-semibold border-0"
                  >
                    <PlusIcon className="h-3 w-3 text-white dark:text-black" />
                    <span className="text-white dark:text-black">
                      Add Variables
                    </span>
                  </Button>
                </div>
                <div className="space-y-2">
                  {envVars.map((env, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        value={env.key}
                        onChange={(e) => {
                          const updated = [...envVars]
                          updated[index].key = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "")
                          setEnvVars(updated)
                        }}
                        placeholder="NAME"
                        className="h-8 text-xs font-mono flex-1"
                      />
                      <Input
                        value={env.value}
                        onChange={(e) => {
                          const updated = [...envVars]
                          updated[index].value = e.target.value
                          setEnvVars(updated)
                        }}
                        placeholder="value"
                        className="h-8 text-xs font-mono flex-1"
                      />
                      <Button
                        type="button"
                        onClick={() => setEnvVars((prev) => prev.filter((_, i) => i !== index))}
                        variant="ghost"
                        className="h-7 w-7 hover:bg-rose-500/10 text-rose-400 p-0 shrink-0 border-0"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button onClick={() => setTab("overview")} variant="outline" className="h-8 text-xs border-border">
                  Discard
                </Button>
                <Button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSaving ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </div>
          </div>
          )}

          {/* ── Domains ────────────────────────────────────────────────── */}
          {currentTab === "domains" && (
            <AppDomains app={app} onChange={(updated) => setApp(updated)} />
          )}

          {/* ── Logs ───────────────────────────────────────────────────── */}
          {currentTab === "logs" && (
            <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TerminalIcon className="h-3.5 w-3.5" />
                  <span>Runtime Logs</span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${logsConnected ? "bg-success animate-pulse" : "bg-muted-foreground/30"}`}
                  />
                  <span>{logsConnected ? "Live" : "Disconnected"}</span>
                  {logs.length > 0 && (
                    <span className="font-mono text-muted-foreground/50">· {logs.length} lines</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => connectLogs()}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    Reconnect
                  </button>
                  {logs.length > 0 && (
                    <button
                      onClick={() => setLogs([])}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 mt-4 min-h-0 bg-transparent border border-border/80 rounded-lg overflow-hidden font-mono text-xs leading-relaxed flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2 shrink-0 select-none">
                  {logsConnected && (
                    <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-0.5">
                  {logs.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground/50 dark:text-slate-500 select-none">
                      <TerminalIcon className={`h-8 w-8 opacity-25 ${logsConnected ? "animate-pulse" : ""}`} />
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
                        <div key={i} className="flex gap-4 group hover:bg-foreground/2 dark:hover:bg-white/2 rounded px-1 -mx-1">
                          <span className="select-none text-muted-foreground/40 dark:text-slate-600 w-10 text-right shrink-0 group-hover:text-muted-foreground/60 dark:group-hover:text-slate-500 transition-colors">
                            {i + 1}
                          </span>
                          <span className="select-none text-muted-foreground/40 dark:text-slate-600 shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className={`${lineColor(log.message)} break-all`}>{log.message}</span>
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Terminal ───────────────────────────────────────────────── */}
          {currentTab === "terminal" && (
            <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TerminalIcon className="h-3.5 w-3.5" />
                  <span>Container Shell</span>
                </div>
                {app.status === "running" && (
                  <button
                    onClick={() => setTermReconnectToken((t) => t + 1)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    <RefreshIcon className="h-3 w-3" />
                    Reconnect
                  </button>
                )}
              </div>

              {app.status !== "running" ? (
                <div className="flex-1 mt-4 min-h-0 bg-card border border-border/80 rounded-lg flex flex-col items-center justify-center gap-3 text-muted-foreground/60 select-none">
                  <TerminalIcon className="h-8 w-8 opacity-25" />
                  <span className="text-sm">The container must be running to open a terminal.</span>
                  {app.status === "stopped" && (
                    <Button
                      onClick={() => handleToggle("start")}
                      disabled={isToggling}
                      variant="outline"
                      className="h-7 gap-1.5 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600"
                    >
                      <PlayIcon className="h-3 w-3" />
                      Start container
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex-1 mt-4 min-h-0">
                  <ContainerTerminal
                    appId={appId}
                    appName={app.name}
                    reconnectToken={termReconnectToken}
                  />
                </div>
              )}
            </div>
          )}

           {/* ── Deployments ────────────────────────────────────────────── */}
           {currentTab === "deployments" && (
             <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4 animate-in fade-in-50 duration-200">
               <div>
                 <h2 className="text-sm font-bold text-foreground">Deployment History</h2>
                 <p className="text-xs text-muted-foreground mt-0.5">
                   {deployments.length} deployment{deployments.length !== 1 ? "s" : ""} recorded.
                 </p>
               </div>

               {deployments.length === 0 ? (
                 <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                   <RefreshIcon className="h-6 w-6 mx-auto mb-3 opacity-20" />
                   {app.status === "building"
                     ? "Waiting for the current build to finish…"
                     : "No deployments recorded for this project yet."}
                 </div>
               ) : (
                 <div className="space-y-3">
                   {deployments.map((dep, idx) => {
                     const isExpanded = expandedDepl === dep.id
                     const isBuilding = dep.status === "building" || dep.status === "in_progress"
                     const isSuccess = dep.status === "success"
                     const deployNumber = deployments.length - idx
                     const isLive = !!dep.image && dep.image === app.activeImage
                     const canRollback = isSuccess && !!dep.image && !isLive && !isBuilding
                     const commitUrl = dep.commit ? githubCommitUrl(app.gitRepo, dep.commit) : ""

                     return (
                       <div
                         key={dep.id}
                         className="rounded-xl border border-border bg-card/72 backdrop-blur-xl overflow-hidden transition-shadow hover:shadow-sm"
                       >
                         {/* Header row — single flex row that wraps on small screens */}
                         <div
                           className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 cursor-pointer group"
                           onClick={() => setExpandedDepl(isExpanded ? null : dep.id)}
                         >
                           {/* Status indicator */}
                           <div className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center ${
                             isBuilding
                               ? "bg-warning/10"
                               : isSuccess
                                 ? "bg-success/10"
                                 : "bg-destructive/10"
                           }`}>
                             {isBuilding ? (
                               <LoaderIcon className="h-3.5 w-3.5 text-warning animate-spin" />
                             ) : isSuccess ? (
                               <CheckIcon className="h-3.5 w-3.5 text-success" />
                             ) : (
                               <XIcon className="h-3.5 w-3.5 text-destructive" />
                             )}
                           </div>

                           <span className="shrink-0 text-xs font-mono text-muted-foreground">
                             #{deployNumber}
                           </span>

                           {/* Commit message — flexes and truncates to fit the row */}
                           <span className="min-w-0 flex-1 basis-40 truncate text-sm font-medium text-foreground">
                             {dep.commitMsg ||
                               (dep.trigger === "rollback" ? "Rollback" : "(no commit message)")}
                           </span>

                           {/* Commit hash → GitHub commit page */}
                           {dep.commit &&
                             (commitUrl ? (
                               <a
                                 href={commitUrl}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 onClick={(e) => e.stopPropagation()}
                                 className="shrink-0 inline-flex items-center gap-1 rounded border border-border/80 bg-muted/30 px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                                 title="View commit on GitHub"
                               >
                                 <GitCommitIcon className="h-3 w-3" />
                                 {dep.commit.slice(0, 7)}
                                 <ExternalIcon className="h-2.5 w-2.5 opacity-60" />
                               </a>
                             ) : (
                               <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground/80">
                                 <GitCommitIcon className="h-3 w-3" />
                                 {dep.commit.slice(0, 7)}
                               </span>
                             ))}

                           {/* Branch */}
                           {app.branch && (
                             <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground/80">
                               <GitBranchIcon className="h-3 w-3" />
                               {app.branch}
                             </span>
                           )}

                           {/* Time */}
                           <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                             {new Date(dep.createdAt).toLocaleString(undefined, {
                               month: "short",
                               day: "numeric",
                               hour: "2-digit",
                               minute: "2-digit",
                             })}
                           </span>

                           {/* Duration */}
                           <span className="shrink-0 text-[11px] font-mono text-muted-foreground/70">
                             {isBuilding ? "in progress" : dep.duration}
                           </span>

                           {/* Status + live badges */}
                           <Badge
                             variant={isBuilding ? "warning" : isSuccess ? "success" : "error"}
                             size="sm"
                             className="shrink-0"
                           >
                             {isBuilding ? "Building" : isSuccess ? "Success" : "Failed"}
                           </Badge>

                           {isLive && (
                             <Badge variant="info" size="sm" className="shrink-0 gap-1">
                               <span className="h-1.5 w-1.5 rounded-full bg-info" />
                               Live
                             </Badge>
                           )}

                           {/* Rollback (inline, no need to expand) */}
                           {canRollback && (
                             <button
                               onClick={(e) => {
                                 e.stopPropagation()
                                 setRollbackTarget(dep)
                               }}
                               className="shrink-0 inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11px] font-mono text-primary hover:bg-primary/15 cursor-pointer transition-colors"
                               title="Roll back to this deployment"
                             >
                               <RefreshIcon className="h-3 w-3" />
                               Rollback
                             </button>
                           )}

                           {/* Expand chevron */}
                           <ChevronLeftIcon className={`ml-auto shrink-0 h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                             isExpanded ? "-rotate-90" : "rotate-180"
                           }`} />
                         </div>
                         
                         {/* Expanded log output */}
                         {isExpanded && (
                           <div className="border-t bg-transparent border-border/30">
                             <div className="flex items-center justify-between px-4 py-2 border-b border-border/20">
                               <span className="text-[11px] font-mono text-muted-foreground/50 dark:text-slate-500">
                                 Build log · {dep.logs.length} lines
                               </span>
                               <div className="flex items-center gap-3">
                                 {canRollback && (
                                   <button
                                     onClick={(e) => {
                                       e.stopPropagation()
                                       setRollbackTarget(dep)
                                     }}
                                     className="flex items-center gap-1 text-[11px] font-mono text-primary hover:text-primary/80 cursor-pointer transition-colors"
                                   >
                                     <RefreshIcon className="h-3 w-3" />
                                     Rollback to this
                                   </button>
                                 )}
                                 {isLive && (
                                   <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground/50">
                                     <CheckIcon className="h-3 w-3 text-info" />
                                     Currently live
                                   </span>
                                 )}
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation()
                                     router.push(`/logs?appId=${appId}&mode=build`)
                                   }}
                                   className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground/50 hover:text-foreground dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer transition-colors"
                                 >
                                   <TerminalIcon className="h-3 w-3" />
                                   Open full log
                                 </button>
                               </div>
                             </div>
                             <div className="px-4 py-3 font-mono text-xs text-foreground dark:text-slate-300 max-h-80 overflow-y-auto space-y-0.5">
                               {dep.logs.length === 0 ? (
                                 <span className="text-muted-foreground/40 dark:text-slate-600 italic">No log output recorded.</span>
                               ) : (
                                 dep.logs.map((line, i) => (
                                   <div key={i} className="flex gap-4">
                                     <span className="select-none text-muted-foreground/40 dark:text-slate-600 w-8 text-right shrink-0">
                                       {i + 1}
                                     </span>
                                     <span className={lineColor(line)}>{line}</span>
                                   </div>
                                 ))
                               )}
                             </div>
                           </div>
                         )}
                       </div>
                     )
                   })}
                 </div>
               )}
             </div>
           )}
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        appName={app?.name ?? ""}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
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
              {rollbackTarget?.commitMsg ? ` — “${rollbackTarget.commitMsg}”` : ""}. A new
              deployment will be created and your live container will be replaced with it. No
              rebuild happens, so it&apos;s fast.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              onClick={() => rollbackTarget && handleRollback(rollbackTarget)}
              disabled={isRollingBack}
              className="gap-1.5"
            >
              <RefreshIcon className={`h-4 w-4 ${isRollingBack ? "animate-spin" : ""}`} />
              {isRollingBack ? "Rolling back…" : "Confirm rollback"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Folder Browser Modal */}
      <Dialog open={showFolderBrowser} onOpenChange={setShowFolderBrowser}>
        <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Select Root Directory</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Choose the directory containing your project files.
            </DialogDescription>
          </DialogHeader>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto pb-1 px-6">
            <button
              className={`hover:text-foreground flex items-center gap-0.5 shrink-0 ${folderBrowserPath === "" ? "font-medium text-foreground" : ""}`}
              onClick={() => navigateToBreadcrumb(-1)}
            >
              <NucleoIcon name="house" className="h-3 w-3" />
              Root
            </button>
            {folderBrowserBreadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                <ChevronRightIcon className="h-3 w-3 shrink-0" />
                <button
                  className={`hover:text-foreground shrink-0 ${i === folderBrowserBreadcrumbs.length - 1 ? "font-medium text-foreground" : ""}`}
                  onClick={() => navigateToBreadcrumb(i)}
                >
                  {crumb}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Current selection indicator */}
          {folderBrowserPath && (
            <div className="text-xs px-2 mb-2 py-1 mx-6 bg-primary/5 border border-primary/20 rounded text-primary font-medium">
              Selected: ./{folderBrowserPath}
            </div>
          )}

          {/* Folder list */}
          <div className="flex-1 mb-2 overflow-y-auto border border-border rounded-md mx-6">
            {folderBrowserLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <RefreshIcon className="h-4 w-4 animate-spin mr-2" />
                Loading folders…
              </div>
            ) : folderBrowserContents.filter((i) => i.type === "dir").length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No subdirectories found.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {folderBrowserContents
                  .filter((item) => item.type === "dir")
                  .map((item) => (
                    <div
                      key={item.path}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 cursor-pointer group"
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
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/40 px-6 pb-6">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setRootDir("")
                setShowFolderBrowser(false)
                if (rootDirDetectTimer.current) clearTimeout(rootDirDetectTimer.current)
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
              className="flex min-w-0 shrink items-center gap-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <span className="shrink-0">Select</span>
              <span className="truncate font-mono">{folderBrowserPath || "Root (./)"}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

export default function AppDetailRoute() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AppDetailPage />
    </Suspense>
  )
}
