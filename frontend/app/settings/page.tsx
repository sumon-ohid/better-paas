"use client"

import React, { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
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
import { useAuth } from "@/components/auth-gate"
import { NucleoIcon } from "@/components/nucleo-icons"
import { Eye, EyeOff } from "lucide-react"
import type { NotificationConfig } from "@/lib/types"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const SettingsIcon = (props: IconProps) => <NucleoIcon {...props} name="settings" />
const InfoIcon = (props: IconProps) => <NucleoIcon {...props} name="info" />
const AlertTriangleIcon = (props: IconProps) => <NucleoIcon {...props} name="triangle-alert" />
const LockIcon = (props: IconProps) => <NucleoIcon {...props} name="lock" />
const BellIcon = (props: IconProps) => <NucleoIcon {...props} name="activity" />
const CloudIcon = (props: IconProps) => <NucleoIcon {...props} name="cloud" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />

export default function SettingsPage() {
  const { showToast } = useToast()
  const { signOut } = useAuth()
  const [pruning, setPruning] = useState(false)
  const [pruneOutput, setPruneOutput] = useState("")
  const [showPruneModal, setShowPruneModal] = useState(false)
  const [restartPolicy, setRestartPolicy] = useState("unless-stopped")

  // Notifications
  const [notif, setNotif] = useState<NotificationConfig>({
    slackWebhookUrl: "",
    genericUrl: "",
    onSuccess: true,
    onFailure: true,
  })
  const [savingNotif, setSavingNotif] = useState(false)

  // Cloudflare DNS integration
  const [cfConnected, setCfConnected] = useState(false)
  const [cfToken, setCfToken] = useState("")
  const [cfShowToken, setCfShowToken] = useState(false)
  const [cfSaving, setCfSaving] = useState(false)
  const [cfError, setCfError] = useState("")

  React.useEffect(() => {
    api.notifications
      .get()
      .then(setNotif)
      .catch(() => {})
    api.cloudflare
      .status()
      .then((s) => setCfConnected(s.connected))
      .catch(() => {})
  }, [])

  const handleSaveCloudflare = async () => {
    if (!cfToken.trim()) {
      setCfError("Please enter an API token")
      return
    }
    setCfSaving(true)
    setCfError("")
    try {
      await api.cloudflare.saveToken(cfToken.trim())
      setCfConnected(true)
      setCfToken("")
      showToast("Cloudflare connected", "DNS records can now be added from a domain.", "success")
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to save token."
      setCfError(msg)
    } finally {
      setCfSaving(false)
    }
  }

  const handleDisconnectCloudflare = async () => {
    try {
      await api.cloudflare.deleteToken()
      setCfConnected(false)
      showToast("Cloudflare disconnected", "The stored API token was removed.")
    } catch {
      showToast("Error", "Failed to disconnect Cloudflare.", "destructive")
    }
  }

  const handleSaveNotif = async () => {
    setSavingNotif(true)
    try {
      await api.notifications.save(notif)
      showToast("Saved", "Notification settings updated.", "success")
    } catch {
      showToast("Save failed", "Could not save notification settings.", "destructive")
    } finally {
      setSavingNotif(false)
    }
  }

  const handleTestNotif = async () => {
    try {
      await api.notifications.test()
      showToast("Test sent", "Check your Slack/webhook endpoint.", "success")
    } catch {
      showToast("Test failed", "Could not send test notification.", "destructive")
    }
  }

  const handlePrune = async () => {
    setPruning(true)
    setPruneOutput("")
    try {
      showToast("Pruning Docker...", "Removing stopped containers, unused images and volumes.")
      const result = await api.system.prune()
      setPruneOutput(result.output)
      showToast("Prune complete", "Docker system prune finished successfully.", "success")
    } catch (err) {
      showToast("Prune failed", "An error occurred during Docker system prune.", "destructive")
      console.error(err)
    } finally {
      setPruning(false)
    }
  }

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <SettingsIcon className="h-6 w-6" />
          </div>
          <div>
            <h2>Node Settings</h2>
            <p className="text-sm text-muted-foreground">
              Configure the worker node environment and maintenance tools.
            </p>
          </div>
        </div>

        {/* Node Configuration */}
        <Card>
          <CardHeader className="border-b border-border/40">
            <CardTitle className="flex items-center gap-2 text-base">
              <SettingsIcon className="h-4 w-4 text-muted-foreground" />
              Node Configuration
              <Badge variant="info" size="sm" className="ml-1">
                Preview
              </Badge>
            </CardTitle>
            <CardDescription>
              System configuration for the local worker daemon environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Alert variant="info">
              <InfoIcon />
              <AlertTitle>Read-only for now</AlertTitle>
              <AlertDescription>
                Editing node configuration from the dashboard isn&apos;t wired up yet. These values
                reflect the current daemon defaults.
              </AlertDescription>
            </Alert>

            <div className="space-y-1.5">
              <Label className="text-xs mr-4 font-semibold text-muted-foreground">
                Proxy Timeout Limit
              </Label>
              <Input defaultValue="30s" disabled className="max-w-xs text-sm" />
              <p className="text-xs text-muted-foreground/60">
                Maximum time Caddy reverse proxy will wait for a backend response.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs mr-4 font-semibold text-muted-foreground">
                Builder Concurrency Limit
              </Label>
              <Input defaultValue="2" disabled className="max-w-xs text-sm" />
              <p className="text-xs text-muted-foreground/60">
                Number of parallel Nixpacks builds allowed simultaneously.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs mr-4 font-semibold text-muted-foreground">
                Container Restart Policy
              </Label>
              <Select value={restartPolicy} onValueChange={(v) => v && setRestartPolicy(v)} disabled>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Select restart policy" />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="unless-stopped">unless-stopped</SelectItem>
                  <SelectItem value="always">always</SelectItem>
                  <SelectItem value="on-failure">on-failure</SelectItem>
                  <SelectItem value="no">no</SelectItem>
                </SelectPopup>
              </Select>
            </div>
            <div className="pt-2">
              <Button disabled>Save configuration</Button>
            </div>
          </CardContent>
        </Card>

        {/* Docker Maintenance */}
        <Card>
          <CardHeader className="border-b border-border/40">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrashIcon className="h-4 w-4 text-muted-foreground" />
              Docker Maintenance
            </CardTitle>
            <CardDescription>
              Remove unused Docker containers, images, volumes, and build cache.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Alert variant="warning">
              <AlertTriangleIcon />
              <AlertTitle>This action cannot be undone</AlertTitle>
              <AlertDescription>
                Docker system prune removes all stopped containers, dangling images, and unused
                networks. Active running containers are not affected.
              </AlertDescription>
            </Alert>

            <Button
              variant="destructive-outline"
              onClick={() => setShowPruneModal(true)}
              loading={pruning}
              className="gap-2"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              {pruning ? "Pruning..." : "Run Docker system prune"}
            </Button>

            {pruneOutput && (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border/40 bg-code p-3 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                {pruneOutput}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deploy Notifications */}
        <Card>
          <CardHeader className="border-b border-border/40">
            <CardTitle className="flex items-center gap-2 text-base">
              <BellIcon className="h-4 w-4 text-muted-foreground" />
              Deploy Notifications
            </CardTitle>
            <CardDescription>
              Get notified on Slack or a custom webhook when deployments succeed or fail.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Slack Incoming Webhook URL</Label>
              <Input
                value={notif.slackWebhookUrl}
                onChange={(e) => setNotif((n) => ({ ...n, slackWebhookUrl: e.target.value }))}
                placeholder="https://hooks.slack.com/services/..."
                className="text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Generic Webhook URL (JSON POST)</Label>
              <Input
                value={notif.genericUrl}
                onChange={(e) => setNotif((n) => ({ ...n, genericUrl: e.target.value }))}
                placeholder="https://example.com/hooks/deploy"
                className="text-sm font-mono"
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={notif.onSuccess}
                  onChange={(e) => setNotif((n) => ({ ...n, onSuccess: e.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
                Notify on success
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={notif.onFailure}
                  onChange={(e) => setNotif((n) => ({ ...n, onFailure: e.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
                Notify on failure
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSaveNotif} loading={savingNotif}>
                Save notifications
              </Button>
              <Button variant="outline" onClick={handleTestNotif}>
                Send test
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cloudflare DNS */}
        <Card>
          <CardHeader className="border-b border-border/40">
            <CardTitle className="flex items-center gap-2 text-base">
              <CloudIcon className="h-4 w-4 text-[#f6821f]" />
              Cloudflare DNS
              {cfConnected && (
                <Badge variant="success" size="sm" className="ml-1 gap-1">
                  <CheckIcon className="h-3 w-3" />
                  Connected
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Connect a Cloudflare API token to create DNS records for custom domains with one
              click from the app&apos;s Domains tab.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {cfConnected ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <GlobeIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>
                    A token is stored on this server. Open any app&apos;s{" "}
                    <span className="font-medium text-foreground">Domains</span> tab and use{" "}
                    <span className="font-medium text-foreground">Add DNS</span> to point a hostname
                    here automatically.
                  </span>
                </div>
                <Button variant="outline" onClick={handleDisconnectCloudflare} className="shrink-0">
                  Disconnect
                </Button>
              </div>
            ) : (
              <>
                <Alert variant="info">
                  <InfoIcon />
                  <AlertTitle>Create a scoped token</AlertTitle>
                  <AlertDescription>
                    In Cloudflare, create an API token with{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[11px]">Zone · DNS · Edit</code>{" "}
                    permission for the zones you want to manage. It is stored encrypted and never
                    leaves your server.
                  </AlertDescription>
                </Alert>

                <a
                  href="https://dash.cloudflare.com/profile/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
                >
                  Create a Cloudflare API token
                  <NucleoIcon name="external" className="h-3 w-3 opacity-60" />
                </a>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">API Token</Label>
                  <div className="relative">
                    <Input
                      type={cfShowToken ? "text" : "password"}
                      value={cfToken}
                      onChange={(e) => {
                        setCfToken(e.target.value)
                        setCfError("")
                      }}
                      placeholder="Cloudflare API token"
                      className="pr-10 font-mono text-sm"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setCfShowToken((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={cfShowToken ? "Hide token" : "Show token"}
                    >
                      {cfShowToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {cfError && <p className="text-[11px] text-destructive-foreground">{cfError}</p>}
                </div>

                <Button onClick={handleSaveCloudflare} loading={cfSaving} className="gap-1.5">
                  <CloudIcon className="h-3.5 w-3.5" />
                  {cfSaving ? "Verifying..." : "Connect Cloudflare"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Session */}
        <Card>
          <CardHeader className="border-b border-border/40">
            <CardTitle className="flex items-center gap-2 text-base">
              <LockIcon className="h-4 w-4 text-muted-foreground" />
              Session
            </CardTitle>
            <CardDescription>Manage your control-plane session on this device.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              Signing out clears your stored admin token from this browser.
            </p>
            <Button variant="outline" onClick={signOut}>
              Sign out
            </Button>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader className="border-b border-border/40">
            <CardTitle className="text-base">About Better-PaaS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {[
              ["Version", "1.0.0"],
              ["Engine", "Go 1.23 + gorilla/websocket"],
              ["Builder", "Nixpacks"],
              ["Proxy", "Caddy + sslip.io"],
              ["Runtime", "Docker"],
              ["Frontend", "Next.js + base-ui"],
            ].map(([key, val]) => (
              <div
                key={key}
                className="flex items-center justify-between border-b border-border/30 pb-2 text-sm last:border-0"
              >
                <span className="text-muted-foreground">{key}</span>
                <span className="font-mono text-xs text-foreground">{val}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Prune confirm */}
      <AlertDialog open={showPruneModal} onOpenChange={setShowPruneModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-warning/10 text-warning sm:mx-0">
              <AlertTriangleIcon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Prune Docker system?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes all stopped containers, dangling images, unused networks, and
              build cache. Active running containers are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
            <AlertDialogClose
              render={
                <Button variant="destructive" onClick={handlePrune} className="gap-1.5">
                  <TrashIcon className="h-4 w-4" />
                  Confirm prune
                </Button>
              }
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
