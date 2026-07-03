"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LogoMark } from "@/components/logo-mark"
import { Button } from "@/components/ui/button"
import { NucleoIcon } from "@/components/nucleo-icons"
import { GitHubConnectModal } from "@/components/github-connect-modal"
import OnboardCard from "@/components/ui/onboard-card"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { api } from "@/lib/api"
import type { Server } from "@/lib/types"
import { ArrowLeft, Check, RotateCcw } from "lucide-react"
import { AddServerWizard } from "@/app/servers/page"
import { Badge } from "@/components/ui/badge"
import { IconMonitor, IconServer2 } from "nucleo-isometric"

// OnboardingGate shows a one-time welcome flow on first sign-in. It sits inside
// AuthGate, so it only renders for an authenticated admin. The "completed" flag
// is persisted on the backend (meta table) so the flow never reappears, across
// browsers and after a localStorage clear.
//
// Flow: Welcome (checklist + Let's go / Skip) → Connect GitHub → Deploy first
// app → Complete. Every step can be skipped - onboarding never blocks the user
// from reaching the dashboard.

type Phase = "loading" | "active" | "done"
type Step = "welcome" | "server" | "github" | "deploy" | "complete"

const STEP_ORDER: Step[] = ["server", "github", "deploy", "complete"]
const STEP_LABELS: Record<Step, string> = {
  welcome: "Welcome",
  server: "Server",
  github: "Connect GitHub",
  deploy: "Deploy",
  complete: "Complete",
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("loading")
  const [step, setStep] = useState<Step>("welcome")
  const [ghConnected, setGhConnected] = useState(false)
  const [ghModalOpen, setGhModalOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)

  // Decide whether to show onboarding. If the call fails (e.g. older backend
  // without the endpoint), fail open: skip onboarding rather than block.
  const check = useCallback(async () => {
    try {
      const { completed } = await api.system.onboarding()
      if (completed) {
        setPhase("done")
        return
      }
      // Pre-fill GitHub connection state so a returning, half-onboarded admin
      // sees the correct status.
      api.git
        .tokenStatus()
        .then((s) => setGhConnected(s.connected))
        .catch(() => {})
      setPhase("active")
    } catch {
      setPhase("done")
    }
  }, [])

  useEffect(() => {
    // check is async; phase is set after the await resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    check()
  }, [check])

  const persistComplete = useCallback(async () => {
    setFinishing(true)
    try {
      await api.system.completeOnboarding()
    } catch {
      // Non-fatal: if persistence fails the flow may reappear next load, which
      // is acceptable and better than trapping the user here.
    } finally {
      setFinishing(false)
      setPhase("done")
    }
  }, [])

  const refreshGitHub = useCallback(() => {
    api.git
      .tokenStatus()
      .then((s) => setGhConnected(s.connected))
      .catch(() => {})
  }, [])

  // Finish onboarding and jump straight into the deploy wizard.
  const finishAndDeploy = useCallback(async () => {
    await persistComplete()
    router.push("/deploy")
  }, [persistComplete, router])

  // Step back through the flow. From the first real step we return to the
  // welcome screen, effectively restarting onboarding from the top.
  const goBack = useCallback(() => {
    const idx = STEP_ORDER.indexOf(step)
    if (idx <= 0) {
      setStep("welcome")
    } else {
      setStep(STEP_ORDER[idx - 1])
    }
  }, [step])

  const restart = useCallback(() => setStep("welcome"), [])

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <OnboardCard
          duration={3000}
          step1="Connecting"
          step2="Loading workspace"
          step3="Almost ready"
        />
      </div>
    )
  }

  if (phase === "done") {
    return <>{children}</>
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-y-auto bg-background p-4">
      <div className="w-full max-w-xl py-8">
        {step === "welcome" ? (
          <WelcomeScreen onStart={() => setStep("server")} onSkip={persistComplete} skipping={finishing} />
        ) : (
          <>
            <StepProgress current={step} />
            <div className="mt-8">
              {step === "server" && (
                <ChooseServerStep
                  onContinue={() => setStep("github")}
                  onSkip={() => setStep("github")}
                />
              )}
              {step === "github" && (
                <ConnectGitHubStep
                  connected={ghConnected}
                  onConnect={() => setGhModalOpen(true)}
                  onContinue={() => setStep("deploy")}
                  onSkip={() => setStep("deploy")}
                />
              )}
              {step === "deploy" && (
                <DeployStep onDeploy={finishAndDeploy} onSkip={() => setStep("complete")} busy={finishing} />
              )}
              {step === "complete" && <CompleteStep onFinish={persistComplete} busy={finishing} />}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={restart}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restart
              </button>
            </div>
          </>
        )}
      </div>

      <GitHubConnectModal
        isOpen={ghModalOpen}
        onClose={() => setGhModalOpen(false)}
        onConnected={() => {
          refreshGitHub()
          setGhConnected(true)
        }}
      />
    </div>
  )
}

