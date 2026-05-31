"use client"

import React, { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { api } from "@/lib/api"
import type { CatalogTemplate, CatalogEnv } from "@/lib/types"
import { NucleoIcon } from "@/components/nucleo-icons"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const SearchIcon = (props: IconProps) => <NucleoIcon {...props} name="search" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const ExternalIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const InfoIcon = (props: IconProps) => <NucleoIcon {...props} name="info" />
const StoreIcon = (props: IconProps) => <NucleoIcon {...props} name="layers" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />

// Logos come from the community dashboard-icons CDN. Only the slug is stored
// server-side; we build the URL here.
function iconUrl(slug: string): string {
  return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${slug}.svg`
}

// AppLogo renders the template's logo, falling back to its initial if the image
// fails to load (so a missing icon never leaves a broken-image box).
function AppLogo({ template, className }: { template: CatalogTemplate; className?: string }) {
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

  const load = useCallback(async () => {
    try {
      const data = await api.catalog.list()
      setTemplates(data || [])
    } catch {
      showToast("Failed to load", "Could not fetch the app catalog.", "destructive")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
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

  const handleDeploy = async () => {
    if (!selected) return
    const name = deployName.trim()
    if (!/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(name)) {
      setErrorMsg("Name must be 2-40 lowercase letters, digits, or hyphens.")
      return
    }
    // Require non-empty for required env vars that aren't auto-generated.
    for (const e of selected.env || []) {
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
      <div className="mx-auto max-w-6xl space-y-6 p-3 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <StoreIcon className="h-6 w-6" />
          </div>
          <div>
            <h2>App Catalog</h2>
            <p className="text-sm text-muted-foreground">
              Deploy popular open-source apps in a few clicks. Each runs as a single container with its
              own storage.
            </p>
          </div>
        </div>

        {/* Search + category filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search apps..."
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
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
          <div className="py-16 text-center text-sm text-muted-foreground">
            <RefreshIcon className="mx-auto mb-2 h-5 w-5 animate-spin opacity-50" />
            Loading catalog...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center">
            <StoreIcon className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm font-medium">No apps match your search</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Try a different term or category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((tpl) => (
              <Card
                key={tpl.id}
                className="group flex flex-col transition-colors hover:border-primary/30"
              >
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-card p-1.5">
                      <AppLogo template={tpl} className="h-full w-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-foreground">{tpl.name}</h3>
                      </div>
                      <Badge variant="info" size="sm" className="mt-0.5">
                        {tpl.category}
                      </Badge>
                    </div>
                  </div>
                  <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {tpl.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant={"secondary"} onClick={() => openDeploy(tpl)} className="h-8 flex-1 gap-1.5 text-xs">
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Deploy dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && !deploying && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              {selected && (
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card p-1">
                  <AppLogo template={selected} className="h-full w-full object-contain" />
                </span>
              )}
              Deploy {selected?.name}
            </DialogTitle>
            <DialogDescription>{selected?.description}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] space-y-4 overflow-y-auto px-6 pb-2">
            {errorMsg && (
              <Alert variant="error">
                <NucleoIcon name="triangle-alert" />
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            {/* App name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">App name</Label>
              <Input
                value={deployName}
                onChange={(e) =>
                  setDeployName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                placeholder="my-app"
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Used for the container name and the app&apos;s default URL.
              </p>
            </div>

            {/* Configurable env vars */}
            {selected && (selected.env?.length ?? 0) > 0 && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs font-semibold text-foreground">Configuration</p>
                {(selected.env || []).map((e: CatalogEnv) => (
                  <div key={e.key} className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 font-mono text-[11px] text-foreground/90">
                      {e.key}
                      {e.required && <span className="text-destructive-foreground">*</span>}
                      {e.secret && <NucleoIcon name="lock" className="h-3 w-3 text-muted-foreground" />}
                    </Label>
                    <Input
                      type={e.secret ? "password" : "text"}
                      value={envValues[e.key] ?? ""}
                      onChange={(ev) => setEnvValues((prev) => ({ ...prev, [e.key]: ev.target.value }))}
                      placeholder={e.generate ? "Leave blank to auto-generate" : e.value || ""}
                      className="h-8 font-mono text-xs"
                    />
                    {e.description && (
                      <p className="text-[11px] leading-snug text-muted-foreground">{e.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Notes / caveats */}
            {selected?.notes && (
              <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-[11px] leading-snug text-muted-foreground">
                <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>{selected.notes}</span>
              </div>
            )}

            {/* Runtime summary */}
            {selected && (
              <div className="space-y-1 rounded-lg border border-border bg-card/40 p-3 text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span>Image</span>
                  <span className="select-all truncate font-mono text-foreground/80">{selected.image}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Internal port</span>
                  <span className="font-mono text-foreground/80">{selected.port}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Storage</span>
                  <span className="font-mono text-foreground/80">
                    {selected.volumePath ? "Persistent volume" : "Stateless"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={deploying}>Cancel</Button>} />
            <Button onClick={handleDeploy} loading={deploying} className="gap-1.5">
              <PlusIcon className="h-3.5 w-3.5" />
              Deploy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
