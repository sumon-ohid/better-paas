"use client"

import React, { useEffect, useState, useCallback } from "react"
import {
  Frame,
  FramePanel,
  FrameTitle,
  FrameDescription,
  FrameFooter,
} from "@/dashboard/components/ui/frame"
import { Button } from "@/dashboard/components/ui/button"
import { Input } from "@/dashboard/components/ui/input"
import { Label } from "@/dashboard/components/ui/label"
import { Badge } from "@/dashboard/components/ui/badge"
import { Checkbox } from "@/dashboard/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/dashboard/components/ui/collapsible"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/dashboard/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/dashboard/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
} from "@/dashboard/components/ui/alert-dialog"
import { AppShell, useToast } from "@/dashboard/components/app-shell"
import { api } from "@/dashboard/lib/api"
import type { Addon, App } from "@/dashboard/lib/types"
import { NucleoIcon } from "@/dashboard/components/nucleo-icons"
import { DbExplorer } from "@/dashboard/components/db-explorer"
import { useActiveServer } from "@/dashboard/components/server-context"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const DatabaseIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="server" />
)
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const LinkIcon = (props: IconProps) => <NucleoIcon {...props} name="link" />
const RefreshIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="refresh" />
)
const CopyIcon = (props: IconProps) => <NucleoIcon {...props} name="copy" />
const LockIcon = (props: IconProps) => <NucleoIcon {...props} name="lock" />
const ChevronIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="chevron-down" />
)
const InfoIcon = (props: IconProps) => <NucleoIcon {...props} name="info" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const ExploreIcon = (props: IconProps) => <NucleoIcon {...props} name="grid" />

// Per-type metadata so the UI can explain exactly what each database gives an app.
const TYPE_META: Record<
  string,
  {
    label: string
    short: string
    primaryVar: string
    blurb: string
    accent: string
  }
> = {
  postgres: {
    label: "PostgreSQL 16",
    short: "Postgres",
    primaryVar: "DATABASE_URL",
    blurb: "Your app reads DATABASE_URL (plus PGHOST, PGUSER, PGPASSWORD…).",
    accent: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  mysql: {
    label: "MySQL 8",
    short: "MySQL",
    primaryVar: "DATABASE_URL",
    blurb: "Your app reads DATABASE_URL (plus MYSQL_HOST, MYSQL_USER…).",
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  redis: {
    label: "Redis 7",
    short: "Redis",
    primaryVar: "REDIS_URL",
    blurb: "Your app reads REDIS_URL (plus REDIS_HOST, REDIS_PASSWORD…).",
    accent: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
}

const ADDON_TYPES = Object.entries(TYPE_META).map(([id, m]) => ({
  id,
  label: m.label,
}))

function typeMeta(type: string) {
  return (
    TYPE_META[type] ?? {
      label: type,
      short: type,
      primaryVar: "",
      blurb: "",
      accent: "bg-muted/50 text-muted-foreground",
    }
  )
}

function isComposeBackedAddon(addon: Addon) {
  return addon.id.startsWith("compose-paas-")
}

// Friendly status presentation.
function statusBadge(status: string): {
  variant: "success" | "warning" | "destructive"
  label: string
} {
  switch (status) {
    case "running":
      return { variant: "success", label: "Running" }
    case "failed":
      return { variant: "destructive", label: "Failed" }
    case "building":
      return { variant: "warning", label: "Starting…" }
    case "stopped":
      return { variant: "warning", label: "Stopped" }
    default:
      return { variant: "warning", label: status }
  }
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        } catch {
          showToast("Copy failed", "Clipboard is not available.", "destructive")
        }
      }}
      className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={`Copy ${label ?? "value"}`}
    >
      {copied ? (
        <CheckIcon className="h-3 w-3 text-success" />
      ) : (
        <CopyIcon className="h-3 w-3" />
      )}
    </button>
  )
}

