"use client"

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LogoMark } from "@/components/logo-mark"
import { Eye, EyeOff, ShieldCheck } from "lucide-react"
import { authApi, connectAgentApi } from "@/lib/api"
import { getToken, setToken, clearToken } from "@/lib/auth"

type Phase = "checking" | "login" | "authorize" | "done" | "error"

const PROFILES = [
  {
    id: "observer",
    label: "Observer",
    description: "Read apps, logs, and metrics only",
  },
  {
    id: "deployer",
    label: "Deployer",
    description: "Deploy, redeploy, stop/start apps (recommended)",
  },
  {
    id: "operator",
    label: "Operator",
    description: "Full day-to-day ops including addons and backups",
  },
] as const

function ConnectAgentContent() {
  const searchParams = useSearchParams()
  const state = searchParams.get("state")?.trim() ?? ""
  const portRaw = searchParams.get("port")?.trim() ?? ""
  const port = Number.parseInt(portRaw, 10)

  const [phase, setPhase] = useState<Phase>("checking")
  const [error, setError] = useState("")

  const [tokenInput, setTokenInput] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [loginSubmitting, setLoginSubmitting] = useState(false)

  const [agentName, setAgentName] = useState("CLI Agent")
  const [profile, setProfile] = useState<(typeof PROFILES)[number]["id"]>("deployer")
  const [authorizing, setAuthorizing] = useState(false)

  const paramsValid = useMemo(
    () => state.length >= 16 && Number.isFinite(port) && port >= 1024 && port <= 65535,
    [state, port],
  )

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAgentName(`${window.location.hostname} CLI`)
    }
  }, [])

  useEffect(() => {
    if (!paramsValid) {
      setPhase("error")
      setError("Missing or invalid connect link. Run paas connect from your terminal again.")
      return
    }
    const stored = getToken()
    if (stored) {
      authApi
        .verify(stored)
        .then(() => setPhase("authorize"))
        .catch(() => {
          clearToken()
          setPhase("login")
        })
    } else {
      setPhase("login")
    }
  }, [paramsValid])

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const candidate = tokenInput.trim()
      if (!candidate) {
        setError("Enter your admin token.")
        return
      }
      setLoginSubmitting(true)
      setError("")
      clearToken()
      try {
        await authApi.verify(candidate)
        setToken(candidate)
        setTokenInput("")
        setPhase("authorize")
      } catch (err) {
        const status = (err as { status?: number }).status
        setError(
          status === 401
            ? "Invalid admin token."
            : "Could not reach the API. Is the backend running on port 8080?",
        )
      } finally {
        setLoginSubmitting(false)
      }
    },
    [tokenInput],
  )

  const handleAuthorize = useCallback(async () => {
    const name = agentName.trim()
    if (!name) {
      setError("Agent name is required.")
      return
    }
    setAuthorizing(true)
    setError("")
    try {
      const res = await connectAgentApi.approve({
        state,
        profile,
        name,
        port,
      })
      setPhase("done")
      window.location.href = res.callbackUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authorization failed.")
    } finally {
      setAuthorizing(false)
    }
  }, [agentName, profile, port, state])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <LogoMark className="size-10" aria-label="Better-PaaS" />
          <h1 className="mt-4 text-lg font-semibold tracking-tight">
            Connect CLI Agent
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Authorize the PaaS CLI on this computer to manage your apps.
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {phase === "checking" && (
          <p className="mt-6 text-center text-sm text-muted-foreground">Checking session…</p>
        )}

        {phase === "login" && (
          <form onSubmit={handleLogin} className="mt-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              Login to Better-PaaS with your admin token to continue.
            </p>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value)
                  setError("")
                }}
                placeholder="Admin token"
                className="h-10 pr-10 font-mono text-sm"
                autoComplete="off"
                autoFocus
                disabled={loginSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowToken((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="submit" className="w-full" loading={loginSubmitting}>
              Login and continue
            </Button>
          </form>
        )}

        {phase === "authorize" && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Agent name</label>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="mt-1.5"
                placeholder="My MacBook CLI"
              />
            </div>

            <div>
              <p className="text-sm font-medium">Permission profile</p>
              <div className="mt-2 space-y-2">
                {PROFILES.map((p) => (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                      profile === p.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="profile"
                      value={p.id}
                      checked={profile === p.id}
                      onChange={() => setProfile(p.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium">{p.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {p.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                A scoped agent token is created for this machine. Your admin token
                is never sent to the CLI — only a revocable <code className="rounded bg-muted px-1">bpagt_</code> token is saved locally.
              </span>
            </div>

            <Button
              className="w-full"
              onClick={handleAuthorize}
              loading={authorizing}
            >
              Authorize CLI
            </Button>
          </div>
        )}

        {phase === "done" && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Authorized. Returning to the CLI…
          </p>
        )}

        {phase === "error" && !error && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Invalid connect request.
          </p>
        )}
      </div>
    </div>
  )
}

export default function ConnectAgentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ConnectAgentContent />
    </Suspense>
  )
}
