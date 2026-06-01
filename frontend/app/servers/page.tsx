"use client"

import React, { useState, useEffect, useCallback } from "react"
import { AppShell, useToast } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
} from "@/components/ui/alert-dialog"
import { NucleoIcon } from "@/components/nucleo-icons"
import { api } from "@/lib/api"
import type { Server } from "@/lib/types"

// ── Icon aliases ──────────────────────────────────────────────────────────────
type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const ServerIcon = (props: IconProps) => <NucleoIcon {...props} name="cloud" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const CopyIcon = (props: IconProps) => <NucleoIcon {...props} name="copy" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const KeyIcon = (props: IconProps) => <NucleoIcon {...props} name="lock" />
const ArrowRightIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-right" />

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: Server["status"] }) {
  const classes =
    status === "connected"
      ? "bg-success"
      : status === "error"
        ? "bg-destructive"
        : "bg-muted-foreground/40"
  return <span className={`inline-block h-2 w-2 rounded-full ${classes}`} />
}

function StatusBadge({ status }: { status: Server["status"] }) {
  const variant =
    status === "connected"
      ? "success"
      : status === "error"
        ? "error"
        : "secondary"
  const label =
    status === "connected" ? "Connected" : status === "error" ? "Error" : "Unknown"
  return (
    <Badge
      variant={variant as "success" | "error" | "secondary"}
      className="gap-1 text-xs"
    >
      <StatusDot status={status} />
      {label}
    </Badge>
  )
}

// ── Add-Server wizard ─────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3

interface AddServerWizardProps {
  open: boolean
  onClose: () => void
  onAdded: (server: Server) => void
}

