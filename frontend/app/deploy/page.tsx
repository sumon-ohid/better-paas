"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { NucleoIcon } from "@/components/nucleo-icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "@/components/ui/dialog"
import type { GitHubRepo, GitHubContent, Server } from "@/lib/types"
import { GitHubConnectModal } from "@/components/github-connect-modal"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { Docker } from "@/components/ui/svgs/docker"
import { Nix } from "@/components/ui/svgs/nix"
import {
  FRAMEWORKS,
  detectFrameworkByName,
  detectFrameworkByFiles,
  detectFrameworkForDir,
  findDockerfile,
  findComposeFile,
} from "@/lib/framework-detection"
import { api } from "@/lib/api"
import { GitCompareArrows } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { useActiveServer } from "@/components/server-context"

// Styled fallback for frameworks without svgl assets (Elixir/Phoenix only)
function FallbackIcon({ label }: { label: string; color: string }) {
  return (
    <div className="h-5 w-5 rounded-md flex items-center justify-center text-[9px] font-bold border border-purple-400/40 text-purple-400 bg-purple-400/10">
      {label.slice(0, 2).toUpperCase()}
    </div>
  )
}

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const ChevronLeftIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-left" />
const ChevronRightIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-right" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />

const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const FolderIcon = (props: IconProps) => <NucleoIcon {...props} name="folder" />

