"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { AppShell, useToast } from "@/components/app-shell"
import { api } from "@/lib/api"
import type { Addon, App } from "@/lib/types"
import { NucleoIcon } from "@/components/nucleo-icons"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const DatabaseIcon = (props: IconProps) => <NucleoIcon {...props} name="server" />
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const LinkIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />

const ADDON_TYPES = [
  { id: "postgres", label: "PostgreSQL 16" },
  { id: "redis", label: "Redis 7" },
  { id: "mysql", label: "MySQL 8" },
]

export default function AddonsPage() {
  const { showToast } = useToast()
  const [addons, setAddons] = useState<Addon[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState("postgres")
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)
  const [attachTarget, setAttachTarget] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const [a, ap] = await Promise.all([api.addons.list(), api.apps.list()])
      setAddons(a || [])
      setApps(ap || [])
    } catch {
      showToast("Failed to load", "Could not fetch add-ons.", "destructive")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast("Name required", "Give your database a name.", "destructive")
      return
    }
    setCreating(true)
    try {
      await api.addons.create(type, name.trim())
      showToast("Provisioning", `${type} container is starting.`, "success")
      setName("")
      await load()
    } catch (err) {
      showToast("Create failed", err instanceof Error ? err.message : "Error", "destructive")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (addon: Addon) => {
    if (!confirm(`Delete ${addon.name}? This removes the container. Its data volume is kept unless you confirm again.`)) return
    const deleteData = confirm("Also delete the persistent data volume? This is irreversible.")
    try {
      await api.addons.delete(addon.id, deleteData)
      showToast("Deleted", `${addon.name} removed.`, "success")
      await load()
    } catch {
      showToast("Delete failed", "Could not delete add-on.", "destructive")
    }
  }

  const handleAttach = async (addon: Addon) => {
    const appId = attachTarget[addon.id]
    if (!appId) {
      showToast("Pick an app", "Select an app to attach to.", "destructive")
      return
    }
    try {
      await api.addons.attach(addon.id, appId)
      showToast("Attached", "Connection vars added. Redeploy the app to apply.", "success")
    } catch {
      showToast("Attach failed", "Could not attach add-on.", "destructive")
    }
  }

  return (
    <AppShell>
      <div className="max-w-4xl space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <DatabaseIcon className="h-4 w-4" />
          </div>
          <div>
            <h1>Managed Databases</h1>
            <p className="text-sm text-muted-foreground">
              One-click Postgres, Redis, and MySQL. Attach to apps to inject connection vars.
            </p>
          </div>
        </div>

        {/* Create */}
        <Card>
          <CardHeader className="border-b border-border/40">
            <CardTitle className="text-base">Provision a database</CardTitle>
            <CardDescription>Runs as a Docker container with a persistent volume on a shared network.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3 pt-4">
            <div className="space-y-1 flex flex-col">
              <Label className="text-xs mb-2 font-semibold text-muted-foreground">Type</Label>
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
            <div className="space-y-1 flex-1 min-w-[180px]">
              <Label className="text-xs mb-2 font-semibold text-muted-foreground">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="my-database"
                className="text-sm"
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
              Provisioned databases
              <button onClick={load} className="text-muted-foreground hover:text-foreground">
                <RefreshIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {addons.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                No databases yet.
              </div>
            ) : (
              <div className="space-y-3">
                {addons.map((addon) => (
                  <div key={addon.id} className="rounded-lg border border-border bg-card/40 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center">
                          <DatabaseIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{addon.name}</span>
                            <Badge variant="info" size="sm">{addon.type}</Badge>
                            <Badge
                              variant={addon.status === "running" ? "success" : addon.status === "failed" ? "destructive" : "warning"}
                              size="sm"
                            >
                              {addon.status}
                            </Badge>
                          </div>
                          <p className="font-mono text-[11px] text-muted-foreground">{addon.containerName}</p>
                        </div>
                      </div>
                      <Button
                        variant="destructive-outline"
                        onClick={() => handleDelete(addon)}
                        className="h-8 gap-1.5"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>

                    {/* Connection env vars */}
                    {addon.connEnv && Object.keys(addon.connEnv).length > 0 && (
                      <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-1 font-mono text-[11px]">
                        {Object.entries(addon.connEnv).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2 text-muted-foreground">
                            <span className="text-foreground/90 font-semibold">{k}</span>
                            <span className="truncate max-w-[260px] select-all">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Attach to app */}
                    <div className="flex items-end gap-2">
                      <div className="space-y-1 flex-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Attach to app</Label>
                        <Select
                          value={attachTarget[addon.id] || ""}
                          onValueChange={(v) => setAttachTarget((prev) => ({ ...prev, [addon.id]: v || "" }))}
                        >
                          <SelectTrigger className="h-8 w-full text-sm">
                            <SelectValue placeholder="Select app..." />
                          </SelectTrigger>
                          <SelectPopup alignItemWithTrigger={false}>
                            {apps.map((app) => (
                              <SelectItem key={app.id} value={app.id}>
                                {app.name}
                              </SelectItem>
                            ))}
                          </SelectPopup>
                        </Select>
                      </div>
                      <Button variant="outline" onClick={() => handleAttach(addon)} className="h-8 gap-1.5">
                        <LinkIcon className="h-3.5 w-3.5" />
                        Attach
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