export function AddServerWizard({ open, onClose, onAdded }: AddServerWizardProps) {
  const { showToast } = useToast()
  const [step, setStep] = useState<WizardStep>(1)

  // Step 1 fields
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [ip, setIp] = useState("")
  const [port, setPort] = useState("22")
  const [sshUser, setSshUser] = useState("root")

  // Step 2 state (generated server + public key)
  const [createdServer, setCreatedServer] = useState<Server | null>(null)
  const [publicKey, setPublicKey] = useState("")
  const [copied, setCopied] = useState(false)

  // Step 3 state (connection test)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    status: string
    dockerVersion?: string
    error?: string
  } | null>(null)

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  const reset = () => {
    setStep(1)
    setName("")
    setDescription("")
    setIp("")
    setPort("22")
    setSshUser("root")
    setCreatedServer(null)
    setPublicKey("")
    setCopied(false)
    setTestResult(null)
    setError("")
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  // Step 1 → 2: create server and get public key
  const handleCreate = async () => {
    setError("")
    if (!name.trim()) { setError("Name is required."); return }
    if (!ip.trim()) { setError("IP address or hostname is required."); return }
    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError("Port must be a number between 1 and 65535.")
      return
    }

    setCreating(true)
    try {
      const server = await api.servers.create({
        name: name.trim(),
        description: description.trim(),
        ip: ip.trim(),
        port: portNum,
        sshUser: sshUser.trim() || "root",
      })
      setCreatedServer(server)
      setPublicKey(server.publicKey ?? "")
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create server")
    } finally {
      setCreating(false)
    }
  }

  // Step 2 → 3
  const handleKeyAdded = () => {
    setStep(3)
  }

  // Step 3: test connection
  const handleTest = async () => {
    if (!createdServer) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.servers.test(createdServer.id)
      setTestResult(result)
    } catch (err) {
      setTestResult({
        status: "error",
        error: err instanceof Error ? err.message : "Connection test failed",
      })
    } finally {
      setTesting(false)
    }
  }

  const handleFinish = () => {
    if (createdServer) {
      const finalServer = {
        ...createdServer,
        status: (testResult?.status as Server["status"]) ?? "unknown",
      }
      onAdded(finalServer)
      showToast("Server added", `${createdServer.name} has been connected.`, "success")
    }
    handleClose()
  }

  const copyKey = () => {
    navigator.clipboard.writeText(publicKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyCommand = () => {
    navigator.clipboard.writeText(
      `echo '${publicKey}' >> ~/.ssh/authorized_keys`,
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ServerIcon className="h-4 w-4 text-muted-foreground" />
            Add Remote Server
          </DialogTitle>
          <DialogDescription>
            Connect a VPS or cloud server to deploy apps on it.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center sm:justify-between gap-1.5 sm:gap-2 pt-1 mb-3 max-w-[420px] mx-auto w-full">
          {([1, 2, 3] as WizardStep[]).map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold border transition-colors ${
                    step === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : step > s
                        ? "border-success bg-success/15 text-success"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {step > s ? <CheckIcon className="h-3.5 w-3.5" /> : s}
                </div>
                <span
                  className={`text-[10px] sm:text-xs whitespace-nowrap ${
                    step === s ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s === 1 ? "Server Info" : s === 2 ? "Add SSH Key" : "Test Connection"}
                </span>
              </div>
              {i < 2 && <div className="h-px w-3 sm:flex-1 bg-border" />}
            </React.Fragment>
          ))}
        </div>

        <DialogPanel className="space-y-4 pt-2">
          {/* Step 1: Server info */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Server Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="server-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Production VPS"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Description
                  </Label>
                  <Input
                    id="server-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional — e.g. Hetzner CX21, Frankfurt"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    IP Address / Hostname <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="server-ip"
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder="e.g. 192.168.1.10"
                    className="text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    SSH Port
                  </Label>
                  <Input
                    id="server-port"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="22"
                    className="text-sm font-mono"
                    type="number"
                    min={1}
                    max={65535}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    SSH Username
                  </Label>
                  <Input
                    id="server-user"
                    value={sshUser}
                    onChange={(e) => setSshUser(e.target.value)}
                    placeholder="root"
                    className="text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Public key */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                    <KeyIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      SSH Key Generated
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      We generated a secure Ed25519 key pair. Add the public key below to your server.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Public Key (paste into your server)
                </Label>
                <div className="relative">
                  <pre className="rounded-lg border border-border bg-[#090a0f] p-3 text-[11px] text-green-400 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all max-h-28 overflow-y-auto">
                    {publicKey || "Generating…"}
                  </pre>
                  <button
                    onClick={copyKey}
                    className="absolute right-2 top-2 rounded bg-muted/60 p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Copy public key"
                  >
                    {copied ? (
                      <CheckIcon className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <CopyIcon className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Quick install command — run this on your server:
                </Label>
                <div className="relative">
                  <pre className="rounded-lg border border-border bg-[#090a0f] p-3 text-[11px] text-slate-200 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                    {`echo '${publicKey}' >> ~/.ssh/authorized_keys`}
                  </pre>
                  <button
                    onClick={copyCommand}
                    className="absolute right-2 top-2 rounded bg-muted/60 p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Copy command"
                  >
                    {copied ? (
                      <CheckIcon className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <CopyIcon className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Make sure Docker is installed on the remote server before testing.
              </p>
            </div>
          )}

          {/* Step 3: Test connection */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="rounded-xl border border-border bg-muted/20 p-4 text-center space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mx-auto">
                  <ServerIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {createdServer?.name}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {createdServer?.sshUser}@{createdServer?.ip}:{createdServer?.port}
                  </p>
                </div>
              </div>

              {testResult && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    testResult.status === "connected"
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  }`}
                >
                  {testResult.status === "connected" ? (
                    <div className="flex items-center gap-2">
                      <CheckIcon className="h-4 w-4 shrink-0" />
                      <span>
                        Connected successfully!{" "}
                        {testResult.dockerVersion && (
                          <span className="opacity-75">
                            Docker {testResult.dockerVersion}
                          </span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">Connection failed</p>
                      <p className="mt-0.5 text-xs opacity-80">{testResult.error}</p>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleTest}
                loading={testing}
                variant="outline"
                className="w-full gap-2"
                id="test-connection-btn"
              >
                <RefreshIcon className={`h-4 w-4 ${testing ? "animate-spin" : ""}`} />
                {testing ? "Testing…" : testResult ? "Retest Connection" : "Test Connection"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                You can also finish without testing and test later from the Servers page.
              </p>
            </div>
          )}
        </DialogPanel>

        <DialogFooter className="gap-2">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                loading={creating}
                className="flex-1"
                id="create-server-btn"
              >
                Generate SSH Key
                <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button onClick={handleKeyAdded} className="flex-1" id="key-added-btn">
                I've added the key
                <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleFinish}
                className="flex-1"
                id="finish-server-btn"
              >
                {testResult?.status === "connected" ? "Finish" : "Save Anyway"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Server card ───────────────────────────────────────────────────────────────

interface ServerCardProps {
  server: Server
  onTest: () => void
  onDelete: () => void
  onViewKey: () => void
  testing: boolean
}

function ServerCard({ server, onTest, onDelete, onViewKey, testing }: ServerCardProps) {
  return (
    <Card
      className={`group flex h-full min-w-0 flex-col overflow-hidden border transition-colors ${
        server.isLocal
          ? "border-primary/20 bg-card"
          : "border-border bg-card hover:border-primary/25"
      }`}
    >
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                server.status === "connected"
                  ? "bg-success/15 text-success"
                  : server.status === "error"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <ServerIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="truncate text-base font-semibold" title={server.name}>
                  {server.name}
                </CardTitle>
                {server.isLocal && (
                  <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary shrink-0">
                    local
                  </span>
                )}
              </div>
              {server.description && (
                <CardDescription className="mt-1 text-xs leading-relaxed break-words">
                  {server.description}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            <StatusBadge status={server.status} />
            {!server.isLocal && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                id={`delete-server-${server.id}`}
                title="Delete Server"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-5 pt-4">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/50 bg-muted/10 p-3 text-xs">
            <div className="min-w-0">
              <span className="block text-muted-foreground/70 font-medium uppercase tracking-wider text-[10px]">Host</span>
              <span className="font-mono text-foreground truncate block" title={server.isLocal ? "localhost" : server.ip}>
                {server.isLocal ? "localhost" : server.ip}
              </span>
            </div>
            <div className="min-w-0">
              <span className="block text-muted-foreground/70 font-medium uppercase tracking-wider text-[10px]">SSH Port</span>
              <span className="font-mono text-foreground">{server.port}</span>
            </div>
            <div className="min-w-0">
              <span className="block text-muted-foreground/70 font-medium uppercase tracking-wider text-[10px]">User</span>
              <span className="font-mono text-foreground truncate block" title={server.isLocal ? "—" : server.sshUser}>
                {server.isLocal ? "—" : server.sshUser}
              </span>
            </div>
          </div>

          {server.lastChecked && server.lastChecked !== "0001-01-01T00:00:00Z" && (
            <p className="text-[11px] text-muted-foreground">
              Last checked:{" "}
              {new Date(server.lastChecked).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onTest}
            loading={testing}
            className="h-7 gap-1.5 text-xs"
            id={`test-server-${server.id}`}
          >
            <RefreshIcon className={`h-3 w-3 ${testing ? "animate-spin" : ""}`} />
            {testing ? "Testing…" : "Test"}
          </Button>

          {!server.isLocal && (
            <Button
              size="sm"
              variant="outline"
              onClick={onViewKey}
              className="h-7 gap-1.5 text-xs"
              id={`view-key-${server.id}`}
            >
              <KeyIcon className="h-3 w-3" />
              Public Key
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Public-key modal ──────────────────────────────────────────────────────────

function PublicKeyModal({
  serverId,
  serverName,
  open,
  onClose,
}: {
  serverId: string
  serverName: string
  open: boolean
  onClose: () => void
}) {
  const [publicKey, setPublicKey] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !serverId) return
    setLoading(true)
    api.servers
      .publicKey(serverId)
      .then((r) => setPublicKey(r.publicKey))
      .catch(() => setPublicKey(""))
      .finally(() => setLoading(false))
  }, [open, serverId])

  const quickCommand = `mkdir -p ~/.ssh && echo '${publicKey}' >> ~/.ssh/authorized_keys`

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <KeyIcon className="h-4 w-4 text-muted-foreground" />
            Public Key — {serverName}
          </DialogTitle>
          <DialogDescription>
            Add this to <code className="font-mono text-xs">~/.ssh/authorized_keys</code> on the remote server.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <CopyableCodeBlock
              label="Authorized key"
              value={publicKey || "No key found — please recreate the server."}
              canCopy={!!publicKey}
            />
          )}
          {publicKey && (
            <CopyableCodeBlock
              className="mt-3"
              label="Quick command"
              value={quickCommand}
            />
          )}
        </DialogPanel>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CopyableCodeBlock({
  label,
  value,
  canCopy = true,
  className = "",
}: {
  label: string
  value: string
  canCopy?: boolean
  className?: string
}) {
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!canCopy) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      showToast("Copy failed", "Clipboard access is unavailable.", "destructive")
    }
  }

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        {canCopy && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={copy}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            {copied ? <CheckIcon className="h-3.5 w-3.5 text-success" /> : <CopyIcon className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        )}
      </div>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-muted/25 p-3 font-mono text-[11px] leading-relaxed text-foreground shadow-inner">
        {value}
      </pre>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ServersPage() {
  const { showToast } = useToast()
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)

  const [showAddWizard, setShowAddWizard] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Server | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Public key modal
  const [keyServer, setKeyServer] = useState<Server | null>(null)

  const fetchServers = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.servers.list()
      setServers(list)
    } catch {
      showToast("Failed to load servers", "Could not connect to the backend.", "destructive")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchServers()
  }, [fetchServers])

  const handleTest = async (server: Server) => {
    setTestingId(server.id)
    try {
      const result = await api.servers.test(server.id)
      const newStatus = result.status as Server["status"]
      setServers((prev) =>
        prev.map((s) =>
          s.id === server.id
            ? { ...s, status: newStatus, lastChecked: new Date().toISOString() }
            : s,
        ),
      )
      if (result.status === "connected") {
        showToast(
          "Connection successful",
          `Docker ${result.dockerVersion ?? ""} running on ${server.name}.`,
          "success",
        )
      } else {
        showToast("Connection failed", result.error ?? "Could not reach server.", "destructive")
      }
    } catch (err) {
      showToast("Test failed", err instanceof Error ? err.message : "Unknown error", "destructive")
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.servers.delete(deleteTarget.id)
      setServers((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      showToast("Server removed", `${deleteTarget.name} has been disconnected.`, "success")
    } catch (err) {
      showToast(
        "Failed to remove server",
        err instanceof Error ? err.message : "Unknown error",
        "destructive",
      )
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Servers</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Connect servers to deploy your apps anywhere.
            </p>
          </div>
          <Button
            onClick={() => setShowAddWizard(true)}
            variant="secondary"
            className="gap-1.5 text-sm"
            id="add-server-btn"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Server
          </Button>
        </div>

        {/* Server grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-xl border border-border bg-muted/20"
              />
            ))}
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <ServerIcon className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-foreground">No servers found</p>
              <p className="text-xs text-muted-foreground">Add a server to get started.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                testing={testingId === server.id}
                onTest={() => handleTest(server)}
                onDelete={() => setDeleteTarget(server)}
                onViewKey={() => setKeyServer(server)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add server wizard */}
      <AddServerWizard
        open={showAddWizard}
        onClose={() => setShowAddWizard(false)}
        onAdded={(server) => {
          setServers((prev) => [...prev, server])
        }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Server</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>? All apps on
              this server must be deleted first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  loading={deleting}
                  id="confirm-delete-server-btn"
                >
                  Remove Server
                </Button>
              }
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Public key modal */}
      <PublicKeyModal
        serverId={keyServer?.id ?? ""}
        serverName={keyServer?.name ?? ""}
        open={!!keyServer}
        onClose={() => setKeyServer(null)}
      />
    </AppShell>
  )
}