export default function DeployPage() {
  const router = useRouter()
  const { activeServerId } = useActiveServer()

  // ── Wizard step ────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1)

  // ── GitHub connection ──────────────────────────────────────────────────────
  const [gitHubConnected, setGitHubConnected] = useState(false)
  const [showGitHubModal, setShowGitHubModal] = useState(false)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [showRepoList, setShowRepoList] = useState(true)

  // ── Selected repo & branch ─────────────────────────────────────────────────
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState("")
  const [isFetchingBranches, setIsFetchingBranches] = useState(false)

  // ── Deploy config ──────────────────────────────────────────────────────────
  const [deployName, setDeployName] = useState("")
  const [deployRootDir, setDeployRootDir] = useState("")
  const [deployPortOverride, setDeployPortOverride] = useState("")
  const [deployBuildCommand, setDeployBuildCommand] = useState("")
  const [deployStartCommand, setDeployStartCommand] = useState("")
  const [deployInstallCommand, setDeployInstallCommand] = useState("")
  const [deployEnvVars, setDeployEnvVars] = useState<{ key: string; value: string }[]>([])

  // ── Build method (nixpacks | dockerfile | compose) ──────────────────────────
  const [deployBuildMethod, setDeployBuildMethod] = useState<"nixpacks" | "dockerfile" | "compose">("nixpacks")
  const [deployDockerfilePath, setDeployDockerfilePath] = useState("Dockerfile")
  // Whether the selected root directory actually contains a Dockerfile. The
  // build-method selector is only shown when this is true; otherwise Nixpacks
  // is the only option and we don't clutter the UI with a choice.
  const [dockerfileAvailable, setDockerfileAvailable] = useState(false)
  // Whether the selected root directory contains a Docker Compose file. When
  // present, the Compose build method is offered.
  const [composeAvailable, setComposeAvailable] = useState(false)
  const [deployComposePath, setDeployComposePath] = useState("docker-compose.yml")

  // ── Advanced config (resource limits, domains, volumes, health, auto-deploy) ─
  const [deployMemory, setDeployMemory] = useState("")
  const [deployCpus, setDeployCpus] = useState("")
  const [deployHealthPath, setDeployHealthPath] = useState("")
  const [deployDomains, setDeployDomains] = useState("")
  const [deployVolumes, setDeployVolumes] = useState("")
  const [deployAutoDeploy, setDeployAutoDeploy] = useState(false)

  // ── Detected framework ─────────────────────────────────────────────────────
  const [detectedFramework, setDetectedFramework] = useState<(typeof FRAMEWORKS)[0] | null>(null)
  const [isDetectingFramework, setIsDetectingFramework] = useState(false)

  // ── Manual public repo input ───────────────────────────────────────────────
  const [manualGitUrl, setManualGitUrl] = useState("")
  const [showPublicRepoModal, setShowPublicRepoModal] = useState(false)

  // ── Bulk env paste ─────────────────────────────────────────────────────────
  const [showBulkEnv, setShowBulkEnv] = useState(false)
  const [bulkEnvText, setBulkEnvText] = useState("")

  // ── Folder browser ─────────────────────────────────────────────────────────
  const [showFolderBrowser, setShowFolderBrowser] = useState(false)
  const [folderBrowserPath, setFolderBrowserPath] = useState("")
  const [folderBrowserContents, setFolderBrowserContents] = useState<GitHubContent[]>([])
  const [folderBrowserLoading, setFolderBrowserLoading] = useState(false)
  const [folderBrowserBreadcrumbs, setFolderBrowserBreadcrumbs] = useState<string[]>([])

  // ── UI state ───────────────────────────────────────────────────────────────
  const [isDeploying, setIsDeploying] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  // ── Servers ────────────────────────────────────────────────────────────────
  const [servers, setServers] = useState<Server[]>([])
  const [selectedServerId, setSelectedServerId] = useState("localhost")
  const selectedServerLabel =
    selectedServerId === "localhost"
      ? "Localhost"
      : servers.find((server) => server.id === selectedServerId)?.name ?? "Remote server"

  // Load servers on mount
  useEffect(() => {
    api.servers
      .list()
      .then((data) => {
        setServers(data)
        const activeTarget = activeServerId !== "all" ? activeServerId : ""
        const activeExists = activeTarget && data.some((s) => s.id === activeTarget)
        const hasLocalhost = data.some((s) => s.id === "localhost")
        setSelectedServerId(activeExists ? activeTarget : hasLocalhost ? "localhost" : data[0]?.id ?? "localhost")
      })
      .catch((err) => {
        console.error("Failed to load servers:", err)
      })
  }, [activeServerId])

  // Debounce timer for re-detecting the framework when the Root Directory input
  // is edited by hand.
  const rootDirDetectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Repo loading ───────────────────────────────────────────────────────────
  const loadRepos = useCallback(async () => {
    setIsLoadingRepos(true)
    try {
      const data = await api.git.repos()
      setRepos(data)
    } catch (err) {
      console.error("Failed to load repos:", err)
      setErrorMsg("Failed to load repositories. Your token may have expired.")
    } finally {
      setIsLoadingRepos(false)
    }
  }, [])

  // ── Check token on mount ───────────────────────────────────────────────────
  useEffect(() => {
    api.git
      .tokenStatus()
      .then((status) => {
        if (status.connected) {
          setGitHubConnected(true)
          loadRepos()
        }
      })
      .catch(() => {
        // No saved token
      })
  }, [loadRepos])

  // Clear any pending root-dir detection timer on unmount.
  useEffect(() => {
    return () => {
      if (rootDirDetectTimer.current) clearTimeout(rootDirDetectTimer.current)
    }
  }, [])

  const applyDetectedFramework = (fw: (typeof FRAMEWORKS)[0] | null) => {
    setDetectedFramework(fw)
    if (fw) {
      setDeployBuildCommand(fw.buildCmd)
      setDeployStartCommand(fw.startCmd)
      setDeployInstallCommand(fw.installCmd)
      setDeployPortOverride(String(fw.port))
    } else {
      setDeployBuildCommand("")
      setDeployStartCommand("")
      setDeployInstallCommand("")
      setDeployPortOverride("")
    }
  }

  // Probe the chosen directory for a Dockerfile and/or a Compose file. The
  // build-method selector is only revealed when at least one alternative to
  // Nixpacks exists; otherwise we silently force Nixpacks.
  const checkBuildOptions = async (repo: GitHubRepo, branch: string, dir: string) => {
    try {
      const [dockerfile, compose] = await Promise.all([
        findDockerfile(repo, branch, dir),
        findComposeFile(repo, branch, dir),
      ])
      if (dockerfile) {
        setDockerfileAvailable(true)
        setDeployDockerfilePath(dockerfile)
      } else {
        setDockerfileAvailable(false)
      }
      if (compose) {
        setComposeAvailable(true)
        setDeployComposePath(compose)
      } else {
        setComposeAvailable(false)
      }
      // Force Nixpacks if the currently-selected method is no longer available.
      setDeployBuildMethod((m) => {
        if (m === "dockerfile" && !dockerfile) return "nixpacks"
        if (m === "compose" && !compose) return "nixpacks"
        return m
      })
    } catch {
      setDockerfileAvailable(false)
      setComposeAvailable(false)
      setDeployBuildMethod("nixpacks")
    }
  }

  const handleRepoSelect = (repoFullName: string) => {
    const repo = repos.find((r) => r.full_name === repoFullName) || null
    setSelectedRepo(repo)
    setShowRepoList(false)
    setBranches([])
    setSelectedBranch("")
    setErrorMsg("")
    setDetectedFramework(null)
    setIsDetectingFramework(false)

    // Instant fallback detection from name/description
    const fwFallback = detectFrameworkByName(repo)
    applyDetectedFramework(fwFallback)

    // Derive app name from repo name
    if (repo) {
      setDeployName(repo.name.toLowerCase().replace(/[^a-z0-9-]/g, ""))
    }

    // Fetch branches + smart file detection
    if (repo) {
      setIsFetchingBranches(true)
      api.git
        .branches(repo.clone_url)
        .then(async (list) => {
          setBranches(list)
          const defaultBranch = list.includes("main")
            ? "main"
            : list.includes("master")
              ? "master"
              : list[0] || "main"
          setSelectedBranch(defaultBranch)

          // Smart file-based detection (async, updates UI if better match found)
          if (defaultBranch) {
            setIsDetectingFramework(true)
            const detected = await detectFrameworkByFiles(repo, defaultBranch)
            setIsDetectingFramework(false)
            const dir = detected?.rootDir || ""
            if (detected) {
              applyDetectedFramework(detected.framework)
              if (detected.rootDir) setDeployRootDir(detected.rootDir)
            }
            await checkBuildOptions(repo, defaultBranch, dir)
          }
        })
        .catch((err) => {
          setErrorMsg(`Failed to fetch branches: ${err.message}`)
        })
        .finally(() => {
          setIsFetchingBranches(false)
        })
    }
  }

  const handleDisconnect = async () => {
    try {
      await api.git.deleteToken()
      setGitHubConnected(false)
      setRepos([])
      setSelectedRepo(null)
      setShowRepoList(true)
      setBranches([])
      setSelectedBranch("")
    } catch {
      // Ignore
    }
  }

  // ── Folder browser logic ───────────────────────────────────────────────────
  const openFolderBrowser = async () => {
    if (!selectedRepo || !selectedBranch) return
    setShowFolderBrowser(true)
    setFolderBrowserPath("")
    setFolderBrowserBreadcrumbs([])
    await loadFolderContents("")
  }

  const loadFolderContents = async (path: string) => {
    if (!selectedRepo || !selectedBranch) return
    setFolderBrowserLoading(true)
    try {
      const data = await api.git.contents(selectedRepo.full_name, selectedBranch, path)
      setFolderBrowserContents(data ?? [])
      setFolderBrowserPath(path)
    } catch (err) {
      console.error("Failed to load folder contents:", err)
      setFolderBrowserContents([])
    } finally {
      setFolderBrowserLoading(false)
    }
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
      const newPath = newCrumbs.join("/")
      loadFolderContents(newPath)
    }
  }

  // Re-detect the framework for a specific directory after the user changes the
  // build Root Directory. The repo root and a subdirectory can hold different
  // stacks, so the auto-configured build/start commands must follow the chosen
  // directory. Falls back to the repo-wide scan when the directory is cleared
  // (back to root).
  const redetectForRootDir = useCallback(
    async (dir: string) => {
      if (!selectedRepo || !selectedBranch) return
      const normalized = dir.replace(/^\.\//, "").replace(/\/+$/, "").trim()

      setIsDetectingFramework(true)
      try {
        if (!normalized || normalized === ".") {
          // Back to repo root: rerun the full scan (handles monorepos/subdirs).
          const detected = await detectFrameworkByFiles(selectedRepo, selectedBranch)
          applyDetectedFramework(detected ? detected.framework : null)
        } else {
          const fwForDir = await detectFrameworkForDir(selectedRepo, selectedBranch, normalized)
          // Only overwrite the build config when we positively recognize the
          // directory's stack; otherwise leave the current commands untouched so
          // we don't clobber a user's manual edits with an empty guess.
          if (fwForDir) applyDetectedFramework(fwForDir)
        }
        // Re-check Dockerfile / Compose presence for the chosen directory.
        await checkBuildOptions(selectedRepo, selectedBranch, normalized)
      } finally {
        setIsDetectingFramework(false)
      }
    },
    [selectedRepo, selectedBranch],
  )

  // Debounced re-detection driven by manual edits to the Root Directory input.
  const handleRootDirChange = (value: string) => {
    setDeployRootDir(value)
    if (rootDirDetectTimer.current) clearTimeout(rootDirDetectTimer.current)
    rootDirDetectTimer.current = setTimeout(() => {
      redetectForRootDir(value)
    }, 600)
  }

  const selectFolder = (path: string) => {
    setDeployRootDir(path)
    setShowFolderBrowser(false)
    if (rootDirDetectTimer.current) clearTimeout(rootDirDetectTimer.current)
    redetectForRootDir(path)
  }

  const parseEnvBlock = (text: string): Array<{ key: string; value: string }> => {
    const result: Array<{ key: string; value: string }> = []
    const seen = new Set<string>()

    for (const rawLine of text.split(/\r?\n/)) {
      let line = rawLine.trim()
      if (!line || line.startsWith("#")) continue

      // Strip "export " prefix
      if (line.startsWith("export ")) {
        line = line.slice(7).trim()
      }

      const eqIdx = line.indexOf("=")
      if (eqIdx === -1) continue

      const key = line.slice(0, eqIdx).trim()
      let value = line.slice(eqIdx + 1).trim()

      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
      if (seen.has(key)) continue
      seen.add(key)

      result.push({ key, value })
    }

    return result
  }

  const handleManualRepo = async (url: string) => {
    const cleanUrl = url.trim().replace(/\.git$/, "")
    if (!cleanUrl) return

    setErrorMsg("")
    setIsFetchingBranches(true)
    setIsDetectingFramework(false)

    // Derive repo name from URL
    const parts = cleanUrl.split("/")
    const repoName = parts[parts.length - 1] || "app"

    const repoObj: GitHubRepo = {
      full_name: cleanUrl.replace("https://github.com/", "").replace("http://github.com/", ""),
      name: repoName,
      clone_url: cleanUrl + ".git",
      html_url: cleanUrl,
      private: false,
      description: "",
      updated_at: new Date().toISOString(),
    }

    setSelectedRepo(repoObj)
    setShowRepoList(false)
    setDeployName(repoName.toLowerCase().replace(/[^a-z0-9-]/g, ""))

    // Instant fallback detection from name/description
    const fwFallback = detectFrameworkByName(repoObj)
    applyDetectedFramework(fwFallback)

    // Fetch branches + smart file detection
    try {
      const list = await api.git.branches(repoObj.clone_url)
      setBranches(list)
      const defaultBranch = list.includes("main")
        ? "main"
        : list.includes("master")
          ? "master"
          : list[0] || "main"
      setSelectedBranch(defaultBranch)

      if (defaultBranch) {
        setIsDetectingFramework(true)
        const detected = await detectFrameworkByFiles(repoObj, defaultBranch)
        setIsDetectingFramework(false)
        const dir = detected?.rootDir || ""
        if (detected) {
          applyDetectedFramework(detected.framework)
          if (detected.rootDir) setDeployRootDir(detected.rootDir)
        }
        await checkBuildOptions(repoObj, defaultBranch, dir)
      }
    } catch (err) {
      setErrorMsg(`Failed to fetch branches: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsFetchingBranches(false)
    }
  }

  const handleNext = () => {
    if (step === 1 && (!deployName || !selectedRepo)) {
      setErrorMsg("App name and repository are required.")
      return
    }
    setErrorMsg("")
    setStep((prev) => Math.min(prev + 1, 3))
  }

  const handleBack = () => {
    setErrorMsg("")
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const handleDeploy = async () => {
    if (!deployName || !selectedRepo) {
      setErrorMsg("Validation failed. Please verify Step 1 fields.")
      setStep(1)
      return
    }

    const envVarsRecord: Record<string, string> = {}
    deployEnvVars.forEach((item) => {
      if (item.key.trim() && item.value.trim()) {
        envVarsRecord[item.key.trim()] = item.value.trim()
      }
    })

    try {
      setIsDeploying(true)
      const newApp = await api.apps.deploy({
        name: deployName,
        gitRepo: selectedRepo.clone_url,
        branch: selectedBranch,
        rootDir: deployRootDir,
        envVars: envVarsRecord,
        buildCommand: deployBuildCommand,
        startCommand: deployStartCommand,
        installCommand: deployInstallCommand,
        portOverride: deployPortOverride ? parseInt(deployPortOverride, 10) : 0,
        memory: deployMemory.trim(),
        cpus: deployCpus.trim(),
        healthPath: deployHealthPath.trim(),
        domains: deployDomains
          .split(/[\n,]/)
          .map((d) => d.trim())
          .filter(Boolean),
        volumes: deployVolumes
          .split(/[\n,]/)
          .map((v) => v.trim())
          .filter(Boolean),
        autoDeploy: deployAutoDeploy,
        buildMethod: deployBuildMethod,
        dockerfilePath: deployBuildMethod === "dockerfile" ? deployDockerfilePath.trim() || "Dockerfile" : undefined,
        composePath: deployBuildMethod === "compose" ? deployComposePath.trim() || "docker-compose.yml" : undefined,
        serverId: selectedServerId,
      })
      router.push(`/logs?appId=${newApp.id}&mode=build`)
    } catch (err) {
      console.error(err)
      setErrorMsg(
        `Deployment submission failed: ${err instanceof Error ? err.message : "Backend connection failed."}`,
      )
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <main className="relative h-dvh bg-background text-foreground flex flex-col items-center overflow-y-auto p-4">
      {/* Close (desktop only) — return to the dashboard */}
      <button
        onClick={() => router.push("/")}
        aria-label="Close"
        className="absolute right-5 top-5 z-10 hidden h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-card/60 text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground md:flex"
      >
        <XIcon className="h-4 w-4" />
      </button>

      <div className="relative my-auto w-full max-w-2xl shrink-0 py-4">
        {/* Step Indicator */}
        <div className="flex items-center mb-8 px-2">
          {[
            { num: 1, label: "Repository" },
            { num: 2, label: "Build Config" },
            { num: 3, label: "Environment" },
          ].map((s) => (
            <React.Fragment key={s.num}>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                    step === s.num
                      ? "bg-primary border-primary text-primary-foreground font-extrabold"
                      : step > s.num
                        ? "bg-muted border-muted text-primary"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {s.num}
                </span>
                <span
                  className={`text-sm font-semibold hidden md:inline transition-colors ${
                    step === s.num ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {s.num < 3 && <div className="h-px flex-1 bg-border mx-3" />}
            </React.Fragment>
          ))}
        </div>

        <Card className="border border-border/80 bg-card">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-base font-bold text-foreground">Deploy New Service</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Select a repository, configure your build, and deploy.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 min-h-[320px]">
            {errorMsg && (
              <Alert variant="error" className="mb-4">
                <NucleoIcon name="triangle-alert" />
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            {/* ── STEP 1: Repository Selection ─────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in-50 duration-200 max-h-[calc(100vh-400px)] overflow-y-auto pr-1">
                {/* When no repo selected and not connected: show CTA */}
                {!gitHubConnected && !selectedRepo && (
                  <div className="py-8 space-y-4 text-center">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium text-foreground">Connect GitHub</h4>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                        Link your account to browse and deploy your repositories.
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowGitHubModal(true)}
                      className="h-9 text-sm flex items-center gap-2 justify-center mx-auto"
                    >
                      <GithubLight className="h-4 w-4 hidden dark:block" />
                      <GithubDark className="h-4 w-4 dark:hidden" />
                      Connect GitHub
                    </Button>
                    <button
                      onClick={() => setShowPublicRepoModal(true)}
                      className="block mx-auto text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Or deploy a public repository &rarr;
                    </button>
                  </div>
                )}

                {/* Connected state: show repo list */}
                {gitHubConnected && (
                  <div className="space-y-3">
                    {/* Connected header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md flex items-center justify-center">
                          <GitCompareArrows className="h-4 w-4 text-success" />
                        </div>
                        <span className="text-sm font-medium text-foreground">GitHub connected</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={loadRepos}
                          disabled={isLoadingRepos}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        >
                          <RefreshIcon className={`h-3 w-3 ${isLoadingRepos ? "animate-spin" : ""}`} />
                          Refresh
                        </button>
                        <button
                          onClick={handleDisconnect}
                          className="text-xs text-destructive-foreground hover:text-destructive transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>

                    {/* Repo list — collapses after selection so config stays visible. */}
                    {(showRepoList || !selectedRepo) && (
                      isLoadingRepos ? (
                        <div className="py-12 text-center text-xs text-muted-foreground">
                          <RefreshIcon className="h-5 w-5 mx-auto mb-2 animate-spin opacity-50" />
                          Loading repositories...
                        </div>
                      ) : repos.length === 0 ? (
                        <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                          No repositories found.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                          {repos.map((repo) => {
                            const isSelected = selectedRepo?.full_name === repo.full_name
                            return (
                              <button
                                key={repo.full_name}
                                onClick={() => handleRepoSelect(repo.full_name)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                                  isSelected
                                    ? "border-primary/50 bg-primary/5"
                                    : "border-border bg-card/40 hover:bg-accent/30"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="h-7 w-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                                    <GithubLight className="h-4 w-4 dark:hidden" />
                                    <GithubDark className="h-4 w-4 hidden dark:block" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-foreground truncate">
                                        {repo.name}
                                      </span>
                                      {repo.private ? (
                                        <span className="text-[10px] font-mono px-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                          private
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-mono px-1 rounded bg-muted/50 text-muted-foreground border border-border">
                                          public
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      {repo.description || "No description"}
                                    </p>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                    {new Date(repo.updated_at).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )
                    )}

                    {/* Add public repo */}
                    {(showRepoList || !selectedRepo) && <button
                      onClick={() => setShowPublicRepoModal(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 hover:bg-accent/20 transition-all cursor-pointer"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Deploy a public repository
                    </button>}
                  </div>
                )}

                {/* Selected repo details — shown for both connected & manual flows */}
                {selectedRepo && (
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    {/* Selected repo info */}
                    <div className="flex items-center gap-2.5 px-1">
                      <div className="h-7 w-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                        <GithubLight className="h-4 w-4 dark:hidden" />
                        <GithubDark className="h-4 w-4 hidden dark:block" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{selectedRepo.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{selectedRepo.full_name}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (gitHubConnected) {
                            setShowRepoList(true)
                          } else {
                            setSelectedRepo(null)
                            setBranches([])
                            setSelectedBranch("")
                            setDetectedFramework(null)
                          }
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Change repository
                      </button>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Branch
                      </Label>
                      {isFetchingBranches ? (
                        <div className="h-9 flex items-center gap-2 text-xs text-muted-foreground">
                          <RefreshIcon className="h-3 w-3 animate-spin" />
                          Fetching branches...
                        </div>
                      ) : branches.length > 0 ? (
                        <Select value={selectedBranch} onValueChange={(v) => setSelectedBranch(v ?? "")}>
                          <SelectTrigger className="h-9 text-sm w-full">
                            <SelectValue placeholder="Select branch..." />
                          </SelectTrigger>
                          <SelectPopup>
                            {branches.map((branch) => (
                              <SelectItem key={branch} value={branch}>
                                {branch}
                              </SelectItem>
                            ))}
                          </SelectPopup>
                        </Select>
                      ) : (
                        <Input
                          value={selectedBranch}
                          onChange={(e) => setSelectedBranch(e.target.value)}
                          placeholder="main"
                          className="h-9 text-sm"
                        />
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        App Name
                      </Label>
                      <Input
                        value={deployName}
                        onChange={(e) =>
                          setDeployName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                        }
                        placeholder="e.g. my-app"
                        className="h-9 text-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Target Server
                      </Label>
                      <Select value={selectedServerId} onValueChange={(v) => setSelectedServerId(v ?? "localhost")}>
                        <SelectTrigger className="h-9 text-sm w-full">
                          <span className="truncate">{selectedServerLabel}</span>
                        </SelectTrigger>
                        <SelectPopup>
                          {servers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.isLocal ? "🖥️ Localhost" : `🌐 ${s.name} (${s.ip})`}
                            </SelectItem>
                          ))}
                        </SelectPopup>
                      </Select>
                      {servers.find((s) => s.id === selectedServerId)?.status !== "connected" && (
                        <p className="text-[10px] text-destructive">
                          ⚠️ Selected server status is not connected.
                        </p>
                      )}
                    </div>

                    {isDetectingFramework ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border">
                        <RefreshIcon className="h-4 w-4 animate-spin text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Scanning repository…</p>
                          <p className="text-[10px] text-muted-foreground">Detecting framework from files</p>
                        </div>
                      </div>
                    ) : detectedFramework ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border">
                        {detectedFramework.icon ? (
                          <detectedFramework.icon className="h-5 w-5 shrink-0" />
                        ) : (
                          <FallbackIcon label={detectedFramework.name} color="" />
                        )}
                        <div>
                          <p className="text-xs font-medium text-foreground">{detectedFramework.name} detected</p>
                          <p className="text-[10px] text-muted-foreground">Build and start commands auto-configured</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Build Config ─────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200 max-h-[calc(100vh-400px)] overflow-y-auto pr-1">
                {isDetectingFramework ? (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    <RefreshIcon className="h-4 w-4 animate-spin text-primary" />
                    <div>
                      <p className="text-xs font-medium text-foreground">Scanning repository…</p>
                      <p className="text-[10px] text-muted-foreground">Detecting framework from files</p>
                    </div>
                  </div>
                ) : detectedFramework ? (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    {detectedFramework.icon ? (
                      <detectedFramework.icon className="h-5 w-5 shrink-0" />
                    ) : (
                      <FallbackIcon label={detectedFramework.name} color="" />
                    )}
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {detectedFramework.name} project detected
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Commands pre-filled. Adjust if needed.
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Build method selector — shown when the chosen directory has
                    a Dockerfile and/or a Compose file; otherwise Nixpacks. */}
                {(dockerfileAvailable || composeAvailable) && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Build Method
                  </Label>
                  <div className={`grid gap-2 ${dockerfileAvailable && composeAvailable ? "grid-cols-3" : "grid-cols-2"}`}>
                    {[
                      { id: "nixpacks" as const, label: "Nixpacks", desc: "Auto-detect", icon: <Nix className="h-5 w-5 text-foreground" />, show: true },
                      { id: "dockerfile" as const, label: "Dockerfile", desc: "Use Dockerfile", icon: <Docker className="h-5 w-5" />, show: dockerfileAvailable },
                      { id: "compose" as const, label: "Compose", desc: "Multi-service", icon: <Docker className="h-5 w-5" />, show: composeAvailable },
                    ].filter((opt) => opt.show).map((opt) => {
                      const active = deployBuildMethod === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDeployBuildMethod(opt.id)}
                          className={`flex flex-col items-start gap-1.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                            active
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40 hover:bg-muted/30"
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

                {deployBuildMethod === "dockerfile" && (
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Dockerfile Path
                    </Label>
                    <Input
                      value={deployDockerfilePath}
                      onChange={(e) => setDeployDockerfilePath(e.target.value)}
                      placeholder="Dockerfile"
                      className="h-9 text-sm font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Relative to the root directory. Install/build/start commands are ignored — your
                      Dockerfile controls the build. Make sure it exposes the app on the port below.
                    </p>
                  </div>
                )}

                {deployBuildMethod === "compose" && (
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Compose File Path
                    </Label>
                    <Input
                      value={deployComposePath}
                      onChange={(e) => setDeployComposePath(e.target.value)}
                      placeholder="docker-compose.yml"
                      className="h-9 text-sm font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Each service becomes its own app, grouped together. Web-facing services (those
                      publishing a port, excluding databases) each get a URL. Build/start commands and
                      the port below are ignored — the compose file controls everything. Deploys recreate
                      the project (brief downtime); managed databases are better added as Add-ons.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Root Directory
                      </Label>
                      <button
                        type="button"
                        onClick={openFolderBrowser}
                        disabled={!selectedRepo || !selectedBranch}
                        className="text-[10px] text-primary hover:underline disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Browse…
                      </button>
                    </div>
                    <Input
                      value={deployRootDir}
                      onChange={(e) => handleRootDirChange(e.target.value)}
                      placeholder="./"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Port Override
                    </Label>
                    <Input
                      value={deployPortOverride}
                      onChange={(e) => setDeployPortOverride(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 3000"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {deployBuildMethod === "nixpacks" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Install Command
                      </Label>
                      <Input
                        value={deployInstallCommand}
                        onChange={(e) => setDeployInstallCommand(e.target.value)}
                        placeholder="npm install"
                        className="h-9 text-sm font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Build Command
                        </Label>
                        <Input
                          value={deployBuildCommand}
                          onChange={(e) => setDeployBuildCommand(e.target.value)}
                          placeholder="npm run build"
                          className="h-9 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Start Command
                        </Label>
                        <Input
                          value={deployStartCommand}
                          onChange={(e) => setDeployStartCommand(e.target.value)}
                          placeholder="npm start"
                          className="h-9 text-sm font-mono"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Advanced: resource limits, health check, domains, volumes */}
                <div className="pt-2 mt-2 border-t border-border/40 space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Advanced (optional)
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Memory Limit
                      </Label>
                      <Input
                        value={deployMemory}
                        onChange={(e) => setDeployMemory(e.target.value)}
                        placeholder="e.g. 512m, 1g"
                        className="h-9 text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        CPU Limit
                      </Label>
                      <Input
                        value={deployCpus}
                        onChange={(e) => setDeployCpus(e.target.value)}
                        placeholder="e.g. 0.5, 1, 2"
                        className="h-9 text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Health Check Path
                    </Label>
                    <Input
                      value={deployHealthPath}
                      onChange={(e) => setDeployHealthPath(e.target.value)}
                      placeholder="/health (blank = TCP check)"
                      className="h-9 text-sm font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground/60">
                      Probed before traffic is switched to a new deploy (zero-downtime).
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Custom Domains
                    </Label>
                    <Input
                      value={deployDomains}
                      onChange={(e) => setDeployDomains(e.target.value)}
                      placeholder="app.example.com, www.example.com"
                      className="h-9 text-sm font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground/60">
                      Comma-separated. HTTPS certs are issued automatically by Caddy. Point DNS to this server first.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Persistent Volumes
                    </Label>
                    <Input
                      value={deployVolumes}
                      onChange={(e) => setDeployVolumes(e.target.value)}
                      placeholder="myapp-data:/data"
                      className="h-9 text-sm font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground/60">
                      Comma-separated <span className="font-mono">name:/container/path</span>. Survives redeploys.
                    </p>
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-border bg-card/40 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={deployAutoDeploy}
                      onChange={(e) => setDeployAutoDeploy(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <div>
                      <p className="text-xs font-medium text-foreground">Auto-deploy on push</p>
                      <p className="text-[10px] text-muted-foreground">
                        Redeploy automatically when you push to this branch (set up the webhook after deploying).
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* ── STEP 3: Environment ──────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200 max-h-[calc(100vh-400px)] overflow-y-auto pr-1">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Environment Variables
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      onClick={() => setShowBulkEnv((v) => !v)}
                      variant="outline"
                      className="h-6 text-[11px] px-2 font-medium"
                    >
                      {showBulkEnv ? "Cancel" : "Paste .env"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setDeployEnvVars((prev) => [...prev, { key: "", value: "" }])}
                      className="h-6 cursor-pointer rounded bg-secondary text-secondary-foreground text-xs px-2 hover:bg-secondary/85 flex items-center gap-1 font-semibold border-0"
                    >
                      <PlusIcon className="h-3 w-3" /> Add Var
                    </Button>
                  </div>
                </div>

                {/* Bulk paste textarea */}
                {showBulkEnv && (
                  <div className="space-y-2 animate-in fade-in-50">
                    <Textarea
                      value={bulkEnvText}
                      onChange={(e) => setBulkEnvText(e.target.value)}
                      placeholder={`KEY=value\nDATABASE_URL="postgres://..."\n# comments are ignored\nexport API_KEY=secret`}
                      className="w-full h-32 rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 resize-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={() => {
                          const parsed = parseEnvBlock(bulkEnvText)
                          if (parsed.length === 0) {
                            setErrorMsg("No valid KEY=value pairs found.")
                            return
                          }
                          setDeployEnvVars((prev) => {
                            const existingKeys = new Set(prev.map((e) => e.key))
                            const merged = [...prev]
                            for (const p of parsed) {
                              if (!existingKeys.has(p.key)) {
                                merged.push(p)
                                existingKeys.add(p.key)
                              }
                            }
                            return merged
                          })
                          setBulkEnvText("")
                          setShowBulkEnv(false)
                          setErrorMsg("")
                        }}
                        disabled={!bulkEnvText.trim()}
                        className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-3"
                      >
                        Parse & Add {bulkEnvText.trim() ? `(${parseEnvBlock(bulkEnvText).length})` : ""}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                  {deployEnvVars.map((env, index) => (
                    <div key={index} className="flex gap-2 items-center animate-in fade-in-50 duration-150">
                      <Input
                        value={env.key}
                        onChange={(e) => {
                          const updated = [...deployEnvVars]
                          updated[index].key = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "")
                          setDeployEnvVars(updated)
                        }}
                        placeholder="VARIABLE_NAME"
                        className="h-9 text-sm font-mono flex-1"
                      />
                      <Input
                        value={env.value}
                        onChange={(e) => {
                          const updated = [...deployEnvVars]
                          updated[index].value = e.target.value
                          setDeployEnvVars(updated)
                        }}
                        placeholder="value"
                        className="h-9 text-sm font-mono flex-1"
                      />
                      <Button
                        type="button"
                        onClick={() => setDeployEnvVars((prev) => prev.filter((_, i) => i !== index))}
                        variant="ghost"
                        className="h-8 w-8 hover:bg-destructive/10 text-destructive p-0 shrink-0 border-0"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {deployEnvVars.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground/60 border border-dashed border-border/80 rounded-md">
                      No environment variables configured.
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>

          {/* Wizard Footer */}
          <div className="p-4 border-t border-border/40 flex items-center justify-between bg-muted/5">
            <Button
              type="button"
              onClick={() => {
                if (step === 1) router.push("/")
                else handleBack()
              }}
              variant="outline"
              className="h-9 cursor-pointer rounded-md border-border bg-background px-3.5 text-sm text-foreground hover:bg-muted/30"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5 mr-1" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>

            <div className="flex gap-2">
              {step < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={step === 1 && !selectedRepo}
                  className="h-9 cursor-pointer rounded-md bg-primary text-primary-foreground px-4 text-sm font-semibold hover:bg-primary/90"
                >
                  Next
                  <ChevronRightIcon className="h-3.5 w-3.5 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  className="h-9 cursor-pointer rounded-md bg-primary text-primary-foreground px-5 text-sm font-semibold hover:bg-primary/90 flex items-center gap-1.5"
                >
                  {isDeploying ? (
                    "Deploying..."
                  ) : (
                    <>
                      <PlayIcon className="h-3.5 w-3.5" />
                      Start Deploy
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <GitHubConnectModal
        isOpen={showGitHubModal}
        onClose={() => setShowGitHubModal(false)}
        onConnected={() => {
          setGitHubConnected(true)
          loadRepos()
        }}
      />

      {/* Public Repo URL Modal */}
      <Dialog open={showPublicRepoModal} onOpenChange={setShowPublicRepoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Deploy Public Repository</DialogTitle>
            <DialogDescription>
              Paste any public GitHub URL — authentication is not required.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                GitHub Repository URL
              </Label>
              <Input
                value={manualGitUrl}
                onChange={(e) => setManualGitUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                className="h-9 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualGitUrl.trim()) {
                    setShowPublicRepoModal(false)
                    handleManualRepo(manualGitUrl)
                  }
                }}
              />
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowPublicRepoModal(false)
                handleManualRepo(manualGitUrl)
              }}
              disabled={!manualGitUrl.trim() || isFetchingBranches}
              className="h-9 gap-1.5 text-sm"
            >
              {isFetchingBranches && <RefreshIcon className="h-3 w-3 animate-spin" />}
              {isFetchingBranches ? "Fetching..." : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                setDeployRootDir("")
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
    </main>
  )
}
