"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog } from "@/components/ui/dialog"
import {
  FramedDialog,
  FramedDialogBody,
  FramedDialogFooter,
  FramedDialogHeader,
} from "@/components/framed-dialog"
import { NucleoIcon } from "@/components/nucleo-icons"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { Eye, EyeOff } from "lucide-react"
import { api } from "@/lib/api"

interface GitHubConnectModalProps {
  isOpen: boolean
  onClose: () => void
  onConnected: () => void
}

type ConnectionStep = "intro" | "paste"

const STEPS = [
  {
    title: "Create a token",
    description: (
      <>
        Generate a PAT with{" "}
        <code className="font-mono text-[11px] text-foreground/80">repo</code> and{" "}
        <code className="font-mono text-[11px] text-foreground/80">admin:repo_hook</code>{" "}
        scopes.
      </>
    ),
  },
  {
    title: "Paste it here",
    description: "Your token is saved on your server and never leaves it.",
  },
  {
    title: "Browse and deploy",
    description:
      "Pick a repo and branch — push webhooks are registered automatically.",
  },
] as const

const githubTokenUrl =
  "https://github.com/settings/tokens/new?description=BaaS+Deploy+Token&scopes=repo,read:user,admin:repo_hook"

export function GitHubConnectModal({
  isOpen,
  onClose,
  onConnected,
}: GitHubConnectModalProps) {
  const [step, setStep] = useState<ConnectionStep>("intro")
  const [token, setToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const resetState = () => {
    setStep("intro")
    setToken("")
    setError("")
    setShowToken(false)
  }

  const handleSave = async () => {
    if (!token.trim()) {
      setError("Please enter a token")
      return
    }

    setIsSaving(true)
    setError("")

    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: "application/vnd.github.v3+json",
        },
      })

      if (!res.ok) {
        setError(
          res.status === 401
            ? "Invalid token. Please check and try again."
            : `GitHub API error: ${res.status}`,
        )
        return
      }

      await api.git.saveToken(token.trim())
      resetState()
      onConnected()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save token")
    } finally {
      setIsSaving(false)
    }
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
      <FramedDialog contentClassName="max-w-md">
        <FramedDialogHeader
          icon={
            <>
              <GithubLight className="h-6 w-6 dark:hidden" />
              <GithubDark className="hidden h-6 w-6 dark:block" />
            </>
          }
          title="Connect GitHub"
          description="Secure access to your repositories"
        />

        <FramedDialogBody>
          {step === "intro" ? (
            <ol className="space-y-4">
              {STEPS.map((item, index) => (
                <li key={item.title} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    {index < STEPS.length - 1 ? (
                      <span
                        aria-hidden
                        className="mt-2.5 w-px flex-1 min-h-3 bg-border/70"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 pb-1">
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="space-y-2">
              <Label
                htmlFor="github-token"
                className="text-xs font-semibold text-muted-foreground"
              >
                Personal access token
              </Label>
              <div className="relative">
                <Input
                  id="github-token"
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
                  aria-invalid={error ? true : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showToken ? "Hide token" : "Show token"}
                >
                  {showToken ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {error ? (
                <p className="text-[11px] text-destructive">{error}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Paste a classic or fine-grained token with repository access.
                </p>
              )}
            </div>
          )}
        </FramedDialogBody>

        {step === "intro" ? (
          <FramedDialogFooter
            pinned
            className="flex-col items-stretch gap-2 sm:flex-col"
          >
            <Button
              render={
                <a
                  href={githubTokenUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              className="w-full gap-2"
            >
              <GithubLight className="hidden h-4 w-4 dark:block" />
              <GithubDark className="h-4 w-4 dark:hidden" />
              Generate token on GitHub
              <NucleoIcon name="external" className="h-3.5 w-3.5 opacity-70" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => setStep("paste")}
              className="w-full"
            >
              I already have a token
            </Button>
          </FramedDialogFooter>
        ) : (
          <FramedDialogFooter pinned>
            <Button variant="ghost" onClick={() => setStep("intro")}>
              Back
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !token.trim()}
              loading={isSaving}
            >
              Save token
            </Button>
          </FramedDialogFooter>
        )}
      </FramedDialog>
    </Dialog>
  )
}
