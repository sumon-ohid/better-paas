"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

export function GitHubConnectModal({ isOpen, onClose, onConnected }: GitHubConnectModalProps) {
  const [step, setStep] = useState<ConnectionStep>("intro")
  const [token, setToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  if (!isOpen) return null

  const githubTokenUrl =
    "https://github.com/settings/tokens/new?description=BaaS+Deploy+Token&scopes=repo,read:user"

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

  const handleClose = () => {
    setStep("intro")
    setToken("")
    setError("")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-md mx-4 bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
              <GithubLight className="h-5 w-5 dark:hidden" />
              <GithubDark className="h-5 w-5 hidden dark:block" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Connect GitHub</h3>
              <p className="text-[11px] text-muted-foreground">Secure access to your repositories</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <NucleoIcon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {step === "intro" && (
            <div className="space-y-5 animate-in fade-in-50">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Create a token</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Generate a PAT with <code className="bg-muted px-1 py-0.5 rounded text-[10px]">repo</code> scope.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Paste it here</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Your token is saved on your server and never leaves it.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Browse and deploy</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Pick any repo, select a branch, and go.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <a
                  href={githubTokenUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
                >
                  <GithubLight className="h-4 w-4" />
                  Generate Token on GitHub
                  <NucleoIcon name="external" className="h-3 w-3 opacity-60" />
                </a>

                <Button
                  onClick={() => setStep("paste")}
                  variant="outline"
                  className="w-full h-9 text-sm"
                >
                  I already have a token
                </Button>
              </div>
            </div>
          )}

          {step === "paste" && (
            <div className="space-y-4 animate-in fade-in-50">
              <div className="space-y-1.5">
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
                    className="h-9 text-sm font-mono pr-10"
                    autoComplete="off"
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {error && <p className="text-[11px] text-rose-500 mt-1">{error}</p>}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => setStep("intro")}
                  variant="outline"
                  className="flex-1 h-9 text-sm"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !token.trim()}
                  className="flex-1 h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Save Token"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
