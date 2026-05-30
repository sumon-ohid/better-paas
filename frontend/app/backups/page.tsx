"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { api, ApiError } from "@/lib/api"
import { getToken } from "@/lib/auth"
import type { BackupInfo, BackupConfig } from "@/lib/types"
import { NucleoIcon } from "@/components/nucleo-icons"
import { Eye, EyeOff } from "lucide-react"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const ArchiveIcon = (props: IconProps) => <NucleoIcon {...props} name="folder" />
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const DownloadIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const InfoIcon = (props: IconProps) => <NucleoIcon {...props} name="info" />
const ClockIcon = (props: IconProps) => <NucleoIcon {...props} name="activity" />
const CloudIcon = (props: IconProps) => <NucleoIcon {...props} name="cloud" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const DEFAULT_CONFIG: BackupConfig = {
  autoEnabled: false,
  intervalHours: 24,
  retention: 10,
  includeDatabases: true,
  s3Enabled: false,
  s3Endpoint: "",
  s3Region: "",
  s3Bucket: "",
  s3Prefix: "",
  s3AccessKeyId: "",
  s3SecretKey: "",
  s3SecretKeySet: false,
}

export default function BackupsPage() {
  const { showToast } = useToast()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Config (auto backup + offsite storage)
  const [cfg, setCfg] = useState<BackupConfig>(DEFAULT_CONFIG)
  const [savingCfg, setSavingCfg] = useState(false)
  const [testingS3, setTestingS3] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  // Track whether the secret field has been edited, so we only send a new
  // secret when the user actually typed one.
  const [secretDirty, setSecretDirty] = useState(false)

  const loadBackups = useCallback(async () => {
    try {
      setBackups((await api.backups.list()) || [])
    } catch {
      showToast("Failed to load", "Could not fetch backups.", "destructive")
    }
  }, [showToast])

  const loadConfig = useCallback(async () => {
    try {
      const c = await api.backups.getConfig()
      setCfg({ ...DEFAULT_CONFIG, ...c, s3SecretKey: "" })
      setSecretDirty(false)
    } catch {
      /* non-fatal */
    }
  }, [])

  useEffect(() => {
    loadBackups()
    loadConfig()
  }, [loadBackups, loadConfig])

  const set = <K extends keyof BackupConfig>(key: K, value: BackupConfig[K]) =>
    setCfg((prev) => ({ ...prev, [key]: value }))

  // Build the payload, omitting the secret unless the user typed a new one.
  const configPayload = (): BackupConfig => ({
    ...cfg,
    s3SecretKey: secretDirty ? (cfg.s3SecretKey || "") : "",
  })

  const handleCreate = async () => {
    setCreating(true)
    try {
      // Persist config first so the latest "include databases" choice applies
      // to this backup (the backend reads stored config when building it).
      await api.backups.saveConfig(configPayload())
      setSecretDirty(false)
      await api.backups.create()
      const where = cfg.s3Enabled ? " and queued for offsite upload" : ""
      showToast("Backup created", `A new snapshot was saved${where}.`, "success")
      await loadBackups()
    } catch (err) {
      showToast("Backup failed", err instanceof Error ? err.message : "Error", "destructive")
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.backups.delete(deleteTarget)
      showToast("Deleted", "Backup removed.", "success")
      setDeleteTarget(null)
      await loadBackups()
    } catch {
      showToast("Delete failed", "Could not delete backup.", "destructive")
    } finally {
      setDeleting(false)
    }
  }

  const handleDownload = (name: string) => {
    const url = api.backups.downloadUrl(name)
    const token = getToken()
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = name
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .catch(() => showToast("Download failed", "Could not download backup.", "destructive"))
  }

  const handleSaveConfig = async () => {
    setSavingCfg(true)
    try {
      const saved = await api.backups.saveConfig(configPayload())
      setCfg({ ...DEFAULT_CONFIG, ...saved, s3SecretKey: "" })
      setSecretDirty(false)
      showToast("Saved", "Backup settings updated.", "success")
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not save settings."
      showToast("Save failed", msg, "destructive")
    } finally {
      setSavingCfg(false)
    }
  }

  const handleTestS3 = async () => {
    setTestingS3(true)
    try {
      await api.backups.testS3(configPayload())
      showToast("Connection OK", "Reached the bucket with these credentials.", "success")
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not reach the bucket."
      showToast("Connection failed", msg, "destructive")
    } finally {
      setTestingS3(false)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ArchiveIcon className="h-6 w-6" />
          </div>
          <div>
            <h2>Backups</h2>
            <p className="text-sm text-muted-foreground">
              Snapshot the control-plane data directory (database, tokens, logs).
            </p>
          </div>
        </div>

        <Alert variant="warning">
          <InfoIcon />
          <AlertTitle>Backups contain secrets</AlertTitle>
          <AlertDescription>
            A backup includes the SQLite database and encryption key. Store downloads and any offsite
            bucket securely, and restrict who can read them.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Main column */}
          <div className="min-w-0 space-y-6">
            {/* Snapshots */}
            <Card>
              <CardHeader className="flex-row items-center justify-between border-b border-border/40">
                <div>
                  <CardTitle className="text-base">Snapshots</CardTitle>
                  <CardDescription>The {cfg.retention} most recent backups are kept.</CardDescription>
                </div>
                <Button onClick={handleCreate} loading={creating} className="gap-1.5">
                  <PlusIcon className="h-3.5 w-3.5" />
                  Create backup
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">Include database contents</span>
                    <span className="block text-xs text-muted-foreground">
                      Also dump each managed database (Postgres/MySQL/Redis) into the archive, so a restore
                      brings back real data — not empty databases.
                    </span>
                  </span>
                  <Switch
                    checked={cfg.includeDatabases}
                    onCheckedChange={(v) => set("includeDatabases", v === true)}
                  />
                </label>
                {backups.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                    No backups yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {backups.map((b) => (
                      <div key={b.name} className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-3">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm text-foreground">{b.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatSize(b.sizeBytes)} · {new Date(b.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button variant="outline" onClick={() => handleDownload(b.name)} className="h-8 gap-1.5">
                            <DownloadIcon className="h-3.5 w-3.5" />
                            Download
                          </Button>
                          <Button variant="destructive-outline" onClick={() => setDeleteTarget(b.name)} className="h-8 w-8 p-0">
                            <TrashIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Automatic backups */}
            <Card>
              <CardHeader className="border-b border-border/40">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClockIcon className="h-4 w-4 text-muted-foreground" />
                  Automatic backups
                </CardTitle>
                <CardDescription>Take a snapshot on a schedule, without you having to remember.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">Run backups automatically</span>
                    <span className="block text-xs text-muted-foreground">
                      Snapshots are created on the interval below and old ones pruned.
                    </span>
                  </span>
                  <Switch checked={cfg.autoEnabled} onCheckedChange={(v) => set("autoEnabled", v === true)} />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Every (hours)</Label>
                    <Input
                      value={String(cfg.intervalHours)}
                      onChange={(e) => set("intervalHours", Number(e.target.value.replace(/\D/g, "")) || 0)}
                      inputMode="numeric"
                      placeholder="24"
                      className="h-9 text-sm sm:h-8"
                      disabled={!cfg.autoEnabled}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Keep latest (count)</Label>
                    <Input
                      value={String(cfg.retention)}
                      onChange={(e) => set("retention", Number(e.target.value.replace(/\D/g, "")) || 0)}
                      inputMode="numeric"
                      placeholder="10"
                      className="h-9 text-sm sm:h-8"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Offsite storage (S3/R2) */}
            <Card>
              <CardHeader className="border-b border-border/40">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CloudIcon className="h-4 w-4 text-muted-foreground" />
                  Offsite storage
                  {cfg.s3SecretKeySet && (
                    <Badge variant="success" size="sm" className="ml-1 gap-1">
                      <CheckIcon className="h-3 w-3" />
                      Configured
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Upload each backup to an S3-compatible bucket (AWS S3, Cloudflare R2, MinIO).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">Upload backups offsite</span>
                    <span className="block text-xs text-muted-foreground">
                      After each backup, push the archive to your bucket.
                    </span>
                  </span>
                  <Switch checked={cfg.s3Enabled} onCheckedChange={(v) => set("s3Enabled", v === true)} />
                </label>

                <div className={`space-y-4 ${cfg.s3Enabled ? "" : "pointer-events-none opacity-50"}`}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Bucket</Label>
                      <Input
                        value={cfg.s3Bucket}
                        onChange={(e) => set("s3Bucket", e.target.value.trim())}
                        placeholder="my-baas-backups"
                        className="h-9 text-sm sm:h-8 font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Region</Label>
                      <Input
                        value={cfg.s3Region}
                        onChange={(e) => set("s3Region", e.target.value.trim())}
                        placeholder="auto (R2) or us-east-1 (S3)"
                        className="h-9 text-sm sm:h-8 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Endpoint</Label>
                    <Input
                      value={cfg.s3Endpoint}
                      onChange={(e) => set("s3Endpoint", e.target.value.trim())}
                      placeholder="https://<account>.r2.cloudflarestorage.com — leave blank for AWS S3"
                      className="h-9 text-sm sm:h-8 font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Key prefix (optional)</Label>
                    <Input
                      value={cfg.s3Prefix}
                      onChange={(e) => set("s3Prefix", e.target.value.trim())}
                      placeholder="baas/backups"
                      className="h-9 text-sm sm:h-8 font-mono"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Access key ID</Label>
                      <Input
                        value={cfg.s3AccessKeyId}
                        onChange={(e) => set("s3AccessKeyId", e.target.value.trim())}
                        placeholder="AKIA… / R2 token id"
                        className="h-9 text-sm sm:h-8 font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Secret access key</Label>
                      <div className="relative">
                        <Input
                          type={showSecret ? "text" : "password"}
                          value={cfg.s3SecretKey || ""}
                          onChange={(e) => {
                            set("s3SecretKey", e.target.value)
                            setSecretDirty(true)
                          }}
                          placeholder={cfg.s3SecretKeySet ? "•••••••• (stored)" : "secret"}
                          className="h-9 pr-9 text-sm sm:h-8 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret((s) => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showSecret ? "Hide secret" : "Show secret"}
                        >
                          {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {cfg.s3SecretKeySet && !secretDirty && (
                        <span className="text-[11px] text-muted-foreground">
                          A secret is stored. Leave blank to keep it.
                        </span>
                      )}
                    </div>
                  </div>

                  <Button variant="outline" onClick={handleTestS3} loading={testingS3} className="h-8 gap-1.5">
                    <CloudIcon className="h-3.5 w-3.5" />
                    Test connection
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveConfig} loading={savingCfg} className="gap-1.5">
                Save settings
              </Button>
            </div>
          </div>

          {/* Right rail */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card className="border-primary/20 bg-primary/3">
              <CardContent className="space-y-2.5 p-4 text-[11px] leading-snug text-muted-foreground">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <InfoIcon className="h-4 w-4 text-primary" />
                  About backups
                </div>
                <p>Each backup is a gzipped archive of the data directory: the database, encryption key, tokens, and logs.</p>
                <p>With &ldquo;include database contents&rdquo; on, managed databases are also dumped (Postgres/MySQL via logical dump, Redis as an RDB snapshot) under <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">databases/</code>.</p>
                <p>Local snapshots are pruned to the &ldquo;keep latest&rdquo; count. Offsite uploads are not pruned automatically.</p>
                <p>Restoring is manual: stop the server, unpack the archive into <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">data/</code>, and restart.</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="mb-2 text-sm font-semibold">Cloudflare R2</p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Set the endpoint to{" "}
                  <code className="break-all rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                    https://&lt;account&gt;.r2.cloudflarestorage.com
                  </code>{" "}
                  and region to <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">auto</code>.
                  Use an R2 API token&apos;s Access Key ID and Secret.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="mb-2 text-sm font-semibold">AWS S3</p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Leave the endpoint blank and set the region (e.g.{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">us-east-1</code>). The
                  IAM user needs <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">s3:PutObject</code>{" "}
                  and <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">s3:ListBucket</code>.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:mx-0">
              <TrashIcon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Delete backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the local backup
              {deleteTarget ? <> <span className="font-mono text-foreground">{deleteTarget}</span></> : null}.
              If it was uploaded offsite, the copy in your bucket is not affected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button variant="destructive" onClick={handleDeleteConfirm} loading={deleting} className="gap-1.5">
              <TrashIcon className="h-3.5 w-3.5" />
              Delete backup
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
