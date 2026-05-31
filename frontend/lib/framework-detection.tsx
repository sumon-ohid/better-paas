// Shared framework detection + the FRAMEWORKS catalog.
//
// Used by both the deploy wizard (app/deploy) and the app detail config tab
// (app/app/[id]) so detection behavior and build-command defaults stay in one
// place. All functions are pure aside from the api.git network calls.

import React from "react"
import type { GitHubRepo, GitHubContent } from "@/lib/types"
import { api } from "@/lib/api"
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

export type FrameworkIcon = React.FC<React.SVGProps<SVGSVGElement>>

export const FRAMEWORKS = [
  { id: "nextjs", name: "Next.js", color: "text-foreground", icon: NextjsIconDark, keywords: ["next", "nextjs"], buildCmd: "pnpm run build", startCmd: "pnpm start", installCmd: "pnpm install", port: 3000 },
  { id: "svelte", name: "Svelte / SvelteKit", color: "text-[#ff3e00]", icon: Svelte, keywords: ["svelte", "sveltekit"], buildCmd: "pnpm run build", startCmd: "pnpm start", installCmd: "pnpm install", port: 4173 },
  { id: "astro", name: "Astro", color: "text-[#e83e8c]", icon: AstroIconDark, keywords: ["astro"], buildCmd: "pnpm run build", startCmd: "pnpm start", installCmd: "pnpm install", port: 4321 },
  { id: "vite", name: "Vite", color: "text-[#646cff]", icon: Vite, keywords: ["vite"], buildCmd: "pnpm run build", startCmd: "pnpm dlx serve dist", installCmd: "pnpm install", port: 4173 },
  { id: "react", name: "React (CRA)", color: "text-[#61dafb]", icon: ReactLight, keywords: ["react"], buildCmd: "pnpm run build", startCmd: "pnpm dlx serve build", installCmd: "pnpm install", port: 3000 },
  { id: "remix", name: "Remix", color: "text-[#121212]", icon: RemixDark, keywords: ["remix"], buildCmd: "pnpm run build", startCmd: "pnpm start", installCmd: "pnpm install", port: 3000 },
  { id: "bun", name: "Bun", color: "text-[#fbf0df]", icon: Bun, keywords: ["bun"], buildCmd: "bun run build", startCmd: "bun run start", installCmd: "bun install", port: 3000 },
  { id: "node", name: "Node.js Server", color: "text-[#68a063]", icon: Nodejs, keywords: ["node", "express", "fastify", "nestjs"], buildCmd: "", startCmd: "node server.js", installCmd: "pnpm install", port: 3000 },
  { id: "deno", name: "Deno", color: "text-[#70ffaf]", icon: DenoDark, keywords: ["deno"], buildCmd: "deno task build", startCmd: "deno task start", installCmd: "deno cache deps.ts", port: 8000 },
  { id: "django", name: "Django", color: "text-[#44b78b]", icon: Django, keywords: ["django"], buildCmd: "", startCmd: "python manage.py runserver 0.0.0.0:$PORT", installCmd: "", port: 8000 },
  { id: "flask", name: "Flask", color: "text-[#f2f2f2]", icon: FlaskDark, keywords: ["flask"], buildCmd: "", startCmd: "python app.py", installCmd: "", port: 5000 },
  { id: "fastapi", name: "FastAPI", color: "text-[#009688]", icon: Fastapi, keywords: ["fastapi"], buildCmd: "", startCmd: "uvicorn main:app --host 0.0.0.0 --port $PORT", installCmd: "", port: 8000 },
  { id: "python", name: "Python", color: "text-[#3776ab]", icon: Python, keywords: ["python"], buildCmd: "", startCmd: "python app.py", installCmd: "", port: 5000 },
  { id: "go", name: "Go", color: "text-[#00add8]", icon: Golang, keywords: ["go", "golang"], buildCmd: "go build -o app", startCmd: "./app", installCmd: "go mod download", port: 8080 },
  { id: "php", name: "PHP", color: "text-[#777bb4]", icon: PhpDark, keywords: ["php", "laravel", "symfony"], buildCmd: "", startCmd: "php -S 0.0.0.0:$PORT", installCmd: "composer install", port: 8000 },
  { id: "rust", name: "Rust", color: "text-[#dea584]", icon: RustDark, keywords: ["rust"], buildCmd: "cargo build --release", startCmd: "./target/release/app", installCmd: "cargo fetch", port: 8080 },
  { id: "ruby", name: "Ruby on Rails", color: "text-[#cc342d]", icon: Ruby, keywords: ["ruby", "rails", "sinatra"], buildCmd: "", startCmd: "bundle exec rails server -b 0.0.0.0 -p $PORT", installCmd: "bundle install", port: 3000 },
  { id: "elixir", name: "Elixir / Phoenix", color: "text-[#7e66a0]", icon: null as FrameworkIcon | null, keywords: ["elixir", "phoenix"], buildCmd: "mix assets.deploy", startCmd: "mix phx.server", installCmd: "mix deps.get", port: 4000 },
  { id: "java", name: "Java (Spring Boot)", color: "text-[#e76f00]", icon: Java, keywords: ["java", "spring", "springboot"], buildCmd: "./mvnw package -DskipTests", startCmd: "java -jar target/*.jar", installCmd: "", port: 8080 },
  { id: "dotnet", name: ".NET / ASP.NET Core", color: "text-[#512bd4]", icon: Microsoft, keywords: ["dotnet", "aspnet", "csharp", "netcore"], buildCmd: "dotnet publish -c Release -o out", startCmd: "dotnet out/*.dll", installCmd: "", port: 8080 },
  { id: "staticfile", name: "Static Site", color: "text-[#00d8ff]", icon: null as FrameworkIcon | null, keywords: ["static", "jekyll", "hugo", "eleventy", "gatsby"], buildCmd: "", startCmd: "", installCmd: "", port: 8080 },
]

