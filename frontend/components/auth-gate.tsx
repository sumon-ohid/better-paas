"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NucleoIcon } from "@/components/nucleo-icons"
import { Eye, EyeOff, RefreshCw } from "lucide-react"
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
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (phase === "locked") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
        <div className="pointer-events-none absolute inset-0 bg-pixel-grid opacity-70 mask-fade-radial" />
        <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card/72 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-border/50 px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <NucleoIcon name="lock" className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">Better-PaaS</h1>
              <p className="text-xs text-muted-foreground">Sign in to your control plane</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Admin Token
              </label>
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
              {error && <p className="mt-1 text-xs text-destructive-foreground">{error}</p>}
            </div>

            <Button
              type="submit"
              disabled={!tokenInput.trim()}
              loading={submitting}
              className="w-full"
            >
              {submitting ? "Verifying…" : "Sign In"}
            </Button>

            <p className="text-xs leading-relaxed text-muted-foreground/70">
              Your admin token was generated when the backend first started.
              On your server, get it with any of these:
            </p>
            <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground/70">
              <li>
                <code className="rounded bg-muted px-1 py-0.5">./server token</code> (or{" "}
                <code className="rounded bg-muted px-1 py-0.5">docker exec &lt;container&gt; ./server token</code>)
              </li>
              <li>
                <code className="rounded bg-muted px-1 py-0.5">cat data/admin_token.txt</code>
              </li>
              <li>backend startup logs (journalctl / docker logs)</li>
            </ul>
          </form>
        </div>
      </div>
    )
  }

  return <AuthContext.Provider value={{ signOut }}>{children}</AuthContext.Provider>
}
