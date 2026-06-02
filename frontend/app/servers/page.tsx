"use client"

import React, { useState, useEffect, useCallback } from "react"
import { AppShell, useToast } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Digitalocean } from "@/components/ui/svgs/digitalocean"
import { api } from "@/lib/api"
import type { Server } from "@/lib/types"
import { IconMonitor, IconServer2 } from "nucleo-isometric"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu"

// ── Icon aliases ──────────────────────────────────────────────────────────────
type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const ServerIcon = (props: IconProps) => <NucleoIcon {...props} name="cloud" />
const RefreshIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="refresh" />
)
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const CopyIcon = (props: IconProps) => <NucleoIcon {...props} name="copy" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const KeyIcon = (props: IconProps) => <NucleoIcon {...props} name="lock" />
const ArrowRightIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="chevron-right" />
)
const ClockIcon = (props: IconProps) => <NucleoIcon {...props} name="clock" />
const MoreIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="more-horizontal" />
)
const ExternalIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="external" />
)

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
    status === "connected"
      ? "Connected"
      : status === "error"
        ? "Error"
        : "Unknown"
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

type ConnectionMode = "cloud" | "manual"
type CloudProvider = "hetzner" | "digitalocean" | "vultr"

const CLOUD_PROVIDERS: Array<{
  id: CloudProvider
  name: string
  description: string
  tokenHint: string
  tokenUrl: string
  tokenHelp: string
  regions: Array<{ value: string; label: string }>
  sizes: Array<{ value: string; label: string }>
  image: string
  imageLabel: string
}> = [
  {
    id: "hetzner",
    name: "Hetzner",
    description: "Fast EU VPS with a simple API.",
    tokenHint: "Project API token",
    tokenUrl: "https://console.hetzner.cloud/projects",
    tokenHelp:
      "Open your project, then Security > API Tokens. Use Read & Write.",
    regions: [
      { value: "fsn1", label: "Falkenstein" },
      { value: "nbg1", label: "Nuremberg" },
      { value: "hel1", label: "Helsinki" },
      { value: "ash", label: "Ashburn" },
      { value: "hil", label: "Hillsboro" },
    ],
    sizes: [
      { value: "cx22", label: "CX22 · 2 vCPU / 4 GB" },
      { value: "cx32", label: "CX32 · 4 vCPU / 8 GB" },
      { value: "cx42", label: "CX42 · 8 vCPU / 16 GB" },
    ],
    image: "ubuntu-24.04",
    imageLabel: "Ubuntu 24.04",
  },
  {
    id: "digitalocean",
    name: "DigitalOcean",
    description: "Friendly droplets and predictable defaults.",
    tokenHint: "Personal access token",
    tokenUrl: "https://cloud.digitalocean.com/account/api/tokens",
    tokenHelp: "Create a token with write access for droplets and SSH keys.",
    regions: [
      { value: "nyc3", label: "New York 3" },
      { value: "sfo3", label: "San Francisco 3" },
      { value: "ams3", label: "Amsterdam 3" },
      { value: "fra1", label: "Frankfurt 1" },
      { value: "sgp1", label: "Singapore 1" },
    ],
    sizes: [
      { value: "s-1vcpu-1gb", label: "Basic · 1 vCPU / 1 GB" },
      { value: "s-1vcpu-2gb", label: "Basic · 1 vCPU / 2 GB" },
      { value: "s-2vcpu-4gb", label: "Basic · 2 vCPU / 4 GB" },
    ],
    image: "ubuntu-24-04-x64",
    imageLabel: "Ubuntu 24.04 x64",
  },
  {
    id: "vultr",
    name: "Vultr",
    description: "Global compute with lightweight plans.",
    tokenHint: "API key",
    tokenUrl: "https://my.vultr.com/settings/#settingsapi",
    tokenHelp:
      "Create or reveal an API key and allow access from this Better PaaS host.",
    regions: [
      { value: "ewr", label: "New Jersey" },
      { value: "ord", label: "Chicago" },
      { value: "ams", label: "Amsterdam" },
      { value: "fra", label: "Frankfurt" },
      { value: "sgp", label: "Singapore" },
    ],
    sizes: [
      { value: "vc2-1c-1gb", label: "Cloud · 1 vCPU / 1 GB" },
      { value: "vc2-1c-2gb", label: "Cloud · 1 vCPU / 2 GB" },
      { value: "vc2-2c-4gb", label: "Cloud · 2 vCPU / 4 GB" },
    ],
    image: "2284",
    imageLabel: "Ubuntu 24.04 x64",
  },
]

