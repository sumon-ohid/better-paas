"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { NucleoIcon } from "@/components/nucleo-icons"
import { AppShell, ToastContainer, useToast } from "@/components/app-shell"
import { api } from "@/lib/api"
import type { DeploymentRecord } from "@/lib/types"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const HistoryIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const ChevronDownIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-down" />

export default function DeploymentsPage() {
  const { toasts, dismissToast } = useToast()
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDeployments = useCallback(async () => {
    try {
      const data = await api.deployments.history()
      setDeployments(data)
    } catch (err) {
      console.error("Failed to fetch deployment history", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeployments()
  }, [fetchDeployments])

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">Deployment History</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              All previous build and deployment runs across all projects.
            </p>
          </div>
          <button
            onClick={fetchDeployments}
            className="flex items-center gap-1.5 rounded-md border border-border bg-muted/15 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-all"
          >
            <HistoryIcon className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        <Card className="border-border bg-card/72 shadow-[0_18px_64px_rgba(0,0,0,.12)] backdrop-blur-xl overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <HistoryIcon className="h-6 w-6 mx-auto mb-3 opacity-30 animate-spin" />
              Loading deployment records...
            </div>
          ) : deployments.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <HistoryIcon className="h-6 w-6 mx-auto mb-3 opacity-20" />
              No deployments yet. Deploy your first service to see history here.
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground bg-muted/20">
                <span>Application</span>
                <span>Status</span>
                <span>Duration</span>
                <span>Deployed At</span>
                <span />
              </div>

              {deployments.map((dep) => (
                <div key={dep.id}>
                  <div
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3 items-center hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => setExpanded(expanded === dep.id ? null : dep.id)}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">{dep.appName}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">{dep.appId}</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full ${
                        dep.status === "success"
                          ? "bg-[#69d1a7]/15 text-[#69d1a7]"
                          : "bg-[#f26d78]/15 text-[#f26d78]"
                      }`}
                    >
                      {dep.status === "success" ? (
                        <CheckIcon className="h-3 w-3" />
                      ) : (
                        <XIcon className="h-3 w-3" />
                      )}
                      {dep.status}
                    </div>

                    <span className="text-xs font-mono text-muted-foreground">{dep.duration}</span>

                    <span className="text-xs text-muted-foreground">
                      {new Date(dep.createdAt).toLocaleString()}
                    </span>

                    <ChevronDownIcon
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                        expanded === dep.id ? "rotate-180" : ""
                      }`}
                    />
                  </div>

                  {/* Expanded log view */}
                  {expanded === dep.id && (
                    <div className="border-t border-border/30 bg-[#090a0f] px-4 py-3 font-mono text-xs text-slate-300 max-h-80 overflow-y-auto space-y-1">
                      {dep.logs.length === 0 ? (
                        <span className="text-slate-500 italic">No log output recorded.</span>
                      ) : (
                        dep.logs.map((line, i) => (
                          <div key={i} className="flex gap-3">
                            <span className="text-slate-600 select-none shrink-0">{i + 1}</span>
                            <span
                              className={
                                line.startsWith("✖") || line.includes("Error")
                                  ? "text-rose-400"
                                  : line.startsWith("✅") || line.startsWith("✔")
                                    ? "text-[#93e0c0]"
                                    : "text-slate-300"
                              }
                            >
                              {line}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppShell>
  )
}
