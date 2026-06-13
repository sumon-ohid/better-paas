"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { NucleoIcon } from "@/components/nucleo-icons"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { Eye, EyeOff, RefreshCw } from "lucide-react"
import { api } from "@/lib/api"

interface GitHubConnectModalProps {
  isOpen: boolean
  onClose: () => void
  onConnected: () => void
}

type ConnectionStep = "intro" | "paste"

const STEPS = [
  { n: 1, title: "Create a token", desc: "Generate a PAT with repo and admin:repo_hook scopes." },
  { n: 2, title: "Paste it here", desc: "Your token is saved on your server and never leaves it." },
  { n: 3, title: "Browse and deploy", desc: "Pick a repo and branch — push webhooks are registered automatically." },
]

export function GitHubConnectModal({ isOpen, onClose, onConnected }: GitHubConnectModalProps) {
  const [step, setStep] = useState<ConnectionStep>("intro")
  const [token, setToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const githubTokenUrl =
    "https://github.com/settings/tokens/new?description=BaaS+Deploy+Token&scopes=repo,read:user,admin:repo_hook"

  const handleSave = async () => {
    if (!token.trim()) {
      setError("Please enter a token")
      return
    }

    setIsSaving(true)
    setError("")

    try {
      // Validate token first
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: "application/vnd.github.v3+json",
        },
      })

      if (!res.ok) {
        if (res.status === 401) {
          setError("Invalid token. Please check and try again.")
        } else {
          setError(`GitHub API error: ${res.status}`)
        }
        setIsSaving(false)
        return
      }

      // Save to backend
      await api.git.saveToken(token.trim())

      // Reset and notify
      setStep("intro")
      setToken("")
      setError("")
      onConnected()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save token")
    } finally {
      setIsSaving(false)
    }
  }

  const resetState = () => {
    setStep("intro")
    setToken("")
    setError("")
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          resetState()
          onClose()
        }
      }}
    >
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
              <GithubLight className="h-5 w-5 dark:hidden" />
              <GithubDark className="hidden h-5 w-5 dark:block" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base">Connect GitHub</DialogTitle>
              <DialogDescription className="text-xs">
                Secure access to your repositories
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogPanel>
          {step === "intro" ? (
            <div className="space-y-5 animate-in fade-in-50">
              <div className="space-y-3">
                {STEPS.map((s) => (
                  <div key={s.n} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-xs font-bold text-primary">{s.n}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {s.title === "Create a token" ? (
                          <>
                            Generate a PAT with{" "}
                            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">repo</code>{" "}
                            and{" "}
                            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">admin:repo_hook</code>{" "}
                            scopes.
                          </>
                        ) : (
                          s.desc
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-1">
                <a
                  href={githubTokenUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
                >
                  <GithubLight className="hidden h-5 w-5 dark:block" />
                  <GithubDark className="h-5 w-5 dark:hidden" />
                  Generate Token on GitHub
                  <NucleoIcon name="external" className="h-3 w-3 opacity-60" />
                </a>

                <Button
                  onClick={() => setStep("paste")}
                  variant="outline"
                  className="h-9 w-full text-sm"
                >
                  I already have a token
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 animate-in fade-in-50">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Personal Access Token
              </label>
              <div className="relative">
                <Input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value)
                    setError("")
                  }}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="h-9 pr-10 font-mono text-sm"
                  autoComplete="off"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showToken ? "Hide token" : "Show token"}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && <p className="mt-1 text-[11px] text-destructive-foreground">{error}</p>}
            </div>
          )}
        </DialogPanel>

        {step === "paste" && (
          <DialogFooter>
            <Button onClick={() => setStep("intro")} variant="outline" className="h-9 text-sm">
              Back
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !token.trim()}
              className="h-9 gap-1.5 text-sm"
            >
              {isSaving && <RefreshCw className="h-3 w-3 animate-spin" />}
              {isSaving ? "Saving..." : "Save Token"}
            </Button>
          </DialogFooter>
        )}

        {/* Hidden close target so Esc / backdrop close work through the primitive */}
        <DialogClose className="sr-only">Close</DialogClose>
      </DialogPopup>
    </Dialog>
  )
}
