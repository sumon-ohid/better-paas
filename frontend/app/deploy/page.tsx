"use client"

import React, { useState, useEffect } from "react"
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
import { NucleoIcon } from "@/components/nucleo-icons"
import { GitHubConnectModal } from "@/components/github-connect-modal"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { ReactLight } from "@/components/ui/svgs/reactLight"
import { Nodejs } from "@/components/ui/svgs/nodejs"
import { NextjsIconDark } from "@/components/ui/svgs/nextjsIconDark"
import { Vite } from "@/components/ui/svgs/vite"
import { Python } from "@/components/ui/svgs/python"
import { Golang } from "@/components/ui/svgs/golang"
import { Svelte } from "@/components/ui/svgs/svelte"
import { AstroIconDark } from "@/components/ui/svgs/astroIconDark"
import { Bun } from "@/components/ui/svgs/bun"
import { DenoDark } from "@/components/ui/svgs/denoDark"
import { PhpDark } from "@/components/ui/svgs/phpDark"
import { RustDark } from "@/components/ui/svgs/rustDark"
import { Ruby } from "@/components/ui/svgs/ruby"
import { RemixDark } from "@/components/ui/svgs/remixDark"
import { Django } from "@/components/ui/svgs/django"
import { FlaskDark } from "@/components/ui/svgs/flaskDark"
import { Fastapi } from "@/components/ui/svgs/fastapi"
import { Java } from "@/components/ui/svgs/java"
import { Microsoft } from "@/components/ui/svgs/microsoft"
import { api } from "@/lib/api"
import type { GitHubRepo } from "@/lib/types"

// Framework definitions (18 supported frameworks)
const FRAMEWORKS = [
  {
    id: "nextjs",
    name: "Next.js",
    color: "text-foreground",
    icon: NextjsIconDark,
    keywords: ["next", "nextjs"],
    buildCmd: "npm run build",
    startCmd: "npm start",
    installCmd: "npm install",
    port: 3000,
  },
  {
    id: "svelte",
    name: "Svelte / SvelteKit",
    color: "text-[#ff3e00]",
    icon: Svelte,
    keywords: ["svelte", "sveltekit"],
    buildCmd: "npm run build",
    startCmd: "npm start",
    installCmd: "npm install",
    port: 4173,
  },
  {
    id: "astro",
    name: "Astro",
    color: "text-[#e83e8c]",
    icon: AstroIconDark,
    keywords: ["astro"],
    buildCmd: "npm run build",
    startCmd: "npm start",
    installCmd: "npm install",
    port: 4321,
  },
  {
    id: "vite",
    name: "Vite",
    color: "text-[#646cff]",
    icon: Vite,
    keywords: ["vite"],
    buildCmd: "npm run build",
    startCmd: "npx serve dist",
    installCmd: "npm install",
    port: 4173,
  },
  {
    id: "react",
    name: "React (CRA)",
    color: "text-[#61dafb]",
    icon: ReactLight,
    keywords: ["react"],
    buildCmd: "npm run build",
    startCmd: "npx serve build",
    installCmd: "npm install",
    port: 3000,
  },
  {
    id: "remix",
    name: "Remix",
    color: "text-[#121212]",
    icon: RemixDark,
    keywords: ["remix"],
    buildCmd: "npm run build",
    startCmd: "npm start",
    installCmd: "npm install",
    port: 3000,
  },
  {
    id: "bun",
    name: "Bun",
    color: "text-[#fbf0df]",
    icon: Bun,
    keywords: ["bun"],
    buildCmd: "bun run build",
    startCmd: "bun run start",
    installCmd: "bun install",
    port: 3000,
  },
  {
    id: "node",
    name: "Node.js Server",
    color: "text-[#68a063]",
    icon: Nodejs,
    keywords: ["node", "express", "fastify", "nestjs"],
    buildCmd: "",
    startCmd: "node server.js",
    installCmd: "npm install",
    port: 3000,
  },
  {
    id: "deno",
    name: "Deno",
    color: "text-[#70ffaf]",
    icon: DenoDark,
    keywords: ["deno"],
    buildCmd: "deno task build",
    startCmd: "deno task start",
    installCmd: "deno cache deps.ts",
    port: 8000,
  },
  {
    id: "django",
    name: "Django",
    color: "text-[#44b78b]",
    icon: Django,
    keywords: ["django"],
    buildCmd: "",
    startCmd: "python manage.py runserver 0.0.0.0:$PORT",
    installCmd: "",
    port: 8000,
  },
  {
    id: "flask",
    name: "Flask",
    color: "text-[#f2f2f2]",
    icon: FlaskDark,
    keywords: ["flask"],
    buildCmd: "",
    startCmd: "python app.py",
    installCmd: "",
    port: 5000,
  },
  {
    id: "fastapi",
    name: "FastAPI",
    color: "text-[#009688]",
    icon: Fastapi,
    keywords: ["fastapi"],
    buildCmd: "",
    startCmd: "uvicorn main:app --host 0.0.0.0 --port $PORT",
    installCmd: "",
    port: 8000,
  },
  {
    id: "python",
    name: "Python",
    color: "text-[#3776ab]",
    icon: Python,
    keywords: ["python"],
    buildCmd: "",
    startCmd: "python app.py",
    installCmd: "",
    port: 5000,
  },
  {
    id: "go",
    name: "Go",
    color: "text-[#00add8]",
    icon: Golang,
    keywords: ["go", "golang"],
    buildCmd: "go build -o app",
    startCmd: "./app",
    installCmd: "go mod download",
    port: 8080,
  },
  {
    id: "php",
    name: "PHP",
    color: "text-[#777bb4]",
    icon: PhpDark,
    keywords: ["php", "laravel", "symfony"],
    buildCmd: "",
    startCmd: "php -S 0.0.0.0:$PORT",
    installCmd: "composer install",
    port: 8000,
  },
  {
    id: "rust",
    name: "Rust",
    color: "text-[#dea584]",
    icon: RustDark,
    keywords: ["rust"],
    buildCmd: "cargo build --release",
    startCmd: "./target/release/app",
    installCmd: "cargo fetch",
    port: 8080,
  },
  {
    id: "ruby",
    name: "Ruby on Rails",
    color: "text-[#cc342d]",
    icon: Ruby,
    keywords: ["ruby", "rails", "sinatra"],
    buildCmd: "",
    startCmd: "bundle exec rails server -b 0.0.0.0 -p $PORT",
    installCmd: "bundle install",
    port: 3000,
  },
  {
    id: "elixir",
    name: "Elixir / Phoenix",
    color: "text-[#7e66a0]",
    icon: null as any,
    keywords: ["elixir", "phoenix"],
    buildCmd: "mix assets.deploy",
    startCmd: "mix phx.server",
    installCmd: "mix deps.get",
    port: 4000,
  },
  {
    id: "java",
    name: "Java (Spring Boot)",
    color: "text-[#e76f00]",
    icon: Java,
    keywords: ["java", "spring", "springboot"],
    buildCmd: "./mvnw package -DskipTests",
    startCmd: "java -jar target/*.jar",
    installCmd: "",
    port: 8080,
  },
  {
    id: "dotnet",
    name: ".NET / ASP.NET Core",
    color: "text-[#512bd4]",
    icon: Microsoft,
    keywords: ["dotnet", "aspnet", "csharp", "netcore"],
    buildCmd: "dotnet publish -c Release -o out",
    startCmd: "dotnet out/*.dll",
    installCmd: "",
    port: 8080,
  },
  {
    id: "staticfile",
    name: "Static Site",
    color: "text-[#00d8ff]",
    icon: null as any,
    keywords: ["static", "jekyll", "hugo", "eleventy", "gatsby"],
    buildCmd: "",
    startCmd: "python -m http.server $PORT",
    installCmd: "",
    port: 8080,
  },
]

