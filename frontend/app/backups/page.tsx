"use client"

import React, { useEffect, useState, useCallback } from "react"
import {
  Frame,
  FramePanel,
  FrameTitle,
  FrameDescription,
  FrameFooter,
} from "@/components/ui/frame"
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
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const DownloadIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const InfoIcon = (props: IconProps) => <NucleoIcon {...props} name="info" />
const ClockIcon = (props: IconProps) => <NucleoIcon {...props} name="activity" />
const CloudIcon = (props: IconProps) => <NucleoIcon {...props} name="cloud" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const RestoreIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />

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
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

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
    // Both loaders are async; setState runs after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleRestoreConfirm = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    try {
      await api.backups.restore(restoreTarget)
      showToast(
        "Restore started",
        "A safety backup was taken first. Services are restarting — reload the dashboard in a minute.",
        "success",
      )
      setRestoreTarget(null)
    } catch (err) {
      showToast("Restore failed", err instanceof Error ? err.message : "Error", "destructive")
    } finally {
      setRestoring(false)
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
      <div className="animate-in fade-in-50 mx-auto max-w-6xl space-y-6 p-4 duration-200 md:p-6">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">Backups</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Snapshot the control-plane data directory (database, tokens, logs).
          </p>
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
            <Frame className="w-full">
              <FramePanel className="shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <FrameTitle>Snapshots</FrameTitle>
                    <FrameDescription className="text-xs sm:text-sm">
                      {backups.length === 0
                        ? "No backups recorded yet."
                        : `${backups.length} snapshot${backups.length !== 1 ? "s" : ""} stored · keeping the latest ${cfg.retention}`}
                    </FrameDescription>
                  </div>
                  <Button
                    onClick={handleCreate}
                    loading={creating}
                    size="sm"
                    className="h-7 shrink-0 gap-1.5 text-xs"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Create backup</span>
                    <span className="sm:hidden">Create</span>
                  </Button>
                </div>
              </FramePanel>

              <FramePanel>
                <label className="flex cursor-pointer items-center justify-between gap-3">
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
              </FramePanel>

              {backups.length === 0 ? (
                <FramePanel className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <CloudIcon className="h-6 w-6 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-foreground">No backups yet</p>
                  <p className="text-xs text-muted-foreground">
                    Create one above — it only takes a moment.
                  </p>
                </FramePanel>
              ) : (
                <FramePanel className="!p-0">
                  <div className="divide-y divide-border/50">
                    {backups.map((b) => (
                      <div
                        key={b.name}
                        className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm text-foreground">{b.name}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {formatSize(b.sizeBytes)} · {new Date(b.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handleDownload(b.name)}
                            className="h-8 gap-1.5 max-sm:flex-1"
                          >
                            <DownloadIcon className="h-3.5 w-3.5" />
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setRestoreTarget(b.name)}
                            className="h-8 gap-1.5 max-sm:flex-1"
                          >
                            <RestoreIcon className="h-3.5 w-3.5" />
                            Restore
                          </Button>
                          <Button
                            variant="destructive-outline"
                            onClick={() => setDeleteTarget(b.name)}
                            className="h-8 w-8 p-0"
                            aria-label="Delete backup"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </FramePanel>
              )}
            </Frame>

            {/* Backup settings: schedule + offsite storage, saved together */}
            <Frame className="w-full">
              {/* Automatic backups */}
              <FramePanel className="space-y-4">
                <div>
                  <FrameTitle className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                    Automatic backups
                  </FrameTitle>
                  <FrameDescription className="text-xs sm:text-sm">
                    Take a snapshot on a schedule, without you having to remember.
                  </FrameDescription>
                </div>
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
              </FramePanel>

              {/* Offsite storage (S3/R2) */}
              <FramePanel className="space-y-4">
                <div>
                  <FrameTitle className="flex flex-wrap items-center gap-2">
                    <CloudIcon className="h-4 w-4 text-muted-foreground" />
                    Offsite storage
                    {cfg.s3SecretKeySet && (
                      <Badge variant="success" size="sm" className="ml-1 gap-1">
                        <CheckIcon className="h-3 w-3" />
                        Configured
                      </Badge>
                    )}
                  </FrameTitle>
                  <FrameDescription className="text-xs sm:text-sm">
                    Upload each backup to an S3-compatible bucket (AWS S3, Cloudflare R2, MinIO).
                  </FrameDescription>
                </div>
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
              </FramePanel>

              <FrameFooter>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Applies to scheduled and manual backups.
                  </p>
                  <Button onClick={handleSaveConfig} loading={savingCfg} size="sm">
                    Save settings
                  </Button>
                </div>
              </FrameFooter>
            </Frame>
          </div>

          {/* Right rail */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Frame className="w-full">
              <FramePanel className="space-y-2.5 text-[11px] leading-snug text-muted-foreground">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <InfoIcon className="h-4 w-4 text-primary" />
                  About backups
                </div>
                <p>Each backup is a gzipped archive of the data directory: the database, encryption key, tokens, and logs.</p>
                <p>With &ldquo;include database contents&rdquo; on, managed databases are also dumped (Postgres/MySQL via logical dump, Redis as an RDB snapshot) under <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">databases/</code>.</p>
                <p>Local snapshots are pruned to the &ldquo;keep latest&rdquo; count. Offsite uploads are not pruned automatically.</p>
                <p>
                  Use <span className="font-medium text-foreground">Restore</span> to roll back the control plane to a snapshot.
                  A fresh safety backup is taken first; your previous <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">data/</code> folder
                  is kept as <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">data.pre-restore-…</code> on disk.
                </p>
              </FramePanel>

              <FramePanel>
                <p className="mb-2 text-sm font-semibold">Cloudflare R2</p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Set the endpoint to{" "}
                  <code className="break-all rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                    https://&lt;account&gt;.r2.cloudflarestorage.com
                  </code>{" "}
                  and region to <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">auto</code>.
                  Use an R2 API token&apos;s Access Key ID and Secret.
                </p>
              </FramePanel>

              <FramePanel>
                <p className="mb-2 text-sm font-semibold">AWS S3</p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Leave the endpoint blank and set the region (e.g.{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">us-east-1</code>). The
                  IAM user needs <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">s3:PutObject</code>{" "}
                  and <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">s3:ListBucket</code>.
                </p>
              </FramePanel>
            </Frame>
          </aside>
        </div>
      </div>

      {/* Restore confirm */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-warning/10 text-warning sm:mx-0">
              <RestoreIcon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Better-PaaS will take a new safety backup first, then replace the current{" "}
              <span className="font-mono text-foreground">data/</span> directory with{" "}
              {restoreTarget ? (
                <span className="font-mono text-foreground">{restoreTarget}</span>
              ) : (
                "this snapshot"
              )}
              . Services restart briefly; deployed app containers are not removed, but the dashboard
              will show whatever apps and settings were in the snapshot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button onClick={handleRestoreConfirm} loading={restoring} className="gap-1.5">
              <RestoreIcon className="h-3.5 w-3.5" />
              Restore backup
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