export type Framework = (typeof FRAMEWORKS)[0]
type DirMatch = { framework: Framework; confidence: "high" | "low" }
export type DetectionResult = { framework: Framework; rootDir: string }

const fw = (id: string): Framework | null => FRAMEWORKS.find((f) => f.id === id) || null

// repoFullNameFromGitUrl derives an "owner/repo" slug from a clone/HTML URL so
// the app detail page (which only stores a git URL) can drive the same
// detection that the deploy wizard does with a GitHubRepo.full_name.
export function repoFullNameFromGitUrl(gitUrl: string): string {
  let s = gitUrl.trim().replace(/\.git$/, "")
  if (s.startsWith("git@")) {
    const i = s.indexOf(":")
    if (i >= 0) s = s.slice(i + 1)
  } else {
    const i = s.indexOf("://")
    if (i >= 0) {
      const rest = s.slice(i + 3)
      const j = rest.indexOf("/")
      s = j >= 0 ? rest.slice(j + 1) : rest
    }
  }
  return s.replace(/^\/+|\/+$/g, "")
}

// makeRepoRef builds a minimal GitHubRepo from a git URL + name for the
// detection helpers (only full_name / clone_url / name are actually used).
export function makeRepoRef(gitUrl: string): GitHubRepo {
  const fullName = repoFullNameFromGitUrl(gitUrl)
  return {
    full_name: fullName,
    name: fullName.split("/").pop() || fullName,
    clone_url: gitUrl,
    html_url: gitUrl.replace(/\.git$/, ""),
    private: false,
    description: "",
    updated_at: new Date().toISOString(),
  }
}

// detectFrameworkByName — instant keyword fallback from repo name/description.
export function detectFrameworkByName(repo: GitHubRepo | null): Framework | null {
  if (!repo) return null
  const text = `${repo.name} ${repo.description || ""}`.toLowerCase()
  for (const f of FRAMEWORKS) {
    for (const kw of f.keywords) {
      if (text.includes(kw)) return f
    }
  }
  return null
}

async function safeContents(repo: GitHubRepo, branch: string, dir: string): Promise<GitHubContent[]> {
  try {
    return await api.git.contents(repo.full_name, branch, dir)
  } catch {
    return []
  }
}

