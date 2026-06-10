"use client"

import React, { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Frame,
  FramePanel,
  FrameTitle,
  FrameDescription,
  FrameFooter,
} from "@/components/ui/frame"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { AppShell, useToast } from "@/components/app-shell"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/menu"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import type { CatalogTemplate, CatalogEnv, App } from "@/lib/types"
import { NucleoIcon } from "@/components/nucleo-icons"
import { Docker } from "@/components/ui/svgs/docker"
import { useActiveServer } from "@/components/server-context"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const ExternalIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="external" />
)
const InfoIcon = (props: IconProps) => <NucleoIcon {...props} name="info" />
const StoreIcon = (props: IconProps) => <NucleoIcon {...props} name="layers" />
const RefreshIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="refresh" />
)
const ChevronDownIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="chevron-down" />
)
const DockerIcon = (props: IconProps) => <NucleoIcon {...props} name="server" />
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const TerminalIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="terminal" />
)

// A simple key/value env var row used by the custom-deploy modals.
type EnvRow = { key: string; value: string; secret: boolean }

const isAutoFilledEnv = (env: CatalogEnv) =>
  env.description?.toLowerCase().startsWith("auto-filled from a managed") ??
  false

const addonLabel = (type: string) => {
  switch (type) {
    case "postgres":
      return "Postgres"
    case "mysql":
      return "MySQL"
    case "redis":
      return "Redis"
    default:
      return type
  }
}

// Logos come from the community dashboard-icons CDN. Only the slug is stored
// server-side; we build the URL here.
const iconUrlOverrides: Record<string, string> = {
  homepage:
    "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/homepage.png",
  pairdrop:
    "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/pairdrop.png",
  woodpecker:
    "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/woodpecker-ci.png",
  prestashop: "https://cdn.jsdelivr.net/npm/simple-icons/icons/prestashop.svg",
  matomo: "https://cdn.jsdelivr.net/npm/simple-icons/icons/matomo.svg",
  seonaut: "https://seonaut.org/favicon.ico",
  seopanel: "https://raw.githubusercontent.com/seopanel/Seo-Panel-Docs/master/_static/seo_lg.png",
  openui: "https://cdn.jsdelivr.net/npm/simple-icons/icons/weightsandbiases.svg",
}

