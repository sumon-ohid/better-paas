"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useAppRouter } from "@/dashboard/lib/app-router"
import { AnimatePresence, motion } from "motion/react"
import { Button } from "@/dashboard/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/dashboard/components/ui/select"
import { Input } from "@/dashboard/components/ui/input"
import { Label } from "@/dashboard/components/ui/label"
import { Alert, AlertDescription } from "@/dashboard/components/ui/alert"
import { NucleoIcon } from "@/dashboard/components/nucleo-icons"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/dashboard/components/ui/dialog"
import {
  Frame,
  FramePanel,
  FrameTitle,
  FrameDescription,
  FrameFooter,
} from "@/dashboard/components/ui/frame"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/dashboard/components/ui/input-group"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/dashboard/components/ui/tabs"
import type { GitHubRepo, GitHubContent, Server } from "@/dashboard/lib/types"
import { GitHubConnectModal } from "@/dashboard/components/github-connect-modal"
import { GithubLight } from "@/dashboard/components/ui/svgs/githubLight"
import { GithubDark } from "@/dashboard/components/ui/svgs/githubDark"
import { Docker } from "@/dashboard/components/ui/svgs/docker"
import { Nix } from "@/dashboard/components/ui/svgs/nix"
import {
  FRAMEWORKS,
  detectFrameworkByName,
  detectFrameworkByFiles,
  detectFrameworkForDir,
  findDockerfile,
  findComposeFile,
  detectFrameworkFromUpload,
  detectFrameworkForUploadDir,
  findDockerfileInUpload,
  findComposeFileInUpload,
  deriveUploadAppName,
  formatUploadSize,
  uploadDirAsGitHubContent,
  uploadRelativePath,
  uploadCommonRootPrefix,
} from "@/dashboard/lib/framework-detection"
import { api } from "@/dashboard/lib/api"
import { GitCompareArrows, Archive, File as FileIconLucide } from "lucide-react"
import { Textarea } from "@/dashboard/components/ui/textarea"
import { useActiveServer } from "@/dashboard/components/server-context"

// Styled fallback for frameworks without svgl assets (Elixir/Phoenix only)
function FallbackIcon({ label }: { label: string; color: string }) {
  return (
    <div className="flex h-5 w-5 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-[9px] font-bold text-primary">
      {label.slice(0, 2).toUpperCase()}
    </div>
  )
}

const fieldLabel = "text-xs font-semibold text-muted-foreground"

const WIZARD_STEPS = [
  { num: 1, label: "Source" },
  { num: 2, label: "Build config" },
  { num: 3, label: "Environment" },
] as const

type DeploySource = "github" | "upload"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const ChevronLeftIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-left" />
const ChevronRightIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-right" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />

const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const FolderIcon = (props: IconProps) => <NucleoIcon {...props} name="folder" />
const SearchIcon = (props: IconProps) => <NucleoIcon {...props} name="search" />
const UploadIcon = (props: React.SVGProps<SVGSVGElement>) => <Archive {...props} />
const FileIcon = (props: React.SVGProps<SVGSVGElement>) => <FileIconLucide {...props} />

function isValidPublicRepoInput(input: string): boolean {
  const trimmed = input.trim().replace(/\.git$/, "")
  if (!trimmed) return false
  if (/^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+/.test(trimmed)) return true
  return /^[\w.-]+\/[\w.-]+$/.test(trimmed)
}

// Smoothly animates its own height whenever the content inside grows or
// shrinks (step changes, expanding sections, added env vars, etc.).
function AnimatedHeight({ children }: { children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | "auto">("auto")

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setHeight(el.offsetHeight)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      animate={{ height }}
      transition={{ duration: 0.35, ease: [0.25, 1, 0.3, 1] }}
      // `relative` anchors popLayout's absolutely-positioned exiting steps so
      // they stay inside (and get clipped by) this wrapper instead of escaping
      // to the page-level positioned ancestor.
      className="relative overflow-hidden"
    >
      <div ref={contentRef} className="relative">{children}</div>
    </motion.div>
  )
}

// Directional slide for wizard steps: forward slides in from the right,
// back slides in from the left.
const stepVariants = {
  enter: (direction: number) => ({ x: direction * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction * -48, opacity: 0 }),
}