// Styled fallback for frameworks without svgl assets (Elixir/Phoenix only)
function FallbackIcon({ label }: { label: string; color: string }) {
  return (
    <div className="h-5 w-5 rounded-md flex items-center justify-center text-[9px] font-bold border border-purple-400/40 text-purple-400 bg-purple-400/10">
      {label.slice(0, 2).toUpperCase()}
    </div>
  )
}

// Detect framework from repo name / description keywords
function detectFramework(repo: GitHubRepo | null): (typeof FRAMEWORKS)[0] | null {
  if (!repo) return null
  const name = repo.name.toLowerCase()
  const desc = (repo.description || "").toLowerCase()
  const text = `${name} ${desc}`

  for (const fw of FRAMEWORKS) {
    for (const kw of fw.keywords) {
      if (text.includes(kw)) return fw
    }
  }
  return null
}

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const ChevronLeftIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-left" />
const ChevronRightIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-right" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />

const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />

export default function DeployPage() {
  const router = useRouter()

  // ── Wizard step ────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1)

  // ── GitHub connection ──────────────────────────────────────────────────────
  const [gitHubConnected, setGitHubConnected] = useState(false)
  const [showGitHubModal, setShowGitHubModal] = useState(false)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)

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

  // ── Detected framework ─────────────────────────────────────────────────────
  const [detectedFramework, setDetectedFramework] = useState<(typeof FRAMEWORKS)[0] | null>(null)

  // ── Manual public repo input ───────────────────────────────────────────────
  const [manualGitUrl, setManualGitUrl] = useState("")
  const [showPublicRepoModal, setShowPublicRepoModal] = useState(false)

  // ── Bulk env paste ─────────────────────────────────────────────────────────
  const [showBulkEnv, setShowBulkEnv] = useState(false)
  const [bulkEnvText, setBulkEnvText] = useState("")

  // ── UI state ───────────────────────────────────────────────────────────────
  const [isDeploying, setIsDeploying] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

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
  }, [])

  const loadRepos = async () => {
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
  }

  const handleRepoSelect = (repoFullName: string) => {
    const repo = repos.find((r) => r.full_name === repoFullName) || null
    setSelectedRepo(repo)
    setBranches([])
    setSelectedBranch("")
    setErrorMsg("")

    // Detect framework
    const fw = detectFramework(repo)
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

    // Derive app name from repo name
    if (repo) {
      setDeployName(repo.name.toLowerCase().replace(/[^a-z0-9-]/g, ""))
    }

    // Fetch branches
    if (repo) {
      setIsFetchingBranches(true)
      api.git
        .branches(repo.clone_url)
        .then((list) => {
          setBranches(list)
          if (list.includes("main")) setSelectedBranch("main")
          else if (list.includes("master")) setSelectedBranch("master")
          else if (list.length > 0) setSelectedBranch(list[0])
        })
        .catch((err) => {
          setErrorMsg(`Failed to fetch branches: ${err.message}`)
        })
        .finally(() => setIsFetchingBranches(false))
    }
  }

  const handleDisconnect = async () => {
    try {
      await api.git.deleteToken()
      setGitHubConnected(false)
      setRepos([])
      setSelectedRepo(null)
      setBranches([])
      setSelectedBranch("")
    } catch {
      // Ignore
    }
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
    setDeployName(repoName.toLowerCase().replace(/[^a-z0-9-]/g, ""))

    // Detect framework
    const fw = detectFramework(repoObj)
    setDetectedFramework(fw)
    if (fw) {
      setDeployBuildCommand(fw.buildCmd)
      setDeployStartCommand(fw.startCmd)
      setDeployInstallCommand(fw.installCmd)
      setDeployPortOverride(String(fw.port))
    }

    // Fetch branches
    try {
      const list = await api.git.branches(repoObj.clone_url)
      setBranches(list)
      if (list.includes("main")) setSelectedBranch("main")
      else if (list.includes("master")) setSelectedBranch("master")
      else if (list.length > 0) setSelectedBranch(list[0])
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
      const res = await fetch("http://localhost:8080/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deployName,
          gitRepo: selectedRepo.clone_url,
          branch: selectedBranch,
          rootDir: deployRootDir,
          envVars: envVarsRecord,
          buildCommand: deployBuildCommand,
          startCommand: deployStartCommand,
          installCommand: deployInstallCommand,
          portOverride: deployPortOverride ? parseInt(deployPortOverride, 10) : 0,
        }),
      })

      if (res.ok) {
        const newApp = await res.json()
        router.push(`/logs?appId=${newApp.id}&mode=build`)
      } else {
        const text = await res.text()
        setErrorMsg(`Deployment submission failed: ${text}`)
      }
    } catch (err) {
      console.error(err)
      setErrorMsg("Backend connection failed.")
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 px-2">
          {[
            { num: 1, label: "Repository" },
            { num: 2, label: "Build Config" },
            { num: 3, label: "Environment" },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-3">
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
              {s.num < 3 && <div className="h-px w-8 md:w-16 bg-border mx-1" />}
            </div>
          ))}
        </div>

        <Card className="border border-border/80 bg-card/65">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-base font-bold text-foreground">Deploy New Service</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Select a repository, configure your build, and deploy.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 min-h-[300px]">
            {errorMsg && (
              <div className="mb-4 p-3 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs leading-relaxed">
                {errorMsg}
              </div>
            )}

            {/* ── STEP 1: Repository Selection ─────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in-50 duration-200 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
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
                        <div className="h-6 w-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                          <NucleoIcon name="check" className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
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
                          className="text-xs text-rose-500 hover:text-rose-600 transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>

                    {/* Repo list — scrollable */}
                    {isLoadingRepos ? (
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
                    )}

                    {/* Add public repo */}
                    <button
                      onClick={() => setShowPublicRepoModal(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 hover:bg-accent/20 transition-all cursor-pointer"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Deploy a public repository
                    </button>
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
                      {!gitHubConnected && (
                        <button
                          onClick={() => {
                            setSelectedRepo(null)
                            setBranches([])
                            setSelectedBranch("")
                            setDetectedFramework(null)
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Change
                        </button>
                      )}
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

                    {detectedFramework && (
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
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Build Config ─────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                {detectedFramework && (
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
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Root Directory
                    </Label>
                    <Input
                      value={deployRootDir}
                      onChange={(e) => setDeployRootDir(e.target.value)}
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
              </div>
            )}

            {/* ── STEP 3: Environment ──────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
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
                    <textarea
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
                        className="h-8 w-8 hover:bg-rose-500/15 text-rose-400 hover:text-rose-500 p-0 shrink-0 border-0"
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
      {showPublicRepoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPublicRepoModal(false)} />
          <div className="relative w-full max-w-md mx-4 bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Deploy Public Repository</h3>
              <button
                onClick={() => setShowPublicRepoModal(false)}
                className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
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
                <p className="text-[11px] text-muted-foreground">
                  Paste any public GitHub URL. Authentication not required.
                </p>
              </div>
              <Button
                onClick={() => {
                  setShowPublicRepoModal(false)
                  handleManualRepo(manualGitUrl)
                }}
                disabled={!manualGitUrl.trim() || isFetchingBranches}
                className="w-full h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isFetchingBranches ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshIcon className="h-3 w-3 animate-spin" />
                    Fetching...
                  </span>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