export default function AddonsPage() {
  const { showToast } = useToast()
  const { activeServerId, servers } = useActiveServer()
  const [addons, setAddons] = useState<Addon[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState("postgres")
  const [name, setName] = useState("")
  const [targetServer, setTargetServer] = useState("localhost")
  const [creating, setCreating] = useState(false)
  const targetServerLabel =
    targetServer === "localhost"
      ? "Localhost"
      : (servers.find((server) => server.id === targetServer)?.name ??
        "Remote server")

  const [prevActiveServerId, setPrevActiveServerId] = useState(activeServerId)
  if (activeServerId !== prevActiveServerId) {
    setPrevActiveServerId(activeServerId)
    setTargetServer(activeServerId === "all" || activeServerId === "localhost" ? "localhost" : activeServerId)
  }

  // Attach dialog state
  const [attachAddon, setAttachAddon] = useState<Addon | null>(null)
  const [attachAppId, setAttachAppId] = useState("")
  const selectedAttachApp = apps.find((app) => app.id === attachAppId)
  const [redeployAfter, setRedeployAfter] = useState(true)
  const [attaching, setAttaching] = useState(false)

  // Delete dialog state
  const [deleteAddon, setDeleteAddon] = useState<Addon | null>(null)
  const [deleteVolume, setDeleteVolume] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Detach dialog state
  const [detachTarget, setDetachTarget] = useState<{
    addon: Addon
    app: App
  } | null>(null)
  const [detachRedeploy, setDetachRedeploy] = useState(true)
  const [detaching, setDetaching] = useState(false)

  // Database explorer state
  const [exploreAddon, setExploreAddon] = useState<Addon | null>(null)

  const load = useCallback(async () => {
    try {
      const [a, ap] = await Promise.all([api.addons.list(), api.apps.list()])
      setAddons(a || [])
      setApps(ap || [])
    } catch {
      showToast("Failed to load", "Could not fetch databases.", "destructive")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    // load is async; setState runs after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  // Which apps is a given add-on attached to? Tracked explicitly on the
  // backend (addon.attachedApps holds app IDs), resolved to live apps here so
  // deleted apps drop off automatically.
  const attachedAppsFor = useCallback(
    (addon: Addon): App[] => {
      const ids = new Set(addon.attachedApps || [])
      return apps.filter((app) => ids.has(app.id))
    },
    [apps]
  )

  const filteredAddons = React.useMemo(() => {
    return addons.filter((addon) => {
      const addonServerId = addon.serverId || "localhost"
      const targetServerId =
        activeServerId === "all"
          ? "all"
          : activeServerId === "localhost"
            ? "localhost"
            : activeServerId
      return targetServerId === "all" || addonServerId === targetServerId
    })
  }, [addons, activeServerId])

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast("Name required", "Give your database a name.", "destructive")
      return
    }
    setCreating(true)
    try {
      await api.addons.create(type, name.trim(), targetServer)
      showToast(
        "Provisioning",
        `Your ${typeMeta(type).short} database is starting on ${targetServerLabel}.`,
        "success"
      )
      setName("")
      await load()
    } catch (err) {
      showToast(
        "Create failed",
        err instanceof Error ? err.message : "Error",
        "destructive"
      )
    } finally {
      setCreating(false)
    }
  }

  const openAttach = (addon: Addon) => {
    setAttachAddon(addon)
    setAttachAppId("")
    setRedeployAfter(true)
  }

  const handleAttachConfirm = async () => {
    if (!attachAddon) return
    if (!attachAppId) {
      showToast("Pick an app", "Select an app to attach to.", "destructive")
      return
    }
    setAttaching(true)
    try {
      await api.addons.attach(attachAddon.id, attachAppId)
      if (redeployAfter) {
        await api.apps.redeploy(attachAppId)
        showToast(
          "Attached & redeploying",
          "Connection variables added. The app is redeploying now.",
          "success"
        )
      } else {
        showToast(
          "Attached",
          "Connection variables added. Redeploy the app to apply them.",
          "success"
        )
      }
      setAttachAddon(null)
      await load()
    } catch (err) {
      showToast(
        "Attach failed",
        err instanceof Error ? err.message : "Could not attach.",
        "destructive"
      )
    } finally {
      setAttaching(false)
    }
  }

  const openDelete = (addon: Addon) => {
    setDeleteAddon(addon)
    setDeleteVolume(false)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteAddon) return
    setDeleting(true)
    try {
      await api.addons.delete(deleteAddon.id, deleteVolume)
      showToast("Deleted", `${deleteAddon.name} removed.`, "success")
      setDeleteAddon(null)
      await load()
    } catch {
      showToast("Delete failed", "Could not delete database.", "destructive")
    } finally {
      setDeleting(false)
    }
  }

  const handleDetachConfirm = async () => {
    if (!detachTarget) return
    setDetaching(true)
    try {
      await api.addons.detach(detachTarget.addon.id, detachTarget.app.id)
      if (detachRedeploy) {
        await api.apps.redeploy(detachTarget.app.id)
        showToast(
          "Detached & redeploying",
          "Connection variables removed. The app is redeploying now.",
          "success"
        )
      } else {
        showToast(
          "Detached",
          "Connection variables removed. Redeploy the app to apply.",
          "success"
        )
      }
      setDetachTarget(null)
      await load()
    } catch (err) {
      showToast(
        "Detach failed",
        err instanceof Error ? err.message : "Could not detach.",
        "destructive"
      )
    } finally {
      setDetaching(false)
    }
  }

  return (
    <AppShell>
      <div className="animate-in fade-in-50 mx-auto max-w-6xl space-y-6 p-4 duration-200 md:p-6">
        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Managed Databases
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            One-click Postgres, Redis, and MySQL for your apps — no connection
            setup required.
          </p>
        </div>

        {/* Two-column layout: actions on the left, reference rail on the right. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Main column */}
          <div className="min-w-0 space-y-6">
            {/* Create */}
            <Frame className="w-full">
              <FramePanel>
                <FrameTitle>Create a database</FrameTitle>
                <FrameDescription className="text-xs sm:text-sm">
                  {typeMeta(type).blurb}
                </FrameDescription>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1.5 max-sm:w-full">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Type
                    </Label>
                    <Select value={type} onValueChange={(v) => v && setType(v)}>
                      <SelectTrigger className="w-44 max-sm:w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectPopup alignItemWithTrigger={false}>
                        {ADDON_TYPES.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5 max-sm:w-full">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Target Server
                    </Label>
                    <Select
                      value={targetServer}
                      onValueChange={(v) => v && setTargetServer(v)}
                      disabled={activeServerId !== "all"}
                    >
                      <SelectTrigger className="w-44 max-sm:w-full">
                        <span className="truncate">{targetServerLabel}</span>
                      </SelectTrigger>
                      <SelectPopup alignItemWithTrigger={false}>
                        <SelectItem value="localhost">Localhost</SelectItem>
                        {servers
                          .filter((s) => s.id !== "localhost")
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                      </SelectPopup>
                    </Select>
                  </div>
                  <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Name
                    </Label>
                    <Input
                      value={name}
                      onChange={(e) =>
                        setName(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, "")
                        )
                      }
                      placeholder="my-database"
                      className="h-9 text-sm sm:h-8"
                    />
                  </div>
                  <Button
                    onClick={handleCreate}
                    loading={creating}
                    className="gap-1.5 max-sm:w-full"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Create
                  </Button>
                </div>
              </FramePanel>
              <FrameFooter>
                <div className="flex gap-1.5 text-xs text-muted-foreground">
                  <InfoIcon className="mt-0.5 size-3 shrink-0" />
                  <p>
                    Databases are created on the selected server and can attach
                    to apps on the same server.
                  </p>
                </div>
              </FrameFooter>
            </Frame>

            {/* List */}
            <Frame className="w-full">
              <FramePanel className="shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <FrameTitle>Your databases</FrameTitle>
                    <FrameDescription className="text-xs sm:text-sm">
                      {loading
                        ? "Loading databases…"
                        : filteredAddons.length === 0
                          ? "No databases provisioned yet."
                          : `${filteredAddons.length} database${filteredAddons.length !== 1 ? "s" : ""} provisioned`}
                    </FrameDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={load}
                    className="h-7 shrink-0 gap-1.5 text-xs"
                  >
                    <RefreshIcon
                      className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                    />
                    <span className="hidden sm:inline">Refresh</span>
                  </Button>
                </div>
              </FramePanel>

              {filteredAddons.length === 0 ? (
                <FramePanel className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <DatabaseIcon className="h-6 w-6 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-foreground">
                    No databases yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Create one above, then attach it to an app to start using
                    it.
                  </p>
                </FramePanel>
              ) : (
                filteredAddons.map((addon) => {
                  const meta = typeMeta(addon.type)
                  const sb = statusBadge(addon.status)
                  const attached = attachedAppsFor(addon)
                  const envEntries = Object.entries(addon.connEnv || {})
                  const composeBacked = isComposeBackedAddon(addon)
                  return (
                    <FramePanel key={addon.id} className="space-y-3">
                      {/* Top row */}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.accent}`}
                          >
                            <DatabaseIcon className="h-4 w-4" />
                          </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-foreground">
                                    {addon.name}
                                  </span>
                                  <Badge variant="info" size="sm">
                                    {meta.short}
                                  </Badge>
                                  <Badge variant={sb.variant} size="sm">
                                    {sb.label}
                                  </Badge>
                                  {composeBacked && (
                                    <Badge variant="secondary" size="sm">
                                      Compose
                                    </Badge>
                                  )}
                                </div>
                                <p className="truncate font-mono text-[11px] text-muted-foreground">
                                  host: {addon.containerName}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 max-sm:w-full">
                              <Button
                                variant="outline"
                                onClick={() => setExploreAddon(addon)}
                                disabled={addon.status !== "running"}
                                className="h-8 gap-1.5 max-sm:flex-1"
                                title={
                                  addon.status === "running"
                                    ? "Browse tables and run queries"
                                    : "Database must be running to explore"
                                }
                              >
                                <ExploreIcon className="h-3.5 w-3.5" />
                                Explore
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => openAttach(addon)}
                                className="h-8 gap-1.5 max-sm:flex-1"
                              >
                                <LinkIcon className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">
                                  Attach to app
                                </span>
                                <span className="sm:hidden">Attach</span>
                              </Button>
                              <Button
                                variant="destructive-outline"
                                onClick={() => openDelete(addon)}
                                disabled={composeBacked}
                                className="h-8"
                                aria-label={composeBacked ? "Managed by compose project" : "Delete database"}
                                title={
                                  composeBacked
                                    ? "This database is managed by its Compose project."
                                    : "Delete database"
                                }
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Attachment status */}
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            {attached.length > 0 ? (
                              <>
                                <span className="text-muted-foreground">
                                  Used by
                                </span>
                                {attached.map((app) => (
                                  <button
                                    key={app.id}
                                    type="button"
                                    onClick={() => {
                                      setDetachTarget({ addon, app })
                                      setDetachRedeploy(true)
                                    }}
                                    className="group inline-flex items-center gap-1 rounded-sm border border-input bg-background px-1.5 py-0.5 font-medium text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive-foreground"
                                    title={`Detach from ${app.name}`}
                                  >
                                    {app.name}
                                    <NucleoIcon
                                      name="x"
                                      className="h-3 w-3 opacity-50 group-hover:opacity-100"
                                    />
                                  </button>
                                ))}
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                                Not attached to any app yet — attach one to
                                start using it.
                              </span>
                            )}
                          </div>

                          {/* Connection variables (collapsible) */}
                          {envEntries.length > 0 && (
                            <Collapsible>
                              <CollapsibleTrigger className="group flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                                <ChevronIcon className="h-3.5 w-3.5 transition-transform group-data-panel-open:rotate-180" />
                                Connection variables ({envEntries.length})
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="mt-2 space-y-1.5 rounded-md border border-border bg-muted/20 p-2.5">
                                  <p className="mb-1 text-[11px] text-muted-foreground">
                                    These are injected into any app you attach.
                                    Secret values are hidden here and stored
                                    securely.
                                  </p>
                                  {envEntries.map(([k, v]) => {
                                    const isSecret = v === "***"
                                    return (
                                      <div
                                        key={k}
                                        className="flex items-center justify-between gap-2 font-mono text-[11px]"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-foreground/90">
                                            {k}
                                          </span>
                                          <CopyButton
                                            value={k}
                                            label="variable name"
                                          />
                                        </div>
                                        {isSecret ? (
                                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                                            <LockIcon className="h-3 w-3" />
                                            hidden
                                          </span>
                                        ) : (
                                          <span className="max-w-[260px] truncate text-muted-foreground select-all">
                                            {v}
                                          </span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                    </FramePanel>
                  )
                })
              )}
            </Frame>
          </div>

          {/* Right rail: informative, secondary reference content. Stacks below
              the main column on small screens, so nothing important is hidden. */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Frame className="w-full">
              {/* How it works */}
              <FramePanel>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <InfoIcon className="h-4 w-4 text-primary" />
                  How it works
                </div>
                <ol className="space-y-3">
                  {[
                    {
                      n: 1,
                      title: "Create a database",
                      body: "Runs as a private container with its own storage.",
                    },
                    {
                      n: 2,
                      title: "Attach it to an app",
                      body: "Injects the connection variables into that app.",
                    },
                    {
                      n: 3,
                      title: "Redeploy the app",
                      body: "Variables apply on the next deploy. We can do it for you.",
                    },
                  ].map((step) => (
                    <li key={step.n} className="flex gap-2.5">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        {step.n}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs leading-tight font-semibold">
                          {step.title}
                        </p>
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </FramePanel>

              {/* Good to know */}
              <FramePanel className="space-y-2.5 text-[11px] leading-snug text-muted-foreground">
                <p className="text-sm font-semibold text-foreground">
                  Good to know
                </p>
                <p>
                  Databases live on a private network and aren&apos;t exposed to
                  the internet — only your attached apps can reach them.
                </p>
                <p>
                  Deleting a database keeps its stored data unless you opt in to
                  erase the volume.
                </p>
                <p>
                  One database can be attached to multiple apps. They&apos;ll
                  all share the same connection.
                </p>
              </FramePanel>
            </Frame>
          </aside>
        </div>
      </div>

      {/* Attach dialog */}
      <Dialog
        open={!!attachAddon}
        onOpenChange={(open) => !open && setAttachAddon(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Attach “{attachAddon?.name}” to an app
            </DialogTitle>
            <DialogDescription>
              This adds the database&apos;s connection variables (like{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
                {typeMeta(attachAddon?.type || "").primaryVar}
              </code>
              ) to the app you choose.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                App
              </Label>
              <Select
                value={attachAppId}
                onValueChange={(v) => setAttachAppId(v || "")}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select an app…">
                    {selectedAttachApp ? selectedAttachApp.name : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup alignItemWithTrigger={false}>
                  {apps.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No apps deployed yet.
                    </div>
                  ) : (
                    apps.map((app) => {
                      const already = (
                        attachAddon?.attachedApps || []
                      ).includes(app.id)
                      const appServerId = app.serverId || "localhost"
                      const addonServerId = attachAddon?.serverId || "localhost"
                      if (appServerId !== addonServerId) return null
                      return (
                        <SelectItem
                          key={app.id}
                          value={app.id}
                          disabled={already}
                        >
                          <span className="flex w-full items-center justify-between gap-2">
                            {app.name}
                            {already && (
                              <span className="text-[11px] text-muted-foreground">
                                already attached
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      )
                    })
                  )}
                </SelectPopup>
              </Select>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-3">
              <Checkbox
                checked={redeployAfter}
                onCheckedChange={(c) => setRedeployAfter(c === true)}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">
                  Redeploy the app now
                </span>
                <span className="block text-xs text-muted-foreground">
                  Recommended. Variables only apply on the next deploy. Leave
                  unchecked to redeploy later yourself.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              onClick={handleAttachConfirm}
              loading={attaching}
              className="gap-1.5"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              {redeployAfter ? "Attach & redeploy" : "Attach"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteAddon}
        onOpenChange={(open) => !open && setDeleteAddon(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:mx-0">
              <TrashIcon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Delete “{deleteAddon?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the database container. Apps already attached keep
              their connection variables but will fail to connect until you
              attach a new database and redeploy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/4 p-3">
              <Checkbox
                checked={deleteVolume}
                onCheckedChange={(c) => setDeleteVolume(c === true)}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium text-destructive-foreground">
                  Also delete the stored data
                </span>
                <span className="block text-xs text-muted-foreground">
                  Permanently erases the data volume. This cannot be undone.
                  Leave unchecked to keep the data for later.
                </span>
              </span>
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button variant="outline">Cancel</Button>}
            />
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              loading={deleting}
              className="gap-1.5"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              {deleteVolume ? "Delete database & data" : "Delete database"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detach confirm */}
      <AlertDialog
        open={!!detachTarget}
        onOpenChange={(open) => !open && setDetachTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-warning/10 text-warning sm:mx-0">
              <LinkIcon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>
              Detach {detachTarget?.addon.name} from {detachTarget?.app.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the database&apos;s connection variables from the
              app. The app will lose access to this database once redeployed.
              The database itself and its data are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-3">
              <Checkbox
                checked={detachRedeploy}
                onCheckedChange={(c) => setDetachRedeploy(c === true)}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">
                  Redeploy the app now
                </span>
                <span className="block text-xs text-muted-foreground">
                  Recommended, so the change takes effect immediately. Leave
                  unchecked to redeploy later yourself.
                </span>
              </span>
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button variant="outline">Cancel</Button>}
            />
            <Button
              onClick={handleDetachConfirm}
              loading={detaching}
              className="gap-1.5"
            >
              {detachRedeploy ? "Detach & redeploy" : "Detach"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Database explorer (full-screen studio) */}
      {exploreAddon && (
        <DbExplorer
          addon={exploreAddon}
          onClose={() => setExploreAddon(null)}
        />
      )}
    </AppShell>
  )
}