export default function DeployPage() {
  const router = useAppRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId") ?? ""
  const { activeServerId } = useActiveServer()
  const [projectName, setProjectName] = useState<string | null>(null)
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null)

  // ── Wizard step ────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1)
  // 1 = navigating forward, -1 = navigating back (drives the slide direction)
  const [stepDirection, setStepDirection] = useState(1)

  // ── Deploy source (GitHub vs local upload) ─────────────────────────────────
  const [deploySource, setDeploySource] = useState<DeploySource>("github")
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadDragActive, setUploadDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  // ── GitHub connection ──────────────────────────────────────────────────────
  const [gitHubConnected, setGitHubConnected] = useState(false)
  const [showGitHubModal, setShowGitHubModal] = useState(false)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [showRepoList, setShowRepoList] = useState(true)
  const [repoSearchQuery, setRepoSearchQuery] = useState("")

  const filteredRepos = repos.filter((repo) => {
    const query = repoSearchQuery.trim().toLowerCase()
    if (!query) return true
    return (
      repo.name.toLowerCase().includes(query) ||
      (repo.description && repo.description.toLowerCase().includes(query)) ||
      repo.full_name.toLowerCase().includes(query)
    )
  })

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
  const [deployAutoDeploy, setDeployAutoDeploy] = useState(true)

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

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    api.projects
      .get(projectId)
      .then((p) => {
        if (!cancelled) {
          setProjectName(p.name)
          setLoadedProjectId(projectId)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjectName(null)
          setLoadedProjectId(projectId)
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const displayProjectName =
    projectId && loadedProjectId === projectId ? projectName : null

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

  const checkUploadBuildOptions = (files: File[], dir: string) => {
    const dockerfile = findDockerfileInUpload(files, dir)
    const compose = findComposeFileInUpload(files, dir)
    setDockerfileAvailable(!!dockerfile)
    setDeployDockerfilePath(dockerfile || "Dockerfile")
    setComposeAvailable(!!compose)
    setDeployComposePath(compose || "docker-compose.yml")
    setDeployBuildMethod((m) => {
      if (m === "dockerfile" && !dockerfile) return "nixpacks"
      if (m === "compose" && !compose) return "nixpacks"
      return m
    })
  }

  const analyzeUploadSelection = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      setDetectedFramework(null)
      setDockerfileAvailable(false)
      setComposeAvailable(false)
      return
    }
    setErrorMsg("")
    setDeployName(deriveUploadAppName(files))
    setDeployRootDir("")

    if (files.length === 1 && files[0].name.toLowerCase().endsWith(".zip")) {
      setDetectedFramework(null)
      setDockerfileAvailable(false)
      setComposeAvailable(false)
      setDeployBuildMethod("nixpacks")
      return
    }

    setIsDetectingFramework(true)
    try {
      const detected = await detectFrameworkFromUpload(files)
      applyDetectedFramework(detected ? detected.framework : null)
      if (detected?.rootDir) setDeployRootDir(detected.rootDir)
      checkUploadBuildOptions(files, detected?.rootDir || "")
    } finally {
      setIsDetectingFramework(false)
    }
  }, [setDeployRootDir])

  const applyUploadFiles = useCallback(
    (files: File[]) => {
      setUploadFiles(files)
      setSelectedRepo(null)
      setShowRepoList(true)
      setBranches([])
      setSelectedBranch("")
      void analyzeUploadSelection(files)
    },
    [analyzeUploadSelection],
  )

  const uploadTotalBytes = uploadFiles.reduce((sum, f) => sum + f.size, 0)

  const handleRepoSelect = (repoFullName: string) => {
    const repo = repos.find((r) => r.full_name === repoFullName) || null
    setSelectedRepo(repo)
    setShowRepoList(false)
    setBranches([])
    setSelectedBranch("")
    setErrorMsg("")
    setDetectedFramework(null)
    setIsDetectingFramework(false)
    setRepoSearchQuery("")

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
      setRepoSearchQuery("")
    } catch {
      // Ignore
    }
  }

  // ── Folder browser logic ───────────────────────────────────────────────────
  const openFolderBrowser = async () => {
    if (deploySource === "upload") {
      if (uploadFiles.length === 0) return
      setShowFolderBrowser(true)
      setFolderBrowserPath("")
      setFolderBrowserBreadcrumbs([])
      setFolderBrowserContents(uploadDirAsGitHubContent(uploadFiles, ""))
      return
    }
    if (!selectedRepo || !selectedBranch) return
    setShowFolderBrowser(true)
    setFolderBrowserPath("")
    setFolderBrowserBreadcrumbs([])
    await loadFolderContents("")
  }

  const loadFolderContents = async (path: string) => {
    if (deploySource === "upload") {
      setFolderBrowserLoading(true)
      try {
        setFolderBrowserContents(uploadDirAsGitHubContent(uploadFiles, path))
        setFolderBrowserPath(path)
      } finally {
        setFolderBrowserLoading(false)
      }
      return
    }
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
      const normalized = dir.replace(/^\.\//, "").replace(/\/+$/, "").trim()

      setIsDetectingFramework(true)
      try {
        if (deploySource === "upload") {
          if (!normalized || normalized === ".") {
            const detected = await detectFrameworkFromUpload(uploadFiles)
            applyDetectedFramework(detected ? detected.framework : null)
          } else {
            const fwForDir = await detectFrameworkForUploadDir(uploadFiles, normalized)
            if (fwForDir) applyDetectedFramework(fwForDir)
          }
          checkUploadBuildOptions(uploadFiles, normalized)
          return
        }

        if (!selectedRepo || !selectedBranch) return

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
    [deploySource, selectedRepo, selectedBranch, uploadFiles],
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
    let cleanUrl = url.trim().replace(/\.git$/, "")
    if (!cleanUrl) return

    // Normalize owner/repo shorthand → full GitHub URL
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://github.com/${cleanUrl.replace(/^\/+/, "")}`
    }

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
    if (step === 1) {
      if (deploySource === "github" && (!deployName || !selectedRepo)) {
        setErrorMsg("App name and repository are required.")
        return
      }
      if (deploySource === "upload" && (!deployName || uploadFiles.length === 0)) {
        setErrorMsg("App name and uploaded files are required.")
        return
      }
    }
    setErrorMsg("")
    setStepDirection(1)
    setStep((prev) => Math.min(prev + 1, 3))
  }

  const handleBack = () => {
    setErrorMsg("")
    setStepDirection(-1)
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const handleDeploy = async () => {
    if (!deployName) {
      setErrorMsg("Validation failed. Please verify Step 1 fields.")
      setStepDirection(-1)
      setStep(1)
      return
    }
    if (deploySource === "github" && !selectedRepo) {
      setErrorMsg("Validation failed. Please verify Step 1 fields.")
      setStepDirection(-1)
      setStep(1)
      return
    }
    if (deploySource === "upload" && uploadFiles.length === 0) {
      setErrorMsg("Upload at least one file or folder before deploying.")
      setStepDirection(-1)
      setStep(1)
      return
    }

    const envVarsRecord: Record<string, string> = {}
    deployEnvVars.forEach((item) => {
      if (item.key.trim() && item.value.trim()) {
        envVarsRecord[item.key.trim()] = item.value.trim()
      }
    })

    const deployPayload = {
      name: deployName,
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
      buildMethod: deployBuildMethod,
      dockerfilePath: deployBuildMethod === "dockerfile" ? deployDockerfilePath.trim() || "Dockerfile" : undefined,
      composePath: deployBuildMethod === "compose" ? deployComposePath.trim() || "docker-compose.yml" : undefined,
      serverId: selectedServerId,
    }

    try {
      setIsDeploying(true)
      let newApp
      if (deploySource === "upload") {
        const uploadConfig = projectId ? { ...deployPayload, projectId } : deployPayload
        newApp = projectId
          ? await api.projects.deployServiceUpload(uploadConfig, uploadFiles)
          : await api.apps.deployUpload(uploadConfig, uploadFiles)
      } else {
        const gitPayload = {
          ...deployPayload,
          gitRepo: selectedRepo!.clone_url,
          branch: selectedBranch,
          autoDeploy: deployAutoDeploy,
        }
        newApp = projectId
          ? await api.projects.deployService({ ...gitPayload, projectId })
          : await api.apps.deploy(gitPayload)
      }
      if (projectId) {
        router.push(`/project/${projectId}`)
      } else {
        router.push(`/logs?appId=${newApp.id}&mode=build`)
      }
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
        onClick={() => router.push(projectId ? `/project/${projectId}` : "/")}
        aria-label="Close"
        className="absolute right-5 top-5 z-10 hidden h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:border-primary/30 hover:text-foreground md:flex"
      >
        <XIcon className="h-4 w-4" />
      </button>

      <div className="relative my-auto w-full max-w-2xl shrink-0 py-4">
        <Frame className="w-full">
          <FramePanel className="shrink-0 space-y-4 !py-4">
            <div className="min-w-0">
              <FrameTitle className="text-base">
                {projectId
                  ? `Add service${displayProjectName ? ` to ${displayProjectName}` : ""}`
                  : "Deploy new service"}
              </FrameTitle>
              <FrameDescription className="text-xs sm:text-sm">
                {step === 1 && (projectId
                  ? "Choose a GitHub repository or upload files for the new service."
                  : "Connect GitHub or upload files from your machine.")}
                {step === 2 && "Configure how your app is built and started."}
                {step === 3 && "Set runtime environment variables (optional)."}
              </FrameDescription>
            </div>

            <div className="grid w-full grid-cols-3 gap-2">
              {WIZARD_STEPS.map((s) => (
                <div
                  key={s.num}
                  className={`flex items-center gap-1.5 text-xs transition-colors ${
                    step === s.num
                      ? "font-medium text-foreground"
                      : step > s.num
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                      step === s.num
                        ? "bg-primary text-primary-foreground"
                        : step > s.num
                          ? "border border-primary/25 text-primary"
                          : "border border-border text-muted-foreground"
                    }`}
                  >
                    {step > s.num ? (
                      <NucleoIcon name="check" className="h-3 w-3" />
                    ) : (
                      s.num
                    )}
                  </span>
                  <span className="truncate">{s.label}</span>
                </div>
              ))}
            </div>
          </FramePanel>

          <FramePanel className="min-h-[320px] !py-4">
            <AnimatedHeight>
            {errorMsg && (
              <Alert variant="error" className="mb-4">
                <NucleoIcon name="triangle-alert" />
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <AnimatePresence mode="popLayout" custom={stepDirection} initial={false}>
            <motion.div
              key={step}
              custom={stepDirection}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full"
            >
            {/* ── STEP 1: Repository Selection ─────────────────────────────── */}
            {step === 1 && (
              <div className="max-h-[calc(100vh-400px)] space-y-5 overflow-y-auto">
                <Tabs
                  value={deploySource}
                  onValueChange={(value) => {
                    if (value === "github" || value === "upload") {
                      setDeploySource(value)
                      setErrorMsg("")
                    }
                  }}
                  className="gap-4"
                >
                  <TabsList className="w-full [&>[data-slot=tabs-tab]]:flex-1">
                    <TabsTab value="github">
                      <GithubLight className="h-4 w-4 dark:hidden" />
                      <GithubDark className="hidden h-4 w-4 dark:block" />
                      GitHub
                    </TabsTab>
                    <TabsTab value="upload">
                      <UploadIcon className="h-4 w-4" />
                      Upload
                    </TabsTab>
                  </TabsList>

                  <TabsPanel value="upload" className="space-y-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        if (files.length > 0) applyUploadFiles(files)
                        e.target.value = ""
                      }}
                    />
                    <input
                      ref={folderInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        if (files.length > 0) applyUploadFiles(files)
                        e.target.value = ""
                      }}
                      {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                    />
                    <input
                      ref={zipInputRef}
                      type="file"
                      accept=".zip,application/zip"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) applyUploadFiles([file])
                        e.target.value = ""
                      }}
                    />

                    <div
                      onDragEnter={(e) => {
                        e.preventDefault()
                        setUploadDragActive(true)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setUploadDragActive(true)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        setUploadDragActive(false)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        setUploadDragActive(false)
                        const files = Array.from(e.dataTransfer.files || [])
                        if (files.length > 0) applyUploadFiles(files)
                      }}
                      className={`rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
                        uploadDragActive
                          ? "border-primary/50 bg-primary/5"
                          : "border-border bg-muted/10"
                      }`}
                    >
                      <UploadIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
                      <p className="text-sm font-semibold text-foreground">
                        Drop files or a project folder here
                      </p>
                      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                        Single static files, full app directories, or a{" "}
                        <code className="font-mono text-foreground/80">.zip</code> archive.
                        Framework detection runs automatically.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Choose files
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => folderInputRef.current?.click()}
                        >
                          Choose folder
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => zipInputRef.current?.click()}
                        >
                          Upload .zip
                        </Button>
                      </div>
                    </div>

                    {uploadFiles.length > 0 && (
                      <div className="space-y-3 rounded-lg border border-border/80 bg-muted/10 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">Upload ready</p>
                            <p className="text-xs text-muted-foreground">
                              {uploadFiles.length} file{uploadFiles.length === 1 ? "" : "s"} ·{" "}
                              {formatUploadSize(uploadTotalBytes)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              setUploadFiles([])
                              setDetectedFramework(null)
                              setDockerfileAvailable(false)
                              setComposeAvailable(false)
                            }}
                            className="shrink-0 text-xs text-muted-foreground"
                          >
                            Clear
                          </Button>
                        </div>
                        <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-border/60 bg-background/50 px-2 py-2 font-mono text-[11px] text-muted-foreground">
                          {uploadFiles.slice(0, 8).map((file, i) => {
                            const strip = uploadCommonRootPrefix(uploadFiles)
                            const shown = (() => {
                              const raw = uploadRelativePath(file)
                              if (strip && (raw === strip || raw.startsWith(`${strip}/`))) {
                                return raw.slice(strip.length).replace(/^\//, "") || raw
                              }
                              return raw
                            })()
                            return (
                              <div key={`${shown}-${i}`} className="flex items-center gap-2 truncate">
                                <FileIcon className="h-3 w-3 shrink-0 opacity-60" />
                                <span className="truncate">{shown}</span>
                              </div>
                            )
                          })}
                          {uploadFiles.length > 8 && (
                            <p className="pt-1 text-[10px] text-muted-foreground/80">
                              +{uploadFiles.length - 8} more files
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 border-t border-border/50 pt-4">
                      <div className="space-y-1.5">
                        <Label className={fieldLabel}>App name</Label>
                        <Input
                          value={deployName}
                          onChange={(e) =>
                            setDeployName(
                              e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                            )
                          }
                          placeholder="my-app"
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className={fieldLabel}>Target server</Label>
                        <Select
                          value={selectedServerId}
                          onValueChange={(v) => setSelectedServerId(v ?? "localhost")}
                        >
                          <SelectTrigger className="h-9 w-full text-sm">
                            <span className="truncate">{selectedServerLabel}</span>
                          </SelectTrigger>
                          <SelectPopup>
                            {servers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.isLocal ? "Localhost" : `${s.name} (${s.ip})`}
                              </SelectItem>
                            ))}
                          </SelectPopup>
                        </Select>
                      </div>
                    </div>

                    {(isDetectingFramework || detectedFramework) && uploadFiles.length > 0 && (
                      <div className="flex items-center gap-2.5 rounded-lg bg-muted/25 px-3 py-2.5">
                        {isDetectingFramework ? (
                          <>
                            <RefreshIcon className="h-4 w-4 shrink-0 animate-spin text-primary" />
                            <div>
                              <p className="text-xs font-medium text-foreground">
                                Scanning uploaded files…
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Detecting framework from project files
                              </p>
                            </div>
                          </>
                        ) : detectedFramework ? (
                          <>
                            {detectedFramework.icon ? (
                              <detectedFramework.icon className="h-5 w-5 shrink-0" />
                            ) : (
                              <FallbackIcon label={detectedFramework.name} color="" />
                            )}
                            <div>
                              <p className="text-xs font-medium text-foreground">
                                {detectedFramework.name} detected
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Build and start commands will be pre-filled on the next step.
                              </p>
                            </div>
                          </>
                        ) : null}
                      </div>
                    )}
                  </TabsPanel>

                  <TabsPanel value="github" className="space-y-4">
                {!gitHubConnected && !selectedRepo && (
                  <div className="flex flex-col items-center gap-4 py-6 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted/30">
                      <GithubLight className="h-5 w-5 dark:hidden" />
                      <GithubDark className="hidden h-5 w-5 dark:block" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">Connect GitHub</p>
                      <p className="mx-auto max-w-xs text-xs text-muted-foreground">
                        Link your account to browse private and public repositories.
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowGitHubModal(true)}
                      size="sm"
                      className="gap-2"
                    >
                      <GithubLight className="hidden h-4 w-4 dark:block" />
                      <GithubDark className="h-4 w-4 dark:hidden" />
                      Connect GitHub
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowPublicRepoModal(true)}
                      className="text-xs text-muted-foreground transition-colors hover:cursor-pointer hover:text-primary"
                    >
                      Or deploy a public repository without signing in →
                    </button>
                  </div>
                )}

                {gitHubConnected && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <GitCompareArrows className="h-4 w-4 text-success" />
                        <p className="text-sm font-semibold text-foreground">Your repositories</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={loadRepos}
                          disabled={isLoadingRepos}
                          className="h-7 gap-1 text-xs text-muted-foreground"
                        >
                          <RefreshIcon
                            className={`h-3 w-3 ${isLoadingRepos ? "animate-spin" : ""}`}
                          />
                          Refresh
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={handleDisconnect}
                          className="h-7 text-xs text-destructive-foreground"
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>

                    {(showRepoList || !selectedRepo) && (
                      <div className="space-y-3">
                        {isLoadingRepos ? (
                          <div className="flex flex-col items-center gap-2 py-10 text-xs text-muted-foreground">
                            <RefreshIcon className="h-5 w-5 animate-spin opacity-50" />
                            Loading repositories…
                          </div>
                        ) : repos.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border py-10 text-center text-xs text-muted-foreground">
                            No repositories found on this account.
                          </div>
                        ) : (
                          <>
                            <InputGroup>
                              <InputGroupAddon align="inline-start">
                                <SearchIcon className="h-4 w-4 opacity-80" />
                              </InputGroupAddon>
                              <InputGroupInput
                                value={repoSearchQuery}
                                onChange={(e) => setRepoSearchQuery(e.target.value)}
                                placeholder="Search repositories…"
                                className="text-sm"
                              />
                              {repoSearchQuery && (
                                <InputGroupAddon align="inline-end">
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => setRepoSearchQuery("")}
                                    className="h-7 w-7 p-0"
                                    aria-label="Clear search"
                                  >
                                    <XIcon className="h-3 w-3" />
                                  </Button>
                                </InputGroupAddon>
                              )}
                            </InputGroup>

                            <div className="max-h-[200px] space-y-1.5 overflow-y-auto pr-0.5">
                              {filteredRepos.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                                  No repositories match your search.
                                </div>
                              ) : (
                                filteredRepos.map((repo) => {
                                  const isSelected =
                                    selectedRepo?.full_name === repo.full_name
                                  return (
                                    <button
                                      key={repo.full_name}
                                      type="button"
                                      onClick={() => handleRepoSelect(repo.full_name)}
                                      className={`w-full cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                        isSelected
                                          ? "border-primary/40 bg-primary/5"
                                          : "border-border/80 hover:bg-accent/30"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/50">
                                          <GithubLight className="h-4 w-4 dark:hidden" />
                                          <GithubDark className="hidden h-4 w-4 dark:block" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-medium text-foreground">
                                              {repo.name}
                                            </span>
                                            <span
                                              className={`shrink-0 rounded border px-1 font-mono text-[10px] ${
                                                repo.private
                                                  ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                                  : "border-border bg-muted/40 text-muted-foreground"
                                              }`}
                                            >
                                              {repo.private ? "private" : "public"}
                                            </span>
                                          </div>
                                          <p className="truncate mb-2 text-[11px] text-muted-foreground">
                                            {repo.description || "No description"}
                                          </p>
                                        </div>
                                        <span className="shrink-0 text-[10px] text-muted-foreground/60">
                                          {new Date(repo.updated_at).toLocaleDateString(
                                            undefined,
                                            { month: "short", day: "numeric" },
                                          )}
                                        </span>
                                      </div>
                                    </button>
                                  )
                                })
                              )}
                            </div>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => setShowPublicRepoModal(true)}
                          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/30 hover:bg-accent/20 hover:text-foreground"
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                          Deploy a public repository
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {selectedRepo && (
                  <div className="space-y-4 border-t border-border/50 pt-5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
                        <GithubLight className="h-4 w-4 dark:hidden" />
                        <GithubDark className="hidden h-4 w-4 dark:block" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {selectedRepo.name}
                        </p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {selectedRepo.full_name}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
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
                        className="h-7 shrink-0 text-xs text-muted-foreground"
                      >
                        Change
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className={fieldLabel}>Branch</Label>
                        {isFetchingBranches ? (
                          <div className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
                            <RefreshIcon className="h-3 w-3 animate-spin" />
                            Fetching branches…
                          </div>
                        ) : branches.length > 0 ? (
                          <Select
                            value={selectedBranch}
                            onValueChange={(v) => setSelectedBranch(v ?? "")}
                          >
                            <SelectTrigger className="h-9 w-full text-sm">
                              <SelectValue placeholder="Select branch…" />
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

                      <div className="space-y-1.5">
                        <Label className={fieldLabel}>App name</Label>
                        <Input
                          value={deployName}
                          onChange={(e) =>
                            setDeployName(
                              e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                            )
                          }
                          placeholder="my-app"
                          className="h-9 text-sm"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Used for the container name and default URL.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label className={fieldLabel}>Target server</Label>
                        <Select
                          value={selectedServerId}
                          onValueChange={(v) => setSelectedServerId(v ?? "localhost")}
                        >
                          <SelectTrigger className="h-9 w-full text-sm">
                            <span className="truncate">{selectedServerLabel}</span>
                          </SelectTrigger>
                          <SelectPopup>
                            {servers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.isLocal ? "Localhost" : `${s.name} (${s.ip})`}
                              </SelectItem>
                            ))}
                          </SelectPopup>
                        </Select>
                        {servers.find((s) => s.id === selectedServerId)?.status !==
                          "connected" && (
                          <p className="text-[11px] text-destructive-foreground">
                            Selected server is not connected.
                          </p>
                        )}
                      </div>
                    </div>

                    {(isDetectingFramework || detectedFramework) && (
                      <div className="flex items-center gap-2.5 rounded-lg bg-muted/25 px-3 py-2.5">
                        {isDetectingFramework ? (
                          <>
                            <RefreshIcon className="h-4 w-4 shrink-0 animate-spin text-primary" />
                            <div>
                              <p className="text-xs font-medium text-foreground">
                                Scanning repository…
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Detecting framework from project files
                              </p>
                            </div>
                          </>
                        ) : detectedFramework ? (
                          <>
                            {detectedFramework.icon ? (
                              <detectedFramework.icon className="h-5 w-5 shrink-0" />
                            ) : (
                              <FallbackIcon label={detectedFramework.name} color="" />
                            )}
                            <div>
                              <p className="text-xs font-medium text-foreground">
                                {detectedFramework.name} detected
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Build and start commands will be pre-filled on the next step.
                              </p>
                            </div>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
                  </TabsPanel>
                </Tabs>
              </div>
            )}

            {/* ── STEP 2: Build Config ─────────────────────────────────────── */}
            {step === 2 && (
              <div className="max-h-[calc(100vh-400px)] space-y-5 overflow-y-auto">
                {(isDetectingFramework || detectedFramework) && (
                  <div className="flex items-center gap-2.5 rounded-lg bg-muted/25 px-3 py-2.5">
                    {isDetectingFramework ? (
                      <>
                        <RefreshIcon className="h-4 w-4 shrink-0 animate-spin text-primary" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Scanning repository…</p>
                          <p className="text-[11px] text-muted-foreground">
                            Detecting framework from project files
                          </p>
                        </div>
                      </>
                    ) : detectedFramework ? (
                      <>
                        {detectedFramework.icon ? (
                          <detectedFramework.icon className="h-5 w-5 shrink-0" />
                        ) : (
                          <FallbackIcon label={detectedFramework.name} color="" />
                        )}
                        <div>
                          <p className="text-xs font-medium text-foreground">
                            {detectedFramework.name} detected
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Commands pre-filled below — adjust if needed.
                          </p>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}

                <div className="space-y-4">
                  {(dockerfileAvailable || composeAvailable) && (
                    <div className="space-y-2">
                      <Label className={fieldLabel}>Build method</Label>
                      <div
                        className={`grid gap-2 ${dockerfileAvailable && composeAvailable ? "grid-cols-3" : "grid-cols-2"}`}
                      >
                        {[
                          {
                            id: "nixpacks" as const,
                            label: "Nixpacks",
                            desc: "Auto-detect",
                            icon: <Nix className="h-5 w-5 text-foreground" />,
                            show: true,
                          },
                          {
                            id: "dockerfile" as const,
                            label: "Dockerfile",
                            desc: "Use Dockerfile",
                            icon: <Docker className="h-5 w-5" />,
                            show: dockerfileAvailable,
                          },
                          {
                            id: "compose" as const,
                            label: "Compose",
                            desc: "Multi-service",
                            icon: <Docker className="h-5 w-5" />,
                            show: composeAvailable,
                          },
                        ]
                          .filter((opt) => opt.show)
                          .map((opt) => {
                            const active = deployBuildMethod === opt.id
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setDeployBuildMethod(opt.id)}
                                className={`flex cursor-pointer flex-col items-start gap-1.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                  active
                                    ? "border-primary/40 bg-primary/5"
                                    : "border-border/80 hover:bg-accent/30"
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
                    </div>
                  )}

                  {deployBuildMethod === "dockerfile" && (
                      <div className="space-y-1.5">
                        <Label className={fieldLabel}>Dockerfile path</Label>
                        <Input
                          value={deployDockerfilePath}
                          onChange={(e) => setDeployDockerfilePath(e.target.value)}
                          placeholder="Dockerfile"
                          className="h-9 font-mono text-sm"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Relative to root directory. Your Dockerfile controls the build — install,
                          build, and start commands below are ignored.
                        </p>
                      </div>
                    )}

                    {deployBuildMethod === "compose" && (
                      <div className="space-y-1.5">
                        <Label className={fieldLabel}>Compose file path</Label>
                        <Input
                          value={deployComposePath}
                          onChange={(e) => setDeployComposePath(e.target.value)}
                          placeholder="docker-compose.yml"
                          className="h-9 font-mono text-sm"
                        />
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          Each service becomes its own app. Web-facing services get a URL. The
                          compose file controls ports and commands — settings below are ignored.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center pb-1.5 justify-between">
                          <Label className={fieldLabel}>Root directory</Label>
                          <button
                            type="button"
                            onClick={openFolderBrowser}
                            disabled={
                              deploySource === "upload"
                                ? uploadFiles.length === 0
                                : !selectedRepo || !selectedBranch
                            }
                            className="text-[11px] text-primary hover:underline disabled:pointer-events-none disabled:opacity-40"
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
                      <div className="space-y-1.5">
                        <Label className={fieldLabel}>Port override</Label>
                        <Input
                          value={deployPortOverride}
                          onChange={(e) =>
                            setDeployPortOverride(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="3000"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    {deployBuildMethod === "nixpacks" && (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className={fieldLabel}>Install command</Label>
                          <Input
                            value={deployInstallCommand}
                            onChange={(e) => setDeployInstallCommand(e.target.value)}
                            placeholder="npm install"
                            className="h-9 font-mono text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className={fieldLabel}>Build command</Label>
                            <Input
                              value={deployBuildCommand}
                              onChange={(e) => setDeployBuildCommand(e.target.value)}
                              placeholder="npm run build"
                              className="h-9 font-mono text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className={fieldLabel}>Start command</Label>
                            <Input
                              value={deployStartCommand}
                              onChange={(e) => setDeployStartCommand(e.target.value)}
                              placeholder="npm start"
                              className="h-9 font-mono text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                </div>

                <div className="space-y-4 border-t border-border/50 pt-5">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Advanced</p>
                    <p className="text-xs text-muted-foreground">
                      Optional resource limits, health checks, domains, and volumes.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className={fieldLabel}>Memory limit</Label>
                        <Input
                          value={deployMemory}
                          onChange={(e) => setDeployMemory(e.target.value)}
                          placeholder="512m, 1g"
                          className="h-9 font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className={fieldLabel}>CPU limit</Label>
                        <Input
                          value={deployCpus}
                          onChange={(e) => setDeployCpus(e.target.value)}
                          placeholder="0.5, 1, 2"
                          className="h-9 font-mono text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className={fieldLabel}>Health check path</Label>
                      <Input
                        value={deployHealthPath}
                        onChange={(e) => setDeployHealthPath(e.target.value)}
                        placeholder="/health (blank = TCP check)"
                        className="h-9 font-mono text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Probed before traffic switches to a new deploy.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className={fieldLabel}>Custom domains</Label>
                      <Input
                        value={deployDomains}
                        onChange={(e) => setDeployDomains(e.target.value)}
                        placeholder="app.example.com, www.example.com"
                        className="h-9 font-mono text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Comma-separated. HTTPS certs are issued automatically — point DNS here
                        first.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className={fieldLabel}>Persistent volumes</Label>
                      <Input
                        value={deployVolumes}
                        onChange={(e) => setDeployVolumes(e.target.value)}
                        placeholder="myapp-data:/data"
                        className="h-9 font-mono text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Comma-separated{" "}
                        <code className="font-mono text-foreground/80">name:/path</code>. Survives
                        redeploys.
                      </p>
                    </div>

                    {deploySource === "github" && (
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/80 px-3 py-2.5 transition-colors hover:bg-accent/20">
                      <input
                        type="checkbox"
                        checked={deployAutoDeploy}
                        onChange={(e) => setDeployAutoDeploy(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-primary"
                      />
                      <div>
                        <p className="text-xs font-medium text-foreground">Auto-deploy on push</p>
                        <p className="text-[11px] text-muted-foreground">
                          Redeploy when you push to this branch. With GitHub
                          connected, the webhook is created automatically.
                        </p>
                      </div>
                    </label>
                    )}
                </div>
              </div>
            )}

            {/* ── STEP 3: Environment ──────────────────────────────────────── */}
            {step === 3 && (() => {
              const bulkEnvParsed = parseEnvBlock(bulkEnvText)
              const bulkEnvLines = bulkEnvText
                ? bulkEnvText.split(/\r?\n/).filter((l) => l.trim()).length
                : 0

              const handleBulkEnvImport = () => {
                if (bulkEnvParsed.length === 0) {
                  setErrorMsg("No valid KEY=value pairs found in pasted text.")
                  return
                }
                setDeployEnvVars((prev) => {
                  const existingKeys = new Set(prev.map((e) => e.key))
                  const merged = [...prev]
                  for (const p of bulkEnvParsed) {
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
              }

              return (
                <div className="max-h-[calc(100vh-400px)] space-y-5 overflow-y-auto">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Environment variables</p>
                      <p className="text-xs text-muted-foreground">
                        Optional runtime config — injected at deploy, not baked into the image.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!showBulkEnv && (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => setShowBulkEnv(true)}
                          className="h-7 gap-1 text-xs"
                        >
                          <NucleoIcon name="copy" className="h-3 w-3" />
                          Paste .env
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        onClick={() =>
                          setDeployEnvVars((prev) => [...prev, { key: "", value: "" }])
                        }
                        className="h-7 gap-1 text-xs"
                      >
                        <PlusIcon className="h-3 w-3" />
                        Add
                      </Button>
                    </div>
                  </div>

                  {showBulkEnv && (
                    <div className="animate-in fade-in-50 space-y-3 rounded-lg border border-border/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <NucleoIcon name="copy" className="h-3.5 w-3.5 text-chart-4" />
                            Paste .env contents
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Comments, blank lines, and{" "}
                            <code className="font-mono text-foreground/80">export</code> prefixes
                            are ignored.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setShowBulkEnv(false)
                            setBulkEnvText("")
                          }}
                          className="h-7 shrink-0 text-xs text-muted-foreground"
                        >
                          Cancel
                        </Button>
                      </div>

                      <div className="overflow-hidden rounded-lg border border-border">
                        <Textarea
                          value={bulkEnvText}
                          onChange={(e) => setBulkEnvText(e.target.value)}
                          placeholder={
                            "DATABASE_URL=postgres://user:pass@host/db\nAPI_KEY=sk_live_...\n# comments are skipped\nexport NODE_ENV=production"
                          }
                          spellCheck={false}
                          className="min-h-[140px] resize-y rounded-none border-0 bg-code px-4 py-3 font-mono text-xs leading-relaxed text-foreground shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
                        />
                        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
                          <span>
                            {bulkEnvLines > 0
                              ? `${bulkEnvLines} non-empty line${bulkEnvLines === 1 ? "" : "s"}`
                              : "Paste KEY=value lines above"}
                          </span>
                          <span>
                            {bulkEnvParsed.length > 0
                              ? `${bulkEnvParsed.length} variable${bulkEnvParsed.length === 1 ? "" : "s"} detected`
                              : "Waiting for valid pairs"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] text-muted-foreground">
                          Duplicate keys are skipped.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleBulkEnvImport}
                          disabled={bulkEnvParsed.length === 0}
                          className="shrink-0 gap-1.5"
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                          Import{bulkEnvParsed.length > 0 ? ` ${bulkEnvParsed.length}` : ""}
                        </Button>
                      </div>
                    </div>
                  )}

                  {deployEnvVars.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
                      <NucleoIcon name="layers" className="h-5 w-5 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No variables yet</p>
                      <p className="max-w-xs text-[11px] leading-snug text-muted-foreground/80">
                        Add keys manually or paste a{" "}
                        <code className="font-mono text-foreground/70">.env</code> file to import
                        them in bulk.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_1fr_2rem] gap-2 px-0.5 text-[10px] font-medium text-muted-foreground">
                        <span>Key</span>
                        <span>Value</span>
                        <span className="sr-only">Remove</span>
                      </div>
                      <div className="max-h-[220px] space-y-2 overflow-y-auto">
                        {deployEnvVars.map((env, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-[1fr_1fr_2rem] items-center gap-2 animate-in fade-in-50 duration-150"
                          >
                            <Input
                              value={env.key}
                              onChange={(e) => {
                                const updated = [...deployEnvVars]
                                updated[index].key = e.target.value
                                  .toUpperCase()
                                  .replace(/[^A-Z0-9_]/g, "")
                                setDeployEnvVars(updated)
                              }}
                              placeholder="VARIABLE_NAME"
                              className="h-9 font-mono text-xs"
                            />
                            <Input
                              value={env.value}
                              onChange={(e) => {
                                const updated = [...deployEnvVars]
                                updated[index].value = e.target.value
                                setDeployEnvVars(updated)
                              }}
                              placeholder="value"
                              className="h-9 font-mono text-xs"
                            />
                            <Button
                              type="button"
                              onClick={() =>
                                setDeployEnvVars((prev) => prev.filter((_, i) => i !== index))
                              }
                              variant="ghost"
                              size="icon-xs"
                              className="text-destructive-foreground hover:bg-destructive/10"
                              aria-label={`Remove ${env.key || "variable"}`}
                            >
                              <XIcon className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {deployEnvVars.filter((e) => e.key.trim()).length} variable
                        {deployEnvVars.filter((e) => e.key.trim()).length === 1 ? "" : "s"} will be
                        set when you deploy.
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}
            </motion.div>
            </AnimatePresence>
            </AnimatedHeight>
          </FramePanel>

          <FrameFooter className="flex items-center justify-between gap-3 !py-3">
            <Button
              type="button"
              onClick={() => {
                if (step === 1) router.push("/")
                else handleBack()
              }}
              variant="outline"
              size="sm"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>

            {step < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={
                  step === 1 &&
                  (deploySource === "github"
                    ? !selectedRepo
                    : uploadFiles.length === 0 || !deployName)
                }
                size="sm"
                className="gap-1.5"
              >
                Next
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleDeploy}
                disabled={isDeploying}
                loading={isDeploying}
                size="sm"
                className="gap-1.5"
              >
                <PlayIcon className="h-3.5 w-3.5" />
                Deploy
              </Button>
            )}
          </FrameFooter>
        </Frame>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                <GithubLight className="h-4 w-4 dark:hidden" />
                <GithubDark className="h-4 w-4 hidden dark:block" />
              </span>
              Deploy public repository
            </DialogTitle>
            <DialogDescription>
              Paste a public GitHub URL — no account connection required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 pb-2">
            <Frame className="w-full">
              <FramePanel className="shrink-0 !py-3">
                <FrameTitle>Repository URL</FrameTitle>
                <FrameDescription className="text-xs sm:text-sm">
                  We&apos;ll fetch branches and detect your framework automatically.
                </FrameDescription>
              </FramePanel>

              <FramePanel className="space-y-2">
                <Label
                  htmlFor="public-repo-url"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  GitHub URL
                </Label>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <GithubLight className="h-4 w-4 opacity-80 dark:hidden" />
                    <GithubDark className="hidden h-4 w-4 opacity-80 dark:block" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="public-repo-url"
                    value={manualGitUrl}
                    onChange={(e) => setManualGitUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="font-mono text-sm"
                    autoFocus
                    aria-invalid={
                      manualGitUrl.trim() && !isValidPublicRepoInput(manualGitUrl)
                        ? true
                        : undefined
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        isValidPublicRepoInput(manualGitUrl) &&
                        !isFetchingBranches
                      ) {
                        setShowPublicRepoModal(false)
                        handleManualRepo(manualGitUrl)
                      }
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    <Button
                      size="xs"
                      variant="secondary"
                      disabled={
                        !isValidPublicRepoInput(manualGitUrl) || isFetchingBranches
                      }
                      loading={isFetchingBranches}
                      onClick={() => {
                        setShowPublicRepoModal(false)
                        handleManualRepo(manualGitUrl)
                      }}
                    >
                      Continue
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
                <p className="text-[11px] text-muted-foreground">
                  Accepts{" "}
                  <code className="font-mono text-foreground/80">
                    https://github.com/owner/repo
                  </code>{" "}
                  or{" "}
                  <code className="font-mono text-foreground/80">
                    owner/repo
                  </code>
                  .
                </p>
              </FramePanel>

              <FrameFooter className="!py-3">
                <div className="flex gap-2 text-[11px] leading-snug text-muted-foreground">
                  <NucleoIcon
                    name="info"
                    className="h-3.5 w-3.5 shrink-0 text-primary"
                  />
                  <span>
                    Private repos need{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setShowPublicRepoModal(false)
                        setShowGitHubModal(true)
                      }}
                      className="cursor-pointer text-primary underline-offset-2 hover:underline"
                    >
                      GitHub connected
                    </button>
                    . Public repos deploy without signing in.
                  </span>
                </div>
              </FrameFooter>
            </Frame>
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" disabled={isFetchingBranches}>
                  Cancel
                </Button>
              }
            />
            <Button
              onClick={() => {
                setShowPublicRepoModal(false)
                handleManualRepo(manualGitUrl)
              }}
              disabled={!isValidPublicRepoInput(manualGitUrl) || isFetchingBranches}
              loading={isFetchingBranches}
              className="gap-1.5"
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Browser Modal */}
      <Dialog open={showFolderBrowser} onOpenChange={setShowFolderBrowser}>
        <DialogContent className="flex max-h-[75vh] max-w-md flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              Select root directory
            </DialogTitle>
            <DialogDescription>
              {deploySource === "upload" ? (
                "Pick the folder inside your upload that contains the app entrypoint."
              ) : selectedRepo && selectedBranch ? (
                <>
                  Browsing{" "}
                  <span className="font-medium text-foreground">{selectedRepo.name}</span> on{" "}
                  <code className="font-mono text-foreground/80">{selectedBranch}</code>. Pick the
                  folder that contains your app.
                </>
              ) : (
                "Choose the directory containing your project files."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 pb-2">
            <nav
              aria-label="Folder path"
              className="flex items-center gap-1 overflow-x-auto rounded-lg bg-muted/25 px-3 py-2 text-xs text-muted-foreground"
            >
              <button
                type="button"
                onClick={() => navigateToBreadcrumb(-1)}
                className={`flex shrink-0 items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground ${
                  folderBrowserPath === "" ? "font-medium text-foreground" : ""
                }`}
              >
                <NucleoIcon name="house" className="h-3 w-3" />
                <span>{deploySource === "upload" ? "upload root" : "repository root"}</span>
              </button>
              {folderBrowserBreadcrumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                  <ChevronRightIcon className="h-3 w-3 shrink-0 opacity-50" />
                  <button
                    type="button"
                    onClick={() => navigateToBreadcrumb(i)}
                    className={`shrink-0 rounded px-1 py-0.5 font-mono transition-colors hover:text-foreground ${
                      i === folderBrowserBreadcrumbs.length - 1
                        ? "font-medium text-foreground"
                        : ""
                    }`}
                  >
                    {crumb}
                  </button>
                </React.Fragment>
              ))}
            </nav>

            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-muted-foreground">Will use</span>
              <code className="truncate rounded-md border border-border/80 bg-muted/20 px-2 py-0.5 font-mono text-foreground/90">
                ./{folderBrowserPath || ""}
              </code>
            </div>

            <div className="min-h-[220px] flex-1 overflow-y-auto rounded-lg border border-border/80">
              {folderBrowserLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-14 text-xs text-muted-foreground">
                  <RefreshIcon className="h-5 w-5 animate-spin opacity-60" />
                  Loading folders…
                </div>
              ) : folderBrowserContents.filter((i) => i.type === "dir").length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                  <FolderIcon className="h-5 w-5 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No subdirectories here</p>
                  <p className="text-[11px] text-muted-foreground/80">
                    Select this folder if your project lives at the current path.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {folderBrowserContents
                    .filter((item) => item.type === "dir")
                    .map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => navigateIntoFolder(item.name)}
                        className="group flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-accent/30"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                          <span className="truncate text-sm text-foreground">{item.name}</span>
                        </span>
                        <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-40 transition-opacity group-hover:opacity-100" />
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
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
              className="text-xs text-muted-foreground"
            >
              Use repo root
            </Button>
            <div className="flex gap-2">
              <DialogClose
                render={<Button variant="outline" size="sm">Cancel</Button>}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => selectFolder(folderBrowserPath)}
                className="max-w-[200px] gap-1.5"
                title={`Select ./${folderBrowserPath || ""}`}
              >
                <span className="shrink-0">Select</span>
                <span className="truncate font-mono text-xs opacity-90">
                  ./{folderBrowserPath || ""}
                </span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
