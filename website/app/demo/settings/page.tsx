"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  Frame,
  FramePanel,
  FrameTitle,
  FrameDescription,
  FrameFooter,
} from "@/dashboard/components/ui/frame"
import { Button } from "@/dashboard/components/ui/button"
import { Input } from "@/dashboard/components/ui/input"
import { Label } from "@/dashboard/components/ui/label"
import { Badge } from "@/dashboard/components/ui/badge"
import { Checkbox } from "@/dashboard/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/dashboard/components/ui/alert"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
} from "@/dashboard/components/ui/alert-dialog"
import { AppShell, useToast } from "@/dashboard/components/app-shell"
import { useTheme } from "next-themes"
import { api, ApiError } from "@/dashboard/lib/api"
import { cleanVersion } from "@/dashboard/lib/utils"
import { useAuth } from "@/dashboard/components/auth-gate"
import { GitHubConnectModal } from "@/dashboard/components/github-connect-modal"
import { GithubLight } from "@/dashboard/components/ui/svgs/githubLight"
import { GithubDark } from "@/dashboard/components/ui/svgs/githubDark"
import { NucleoIcon } from "@/dashboard/components/nucleo-icons"
import { Eye, EyeOff, RotateCcw } from "lucide-react"
import type { NotificationConfig, UpdateStatus, SystemVersion, UpdateProgress } from "@/dashboard/lib/types"
import { Cloudflare } from "@/dashboard/components/ui/svgs/cloudflare"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const SettingsIcon = (props: IconProps) => <NucleoIcon {...props} name="settings" />
const InfoIcon = (props: IconProps) => <NucleoIcon {...props} name="info" />
const AlertTriangleIcon = (props: IconProps) => <NucleoIcon {...props} name="triangle-alert" />
const LockIcon = (props: IconProps) => <NucleoIcon {...props} name="lock" />
const BellIcon = (props: IconProps) => <NucleoIcon {...props} name="activity" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const DownloadIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />
const LinkIcon = (props: IconProps) => <NucleoIcon {...props} name="link" />
const SunIcon = (props: IconProps) => <NucleoIcon {...props} name="sun" />
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />

// Settings categories shown in the left sub-nav. Each maps to a group of cards
// rendered in the content column.
type SettingsSection = "general" | "updates" | "integrations" | "notifications" | "maintenance"

const SETTINGS_SECTIONS: {
  id: SettingsSection
  label: string
  description: string
  Icon: (props: IconProps) => React.ReactElement
}[] = [
  { id: "general", label: "General", description: "Session and node info", Icon: SettingsIcon },
  { id: "updates", label: "Updates", description: "Software version & releases", Icon: RefreshIcon },
  { id: "integrations", label: "Integrations", description: "GitHub and Cloudflare", Icon: LinkIcon },
  { id: "notifications", label: "Notifications", description: "Deploy alerts", Icon: BellIcon },
  { id: "maintenance", label: "Maintenance", description: "Docker cleanup", Icon: TrashIcon },
]

