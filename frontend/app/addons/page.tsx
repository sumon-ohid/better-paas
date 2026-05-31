"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
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
import { AppShell, useToast } from "@/components/app-shell"
import { api } from "@/lib/api"
import type { Addon, App } from "@/lib/types"
import { NucleoIcon } from "@/components/nucleo-icons"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const DatabaseIcon = (props: IconProps) => <NucleoIcon {...props} name="server" />
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const LinkIcon = (props: IconProps) => <NucleoIcon {...props} name="link" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const CopyIcon = (props: IconProps) => <NucleoIcon {...props} name="copy" />
const LockIcon = (props: IconProps) => <NucleoIcon {...props} name="lock" />
const ChevronIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-down" />
const InfoIcon = (props: IconProps) => <NucleoIcon {...props} name="info" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />

// Per-type metadata so the UI can explain exactly what each database gives an app.
const TYPE_META: Record<
  string,
  { label: string; short: string; primaryVar: string; blurb: string }
> = {
  postgres: {
    label: "PostgreSQL 16",
    short: "Postgres",
    primaryVar: "DATABASE_URL",
    blurb: "Your app reads DATABASE_URL (plus PGHOST, PGUSER, PGPASSWORD…).",
  },
  mysql: {
    label: "MySQL 8",
    short: "MySQL",
    primaryVar: "DATABASE_URL",
    blurb: "Your app reads DATABASE_URL (plus MYSQL_HOST, MYSQL_USER…).",
  },
  redis: {
    label: "Redis 7",
    short: "Redis",
    primaryVar: "REDIS_URL",
    blurb: "Your app reads REDIS_URL (plus REDIS_HOST, REDIS_PASSWORD…).",
  },
}

const ADDON_TYPES = Object.entries(TYPE_META).map(([id, m]) => ({ id, label: m.label }))

// Internal ports each database listens on (for the type reference card).
const TYPE_PORTS: Record<string, number> = {
  postgres: 5432,
  mysql: 3306,
  redis: 6379,
}

function typeMeta(type: string) {
  return TYPE_META[type] ?? { label: type, short: type, primaryVar: "", blurb: "" }
}

// Friendly status presentation.
function statusBadge(status: string): { variant: "success" | "warning" | "destructive"; label: string } {
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
      {copied ? <CheckIcon className="h-3 w-3 text-success" /> : <CopyIcon className="h-3 w-3" />}
    </button>
  )
}