function iconUrl(slug: string): string {
  if (iconUrlOverrides[slug]) return iconUrlOverrides[slug]
  return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${slug}.svg`
}

// AppLogo renders the template's logo, falling back to its initial if the image
// fails to load (so a missing icon never leaves a broken-image box).
function AppLogo({
  template,
  className,
}: {
  template: CatalogTemplate
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  if (failed || !template.icon) {
    return (
      <div
        className={`flex items-center justify-center rounded-md bg-muted text-sm font-bold text-muted-foreground ${className ?? ""}`}
      >
        {template.name.charAt(0).toUpperCase()}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconUrl(template.icon)}
      alt={`${template.name} logo`}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

export default function CatalogPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { activeServerId } = useActiveServer()
  const targetServerId = activeServerId === "all" ? "localhost" : activeServerId

  const [templates, setTemplates] = useState<CatalogTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("All")

  // Deploy dialog state
  const [selected, setSelected] = useState<CatalogTemplate | null>(null)
  const [deployName, setDeployName] = useState("")
  const [envValues, setEnvValues] = useState<Record<string, string>>({})
  const [deploying, setDeploying] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  // Custom-deploy modals ("image" | "dockerfile" | null)
  const [customMode, setCustomMode] = useState<"image" | "dockerfile" | null>(
    null
  )

  const load = useCallback(async () => {
    try {
      const data = await api.catalog.list()
      setTemplates(data || [])
      return data || []
    } catch {
      showToast(
        "Failed to load",
        "Could not fetch the app catalog.",
        "destructive"
      )
      return []
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null

    const startPolling = (current: CatalogTemplate[]) => {
      // Only poll if some Docker Hub templates are still missing a size.
      // Non-Docker Hub (ghcr.io, lscr.io, quay.io) images are skipped by the
      // backend, so we never wait for them.
      const isDockerhub = (img: string) =>
        !img.includes("ghcr.io") &&
        !img.includes("lscr.io") &&
        !img.includes("quay.io")

      const stillMissing = current.some(
        (t) => isDockerhub(t.image) && !t.imageSize
      )
      if (!stillMissing || cancelled) return

      pollTimer = setTimeout(async () => {
        if (cancelled) return
        try {
          const fresh = await api.catalog.list()
          if (!cancelled) {
            setTemplates(fresh || [])
            startPolling(fresh || []) // keep going until all sizes are in
          }
        } catch {
          // silently ignore poll errors
        }
      }, 3000)
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().then((data) => {
      if (!cancelled) startPolling(data)
    })

    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [load])

  const categories = useMemo(() => {
    const set = new Set<string>()
    templates.forEach((t) => set.add(t.category))
    return ["All", ...Array.from(set).sort()]
  }, [templates])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return templates.filter((t) => {
      if (category !== "All" && t.category !== category) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      )
    })
  }, [templates, search, category])

  const openDeploy = (tpl: CatalogTemplate) => {
    setSelected(tpl)
    setDeployName(tpl.id)
    // Seed env fields with their template defaults.
    const seed: Record<string, string> = {}
    ;(tpl.env || []).forEach((e) => {
      seed[e.key] = e.value || ""
    })
    setEnvValues(seed)
    setErrorMsg("")
  }

  const openCustom = (mode: "image" | "dockerfile") => {
    setCustomMode(mode)
  }

  const handleDeploy = async () => {
    if (!selected) return
    const name = deployName.trim()
    if (!/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(name)) {
      setErrorMsg("Name must be 2-40 lowercase letters, digits, or hyphens.")
      return
    }
    // Require non-empty for required env vars that aren't auto-generated.
    for (const e of selected.env || []) {
      if (isAutoFilledEnv(e)) continue
      if (e.required && !e.generate && !(envValues[e.key] || "").trim()) {
        setErrorMsg(`${e.key} is required.`)
        return
      }
    }

    setDeploying(true)
    setErrorMsg("")
    try {
      const app = await api.catalog.deploy({
        templateId: selected.id,
        name,
        envVars: envValues,
        serverId: targetServerId,
      })
      showToast("Deploying", `${selected.name} is starting up.`, "success")
      router.push(`/logs?appId=${app.id}&mode=build`)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Deployment failed.")
      setDeploying(false)
    }
  }

  return (
    <AppShell>
      <div className="animate-in fade-in-50 mx-auto max-w-6xl space-y-6 p-4 duration-200 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                App Catalog
              </h2>
              <Badge variant="secondary" size="sm" className="shrink-0">
                {templates.length} apps
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Deploy popular open-source apps in a few clicks. Each runs as a
              single container with its own storage.
            </p>
          </div>

          {/* Custom deploy dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant={"outline"} className="h-9 shrink-0 gap-1.5">
                  <Docker className="h-4 w-4" />
                  Custom Deploy
                  <ChevronDownIcon className="h-3.5 w-3.5 opacity-80" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem
                onClick={() => openCustom("image")}
                className="items-start gap-2.5 py-2"
              >
                <DockerIcon className="mt-0.5 h-4 w-4 text-chart-2" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">From Docker image</p>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Run any image from Docker Hub or another registry.
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openCustom("dockerfile")}
                className="items-start gap-2.5 py-2"
              >
                <TerminalIcon className="mt-0.5 h-4 w-4 text-chart-4" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">From a Dockerfile</p>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Paste a Dockerfile and we&apos;ll build and run it — no repo
                    needed.
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search + category filter */}
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,320px)_1fr] lg:items-start">
          <InputGroup className="min-w-0">
            <InputGroupInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search apps..."
              type="search"
            />
            <InputGroupAddon align="inline-end">
              <Button size="xs" variant="secondary">
                Search
              </Button>
            </InputGroupAddon>
          </InputGroup>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:min-h-9">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  category === c
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <Frame className="w-full">
            <FramePanel className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <RefreshIcon className="h-5 w-5 animate-spin text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Loading catalog...</p>
            </FramePanel>
          </Frame>
        ) : filtered.length === 0 ? (
          <Frame className="w-full">
            <FramePanel className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <StoreIcon className="h-6 w-6 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">
                No apps match your search
              </p>
              <p className="text-xs text-muted-foreground">
                Try a different term or category.
              </p>
              {(search || category !== "All") && (
                <button
                  onClick={() => {
                    setSearch("")
                    setCategory("All")
                  }}
                  className="mt-1 cursor-pointer text-xs text-primary underline-offset-2 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </FramePanel>
          </Frame>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((tpl) => (
              <Frame key={tpl.id}>
                <FramePanel className="relative flex flex-1 flex-col gap-3">
                  {/* Image size badge — top-right corner. Always rendered so
                      the card height is stable; fades in once the backend
                      background-fetch has populated the size. */}
                  <span
                    className={`absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full border border-border bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm transition-opacity duration-500 ${
                      tpl.imageSize ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <Docker className="h-2.5 w-2.5 opacity-60" />
                    {tpl.imageSize ?? ""}
                  </span>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-white p-1.5">
                      <AppLogo
                        template={tpl}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {tpl.name}
                      </h3>
                      <Badge variant="info" size="sm" className="mt-0.5">
                        {tpl.category}
                      </Badge>
                    </div>
                  </div>
                  <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {tpl.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={"secondary"}
                      onClick={() => openDeploy(tpl)}
                      className="h-8 flex-1 gap-1.5 text-xs"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Deploy
                    </Button>
                    {tpl.website && (
                      <a
                        href={tpl.website}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
                        title="Project website"
                      >
                        <ExternalIcon className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </FramePanel>
              </Frame>
            ))}
          </div>
        )}
      </div>

      {/* Deploy dialog */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && !deploying && setSelected(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              {selected && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-white p-1">
                  <AppLogo
                    template={selected}
                    className="h-full w-full object-contain"
                  />
                </span>
              )}
              <span className="min-w-0 truncate">Deploy {selected?.name}</span>
            </DialogTitle>
            <DialogDescription className="line-clamp-2">
              {selected?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 pb-2">
            {errorMsg && (
              <Alert variant="error">
                <NucleoIcon name="triangle-alert" />
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            {selected && (
              <Frame className="w-full">
                <FramePanel className="shrink-0 !py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <FrameTitle>App settings</FrameTitle>
                      <FrameDescription className="text-xs sm:text-sm">
                        Name your deployment on{" "}
                        <span className="font-mono text-foreground/80">
                          {targetServerId}
                        </span>
                        .
                      </FrameDescription>
                    </div>
                    <Badge variant="info" size="sm" className="shrink-0">
                      {selected.category}
                    </Badge>
                  </div>
                </FramePanel>

                <FramePanel className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    App name
                  </Label>
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
                    Used for the container name and the app&apos;s default URL.
                  </p>
                </FramePanel>

                {selected.requiredAddons?.length ? (
                  <FramePanel className="!py-3">
                    <div className="flex gap-2 text-[11px] leading-snug text-muted-foreground">
                      <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>
                        Better PaaS will create{" "}
                        {selected.requiredAddons
                          .map((addon) => addonLabel(addon.type))
                          .join(" + ")}{" "}
                        on the selected server and inject the connection
                        variables automatically.
                      </span>
                    </div>
                  </FramePanel>
                ) : null}

                {(selected.env || []).some((e) => !isAutoFilledEnv(e)) && (
                  <>
                    <FramePanel className="shrink-0 !py-3">
                      <FrameTitle>Configuration</FrameTitle>
                      <FrameDescription className="text-xs sm:text-sm">
                        Environment variables for this template.
                      </FrameDescription>
                    </FramePanel>
                    <FramePanel className="space-y-3">
                      {(selected.env || [])
                        .filter((e: CatalogEnv) => !isAutoFilledEnv(e))
                        .map((e: CatalogEnv) => (
                          <div key={e.key} className="space-y-1.5">
                            <Label className="flex items-center gap-1.5 font-mono text-[11px] text-foreground/90">
                              {e.key}
                              {e.required && (
                                <span className="text-destructive-foreground">
                                  *
                                </span>
                              )}
                              {e.secret && (
                                <NucleoIcon
                                  name="lock"
                                  className="h-3 w-3 text-muted-foreground"
                                />
                              )}
                            </Label>
                            <Input
                              type={e.secret ? "password" : "text"}
                              value={envValues[e.key] ?? ""}
                              onChange={(ev) =>
                                setEnvValues((prev) => ({
                                  ...prev,
                                  [e.key]: ev.target.value,
                                }))
                              }
                              placeholder={
                                e.generate
                                  ? "Leave blank to auto-generate"
                                  : e.value || ""
                              }
                              className="h-8 font-mono text-xs"
                            />
                            {e.description && (
                              <p className="text-[11px] leading-snug text-muted-foreground">
                                {e.description}
                              </p>
                            )}
                          </div>
                        ))}
                    </FramePanel>
                  </>
                )}

                <FramePanel className="shrink-0 !py-3">
                  <FrameTitle>Runtime</FrameTitle>
                  <FrameDescription className="text-xs sm:text-sm">
                    Container image and networking details.
                  </FrameDescription>
                </FramePanel>
                <FramePanel className="divide-y divide-border/60 !py-0">
                  <div className="flex items-center justify-between gap-3 py-2.5 text-xs">
                    <span className="text-muted-foreground">Image</span>
                    <span className="truncate font-mono text-foreground/80 select-all">
                      {selected.image}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2.5 text-xs">
                    <span className="text-muted-foreground">Internal port</span>
                    <span className="font-mono text-foreground/80">
                      {selected.port}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2.5 text-xs">
                    <span className="text-muted-foreground">Storage</span>
                    <span className="font-mono text-foreground/80">
                      {selected.volumePath ? "Persistent volume" : "Stateless"}
                    </span>
                  </div>
                  {selected.imageSize && (
                    <div className="flex items-center justify-between gap-3 py-2.5 text-xs">
                      <span className="text-muted-foreground">Image size</span>
                      <span className="font-mono text-foreground/80">
                        {selected.imageSize}
                      </span>
                    </div>
                  )}
                </FramePanel>

                {selected.notes && (
                  <FrameFooter className="!py-3">
                    <div className="flex gap-2 text-[11px] leading-snug text-muted-foreground">
                      <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                      <span>{selected.notes}</span>
                    </div>
                  </FrameFooter>
                )}
              </Frame>
            )}
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" disabled={deploying}>
                  Cancel
                </Button>
              }
            />
            <Button
              onClick={handleDeploy}
              loading={deploying}
              className="gap-1.5"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Deploy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom deploy modal (image / dockerfile) */}
      <CustomDeployModal
        key={customMode ?? "closed"}
        mode={customMode}
        serverId={targetServerId}
        onClose={() => setCustomMode(null)}
        onDeployed={(app) => router.push(`/logs?appId=${app.id}&mode=build`)}
      />
    </AppShell>
  )
}