async function detectInDir(
  repo: GitHubRepo,
  branch: string,
  dir: string,
  contents: GitHubContent[],
): Promise<DirMatch | null> {
  const fileNames = new Set(contents.map((c) => c.name.toLowerCase()))
  const join = (name: string) => (dir ? `${dir}/${name}` : name)
  const high = (id: string): DirMatch | null => {
    const f = fw(id)
    return f ? { framework: f, confidence: "high" } : null
  }

  if (fileNames.has("next.config.js") || fileNames.has("next.config.ts") || fileNames.has("next.config.mjs") || fileNames.has("next.config.cjs"))
    return high("nextjs")
  if (fileNames.has("svelte.config.js") || fileNames.has("svelte.config.ts")) return high("svelte")
  if (fileNames.has("astro.config.mjs") || fileNames.has("astro.config.js") || fileNames.has("astro.config.ts")) return high("astro")
  if (fileNames.has("remix.config.js") || fileNames.has("remix.config.mjs")) return high("remix")
  if (fileNames.has("vite.config.js") || fileNames.has("vite.config.ts") || fileNames.has("vite.config.mjs")) return high("vite")

  if (fileNames.has("package.json")) {
    try {
      const pkgFile = await api.git.file(repo.full_name, branch, join("package.json"))
      const pkg = JSON.parse(pkgFile.content || "{}")
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
      const depNames = Object.keys(deps).map((d) => d.toLowerCase())
      const has = (n: string) => depNames.includes(n)

      if (has("next")) return high("nextjs")
      if (has("@sveltejs/kit")) return high("svelte")
      if (has("astro")) return high("astro")
      if (has("@remix-run/dev") || has("@remix-run/react") || has("remix")) return high("remix")
      if (has("react-scripts")) return high("react")
      if (has("vite")) return high("vite")
      if (has("@nestjs/core") || has("@nestjs/cli") || has("express") || has("fastify") || has("koa") || has("@hapi/hapi")) return high("node")

      const scripts = (pkg.scripts || {}) as Record<string, string>
      const scriptText = Object.values(scripts).join(" ").toLowerCase()
      if (/(^|[\s&|;])next(\s|$|\s+(build|start|dev))/.test(scriptText)) return high("nextjs")
      if (/(^|[\s&|;])astro(\s|$)/.test(scriptText)) return high("astro")
      if (/(^|[\s&|;])remix(\s|$)/.test(scriptText)) return high("remix")
      if (/(^|[\s&|;])vite(\s|$)/.test(scriptText)) return high("vite")

      if (depNames.length > 0 || Object.keys(scripts).length > 0) {
        const f = fw("node")
        return f ? { framework: f, confidence: "low" } : null
      }
    } catch {
      // fall through
    }
  }

  if (fileNames.has("requirements.txt")) {
    const reqFile = await api.git.file(repo.full_name, branch, join("requirements.txt"))
    const content = (reqFile.content || "").toLowerCase()
    if (content.includes("django")) return high("django")
    if (content.includes("flask")) return high("flask")
    if (content.includes("fastapi")) return high("fastapi")
    return high("python")
  }
  if (fileNames.has("pyproject.toml")) {
    const pyFile = await api.git.file(repo.full_name, branch, join("pyproject.toml"))
    const content = (pyFile.content || "").toLowerCase()
    if (content.includes("django")) return high("django")
    if (content.includes("flask")) return high("flask")
    if (content.includes("fastapi")) return high("fastapi")
    return high("python")
  }

  if (fileNames.has("go.mod")) return high("go")
  if (fileNames.has("cargo.toml")) return high("rust")
  if (fileNames.has("composer.json")) return high("php")
  if (fileNames.has("gemfile")) return high("ruby")
  if (fileNames.has("mix.exs")) return high("elixir")
  if (fileNames.has("pom.xml") || fileNames.has("build.gradle")) return high("java")
  if ([...fileNames].some((f) => f.endsWith(".csproj") || f.endsWith(".sln"))) return high("dotnet")

  if (fileNames.has("bun.lockb")) return high("bun")
  if (fileNames.has("deno.json") || fileNames.has("deno.jsonc")) return high("deno")

  if (fileNames.has("index.html") || fileNames.has("index.htm")) return high("staticfile")

  return null
}

