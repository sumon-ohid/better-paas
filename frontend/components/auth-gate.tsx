"use client"

import React, { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eye, EyeOff } from "lucide-react"
import OnboardCard from "@/components/ui/onboard-card"
import { authApi } from "@/lib/api"
import { getToken, setToken, clearToken } from "@/lib/auth"

type Phase = "checking" | "locked" | "unlocked"

interface AuthContextValue {
  signOut: () => void
}

const AuthContext = React.createContext<AuthContextValue>({ signOut: () => {} })

export function useAuth() {
  return React.useContext(AuthContext)
}

/**
 * AuthGate blocks the dashboard until a valid admin token is provided.
 *
 * On mount it validates any stored token against the backend. If none is
 * present or it is rejected, a login screen is shown. The admin token is
 * generated on the server's first run (printed to the logs and written to
 * data/admin_token.txt).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking")
  const [tokenInput, setTokenInput] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const verifyStored = useCallback(async () => {
    const stored = getToken()
    if (!stored) {
      setPhase("locked")
      return
    }
    try {
      await authApi.verify(stored)
      setPhase("unlocked")
    } catch {
      clearToken()
      setPhase("locked")
    }
  }, [])

  useEffect(() => {
    // verifyStored is async; phase is set after the await resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    verifyStored()
  }, [verifyStored])

  const signOut = useCallback(() => {
    clearToken()
    setTokenInput("")
    setPhase("locked")
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const candidate = tokenInput.trim()
      if (!candidate) {
        setError("Enter your admin token.")
        return
      }
      setSubmitting(true)
      setError("")
      try {
        await authApi.verify(candidate)
        setToken(candidate)
        setTokenInput("")
        setPhase("unlocked")
      } catch (err) {
        const status = (err as { status?: number }).status
        setError(status === 401 ? "Invalid token. Check data/admin_token.txt on your server." : "Could not reach the backend. Is it running?")
      } finally {
        setSubmitting(false)
      }
    },
    [tokenInput],
  )

  if (phase === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <OnboardCard
          duration={3000}
          step1="Connecting"
          step2="Verifying session"
          step3="Loading dashboard"
        />
      </div>
    )
  }

  if (phase === "locked") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex w-full max-w-sm flex-col items-center text-center">
          {/* Logo */}
          <Image
            src="/logo.svg"
            alt="Better-PaaS Logo"
            width={8340}
            height={840}
            className="size-10"
          />

          {/* Heading */}
          <h1 className="mt-5 text-xl font-bold tracking-tight text-foreground">
            Sign in to Better-PaaS
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your admin token to access your control plane.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 w-full space-y-3">
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value)
                  setError("")
                }}
                placeholder="Paste your admin token"
                className="h-10 pr-10 font-mono text-sm"
                autoComplete="off"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowToken((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-destructive-foreground">{error}</p>}

            <Button
              type="submit"
              disabled={!tokenInput.trim()}
              loading={submitting}
              className="w-full"
            >
              {submitting ? "Verifying…" : "Sign In"}
            </Button>
          </form>

          {/* Info */}
          <div className="mt-8 w-full border-t border-border/50 pt-5">
            <p className="text-xs leading-relaxed text-muted-foreground/70">
              Your admin token was generated when the backend first started.
              Retrieve it using one of these methods:
            </p>
            <div className="mt-3 space-y-3 text-left text-xs leading-relaxed text-muted-foreground/70">
              <div>
                <span className="font-semibold text-foreground">For Standard Installation:</span>
                <ul className="mt-1 ml-4 list-disc space-y-0.5">
                  <li>Check backend startup logs or systemd service logs.</li>
                  <li>Run <code className="rounded bg-muted px-1 py-0.5">./server token</code> inside your backend directory.</li>
                </ul>
              </div>
              <div>
                <span className="font-semibold text-foreground">For Docker Installation:</span>
                <ul className="mt-1 ml-4 list-disc space-y-0.5">
                  <li>Run <code className="rounded bg-muted px-1 py-0.5">docker logs better-paas</code></li>
                  <li>Run <code className="rounded bg-muted px-1 py-0.5">docker exec -it better-paas /app/server token</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <AuthContext.Provider value={{ signOut }}>{children}</AuthContext.Provider>
}