// ── Env var editor ────────────────────────────────────────────────────────────
// Reusable key/value rows shared by both custom-deploy modes. A row can be
// flagged secret so its value is masked and persisted as a secret env var.
function EnvVarEditor({
  rows,
  onChange,
}: {
  rows: EnvRow[]
  onChange: (rows: EnvRow[]) => void
}) {
  const update = (i: number, patch: Partial<EnvRow>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    onChange(next)
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground">
          Environment variables
        </Label>
        <button
          type="button"
          onClick={() =>
            onChange([...rows, { key: "", value: "", secret: false }])
          }
          className="flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/85"
        >
          <PlusIcon className="h-3 w-3" />
          Add
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border py-3 text-center text-[11px] text-muted-foreground">
          No environment variables.
        </p>
      ) : (
        <div className="max-h-[160px] space-y-2 overflow-y-auto pr-1">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={row.key}
                onChange={(e) =>
                  update(i, {
                    key: e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9_]/g, ""),
                  })
                }
                placeholder="VARIABLE_NAME"
                className="h-8 flex-1 font-mono text-xs"
              />
              <Input
                type={row.secret ? "password" : "text"}
                value={row.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="value"
                className="h-8 flex-1 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => update(i, { secret: !row.secret })}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  row.secret
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
                title={
                  row.secret
                    ? "Stored as a secret (value hidden)"
                    : "Mark as secret"
                }
              >
                <NucleoIcon name="lock" className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-destructive-foreground hover:bg-destructive/10"
                aria-label="Remove variable"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Custom deploy modal ─────────────────────────────────────────────────────────
// Handles both "Deploy from Docker image" and "Deploy from a Dockerfile". The
// two share the same advanced fields (name, port, env, volumes, domains,
// resource limits); only the primary input and the deploy call differ.
function CustomDeployModal({
  mode,
  serverId,
  onClose,
  onDeployed,
}: {
  mode: "image" | "dockerfile" | null
  serverId: string
  onClose: () => void
  onDeployed: (app: App) => void
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [image, setImage] = useState("")
  const [dockerfile, setDockerfile] = useState("")
  const [port, setPort] = useState("")
  const [healthPath, setHealthPath] = useState("")
  const [domains, setDomains] = useState("")
  const [volumes, setVolumes] = useState("")
  const [memory, setMemory] = useState("")
  const [cpus, setCpus] = useState("")
  const [envRows, setEnvRows] = useState<EnvRow[]>([])
  const [deploying, setDeploying] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const isImage = mode === "image"
  const dockerfileLines = dockerfile ? dockerfile.split("\n").length : 0

  const buildCommon = () => {
    const envVars: Record<string, string> = {}
    const secretKeys: string[] = []
    for (const r of envRows) {
      const k = r.key.trim()
      if (!k) continue
      envVars[k] = r.value
      if (r.secret) secretKeys.push(k)
    }
    return {
      name: name.trim() || undefined,
      envVars,
      secretKeys,
      domains: domains
        .split(/[\n,]/)
        .map((d) => d.trim())
        .filter(Boolean),
      volumes: volumes
        .split(/[\n,]/)
        .map((v) => v.trim())
        .filter(Boolean),
      memory: memory.trim(),
      cpus: cpus.trim(),
      port: port ? parseInt(port, 10) : 0,
      healthPath: healthPath.trim(),
      serverId,
    }
  }

  const handleDeploy = async () => {
    // Name is optional (server derives one), but if given it must be valid.
    const n = name.trim()
    if (n && !/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(n)) {
      setErrorMsg("Name must be 2-40 lowercase letters, digits, or hyphens.")
      return
    }
    if (isImage && !image.trim()) {
      setErrorMsg("Enter a Docker image, e.g. nginx:1.27.")
      return
    }
    if (!isImage && !dockerfile.trim()) {
      setErrorMsg("Paste a Dockerfile to deploy.")
      return
    }
    if (!isImage && !/from\s+/i.test(dockerfile)) {
      setErrorMsg("The Dockerfile must contain a FROM instruction.")
      return
    }

    setDeploying(true)
    setErrorMsg("")
    try {
      const app = isImage
        ? await api.catalog.deployImage({
            ...buildCommon(),
            image: image.trim(),
          })
        : await api.catalog.deployDockerfile({ ...buildCommon(), dockerfile })
      onDeployed(app)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Deployment failed.")
      setDeploying(false)
    }
  }

  return (
    <Dialog
      open={!!mode}
      onOpenChange={(open) => !open && !deploying && onClose()}
    >
      <DialogContent className={isImage ? "max-w-lg" : "max-w-2xl"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {isImage ? (
              <DockerIcon className="h-4 w-4 text-chart-2" />
            ) : (
              <TerminalIcon className="h-4 w-4 text-chart-4" />
            )}
            {isImage ? "Deploy from Docker image" : "Deploy from a Dockerfile"}
          </DialogTitle>
          <DialogDescription>
            {isImage
              ? "Run any public image from Docker Hub or another registry."
              : "Paste a self-contained Dockerfile. We build the image on this server."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 pb-2">
          {errorMsg && (
            <Alert variant="error">
              <NucleoIcon name="triangle-alert" />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Primary input */}
          {isImage ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Docker image
              </Label>
              <Input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="nginx:1.27 or ghcr.io/owner/app:tag"
                className="h-9 font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Public registries only for now. Pin a tag (avoid{" "}
                <code className="font-mono">latest</code>) so redeploys are
                repeatable.
              </p>
            </div>
          ) : (
            <Frame className="w-full">
              <FramePanel className="shrink-0 !py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <FrameTitle className="flex items-center gap-2">
                      <TerminalIcon className="h-3.5 w-3.5 text-chart-4" />
                      Dockerfile
                    </FrameTitle>
                    <FrameDescription className="text-xs sm:text-sm">
                      Self-contained builds only — fetch dependencies inside the
                      Dockerfile.
                    </FrameDescription>
                  </div>
                  {dockerfile && (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => setDockerfile("")}
                      className="h-7 shrink-0 text-xs text-muted-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </FramePanel>

              <FramePanel className="relative overflow-hidden !p-0">
                <Textarea
                  value={dockerfile}
                  onChange={(e) => setDockerfile(e.target.value)}
                  placeholder={
                    'FROM alpine:3.20\nRUN apk add --no-cache caddy\nEXPOSE 80\nCMD ["caddy", "file-server", "--listen", ":80"]'
                  }
                  spellCheck={false}
                  className="min-h-[240px] resize-y rounded-none border-0 bg-code px-4 py-3 font-mono text-xs leading-relaxed text-foreground shadow-none focus-visible:ring-0"
                />
                <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
                  <span className="font-mono">
                    {dockerfileLines > 0
                      ? `${dockerfileLines} line${dockerfileLines === 1 ? "" : "s"}`
                      : "No content"}
                  </span>
                  <span>
                    {/from\s+/i.test(dockerfile)
                      ? "FROM detected"
                      : "Needs a FROM instruction"}
                  </span>
                </div>
              </FramePanel>

              <FrameFooter className="!py-3">
                <div className="flex gap-2 text-[11px] leading-snug text-muted-foreground">
                  <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <span>
                    There&apos;s no build context, so{" "}
                    <code className="font-mono">COPY</code> /{" "}
                    <code className="font-mono">ADD</code> of local files
                    won&apos;t work. Use packages or{" "}
                    <code className="font-mono">ADD https://…</code> instead.
                    Need local files?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        router.push("/deploy")
                      }}
                      className="cursor-pointer text-primary underline-offset-2 hover:underline"
                    >
                      Deploy from Git
                    </button>
                    .
                  </span>
                </div>
              </FrameFooter>
            </Frame>
          )}

          <Frame className="w-full">
            <FramePanel className="shrink-0 !py-3">
              <FrameTitle>Deploy settings</FrameTitle>
              <FrameDescription className="text-xs sm:text-sm">
                Optional overrides for the container runtime.
              </FrameDescription>
            </FramePanel>

            <FramePanel className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              App name (optional)
            </Label>
            <Input
              value={name}
              onChange={(e) =>
                setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              placeholder={
                isImage ? "Derived from the image if left blank" : "my-app"
              }
              className="h-9 text-sm"
            />
          </div>

          {/* Port + health path */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Container port
              </Label>
              <Input
                value={port}
                onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 80"
                className="h-9 font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Health path
              </Label>
              <Input
                value={healthPath}
                onChange={(e) => setHealthPath(e.target.value)}
                placeholder="/ (optional)"
                className="h-9 font-mono text-sm"
              />
            </div>
          </div>

          {/* Env vars */}
          <EnvVarEditor rows={envRows} onChange={setEnvRows} />

          {/* Advanced */}
          <div className="space-y-3 rounded-lg border border-border bg-muted/15 p-3">
            <p className="text-xs font-semibold text-foreground">
              Advanced (optional)
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Persistent volumes
              </Label>
              <Input
                value={volumes}
                onChange={(e) => setVolumes(e.target.value)}
                placeholder="my-data:/data, /host/path:/container/path"
                className="h-8 font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Comma- or newline-separated. Named volumes survive redeploys.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Custom domains
              </Label>
              <Input
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                placeholder="app.example.com"
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Memory
                </Label>
                <Input
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  placeholder="512m"
                  className="h-8 font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  CPUs
                </Label>
                <Input
                  value={cpus}
                  onChange={(e) => setCpus(e.target.value)}
                  placeholder="0.5"
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>
          </div>
            </FramePanel>
          </Frame>
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={deploying}>
                Cancel
              </Button>
            }
          />
          <Button
            onClick={handleDeploy}
            loading={deploying}
            className="gap-1.5"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {isImage ? "Pull & deploy" : "Build & deploy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
