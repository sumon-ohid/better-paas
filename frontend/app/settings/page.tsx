"use client"

import React, { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { AppShell, ToastContainer, useToast } from "@/components/app-shell"
import { api } from "@/lib/api"
import { useAuth } from "@/components/auth-gate"
import { NucleoIcon } from "@/components/nucleo-icons"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const SettingsIcon = (props: IconProps) => <NucleoIcon {...props} name="settings" />
const LockIcon = (props: IconProps) => <NucleoIcon {...props} name="lock" />

export default function SettingsPage() {
  const { toasts, showToast, dismissToast } = useToast()
  const { signOut } = useAuth()
  const [pruning, setPruning] = useState(false)
  const [pruneOutput, setPruneOutput] = useState("")
  const [restartPolicy, setRestartPolicy] = useState("unless-stopped")

  const handlePrune = async () => {
    setPruning(true)
    setPruneOutput("")
    try {
      showToast("Pruning Docker...", "Removing stopped containers, unused images and volumes.")
      const result = await api.system.prune()
      setPruneOutput(result.output)
      showToast("Prune Complete", "Docker system prune finished successfully.")
    } catch (err) {
      showToast("Prune Failed", "An error occurred during Docker system prune.", "destructive")
      console.error(err)
    } finally {
      setPruning(false)
    }
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-lg font-bold text-foreground">Node Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure the worker node environment and maintenance tools.
          </p>
        </div>

        {/* Node Configuration */}
        <Card className="border-border bg-card/72">
          <CardHeader className="border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-muted-foreground" />
              Node Configuration
            </CardTitle>
            <CardDescription className="text-xs">
              System configuration for the local worker daemon environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Proxy Timeout Limit
              </Label>
              <Input
                defaultValue="30s"
                className="bg-background border-border ml-2 text-foreground text-sm max-w-xs"
              />
              <p className="text-[11px] text-muted-foreground/60">
                Maximum time Caddy reverse proxy will wait for backend response.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Builder Concurrency Limit
              </Label>
              <Input
                defaultValue="2"
                className="bg-background ml-2 border-border text-foreground text-sm max-w-xs"
              />
              <p className="text-[11px] text-muted-foreground/60">
                Number of parallel Nixpacks builds allowed simultaneously.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground mr-2">
                Container Restart Policy
              </Label>
              <Select value={restartPolicy} onValueChange={(v) => v && setRestartPolicy(v)}>
                <SelectTrigger className="max-w-xs w-full">
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
              <Button className="h-8 cursor-pointer rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Docker Maintenance */}
        <Card className="border-border bg-card/72">
          <CardHeader className="border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrashIcon className="h-4 w-4 text-muted-foreground" />
              Docker Maintenance
            </CardTitle>
            <CardDescription className="text-xs">
              Remove unused Docker containers, images, volumes, and build cache.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="rounded-md border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-400/80">
              ⚠️ <strong>Warning:</strong> Docker system prune removes all stopped containers,
              dangling images, and unused networks. This action cannot be undone.
            </div>

            <Button
              onClick={handlePrune}
              disabled={pruning}
              className="flex items-center gap-2 h-8 cursor-pointer rounded-md border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-medium text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-50"
              variant="ghost"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              {pruning ? "Pruning..." : "Run Docker System Prune"}
            </Button>

            {pruneOutput && (
              <div className="rounded-md bg-[#090a0f] border border-border/30 p-3 font-mono text-xs text-slate-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
                {pruneOutput}
              </div>
            )}
          </CardContent>
        </Card>

        {/* About */}
        <Card className="border-border bg-card/72">
          <CardHeader className="border-b border-border/40">
            <CardTitle className="text-sm font-bold">About Antigravity</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {[
              ["Version", "1.0.0"],
              ["Engine", "Go 1.23 + gorilla/websocket"],
              ["Builder", "Nixpacks"],
              ["Proxy", "Caddy + sslip.io"],
              ["Runtime", "Docker"],
              ["Frontend", "Next.js + shadcn/ui"],
            ].map(([key, val]) => (
              <div
                key={key}
                className="flex items-center justify-between text-sm border-b border-border/30 pb-2 last:border-0"
              >
                <span className="text-muted-foreground">{key}</span>
                <span className="font-mono text-xs text-foreground">{val}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppShell>
  )
}