// ── Welcome ──────────────────────────────────────────────────────────────────

function WelcomeScreen({
  onStart,
  onSkip,
  skipping,
}: {
  onStart: () => void
  onSkip: () => void
  skipping: boolean
}) {
  const items = [
    { title: "Setup server", desc: "Choose localhost or connect a remote VPS." },
    { title: "Connect GitHub", desc: "Link a token to browse and deploy your repositories." },
    { title: "Deploy your first app", desc: "Pick a repo and branch - we build and run it for you." },
    { title: "Manage everything", desc: "Logs, metrics, domains, databases, and backups in one place." },
  ]
  return (
    <div className="flex flex-col items-center text-center animate-in fade-in-50 duration-300">
      <LogoMark className="size-11" aria-label="Better-PaaS" />
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">Welcome to Better-PaaS</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Set up servers, connect GitHub, and deploy your first app in minutes.
      </p>

      <div className="mt-7 w-full rounded-xl border border-border bg-card/40 p-5 text-left">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          What you&apos;ll set up
        </p>
        <ul className="space-y-3.5">
          {items.map((it) => (
            <li key={it.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="h-3 w-3" />
              </span>
              <span className="space-y-0.5">
                <span className="block text-sm font-medium text-foreground">{it.title}</span>
                <span className="block text-[12px] leading-snug text-muted-foreground">{it.desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Button onClick={onStart} className="mt-7 h-11 w-full max-w-xs text-sm font-semibold">
        Let&apos;s go
      </Button>
      <button
        type="button"
        onClick={onSkip}
        disabled={skipping}
        className="mt-3 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        Skip setup
      </button>
    </div>
  )
}

// ── Stepper ──────────────────────────────────────────────────────────────────

function StepProgress({ current }: { current: Step }) {
  const currentIndex = STEP_ORDER.indexOf(current)
  return (
    <div className="flex items-start justify-center">
      {STEP_ORDER.map((s, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        return (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-success bg-success/15 text-success"
                      : "border-border bg-card/40 text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-[11px] font-medium ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
            {i < STEP_ORDER.length - 1 && (
              // Pin the connector to the vertical center of the circles (h-8 → 16px)
              // so it doesn't drift down toward the labels below.
              <div
                className={`mx-2 mt-4 h-px w-16 -translate-y-1/2 transition-colors sm:w-24 ${
                  i < currentIndex ? "bg-success/50" : "bg-border"
                }`}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ── Step shell ───────────────────────────────────────────────────────────────

function StepCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-6 animate-in fade-in-50 duration-200">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  )
}

// ── Step 1: GitHub ───────────────────────────────────────────────────────────

function ConnectGitHubStep({
  connected,
  onConnect,
  onContinue,
  onSkip,
}: {
  connected: boolean
  onConnect: () => void
  onContinue: () => void
  onSkip: () => void
}) {
  return (
    <StepCard
      icon={
        <>
          <GithubLight className="h-6 w-6 dark:hidden" />
          <GithubDark className="hidden h-6 w-6 dark:block" />
        </>
      }
      title="Connect GitHub"
      description="Link a personal access token so you can browse and deploy your repositories. It is stored encrypted on your server and never leaves."
    >
      {connected ? (
        <div className="flex flex-col items-center gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-sm font-medium text-success">
            <Check className="h-3.5 w-3.5" />
            GitHub connected
          </span>
          <Button onClick={onContinue} className="h-10 w-full max-w-xs text-sm">
            Continue
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Button onClick={onConnect} className="h-10 w-full max-w-xs gap-2 text-sm">
            <GithubLight className="h-4 w-4 dark:hidden" />
            <GithubDark className="hidden h-4 w-4 dark:block" />
            Connect GitHub
          </Button>
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            I&apos;ll do this later
          </button>
        </div>
      )}
    </StepCard>
  )
}

// ── Step 2: Deploy ───────────────────────────────────────────────────────────

function DeployStep({
  onDeploy,
  onSkip,
  busy,
}: {
  onDeploy: () => void
  onSkip: () => void
  busy: boolean
}) {
  return (
    <StepCard
      icon={<NucleoIcon name="layers" className="h-6 w-6" />}
      title="Deploy your first app"
      description="Pick a repository and branch - Better-PaaS builds it with Nixpacks, runs it as a container, and routes it through Caddy automatically."
    >
      <div className="flex flex-col items-center gap-3">
        <Button onClick={onDeploy} loading={busy} className="h-10 w-full max-w-xs gap-1.5 text-sm">
          <NucleoIcon name="plus" className="h-4 w-4" />
          Deploy an app
        </Button>
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          Skip, I&apos;ll do it later
        </button>
      </div>
    </StepCard>
  )
}

// ── Step 3: Complete ─────────────────────────────────────────────────────────

function CompleteStep({ onFinish, busy }: { onFinish: () => void; busy: boolean }) {
  return (
    <StepCard
      icon={<Check className="h-6 w-6" />}
      title="You're all set"
      description="That's the basics. You can connect GitHub, deploy apps, add databases, and configure backups any time from the dashboard."
    >
      <div className="flex justify-center">
        <Button onClick={onFinish} loading={busy} className="h-10 w-full max-w-xs text-sm font-semibold">
          Go to dashboard
        </Button>
      </div>
    </StepCard>
  )
}

function ChooseServerStep({
  onContinue,
  onSkip,
}: {
  onContinue: () => void
  onSkip: () => void
}) {
  const [selectedOption, setSelectedOption] = useState<"localhost" | "remote">("localhost")
  const [showWizard, setShowWizard] = useState(false)
  const [vpsConnected, setVpsConnected] = useState(false)
  const [connectedVpsName, setConnectedVpsName] = useState("")

  const handleAdded = (server: Server) => {
    if (server.status === "connected") {
      setVpsConnected(true)
      setConnectedVpsName(server.name)
      setSelectedOption("remote")
    }
  }

  const handleNext = () => {
    onContinue()
  }

  return (
    <StepCard
      icon={<NucleoIcon name="cloud" className="h-6 w-6" />}
      title="Choose your deployment target"
      description="Your apps will run on a server. Use this server (Localhost) for personal projects, or connect a remote VPS for production."
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Localhost Option Card */}
          <button
            type="button"
            onClick={() => setSelectedOption("localhost")}
            className={`flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer ${
              selectedOption === "localhost"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-card/40 hover:bg-accent/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <IconMonitor className="h-7 w-7 text-foreground" />
              <span className="text-sm font-semibold text-foreground">Use This Server (Localhost)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Default. Deploys apps directly onto this server. Fast, zero configuration, perfect for development.
            </p>
          </button>

          {/* Remote Option Card */}
          <button
            type="button"
            onClick={() => {
              setSelectedOption("remote")
              if (!vpsConnected) {
                setShowWizard(true)
              }
            }}
            className={`flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer ${
              selectedOption === "remote"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-card/40 hover:bg-accent/20"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <IconServer2 className="h-7 w-7 text-foreground" />
                <span className="text-sm font-semibold text-foreground">Remote Server</span>
                <Badge variant="info" size="sm" className="font-semibold">Recommended</Badge>
              </div>
              {vpsConnected && <span className="h-2 w-2 rounded-full bg-success animate-pulse" />}
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {vpsConnected
                ? `Successfully connected remote server: "${connectedVpsName}". Ready for deployment.`
                : "Connect a remote VPS or VM over SSH. Run apps in production environments securely."}
            </p>
            {!vpsConnected && (
              <span className="text-xs text-primary font-medium mt-3 inline-flex items-center gap-1">
                <NucleoIcon name="plus" className="h-3.5 w-3.5" />
                Add remote VPS
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 mt-4">
          <Button onClick={handleNext} className="h-10 w-full max-w-xs text-sm font-semibold">
            Continue
          </Button>
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            I&apos;ll configure this later
          </button>
        </div>
      </div>

      <AddServerWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onAdded={handleAdded}
      />
    </StepCard>
  )
}