// Interface theme options for the visual picker in the General section. Each
// renders a small mockup preview so the choice reads at a glance.
const THEME_OPTIONS: { id: "system" | "light" | "dark"; label: string }[] = [
  { id: "system", label: "System preference" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
]

// ThemePreview draws a tiny dashboard mockup (sidebar + content) in the given
// palette. "system" is shown split down the middle (light left, dark right) to
// signal it follows the OS setting.
function ThemePreview({ variant }: { variant: "system" | "light" | "dark" }) {
  if (variant === "system") {
    return (
      <div className="relative flex h-full w-full overflow-hidden">
        <div className="w-1/2 overflow-hidden">
          <MockDashboard palette="light" clip="left" />
        </div>
        <div className="w-1/2 overflow-hidden">
          <MockDashboard palette="dark" clip="right" />
        </div>
      </div>
    )
  }
  return <MockDashboard palette={variant} />
}

function MockDashboard({
  palette,
  clip,
}: {
  palette: "light" | "dark"
  clip?: "left" | "right"
}) {
  const dark = palette === "dark"
  const bg = dark ? "bg-zinc-900" : "bg-white"
  const sidebar = dark ? "bg-zinc-800" : "bg-zinc-100"
  const line = dark ? "bg-zinc-700" : "bg-zinc-200"
  const lineStrong = dark ? "bg-zinc-600" : "bg-zinc-300"
  // When used as a system split, keep the mockup full-width and let the parent
  // clip it, so the two halves form one continuous dashboard.
  const width = clip ? "w-[200%]" : "w-full"
  const offset = clip === "right" ? "-translate-x-1/2" : ""
  return (
    <div className={`flex h-full ${width} ${offset} ${bg}`}>
      <div className={`flex w-1/4 flex-col gap-1 p-1.5 ${sidebar}`}>
        <div className={`h-1.5 w-3/4 rounded-full ${lineStrong}`} />
        <div className={`h-1 w-full rounded-full ${line}`} />
        <div className={`h-1 w-full rounded-full ${line}`} />
        <div className={`h-1 w-2/3 rounded-full ${line}`} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <div className={`h-1.5 w-1/2 rounded-full ${lineStrong}`} />
        <div className={`h-1 w-full rounded-full ${line}`} />
        <div className={`h-1 w-5/6 rounded-full ${line}`} />
        <div className={`mt-1 h-6 w-full rounded ${line}`} />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { showToast } = useToast()
  const { signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  // next-themes only knows the active theme on the client; gate the picker's
  // selected state on mount to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false)
  React.useEffect(() => {
    // One-time mount flag; intentional setState in effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])
  const [activeSection, setActiveSection] = useState<SettingsSection>("general")
  const [pruning, setPruning] = useState(false)
  const [pruneOutput, setPruneOutput] = useState("")
  const [showPruneModal, setShowPruneModal] = useState(false)
  const [resettingOnboarding, setResettingOnboarding] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)

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

  // GitHub integration
  const [ghConnected, setGhConnected] = useState(false)
  const [ghModalOpen, setGhModalOpen] = useState(false)

  // Updates
  const [sysVersion, setSysVersion] = useState<SystemVersion | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [applyingUpdate, setApplyingUpdate] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null)
  const [, setPollingUpdate] = useState(false)
  const updateLogEndRef = useRef<HTMLDivElement>(null)

  // Custom Domain
  const [paasDomain, setPaasDomain] = useState("")
  const [paasDomainEnvOverridden, setPaasDomainEnvOverridden] = useState(false)
  const [savingDomain, setSavingDomain] = useState(false)

  const pollUpdateProgress = useCallback(async () => {
    let errorRetries = 0
    const maxErrorRetries = 120

    const poll = async () => {
      try {
        const p = await api.system.updateStatus()
        setUpdateProgress(p)
        errorRetries = 0
        const stillRunning =
          p.inProgress ||
          p.state === "running" ||
          p.state === "starting"
        if (stillRunning) {
          setTimeout(poll, 1500)
        } else {
          setPollingUpdate(false)
          if (p.state === "completed") {
            api.system.version().then(setSysVersion).catch(() => {})
            api.system.updateCheck(true).then(setUpdateStatus).catch(() => {})
            // Hard-reload so the dashboard runs on the new build's assets
            // instead of stale cached chunks from the previous version.
            showToast("Update complete", "Reloading to load the new version...", "success")
            setTimeout(() => window.location.reload(), 2000)
          }
        }
      } catch {
        // The backend restarts mid-update; keep polling through brief outages.
        errorRetries++
        if (errorRetries < maxErrorRetries) {
          setTimeout(poll, 1500)
        } else {
          setPollingUpdate(false)
        }
      }
    }
    await poll()
  }, [showToast])

  useEffect(() => {
    api.notifications
      .get()
      .then(setNotif)
      .catch(() => {})
    api.cloudflare
      .status()
      .then((s) => setCfConnected(s.connected))
      .catch(() => {})
    api.git
      .tokenStatus()
      .then((s) => setGhConnected(s.connected))
      .catch(() => {})
    api.system
      .version()
      .then(setSysVersion)
      .catch(() => {})
    api.system
      .domain()
      .then((d) => {
        setPaasDomain(d.domain)
        setPaasDomainEnvOverridden(d.envOverridden)
      })
      .catch(() => {})

    // Check initial update progress on mount
    api.system
      .updateStatus()
      .then((p) => {
        setUpdateProgress(p)
        if (p.inProgress) {
          setPollingUpdate(true)
          pollUpdateProgress()
        }
      })
      .catch(() => {})
  }, [pollUpdateProgress])

  useEffect(() => {
    if (updateLogEndRef.current) {
      updateLogEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [updateProgress?.log])

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    try {
      const s = await api.system.updateCheck(true)
      setUpdateStatus(s)
      if (!s.configured) {
        showToast("Not configured", "No update source is set (UPDATE_REPO).", "destructive")
      } else if (s.hasUpdate) {
        showToast("Update available", `Version ${s.latest} is available.`, "success")
      } else {
        showToast("Up to date", "You're running the latest version.", "success")
      }
    } catch (err) {
      showToast("Check failed", err instanceof ApiError ? err.message : "Could not check.", "destructive")
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleApplyUpdate = async () => {
    setApplyingUpdate(true)
    try {
      const res = await api.system.updateApply()
      setShowUpdateModal(false)
      showToast("Update started", res.message, "success")
      setPollingUpdate(true)
      setTimeout(pollUpdateProgress, 1500)
    } catch (err) {
      showToast("Update failed", err instanceof ApiError ? err.message : "Could not start update.", "destructive")
    } finally {
      setApplyingUpdate(false)
    }
  }

  const refreshGitHub = () => {
    api.git
      .tokenStatus()
      .then((s) => setGhConnected(s.connected))
      .catch(() => {})
  }

  const handleDisconnectGitHub = async () => {
    try {
      await api.git.deleteToken()
      setGhConnected(false)
      showToast("GitHub disconnected", "The stored access token was removed.")
    } catch {
      showToast("Error", "Failed to disconnect GitHub.", "destructive")
    }
  }

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
      showToast("Pruning Docker...", "Removing stopped containers, dangling images, and unused networks.")
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

  const handleResetOnboarding = async () => {
    setResettingOnboarding(true)
    try {
      showToast("Resetting onboarding...", "Restoring onboarding checklist status in the database.")
      await api.system.resetOnboarding()
      showToast("Reset complete", "Redirecting to initial setup flow...", "success")
      window.location.href = "/"
    } catch (err) {
      showToast("Reset failed", err instanceof ApiError ? err.message : "Could not reset onboarding.", "destructive")
    } finally {
      setResettingOnboarding(false)
    }
  }

  const handleSaveDomain = async () => {
    setSavingDomain(true)
    try {
      await api.system.saveDomain(paasDomain.trim())
      showToast("Domain saved", "Custom domain configuration updated successfully. Caddy reverse proxy has been reloaded.", "success")
    } catch (err) {
      showToast(
        "Save failed",
        err instanceof ApiError ? err.message : "Could not save custom domain.",
        "destructive"
      )
    } finally {
      setSavingDomain(false)
    }
  }

  return (
    <AppShell>
      <div className="animate-in fade-in-50 p-4 duration-200 md:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Node Settings</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Configure the worker node environment and maintenance tools.
          </p>
        </div>

        {/* Two-column layout: category nav on the left, section content on the right. */}
        <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Category nav. Horizontal scroll strip on mobile, vertical rail on md+. */}
          <nav
            aria-label="Settings categories"
            className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:sticky md:top-6 md:mx-0 md:h-fit md:flex-col md:gap-0.5 md:overflow-visible md:px-0 md:pb-0"
          >
            {SETTINGS_SECTIONS.map((section) => {
              const active = activeSection === section.id
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors md:w-full ${
                    active
                      ? "bg-accent font-medium text-foreground"
                      : "text-foreground/75 hover:bg-muted/20 hover:text-foreground"
                  }`}
                >
                  <section.Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{section.label}</span>
                    <span className="hidden truncate text-[11px] font-normal text-muted-foreground lg:block">
                      {section.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </nav>

          {/* Section content */}
          <div className="min-w-0 space-y-6">
            {activeSection === "updates" && (
              <>
        {/* Software Updates */}
        <Frame className="w-full">
          <FramePanel>
            <FrameTitle className="flex flex-wrap items-center gap-2">
              <RefreshIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              Software Updates
              {updateStatus?.hasUpdate && (
                <Badge variant="warning" size="sm" className="ml-1">
                  Update available
                </Badge>
              )}
            </FrameTitle>
            <FrameDescription className="text-xs sm:text-sm">
              Update Better-PaaS to the latest release. A backup is taken automatically before
              updating, and the services restart briefly.
            </FrameDescription>
          </FramePanel>
          <FramePanel className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Current version</span>
                <Badge 
                  variant="outline" 
                  size="sm" 
                  className="font-mono whitespace-nowrap"
                  title={sysVersion?.version}
                >
                  {cleanVersion(sysVersion?.version) || "…"}
                </Badge>
              </div>
              {updateStatus && updateStatus.configured && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Latest</span>
                  <Badge
                    variant={updateStatus.hasUpdate ? "warning" : "success"}
                    size="sm"
                    className="font-mono"
                  >
                    {updateStatus.latest || "unknown"}
                  </Badge>
                </div>
              )}
            </div>

            {sysVersion && !sysVersion.gitCheckout && (
              <Alert variant="info">
                <InfoIcon />
                <AlertTitle>Manual install detected</AlertTitle>
                <AlertDescription>
                  One-click updates require a git-checkout install. Pull the latest code and
                  run <span className="font-mono">sudo bash install.sh</span> from your install
                  directory, or update your Docker image if you deploy that way.
                </AlertDescription>
              </Alert>
            )}

            {updateStatus?.hasUpdate && updateStatus.release && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {updateStatus.release.name || updateStatus.release.tagName}
                  </span>
                  {updateStatus.release.url && (
                    <a
                      href={updateStatus.release.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                    >
                      Release notes
                      <NucleoIcon name="external" className="h-3 w-3 opacity-60" />
                    </a>
                  )}
                </div>
                {updateStatus.release.notes && (
                  <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-muted-foreground">
                    {updateStatus.release.notes}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleCheckUpdate} loading={checkingUpdate} className="gap-1.5">
                <RefreshIcon className={`h-3.5 w-3.5 ${checkingUpdate ? "animate-spin" : ""}`} />
                Check for updates
              </Button>
              {updateStatus?.hasUpdate && sysVersion?.gitCheckout && (
                <Button onClick={() => setShowUpdateModal(true)} className="gap-1.5">
                  <DownloadIcon className="h-3.5 w-3.5" />
                  Update to {updateStatus.latest}
                </Button>
              )}
            </div>
          </FramePanel>
          <FrameFooter>
            <div className="flex gap-1.5 text-xs text-muted-foreground">
              <NucleoIcon name="refresh" className="mt-0.5 size-3 shrink-0" />
              <p>Updates pull the latest release from the configured update source.</p>
            </div>
          </FrameFooter>
        </Frame>

        <Frame className="w-full">
          <FramePanel>
            <FrameTitle className="flex items-center gap-2">
              <TerminalIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              Manual update (recommended)
            </FrameTitle>
            <FrameDescription className="text-xs sm:text-sm">
              SSH into your server, pull the latest code, and re-run the installer. This
              rebuilds the backend and frontend and restarts services - the easiest and
              most reliable way to update.
            </FrameDescription>
          </FramePanel>
          <FramePanel className="space-y-3">
            <p className="text-sm text-muted-foreground">
              From your Better-PaaS install directory on the server:
            </p>
            <div className="overflow-x-auto rounded-lg border border-border/40 bg-code p-3 font-mono text-xs whitespace-pre text-foreground/90">
{`cd ~/better-paas
git pull
sudo bash install.sh`}
            </div>
            <p className="text-xs text-muted-foreground">
              Replace <span className="font-mono">~/better-paas</span> with your clone path if
              different. Your <span className="font-mono">data/</span> directory at the repo root
              is preserved and migrated automatically. When it finishes, hard-refresh the dashboard
              (Cmd+Shift+R or Ctrl+Shift+R).
            </p>
          </FramePanel>
          <FrameFooter>
            <div className="flex gap-1.5 text-xs text-muted-foreground">
              <TerminalIcon className="mt-0.5 size-3 shrink-0" />
              <p>
                Use the in-app update above for one-click upgrades, or this terminal flow
                when you want the same path as a fresh install.
              </p>
            </div>
          </FrameFooter>
        </Frame>

        {updateProgress && updateProgress.state !== "idle" && (
          <Frame className="w-full">
            <FramePanel>
              <div className="flex items-center justify-between gap-3">
                <FrameTitle className="flex items-center gap-2">
                  <TerminalIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  Update Progress &amp; Logs
                </FrameTitle>
                {updateProgress.inProgress ? (
                  <Badge variant="warning" size="sm" className="animate-pulse">
                    In Progress
                  </Badge>
                ) : updateProgress.state === "completed" ? (
                  <Badge variant="success" size="sm">
                    Completed
                  </Badge>
                ) : updateProgress.state === "failed" ? (
                  <Badge variant="destructive" size="sm">
                    Failed
                  </Badge>
                ) : null}
              </div>
              <FrameDescription className="text-xs sm:text-sm">
                Status: <span className="font-mono font-medium">{updateProgress.state}</span>. Real-time build and deployment logs from the self-update script.
              </FrameDescription>
            </FramePanel>
            <FramePanel className="overflow-hidden !p-0">
              <div className="relative flex flex-col font-mono text-xs h-80 bg-muted/5">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-muted/10 text-[10px] uppercase font-bold tracking-wider text-muted-foreground select-none">
                  <span>Update Script Output</span>
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${updateProgress.inProgress ? "bg-success animate-pulse" : "bg-muted-foreground/50"}`} />
                    {updateProgress.inProgress ? "Live" : "Ended"}
                  </span>
                </div>
                <div className="p-4 overflow-y-auto flex-1 space-y-1.5 leading-relaxed text-foreground/90 selection:bg-primary/20 scrollbar-thin">
                  {updateProgress.log ? (
                    <pre className="whitespace-pre-wrap break-all font-mono text-foreground/90 text-xs">
                      {updateProgress.log}
                    </pre>
                  ) : (
                    <div className="text-muted-foreground italic text-center py-16 flex flex-col items-center justify-center gap-2">
                      <TerminalIcon className="h-5 w-5 opacity-40 animate-pulse text-muted-foreground" />
                      <span>Waiting for update output...</span>
                    </div>
                  )}
                  <div ref={updateLogEndRef} />
                </div>
              </div>
            </FramePanel>
          </Frame>
        )}
              </>
            )}

            {activeSection === "maintenance" && (
              <>
        {/* Docker Maintenance */}
        <Frame className="w-full">
          <FramePanel>
            <FrameTitle className="flex items-center gap-2">
              <TrashIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              Docker Maintenance
            </FrameTitle>
            <FrameDescription className="text-xs sm:text-sm">
              Remove unused Docker containers, images, volumes, and build cache.
            </FrameDescription>
          </FramePanel>
          <FramePanel className="space-y-4">
            <Alert variant="warning">
              <AlertTriangleIcon />
              <AlertTitle>This action cannot be undone</AlertTitle>
              <AlertDescription>
                Removes all stopped containers, dangling images, unused networks, and build cache.
                Running containers and named volumes (including kept database data) are not affected.
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
          </FramePanel>
          <FrameFooter>
            <div className="flex gap-1.5 text-xs text-muted-foreground">
              <NucleoIcon name="info" className="mt-0.5 size-3 shrink-0" />
              <p>Running containers and named volumes are never touched by the prune.</p>
            </div>
          </FrameFooter>
        </Frame>
              </>
            )}

            {activeSection === "notifications" && (
              <>
        {/* Deploy Notifications */}
        <Frame className="w-full">
          <FramePanel>
            <FrameTitle className="flex items-center gap-2">
              <BellIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              Deploy Notifications
            </FrameTitle>
            <FrameDescription className="text-xs sm:text-sm">
              Get notified on Slack or a custom webhook when deployments succeed or fail.
            </FrameDescription>
          </FramePanel>
          <FramePanel className="space-y-4">
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
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={notif.onSuccess}
                  onCheckedChange={(c) => setNotif((n) => ({ ...n, onSuccess: c === true }))}
                />
                Notify on success
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={notif.onFailure}
                  onCheckedChange={(c) => setNotif((n) => ({ ...n, onFailure: c === true }))}
                />
                Notify on failure
              </label>
            </div>
          </FramePanel>
          <FrameFooter>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1.5 text-xs text-muted-foreground">
                <NucleoIcon name="activity" className="mt-0.5 size-3 shrink-0" />
                <p>Use &quot;Send test&quot; to verify your webhook endpoint before relying on it.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleTestNotif}>
                  Send test
                </Button>
                <Button size="sm" onClick={handleSaveNotif} loading={savingNotif}>
                  Save notifications
                </Button>
              </div>
            </div>
          </FrameFooter>
        </Frame>
              </>
            )}

            {activeSection === "integrations" && (
              <>
        {/* GitHub */}
        <Frame className="w-full">
          <FramePanel>
            <FrameTitle className="flex flex-wrap items-center gap-2">
              <GithubLight className="h-4 w-4 shrink-0 dark:hidden" />
              <GithubDark className="hidden h-4 w-4 shrink-0 dark:block" />
              GitHub
              {ghConnected && (
                <Badge variant="success" size="sm" className="ml-1 gap-1">
                  <CheckIcon className="h-3 w-3" />
                  Connected
                </Badge>
              )}
            </FrameTitle>
            <FrameDescription className="text-xs sm:text-sm">
              Connect a personal access token to browse and deploy your repositories, and to enable
              auto-deploy webhooks.
            </FrameDescription>
          </FramePanel>
          <FramePanel className="space-y-4">
            {ghConnected ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>
                    A token is stored on this server. Deploy a new service from the{" "}
                    <span className="font-medium text-foreground">Deploy</span> page to browse your
                    repositories.
                  </span>
                </div>
                <Button variant="outline" onClick={handleDisconnectGitHub} className="shrink-0">
                  Disconnect
                </Button>
              </div>
            ) : (
              <>
                <Alert variant="info">
                  <InfoIcon />
                  <AlertTitle>Create a personal access token</AlertTitle>
                  <AlertDescription>
                    Generate a PAT with{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[11px]">repo</code> scope. It
                    is stored encrypted and never leaves your server.
                  </AlertDescription>
                </Alert>
                <Button onClick={() => setGhModalOpen(true)} className="gap-1.5">
                  <GithubLight className="hidden h-4 w-4 dark:block" />
                  <GithubDark className="h-4 w-4 dark:hidden" />
                  Connect GitHub
                </Button>
              </>
            )}
          </FramePanel>
          <FrameFooter>
            <div className="flex gap-1.5 text-xs text-muted-foreground">
              <NucleoIcon name="lock" className="mt-0.5 size-3 shrink-0" />
              <p>Tokens are stored encrypted on this server and never leave it.</p>
            </div>
          </FrameFooter>
        </Frame>

        {/* Cloudflare DNS */}
        <Frame className="w-full">
          <FramePanel>
            <FrameTitle className="flex flex-wrap items-center gap-2">
              <Cloudflare className="h-5 w-5 shrink-0 text-[#f6821f]" />
              Cloudflare DNS
              {cfConnected && (
                <Badge variant="success" size="sm" className="ml-1 gap-1">
                  <CheckIcon className="h-3 w-3" />
                  Connected
                </Badge>
              )}
            </FrameTitle>
            <FrameDescription className="text-xs sm:text-sm">
              Connect a Cloudflare API token to create DNS records for custom domains with one
              click from the app&apos;s Domains tab.
            </FrameDescription>
          </FramePanel>
          <FramePanel className="space-y-4">
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
                  <Cloudflare className="h-5 w-5" />
                  {cfSaving ? "Verifying..." : "Connect Cloudflare"}
                </Button>
              </>
            )}
          </FramePanel>
          <FrameFooter>
            <div className="flex gap-1.5 text-xs text-muted-foreground">
              <NucleoIcon name="web" className="mt-0.5 size-3 shrink-0" />
              <p>DNS records are created from each app&apos;s Domains tab once connected.</p>
            </div>
          </FrameFooter>
        </Frame>
              </>
            )}

            {activeSection === "general" && (
              <>
        {/* Interface theme */}
        <Frame className="w-full">
          <FramePanel>
            <FrameTitle className="flex items-center gap-2">
              <SunIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              Interface Theme
            </FrameTitle>
            <FrameDescription className="text-xs sm:text-sm">
              Select or customize your UI theme.
            </FrameDescription>
          </FramePanel>
          <FramePanel>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {THEME_OPTIONS.map((opt) => {
                const selected = mounted && (theme ?? "system") === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    aria-pressed={selected}
                    className="group flex flex-col gap-2 text-left"
                  >
                    <span
                      className={`relative block aspect-16/10 overflow-hidden rounded-xl border-2 transition-colors ${
                        selected
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border group-hover:border-primary/40"
                      }`}
                    >
                      <ThemePreview variant={opt.id} />
                      {selected && (
                        <span className="absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                          <CheckIcon className="h-3 w-3" />
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        selected ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </FramePanel>
        </Frame>

        {/* Session + onboarding actions */}
        <Frame className="w-full">
          <FramePanel className="flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <LockIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                Session
              </p>
              <p className="text-xs text-muted-foreground">
                Signing out clears your stored admin token from this browser.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} className="shrink-0">
              Sign out
            </Button>
          </FramePanel>

          <FramePanel className="flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <RotateCcw className="h-4 w-4 shrink-0 text-muted-foreground" />
                Onboarding Setup
              </p>
              <p className="text-xs text-muted-foreground">
                Run the initial setup flow again - servers, GitHub, and your first deploy.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetModal(true)}
              className="shrink-0"
            >
              Reset
            </Button>
          </FramePanel>
        </Frame>

        {/* Custom Domain */}
        <Frame className="w-full">
          <FramePanel>
            <FrameTitle className="flex flex-wrap items-center gap-2">
              <GlobeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              Custom Domain
              {paasDomainEnvOverridden && (
                <Badge variant="warning" size="sm" className="ml-1">
                  Enforced via env
                </Badge>
              )}
            </FrameTitle>
            <FrameDescription className="text-xs sm:text-sm">
              Set up a custom domain (e.g. <code className="rounded bg-muted px-1 py-0.5 text-[11px]">paas.example.com</code>) to access this Better-PaaS dashboard. Caddy will dynamically route traffic on ports 80/443 and provision TLS certificates automatically.
            </FrameDescription>
          </FramePanel>
          <FramePanel className="space-y-4">
            {paasDomainEnvOverridden && (
              <Alert variant="info">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Environment Override Active</AlertTitle>
                <AlertDescription>
                  The domain is currently set via the <code className="rounded bg-muted px-1 py-0.5 text-[11px]">PAAS_DOMAIN</code> environment variable on your server and cannot be edited from the web interface.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs mr-2 font-semibold text-muted-foreground">Domain name</Label>
              <Input
                type="text"
                value={paasDomain}
                onChange={(e) => setPaasDomain(e.target.value)}
                disabled={paasDomainEnvOverridden}
                placeholder="paas.example.com"
                className="max-w-md font-mono text-sm"
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">
                Ensure your domain DNS points a CNAME or A record to this server IP address before saving.
              </p>
            </div>

          </FramePanel>
          <FrameFooter>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1.5 text-xs text-muted-foreground">
                <NucleoIcon name="web" className="mt-0.5 size-3 shrink-0" />
                <p>Point a CNAME or A record at this server&apos;s IP before saving the domain.</p>
              </div>
              {!paasDomainEnvOverridden && (
                <Button size="sm" onClick={handleSaveDomain} loading={savingDomain}>
                  Save Domain
                </Button>
              )}
            </div>
          </FrameFooter>
        </Frame>

        {/* About */}
        <Frame className="w-full">
          <FramePanel>
            <FrameTitle className="flex items-center gap-2">
              <NucleoIcon name="info" className="h-4 w-4 shrink-0 text-muted-foreground" />
              About Better-PaaS
            </FrameTitle>
            <FrameDescription className="text-xs sm:text-sm">
              Stack and runtime details for this node.
            </FrameDescription>
          </FramePanel>
          <FramePanel>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {[
                ["Version", cleanVersion(sysVersion?.version) || "1.0.0"],
                ["Engine", "Go 1.25 + gorilla/websocket"],
                ["Database", "SQLite (modernc.org/sqlite)"],
                ["Builder", "Nixpacks"],
                ["Proxy", "Caddy + sslip.io"],
                ["Runtime", "Docker"],
                ["Frontend", "Next.js + base-ui"],
              ].map(([key, val]) => (
                <div key={key} className="space-y-1.5">
                  <span className="block text-xs font-medium text-muted-foreground">{key}</span>
                  <span
                    className="block truncate font-mono text-sm font-medium text-foreground tabular-nums"
                    title={key === "Version" ? sysVersion?.version : undefined}
                  >
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </FramePanel>
        </Frame>
              </>
            )}
          </div>
        </div>
        </div>
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
              build cache. Running containers and named volumes (including kept database data) are
              not affected.
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

      <GitHubConnectModal
        isOpen={ghModalOpen}
        onClose={() => setGhModalOpen(false)}
        onConnected={refreshGitHub}
      />

      {/* Update confirm */}
      <AlertDialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-warning/10 text-warning sm:mx-0">
              <RefreshIcon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>
              Update to {updateStatus?.latest}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will back up your data, pull and rebuild the latest release, and restart the
              services. The dashboard and your deployed apps&apos; control plane will be briefly
              unavailable during the restart (running app containers keep serving). This can take a
              few minutes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button onClick={handleApplyUpdate} loading={applyingUpdate} className="gap-1.5">
              <DownloadIcon className="h-3.5 w-3.5" />
              Back up &amp; update
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Onboarding reset confirm */}
      <AlertDialog open={showResetModal} onOpenChange={setShowResetModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-warning/10 text-warning sm:mx-0">
              <RotateCcw className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Reset onboarding flow?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the database to set onboarding as incomplete and take you back to the initial setup flow. Your existing apps and server settings will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button variant="destructive" onClick={handleResetOnboarding} loading={resettingOnboarding} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset &amp; reload
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
