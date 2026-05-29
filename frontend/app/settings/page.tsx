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
import { api } from "@/lib/api"
import { useAuth } from "@/components/auth-gate"
import { NucleoIcon } from "@/components/nucleo-icons"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const SettingsIcon = (props: IconProps) => <NucleoIcon {...props} name="settings" />
const InfoIcon = (props: IconProps) => <NucleoIcon {...props} name="info" />
const AlertTriangleIcon = (props: IconProps) => <NucleoIcon {...props} name="triangle-alert" />
const LockIcon = (props: IconProps) => <NucleoIcon {...props} name="lock" />

export default function SettingsPage() {
  const { showToast } = useToast()
  const { signOut } = useAuth()
  const [pruning, setPruning] = useState(false)
  const [pruneOutput, setPruneOutput] = useState("")
  const [showPruneModal, setShowPruneModal] = useState(false)
  const [restartPolicy, setRestartPolicy] = useState("unless-stopped")

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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <SettingsIcon className="h-4 w-4" />
          </div>
          <div>
            <h1>Node Settings</h1>
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
              <Label className="text-xs font-semibold text-muted-foreground">
                Proxy Timeout Limit
              </Label>
              <Input defaultValue="30s" disabled className="max-w-xs text-sm" />
              <p className="text-xs text-muted-foreground/60">
                Maximum time Caddy reverse proxy will wait for a backend response.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Builder Concurrency Limit
              </Label>
              <Input defaultValue="2" disabled className="max-w-xs text-sm" />
              <p className="text-xs text-muted-foreground/60">
                Number of parallel Nixpacks builds allowed simultaneously.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
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
            <CardTitle className="text-base">About Antigravity</CardTitle>
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
