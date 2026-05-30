"use client"

import React, { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
} from "@/components/ui/alert-dialog"
import { NucleoIcon } from "@/components/nucleo-icons"
import { useToast } from "@/components/app-shell"
import { api, ApiError } from "@/lib/api"
import type { App } from "@/lib/types"

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
      <div className="max-w-2xl space-y-6 animate-in fade-in-50 duration-200">
        {/* Add domain */}
        <div className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <GlobeIcon className="h-4 w-4 text-muted-foreground" />
              Custom Domains
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Point your own hostname at this app. HTTPS certificates are issued automatically once
              DNS resolves here.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value.replace(/\s/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isAdding) handleAdd()
              }}
              placeholder="app.example.com"
              className="h-9 text-sm font-mono"
            />
            <Button
              onClick={handleAdd}
              disabled={isAdding || !newDomain.trim()}
              className="h-9 shrink-0 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isAdding ? (
                <RefreshIcon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlusIcon className="h-3.5 w-3.5" />
              )}
              Add Domain
            </Button>
          </div>
        </div>

        {/* DNS target hint */}
        <Card className="border-border bg-card/72 backdrop-blur-xl p-4 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            DNS Target
          </span>
          <p className="text-xs text-muted-foreground">
            Create an <code className="rounded bg-muted px-1.5 py-0.5 font-mono font-semibold text-[11px]">A</code>{" "}
            record for each domain pointing at this server&apos;s public IP:
          </p>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
            <span className="font-mono text-sm text-foreground">
              {serverIp || "detecting…"}
            </span>
            {serverIp && (
              <button
                onClick={() => copy(serverIp, "ip")}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
            <p className="flex items-start gap-1.5 pt-1 text-[11px] text-muted-foreground">
              <InfoIcon className="mt-px h-3 w-3 shrink-0" />
              <span>
                Using Cloudflare?{" "}
                <Link
                  href="/settings"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Connect an API token
                </Link>{" "}
                to add DNS records with one click.
              </span>
            </p>
          )}
        </Card>

        {/* Domain list */}
        {domains.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <GlobeIcon className="mx-auto mb-3 h-6 w-6 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No custom domains yet.</p>
            <p className="mt-0.5 text-xs text-muted-foreground/60">
              Add one above to serve this app from your own hostname.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card/72 backdrop-blur-xl divide-y divide-border">
            {domains.map((domain) => (
              <div
                key={domain}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <GlobeIcon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <a
                    href={`https://${domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 truncate font-mono text-sm font-medium text-foreground transition-colors hover:text-primary"
                  >
                    <span className="truncate">{domain}</span>
                    <ExternalIcon className="h-3 w-3 shrink-0 opacity-50" />
                  </a>
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="h-2 w-2 mr-1 rounded-full bg-success" />
                    HTTPS provisioned automatically
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {cfConnected && (
                    <Button
                      onClick={() => handleCloudflareDns(domain)}
                      disabled={dnsBusy === domain}
                      variant="outline"
                      className="h-8 gap-1.5 border-[#f6821f]/40 text-xs text-[#f6821f] hover:bg-[#f6821f]/10 hover:text-[#f6821f]"
                      title="Create the A record on Cloudflare automatically"
                    >
                      {dnsBusy === domain ? (
                        <RefreshIcon className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CloudIcon className="h-3.5 w-3.5" />
                      )}
                      Add DNS
                    </Button>
                  )}

                  <Button
                    onClick={() => setRemoveTarget(domain)}
                    disabled={removing === domain}
                    variant="ghost"
                    className="h-8 w-8 border-0 p-0 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                    title="Remove domain"
                  >
                    {removing === domain ? (
                      <RefreshIcon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <TrashIcon className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
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
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{removeTarget}</code>{" "}
              to {app.name}? The app stays online on its other domains. You can re-add it anytime,
              but its TLS certificate will need to be re-issued.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
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
