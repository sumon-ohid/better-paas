"use client"

import React, { useEffect, useState, useCallback } from "react"
import { AppLink } from "@/dashboard/components/app-link"
import { Button } from "@/dashboard/components/ui/button"
import { Input } from "@/dashboard/components/ui/input"
import {
  Frame,
  FramePanel,
  FrameTitle,
  FrameDescription,
  FrameFooter,
} from "@/dashboard/components/ui/frame"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/dashboard/components/ui/table"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
} from "@/dashboard/components/ui/alert-dialog"
import { NucleoIcon } from "@/dashboard/components/nucleo-icons"
import { useToast } from "@/dashboard/components/app-shell"
import { api, ApiError } from "@/dashboard/lib/api"
import type { App } from "@/dashboard/lib/types"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />
const CloudIcon = (props: IconProps) => <NucleoIcon {...props} name="cloud" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const CopyIcon = (props: IconProps) => <NucleoIcon {...props} name="copy" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const ExternalIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const InfoIcon = (props: IconProps) => <NucleoIcon {...props} name="info" />

interface AppDomainsProps {
  app: App
  onChange: (app: App) => void
}

export function AppDomains({ app, onChange }: AppDomainsProps) {
  const { showToast } = useToast()
  const domains = app.domains ?? []

  const [newDomain, setNewDomain] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [dnsBusy, setDnsBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [serverIp, setServerIp] = useState<string>("")
  const [cfConnected, setCfConnected] = useState(false)

  const loadMeta = useCallback(() => {
    api.server
      .info()
      .then((info) => setServerIp(info.publicIp))
      .catch(() => {})
    api.cloudflare
      .status()
      .then((s) => setCfConnected(s.connected))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadMeta()
  }, [loadMeta])

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
  }

  const handleAdd = async () => {
    const domain = newDomain.trim().toLowerCase().replace(/\.$/, "")
    if (!domain) return
    setIsAdding(true)
    try {
      const updated = await api.apps.addDomain(app.id, domain)
      onChange(updated)
      setNewDomain("")
      showToast("Domain added", `${domain} is now routed to ${app.name}.`, "success")
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to add domain."
      showToast("Could not add domain", msg, "destructive")
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemove = async (domain: string) => {
    setRemoving(domain)
    try {
      const updated = await api.apps.removeDomain(app.id, domain)
      onChange(updated)
      showToast("Domain removed", `${domain} is no longer routed here.`)
      setRemoveTarget(null)
    } catch {
      showToast("Error", "Failed to remove domain.", "destructive")
    } finally {
      setRemoving(null)
    }
  }

  const handleCloudflareDns = async (domain: string) => {
    setDnsBusy(domain)
    try {
      const res = await api.cloudflare.addDns(domain)
      showToast(
        res.status === "updated" ? "DNS record updated" : "DNS record created",
        `${res.domain} → ${res.ip} (zone ${res.zone}). HTTPS provisions automatically within a minute.`,
        "success",
      )
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to create DNS record."
      showToast("Cloudflare error", msg, "destructive")
    } finally {
      setDnsBusy(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="animate-in fade-in-50 mx-auto max-w-6xl space-y-4 duration-200">
        <Frame className="w-full">
          {/* Header + Add */}
          <FramePanel>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <FrameTitle>Custom Domains</FrameTitle>
                <FrameDescription>
                  Point your own hostname at this app. HTTPS certificates are
                  issued automatically once DNS resolves here.
                </FrameDescription>
              </div>
              <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                <Input
                  value={newDomain}
                  onChange={(e) =>
                    setNewDomain(e.target.value.replace(/\s/g, ""))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isAdding) handleAdd()
                  }}
                  placeholder="app.example.com"
                  className="h-8 text-sm font-mono sm:w-64"
                />
                <Button
                  onClick={handleAdd}
                  disabled={isAdding || !newDomain.trim()}
                  size="default"
                  className="h-9 gap-1.5 text-xs"
                >
                  {isAdding ? (
                    <RefreshIcon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PlusIcon className="h-3.5 w-3.5" />
                  )}
                  Add
                </Button>
              </div>
            </div>
          </FramePanel>

          {/* Domain list */}
          {domains.length === 0 ? (
            <FramePanel className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <GlobeIcon className="h-6 w-6 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No custom domains yet.
              </p>
              <p className="text-xs text-muted-foreground/60">
                Add one above to serve this app from your own hostname.
              </p>
            </FramePanel>
          ) : (
            <Table variant="card">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[55%]">Domain</TableHead>
                  <TableHead className="w-[25%]">Status</TableHead>
                  <TableHead className="w-[20%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => (
                  <TableRow key={domain}>
                    <TableCell>
                      <a
                        href={`https://${domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 truncate font-mono text-sm font-medium text-foreground transition-colors hover:text-primary"
                        title={`Open https://${domain}`}
                      >
                        <GlobeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{domain}</span>
                        <ExternalIcon className="h-3 w-3 shrink-0 opacity-50" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-success" />
                        HTTPS active
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        {cfConnected && (
                          <Button
                            onClick={() => handleCloudflareDns(domain)}
                            disabled={dnsBusy === domain}
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 border-[#f6821f]/40 text-xs text-[#f6821f] hover:bg-[#f6821f]/10 hover:text-[#f6821f]"
                            title="Create the A record on Cloudflare automatically"
                          >
                            {dnsBusy === domain ? (
                              <RefreshIcon className="h-3 w-3 animate-spin" />
                            ) : (
                              <CloudIcon className="h-3 w-3" />
                            )}
                            DNS
                          </Button>
                        )}
                        <Button
                          onClick={() => setRemoveTarget(domain)}
                          disabled={removing === domain}
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                          title="Remove domain"
                        >
                          {removing === domain ? (
                            <RefreshIcon className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <TrashIcon className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Footer: DNS target */}
          <FrameFooter>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <InfoIcon className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Point an{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono font-semibold">
                    A
                  </code>{" "}
                  record to this server&apos;s public IP
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1">
                  <span className="font-mono text-xs text-foreground">
                    {serverIp || "detecting…"}
                  </span>
                  {serverIp && (
                    <button
                      onClick={() => copy(serverIp, "ip")}
                      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Copy IP"
                    >
                      {copied === "ip" ? (
                        <CheckIcon className="h-3 w-3 text-success" />
                      ) : (
                        <CopyIcon className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
                {!cfConnected && (
                  <span className="text-[11px] text-muted-foreground">
                    <AppLink
                      href="/settings"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Connect Cloudflare
                    </AppLink>{" "}
                    for 1-click DNS
                  </span>
                )}
              </div>
            </div>
          </FrameFooter>
        </Frame>
      </div>

      {/* Remove domain confirmation */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 sm:mx-0">
              <TrashIcon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Remove domain</AlertDialogTitle>
            <AlertDialogDescription>
              Stop routing{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                {removeTarget}
              </code>{" "}
              to {app.name}? The app stays online on its other domains. You can
              re-add it anytime, but its TLS certificate will need to be
              re-issued.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button variant="outline">Cancel</Button>}
            />
            <Button
              variant="destructive"
              onClick={() => removeTarget && handleRemove(removeTarget)}
              disabled={!!removing}
              className="gap-1.5"
            >
              {removing ? (
                <RefreshIcon className="h-4 w-4 animate-spin" />
              ) : (
                <TrashIcon className="h-4 w-4" />
              )}
              {removing ? "Removing…" : "Remove domain"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