function ProviderLogo({
  provider,
  className = "",
}: {
  provider: CloudProvider
  className?: string
}) {
  if (provider === "hetzner") {
    return (
      <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
        <rect width="40" height="40" rx="8" fill="#D50C2D" />
        <path fill="#fff" d="M10 10h6v8h8v-8h6v20h-6v-8h-8v8h-6V10Z" />
      </svg>
    )
  }
  if (provider === "digitalocean") {
    return <Digitalocean className={className} aria-hidden="true" />
  }
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="8" fill="#007BFC" />
      <path fill="#fff" d="M8 10h7.2l4.8 15.2L24.8 10H32L23.6 30h-7.2L8 10Z" />
    </svg>
  )
}

export function AddServerWizard({
  open,
  onClose,
  onAdded,
}: AddServerWizardProps) {
  const { showToast } = useToast()
  const [step, setStep] = useState<WizardStep>(1)
  const [mode, setMode] = useState<ConnectionMode>("cloud")

  // Step 1 fields
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [ip, setIp] = useState("")
  const [port, setPort] = useState("22")
  const [sshUser, setSshUser] = useState("root")
  const [provider, setProvider] = useState<CloudProvider>("hetzner")
  const providerConfig =
    CLOUD_PROVIDERS.find((p) => p.id === provider) ?? CLOUD_PROVIDERS[0]
  const [cloudToken, setCloudToken] = useState("")
  const [cloudRegion, setCloudRegion] = useState(
    providerConfig.regions[0].value
  )
  const [cloudSize, setCloudSize] = useState(providerConfig.sizes[0].value)
  const [cloudImage, setCloudImage] = useState(providerConfig.image)

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

  const selectProvider = (nextProvider: CloudProvider) => {
    const next =
      CLOUD_PROVIDERS.find((p) => p.id === nextProvider) ?? CLOUD_PROVIDERS[0]
    setProvider(nextProvider)
    setCloudRegion(next.regions[0].value)
    setCloudSize(next.sizes[0].value)
    setCloudImage(next.image)
  }

  const reset = () => {
    setStep(1)
    setMode("cloud")
    setName("")
    setDescription("")
    setIp("")
    setPort("22")
    setSshUser("root")
    selectProvider("hetzner")
    setCloudToken("")
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
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    if (mode === "manual") {
      if (!ip.trim()) {
        setError("IP address or hostname is required.")
        return
      }
      const portNum = parseInt(port, 10)
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        setError("Port must be a number between 1 and 65535.")
        return
      }
    } else if (!cloudToken.trim()) {
      setError(`${providerConfig.name} API token is required.`)
      return
    }

    setCreating(true)
    try {
      const server =
        mode === "manual"
          ? await api.servers.create({
              name: name.trim(),
              description: description.trim(),
              ip: ip.trim(),
              port: parseInt(port, 10),
              sshUser: sshUser.trim() || "root",
            })
          : await api.servers.createCloud({
              provider,
              token: cloudToken.trim(),
              name: name.trim(),
              description: description.trim(),
              region: cloudRegion,
              size: cloudSize,
              image: cloudImage.trim() || providerConfig.image,
              sshUser: sshUser.trim() || "root",
            })
      setCreatedServer(server)
      setPublicKey(server.publicKey ?? "")
      setStep(mode === "manual" ? 2 : 3)
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
      showToast(
        "Server added",
        `${createdServer.name} is ready to use.`,
        "success"
      )
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
      `echo '${publicKey}' >> ~/.ssh/authorized_keys`
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
        <div className="mx-auto mb-3 flex w-full max-w-[420px] items-center justify-center gap-1.5 pt-1 sm:justify-between sm:gap-2">
          {([1, 2, 3] as WizardStep[]).map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex shrink-0 items-center gap-1.5">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
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
                  className={`text-[10px] whitespace-nowrap sm:text-xs ${
                    step === s
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {s === 1
                    ? mode === "cloud"
                      ? "Cloud Setup"
                      : "Server Info"
                    : s === 2
                      ? mode === "cloud"
                        ? "Provision"
                        : "Add SSH Key"
                      : "Test Connection"}
                </span>
              </div>
              {i < 2 && <div className="h-px w-3 bg-border sm:flex-1" />}
            </React.Fragment>
          ))}
        </div>

        <DialogPanel className="space-y-4 pt-2">
          {/* Step 1: Server info */}
          {step === 1 && (
            <div className="animate-in fade-in-50 space-y-4 duration-200">
              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/20 p-1">
                <button
                  type="button"
                  onClick={() => setMode("cloud")}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    mode === "cloud"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Cloud Provider
                </button>
                <button
                  type="button"
                  onClick={() => setMode("manual")}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    mode === "manual"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Manual SSH
                </button>
              </div>

              {mode === "cloud" && (
                <div className="grid gap-2 sm:grid-cols-3">
                  {CLOUD_PROVIDERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectProvider(item.id)}
                      className={`min-h-[112px] rounded-lg border p-3 text-left transition-colors ${
                        provider === item.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-muted/10 hover:border-primary/40 hover:bg-muted/20"
                      }`}
                    >
                      <ProviderLogo provider={item.id} className="h-9 w-9" />
                      <div className="mt-3 text-sm font-semibold text-foreground">
                        {item.name}
                      </div>
                      <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                        {item.description}
                      </div>
                    </button>
                  ))}
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
                    placeholder={
                      mode === "cloud"
                        ? `Optional - e.g. ${providerConfig.name} ${cloudSize}`
                        : "Optional - e.g. Hetzner CX22, Frankfurt"
                    }
                    className="text-sm"
                  />
                </div>
                {mode === "cloud" ? (
                  <>
                    <div className="space-y-1.5 sm:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          {providerConfig.name} Token{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <a
                          href={providerConfig.tokenUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Get API key
                          <ExternalIcon className="h-3 w-3" />
                        </a>
                      </div>
                      <Input
                        id="cloud-token"
                        value={cloudToken}
                        onChange={(e) => setCloudToken(e.target.value)}
                        placeholder={providerConfig.tokenHint}
                        className="font-mono text-sm"
                        type="password"
                        autoComplete="off"
                      />
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {providerConfig.tokenHelp}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Region
                      </Label>
                      <Select
                        value={cloudRegion}
                        onValueChange={(value) =>
                          value && setCloudRegion(value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {providerConfig.regions.map((region) => (
                            <SelectItem key={region.value} value={region.value}>
                              {region.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Server Size
                      </Label>
                      <Select
                        value={cloudSize}
                        onValueChange={(value) => value && setCloudSize(value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {providerConfig.sizes.map((size) => (
                            <SelectItem key={size.value} value={size.value}>
                              {size.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Image
                      </Label>
                      <Input
                        id="cloud-image"
                        value={cloudImage}
                        onChange={(e) => setCloudImage(e.target.value)}
                        placeholder={providerConfig.imageLabel}
                        className="font-mono text-sm"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        IP Address / Hostname{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="server-ip"
                        value={ip}
                        onChange={(e) => setIp(e.target.value)}
                        placeholder="e.g. 192.168.1.10"
                        className="font-mono text-sm"
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
                        className="font-mono text-sm"
                        type="number"
                        min={1}
                        max={65535}
                      />
                    </div>
                  </>
                )}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    SSH Username
                  </Label>
                  <Input
                    id="server-user"
                    value={sshUser}
                    onChange={(e) => setSshUser(e.target.value)}
                    placeholder="root"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              {mode === "cloud" && (
                <div className="rounded-lg border border-border bg-muted/15 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  Better PaaS will create the VM, install your SSH key, run
                  cloud-init to install Docker, and then save the server with
                  the returned public IP.
                </div>
              )}
            </div>
          )}

          {/* Step 2: Public key */}
          {step === 2 && (
            <div className="animate-in fade-in-50 space-y-4 duration-200">
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <KeyIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      SSH Key Generated
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      We generated a secure Ed25519 key pair. Add the public key
                      below to your server.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Public Key (paste into your server)
                </Label>
                <div className="relative">
                  <pre className="max-h-28 overflow-x-auto overflow-y-auto rounded-lg border border-border bg-[#090a0f] p-3 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-green-400">
                    {publicKey || "Generating…"}
                  </pre>
                  <button
                    onClick={copyKey}
                    className="absolute top-2 right-2 rounded bg-muted/60 p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                  <pre className="overflow-x-auto rounded-lg border border-border bg-[#090a0f] p-3 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-slate-200">
                    {`echo '${publicKey}' >> ~/.ssh/authorized_keys`}
                  </pre>
                  <button
                    onClick={copyCommand}
                    className="absolute top-2 right-2 rounded bg-muted/60 p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                Make sure Docker is installed on the remote server before
                testing.
              </p>
            </div>
          )}

          {/* Step 3: Test connection */}
          {step === 3 && (
            <div className="animate-in fade-in-50 space-y-4 duration-200">
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {mode === "cloud" ? (
                    <ProviderLogo provider={provider} className="h-8 w-8" />
                  ) : (
                    <ServerIcon className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {createdServer?.name}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {createdServer?.sshUser}@{createdServer?.ip}:
                    {createdServer?.port}
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
                      <p className="mt-0.5 text-xs opacity-80">
                        {testResult.error}
                      </p>
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
                <RefreshIcon
                  className={`h-4 w-4 ${testing ? "animate-spin" : ""}`}
                />
                {testing
                  ? "Testing…"
                  : testResult
                    ? "Retest Connection"
                    : "Test Connection"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                {mode === "cloud"
                  ? "Cloud-init can take a few minutes to finish Docker installation. If the first test fails, wait briefly and retest."
                  : "You can also finish without testing and test later from the Servers page."}
              </p>
            </div>
          )}
        </DialogPanel>

        <DialogFooter className="gap-2">
          {step === 1 && (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                loading={creating}
                className="flex-1"
                id="create-server-btn"
              >
                {mode === "cloud" ? "Create & Connect" : "Generate SSH Key"}
                <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleKeyAdded}
                className="flex-1"
                id="key-added-btn"
              >
                I've added the key
                <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(mode === "cloud" ? 1 : 2)}
                className="flex-1"
              >
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

function ServerCard({
  server,
  onTest,
  onDelete,
  onViewKey,
  testing,
}: ServerCardProps) {
  return (
    <Card
      className={`group flex h-[210px] min-w-0 flex-col overflow-hidden border transition-colors ${
        server.isLocal
          ? "border-primary/20 bg-card"
          : "border-border bg-card hover:border-primary/25"
      }`}
    >
      <CardHeader className="border-b border-border/40 p-5 pb-3">
        <div className="flex w-full min-w-0 items-start justify-between gap-3">
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
              {server.isLocal ? (
                <IconMonitor className="h-6 w-6" />
              ) : (
                <IconServer2 className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex w-full min-w-0 items-center gap-2">
                <CardTitle
                  className="min-w-0 flex-1 truncate text-base font-semibold"
                  title={server.name}
                >
                  {server.name}
                </CardTitle>
                {server.isLocal && (
                  <span className="shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                    local
                  </span>
                )}
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge status={server.status} />
                </div>
              </div>
              <div className="mt-1 h-4 w-full min-w-0 overflow-hidden">
                {server.description ? (
                  <CardDescription
                    className="block truncate text-xs leading-none text-muted-foreground"
                    title={server.description}
                  >
                    {server.description}
                  </CardDescription>
                ) : (
                  <span className="block text-xs leading-none text-muted-foreground/0 select-none">
                    —
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    id={`server-actions-${server.id}`}
                    title="Actions"
                  >
                    <MoreIcon className="h-4 w-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onTest} disabled={testing}>
                  <RefreshIcon
                    className={`h-4 w-4 text-muted-foreground/75 ${testing ? "animate-spin" : ""}`}
                  />
                  {testing ? "Testing…" : "Test Connection"}
                </DropdownMenuItem>

                {!server.isLocal && (
                  <>
                    <DropdownMenuItem onClick={onViewKey}>
                      <KeyIcon className="h-4 w-4 text-muted-foreground/75" />
                      Public Key
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={onDelete}>
                      <TrashIcon className="h-4 w-4" />
                      Delete Server
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between p-5 pt-3">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/50 bg-muted/10 p-3 text-xs">
            <div className="min-w-0">
              <span className="block text-[10px] font-medium tracking-wider text-muted-foreground/70 uppercase">
                Host
              </span>
              <span
                className="block truncate font-mono text-foreground"
                title={server.isLocal ? "localhost" : server.ip}
              >
                {server.isLocal ? "localhost" : server.ip}
              </span>
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-medium tracking-wider text-muted-foreground/70 uppercase">
                SSH Port
              </span>
              <span className="font-mono text-foreground">{server.port}</span>
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-medium tracking-wider text-muted-foreground/70 uppercase">
                User
              </span>
              <span
                className="block truncate font-mono text-foreground"
                title={server.isLocal ? "—" : server.sshUser}
              >
                {server.isLocal ? "—" : server.sshUser}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ClockIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <span>
              {server.lastChecked &&
              server.lastChecked !== "0001-01-01T00:00:00Z" ? (
                <>
                  Last checked:{" "}
                  {new Date(server.lastChecked).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              ) : (
                "Never checked"
              )}
            </span>
          </div>
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
            Add this to{" "}
            <code className="font-mono text-xs">~/.ssh/authorized_keys</code> on
            the remote server.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
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
      showToast(
        "Copy failed",
        "Clipboard access is unavailable.",
        "destructive"
      )
    }
  }

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        {canCopy && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={copy}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            {copied ? (
              <CheckIcon className="h-3.5 w-3.5 text-success" />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        )}
      </div>
      <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted/25 p-3 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-foreground shadow-inner">
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
      showToast(
        "Failed to load servers",
        "Could not connect to the backend.",
        "destructive"
      )
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
            : s
        )
      )
      if (result.status === "connected") {
        showToast(
          "Connection successful",
          `Docker ${result.dockerVersion ?? ""} running on ${server.name}.`,
          "success"
        )
      } else {
        showToast(
          "Connection failed",
          result.error ?? "Could not reach server.",
          "destructive"
        )
      }
    } catch (err) {
      showToast(
        "Test failed",
        err instanceof Error ? err.message : "Unknown error",
        "destructive"
      )
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
      showToast(
        "Server removed",
        `${deleteTarget.name} has been disconnected.`,
        "success"
      )
    } catch (err) {
      showToast(
        "Failed to remove server",
        err instanceof Error ? err.message : "Unknown error",
        "destructive"
      )
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Servers</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
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
              <p className="text-sm font-medium text-foreground">
                No servers found
              </p>
              <p className="text-xs text-muted-foreground">
                Add a server to get started.
              </p>
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
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Server</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>? All
              apps on this server must be deleted first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button variant="outline">Cancel</Button>}
            />
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