export default function AddonsPage() {
  const { showToast } = useToast()
  const [addons, setAddons] = useState<Addon[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState("postgres")
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)

  // Attach dialog state
  const [attachAddon, setAttachAddon] = useState<Addon | null>(null)
  const [attachAppId, setAttachAppId] = useState("")
  const [redeployAfter, setRedeployAfter] = useState(true)
  const [attaching, setAttaching] = useState(false)

  // Delete dialog state
  const [deleteAddon, setDeleteAddon] = useState<Addon | null>(null)
  const [deleteVolume, setDeleteVolume] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Detach dialog state
  const [detachTarget, setDetachTarget] = useState<{ addon: Addon; app: App } | null>(null)
  const [detachRedeploy, setDetachRedeploy] = useState(true)
  const [detaching, setDetaching] = useState(false)

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
    [apps],
  )

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast("Name required", "Give your database a name.", "destructive")
      return
    }
    setCreating(true)
    try {
      await api.addons.create(type, name.trim())
      showToast("Provisioning", `Your ${typeMeta(type).short} database is starting.`, "success")
      setName("")
      await load()
    } catch (err) {
      showToast("Create failed", err instanceof Error ? err.message : "Error", "destructive")
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
        showToast("Attached & redeploying", "Connection variables added. The app is redeploying now.", "success")
      } else {
        showToast("Attached", "Connection variables added. Redeploy the app to apply them.", "success")
      }
      setAttachAddon(null)
      await load()
    } catch (err) {
      showToast("Attach failed", err instanceof Error ? err.message : "Could not attach.", "destructive")
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
        showToast("Detached & redeploying", "Connection variables removed. The app is redeploying now.", "success")
      } else {
        showToast("Detached", "Connection variables removed. Redeploy the app to apply.", "success")
      }
      setDetachTarget(null)
      await load()
    } catch (err) {
      showToast("Detach failed", err instanceof Error ? err.message : "Could not detach.", "destructive")
    } finally {
      setDetaching(false)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <DatabaseIcon className="h-6 w-6" />
          </div>
          <div>
            <h2>Managed Databases</h2>
            <p className="text-sm text-muted-foreground">
              One-click Postgres, Redis, and MySQL for your apps — no connection setup required.
            </p>
          </div>
        </div>

        {/* Two-column layout: actions on the left, reference rail on the right. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Main column */}
          <div className="min-w-0 space-y-6">
            {/* Create */}
            <Card>
              <CardHeader className="border-b border-border/40">
                <CardTitle className="text-base">Create a database</CardTitle>
                <CardDescription>{typeMeta(type).blurb}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3 pt-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Type</Label>
                  <Select value={type} onValueChange={(v) => v && setType(v)}>
                    <SelectTrigger className="w-44">
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
                <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="my-database"
                    className="h-9 text-sm sm:h-8"
                  />
                </div>
                <Button onClick={handleCreate} loading={creating} className="gap-1.5">
                  <PlusIcon className="h-3.5 w-3.5" />
                  Create
                </Button>
              </CardContent>
            </Card>

            {/* List */}
            <Card>
              <CardHeader className="border-b border-border/40">
                <CardTitle className="flex items-center gap-2 text-base">
                  Your databases
                  <button onClick={load} className="text-muted-foreground hover:text-foreground" aria-label="Refresh">
                    <RefreshIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {addons.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border py-10 text-center">
                    <DatabaseIcon className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No databases yet</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Create one above, then attach it to an app to start using it.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addons.map((addon) => {
                      const meta = typeMeta(addon.type)
                      const sb = statusBadge(addon.status)
                      const attached = attachedAppsFor(addon)
                      const envEntries = Object.entries(addon.connEnv || {})
                      return (
                        <div key={addon.id} className="space-y-3 rounded-lg border border-border bg-card/40 p-3.5">
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/50">
                                <DatabaseIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-foreground">{addon.name}</span>
                                  <Badge variant="info" size="sm">{meta.short}</Badge>
                                  <Badge variant={sb.variant} size="sm">{sb.label}</Badge>
                                </div>
                                <p className="truncate font-mono text-[11px] text-muted-foreground">
                                  host: {addon.containerName}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Button variant="outline" onClick={() => openAttach(addon)} className="h-8 gap-1.5">
                                <LinkIcon className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Attach to app</span>
                                <span className="sm:hidden">Attach</span>
                              </Button>
                              <Button
                                variant="destructive-outline"
                                onClick={() => openDelete(addon)}
                                className="h-8"
                                aria-label="Delete database"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Attachment status */}
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            {attached.length > 0 ? (
                              <>
                                <span className="text-muted-foreground">Used by</span>
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
                                Not attached to any app yet — attach one to start using it.
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
                                    These are injected into any app you attach. Secret values are hidden here and
                                    stored securely.
                                  </p>
                                  {envEntries.map(([k, v]) => {
                                    const isSecret = v === "***"
                                    return (
                                      <div key={k} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-foreground/90">{k}</span>
                                          <CopyButton value={k} label="variable name" />
                                        </div>
                                        {isSecret ? (
                                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                                            <LockIcon className="h-3 w-3" />
                                            hidden
                                          </span>
                                        ) : (
                                          <span className="max-w-[260px] select-all truncate text-muted-foreground">{v}</span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right rail: informative, secondary reference content. Stacks below
              the main column on small screens, so nothing important is hidden. */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {/* How it works */}
            <Card className="border-primary/20 bg-primary/3">
              <CardContent className="p-4">
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
                        <p className="text-xs font-semibold leading-tight">{step.title}</p>
                        <p className="text-[11px] leading-snug text-muted-foreground">{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* Good to know */}
            <Card>
              <CardContent className="space-y-2.5 p-4 text-[11px] leading-snug text-muted-foreground">
                <p className="text-sm font-semibold text-foreground">Good to know</p>
                <p>
                  Databases live on a private network and aren&apos;t exposed to the internet — only your
                  attached apps can reach them.
                </p>
                <p>
                  Deleting a database keeps its stored data unless you opt in to erase the volume.
                </p>
                <p>
                  One database can be attached to multiple apps. They&apos;ll all share the same connection.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {/* Attach dialog */}
      <Dialog open={!!attachAddon} onOpenChange={(open) => !open && setAttachAddon(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Attach “{attachAddon?.name}” to an app</DialogTitle>
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
              <Label className="text-xs font-semibold text-muted-foreground">App</Label>
              <Select value={attachAppId} onValueChange={(v) => setAttachAppId(v || "")}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select an app…" />
                </SelectTrigger>
                <SelectPopup alignItemWithTrigger={false}>
                  {apps.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No apps deployed yet.</div>
                  ) : (
                    apps.map((app) => {
                      const already = (attachAddon?.attachedApps || []).includes(app.id)
                      return (
                        <SelectItem key={app.id} value={app.id} disabled={already}>
                          <span className="flex w-full items-center justify-between gap-2">
                            {app.name}
                            {already && (
                              <span className="text-[11px] text-muted-foreground">already attached</span>
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
                <span className="block text-sm font-medium">Redeploy the app now</span>
                <span className="block text-xs text-muted-foreground">
                  Recommended. Variables only apply on the next deploy. Leave unchecked to redeploy later
                  yourself.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button onClick={handleAttachConfirm} loading={attaching} className="gap-1.5">
              <LinkIcon className="h-3.5 w-3.5" />
              {redeployAfter ? "Attach & redeploy" : "Attach"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteAddon} onOpenChange={(open) => !open && setDeleteAddon(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:mx-0">
              <TrashIcon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Delete “{deleteAddon?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the database container. Apps already attached keep their connection variables but
              will fail to connect until you attach a new database and redeploy.
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
                  Permanently erases the data volume. This cannot be undone. Leave unchecked to keep the data
                  for later.
                </span>
              </span>
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button variant="destructive" onClick={handleDeleteConfirm} loading={deleting} className="gap-1.5">
              <TrashIcon className="h-3.5 w-3.5" />
              {deleteVolume ? "Delete database & data" : "Delete database"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detach confirm */}
      <AlertDialog open={!!detachTarget} onOpenChange={(open) => !open && setDetachTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-warning/10 text-warning sm:mx-0">
              <LinkIcon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>
              Detach “{detachTarget?.addon.name}” from “{detachTarget?.app.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the database&apos;s connection variables from the app. The app will lose access to
              this database once redeployed. The database itself and its data are not affected.
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
                <span className="block text-sm font-medium">Redeploy the app now</span>
                <span className="block text-xs text-muted-foreground">
                  Recommended, so the change takes effect immediately. Leave unchecked to redeploy later
                  yourself.
                </span>
              </span>
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button onClick={handleDetachConfirm} loading={detaching} className="gap-1.5">
              {detachRedeploy ? "Detach & redeploy" : "Detach"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
