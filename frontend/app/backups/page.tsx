"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AppShell, useToast } from "@/components/app-shell"
import { api } from "@/lib/api"
import { getToken } from "@/lib/auth"
import type { BackupInfo } from "@/lib/types"
import { NucleoIcon } from "@/components/nucleo-icons"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const ArchiveIcon = (props: IconProps) => <NucleoIcon {...props} name="folder" />
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const DownloadIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const InfoIcon = (props: IconProps) => <NucleoIcon {...props} name="info" />

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function BackupsPage() {
  const { showToast } = useToast()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      setBackups((await api.backups.list()) || [])
    } catch {
      showToast("Failed to load", "Could not fetch backups.", "destructive")
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    setCreating(true)
    try {
      await api.backups.create()
      showToast("Backup created", "A new snapshot of the data directory was saved.", "success")
      await load()
    } catch (err) {
      showToast("Backup failed", err instanceof Error ? err.message : "Error", "destructive")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete backup ${name}?`)) return
    try {
      await api.backups.delete(name)
      await load()
    } catch {
      showToast("Delete failed", "Could not delete backup.", "destructive")
    }
  }

  const handleDownload = (name: string) => {
    // Download with the admin token via a temporary fetch → blob, since the
    // endpoint requires the Authorization header.
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

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
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
            A backup includes the SQLite database and encryption key. Store downloads securely. Set
            <span className="font-mono"> BACKUP_INTERVAL_HOURS</span> to enable automatic backups.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="border-b border-border/40 flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Snapshots</CardTitle>
              <CardDescription>The 10 most recent backups are kept.</CardDescription>
            </div>
            <Button onClick={handleCreate} loading={creating} className="gap-1.5">
              <PlusIcon className="h-3.5 w-3.5" />
              Create backup
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {backups.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                No backups yet.
              </div>
            ) : (
              <div className="space-y-2">
                {backups.map((b) => (
                  <div key={b.name} className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-foreground truncate">{b.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatSize(b.sizeBytes)} · {new Date(b.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" onClick={() => handleDownload(b.name)} className="h-8 gap-1.5">
                        <DownloadIcon className="h-3.5 w-3.5" />
                        Download
                      </Button>
                      <Button variant="destructive-outline" onClick={() => handleDelete(b.name)} className="h-8 w-8 p-0">
                        <TrashIcon className="h-3.5 w-3.5" />
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