async function collectSubdirCandidates(
  repo: GitHubRepo,
  branch: string,
  rootContents: GitHubContent[],
): Promise<string[]> {
  const rootDirs = new Set(rootContents.filter((c) => c.type === "dir").map((c) => c.name.toLowerCase()))
  const out: string[] = []
  const push = (raw: string) => {
    const norm = raw.replace(/^\.\//, "").replace(/\/+$/, "").trim()
    if (norm && !out.includes(norm)) out.push(norm)
  }

  if (rootContents.some((c) => c.name.toLowerCase() === "package.json")) {
    try {
      const pkgFile = await api.git.file(repo.full_name, branch, "package.json")
      const pkg = JSON.parse(pkgFile.content || "{}")
      let patterns: string[] = []
      if (Array.isArray(pkg.workspaces)) patterns = pkg.workspaces
      else if (pkg.workspaces && Array.isArray(pkg.workspaces.packages)) patterns = pkg.workspaces.packages

      for (const pat of patterns) {
        if (typeof pat !== "string") continue
        if (pat.endsWith("/*")) {
          const base = pat.slice(0, -2)
          if (base && !base.includes("*") && rootDirs.has(base.toLowerCase())) {
            const children = await safeContents(repo, branch, base)
            for (const ch of children) if (ch.type === "dir") push(`${base}/${ch.name}`)
          }
        } else if (!pat.includes("*")) {
          push(pat)
        }
      }
    } catch {
      // ignore malformed package.json
    }
  }

  for (const c of ["frontend", "client", "web", "app", "www", "ui", "site"]) push(c)
  for (const c of ["apps/web", "apps/frontend", "apps/app", "apps/client", "packages/web", "packages/app"]) push(c)

  return out.filter((p) => rootDirs.has(p.split("/")[0].toLowerCase())).slice(0, 12)
}

function isWorkspaceRoot(rootContents: GitHubContent[], rootPkg: Record<string, unknown> | null): boolean {
  const names = new Set(rootContents.map((c) => c.name.toLowerCase()))
  if (names.has("pnpm-workspace.yaml") || names.has("pnpm-workspace.yml")) return true
  if (rootPkg) {
    const ws = rootPkg.workspaces
    if (Array.isArray(ws) && ws.length > 0) return true
    if (ws && typeof ws === "object" && Array.isArray((ws as { packages?: unknown }).packages)) return true
  }
  return false
}

// detectFrameworkByFiles — repo-wide scan (root + monorepo subdirs).
export async function detectFrameworkByFiles(repo: GitHubRepo, branch: string): Promise<DetectionResult | null> {
  try {
    const rootContents = await safeContents(repo, branch, "")
    let rootPkg: Record<string, unknown> | null = null
    if (rootContents.some((c) => c.name.toLowerCase() === "package.json")) {
      try {
        const f = await api.git.file(repo.full_name, branch, "package.json")
        rootPkg = JSON.parse(f.content || "{}")
      } catch {
        rootPkg = null
      }
    }
    const monorepo = isWorkspaceRoot(rootContents, rootPkg)
    const rootMatch = await detectInDir(repo, branch, "", rootContents)

    if (rootMatch && rootMatch.confidence === "high" && rootMatch.framework.id !== "node") {
      return { framework: rootMatch.framework, rootDir: "" }
    }

    const candidates = await collectSubdirCandidates(repo, branch, rootContents)
    for (const dir of candidates) {
      const contents = await safeContents(repo, branch, dir)
      if (contents.length === 0) continue
      const sub = await detectInDir(repo, branch, dir, contents)
      if (sub && sub.confidence === "high" && sub.framework.id !== "node") {
        return { framework: sub.framework, rootDir: monorepo ? "" : dir }
      }
    }
    if (rootMatch) return { framework: rootMatch.framework, rootDir: "" }
  } catch (err) {
    console.error("[FrameworkScan] error:", err)
  }
  return null
}

// detectFrameworkForDir — single directory, no traversal.
export async function detectFrameworkForDir(repo: GitHubRepo, branch: string, dir: string): Promise<Framework | null> {
  const normalized = dir.replace(/^\.\//, "").replace(/\/+$/, "").trim()
  try {
    const contents = await safeContents(repo, branch, normalized)
    if (contents.length === 0) return null
    const match = await detectInDir(repo, branch, normalized, contents)
    return match ? match.framework : null
  } catch (err) {
    console.error("[FrameworkScan] per-dir error:", err)
    return null
  }
}

// listDirContents — thin wrapper for the folder browser to list a directory.
export function listDirContents(repoFullName: string, branch: string, path: string): Promise<GitHubContent[]> {
  return api.git.contents(repoFullName, branch, path)
}

// findDockerfile returns the name of a Dockerfile in the given directory (e.g.
// "Dockerfile"), or null if none exists. Matches "Dockerfile" case-insensitively
// and common variants like "Dockerfile.prod". Used to decide whether to offer
// the build-method selector at all — no Dockerfile means Nixpacks is the only
// sensible option.
export async function findDockerfile(repo: GitHubRepo, branch: string, dir: string): Promise<string | null> {
  const normalized = dir.replace(/^\.\//, "").replace(/\/+$/, "").trim()
  const contents = await safeContents(repo, branch, normalized)
  // Prefer an exact "Dockerfile"; fall back to a "Dockerfile.*" variant.
  const exact = contents.find((c) => c.type === "file" && c.name.toLowerCase() === "dockerfile")
  if (exact) return exact.name
  const variant = contents.find((c) => c.type === "file" && c.name.toLowerCase().startsWith("dockerfile"))
  return variant ? variant.name : null
}

// composeFileNames are the compose filenames we look for, in priority order,
// matching docker compose's own resolution and the backend's findComposeFile.
const composeFileNames = ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"]

// findComposeFile returns the name of a Docker Compose file in the given
// directory (e.g. "docker-compose.yml"), or null if none exists. Used to decide
// whether to offer the Compose build method in the deploy wizard.
export async function findComposeFile(repo: GitHubRepo, branch: string, dir: string): Promise<string | null> {
  const normalized = dir.replace(/^\.\//, "").replace(/\/+$/, "").trim()
  const contents = await safeContents(repo, branch, normalized)
  const names = new Map(contents.filter((c) => c.type === "file").map((c) => [c.name.toLowerCase(), c.name]))
  for (const candidate of composeFileNames) {
    const match = names.get(candidate)
    if (match) return match
  }
  return null
}
