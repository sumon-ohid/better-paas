"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { NucleoIcon } from "@/components/nucleo-icons"
import { AppShell, ToastContainer, useToast } from "@/components/app-shell"
import { api } from "@/lib/api"
import type { App, DeploymentRecord } from "@/lib/types"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const ChevronLeftIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-left" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const ChevronDownIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-down" />
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const GitBranchIcon = (props: IconProps) => <NucleoIcon {...props} name="branch" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />

export default function ProjectDeploymentsPage() {
  const router = useRouter()
  const params = useParams()
  const appId = params.appId as string

  const { toasts, dismissToast } = useToast()
  const [app, setApp] = useState<App | null>(null)
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [appsData, deplData] = await Promise.all([
        api.apps.list(),
        api.deployments.history(),
      ])
      const found = appsData.find((a) => a.id === appId) ?? null
      setApp(found)
      // Filter to only this project's deployments, newest first
      setDeployments(deplData.filter((d) => d.appId === appId))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [appId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRedeploy = async () => {
    if (!app) return
    try {
      await api.apps.redeploy(app.id)
      // Redirect to live build log
      router.push(`/logs?appId=${app.id}&mode=build`)
    } catch (err) {
      console.error("Redeploy failed", err)
    }
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Back to deployments list */}
            <button
              onClick={() => router.push("/deployments")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              All Projects
            </button>

            <span className="h-4 w-px bg-border" />

            <div>
              <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                {app?.name ?? appId}
                {app && (
                  <span
                    className={`text-[11px] font-mono px-1.5 py-0.5 rounded-full ${
                      app.status === "running"
                        ? "bg-[#69d1a7]/15 text-[#69d1a7]"
                        : app.status === "building"
                          ? "bg-amber-400/15 text-amber-400"
                          : app.status === "failed"
                            ? "bg-rose-500/15 text-rose-400"
                            : "bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {app.status}
                  </span>
                )}
              </h1>
               {app && (
                 <p className="text-xs font-mono text-muted-foreground mt-0.5">
                   <a
                     href={app.gitRepo}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="hover:text-primary transition-colors"
                   >
                     {app.gitRepo}
                   </a>
                   {app.branch && (
                     <span className="ml-2 inline-flex items-center gap-1">
                       <GitBranchIcon className="h-3 w-3" />
                       {app.branch}
                     </span>
                   )}
                 </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 rounded-md border border-border bg-muted/15 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-all"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              Refresh
            </button>

            {/* Live logs shortcut */}
            {app && (
              <button
                onClick={() => router.push(`/logs?appId=${app.id}&mode=runtime`)}
                className="flex items-center gap-1.5 rounded-md border border-border bg-muted/15 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-all"
              >
                <TerminalIcon className="h-3.5 w-3.5" />
                Live Logs
              </button>
            )}

            {/* Redeploy */}
            {app && (
              <button
                onClick={handleRedeploy}
                className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/20 cursor-pointer transition-all"
              >
                <PlayIcon className="h-3.5 w-3.5" />
                Redeploy
              </button>
            )}
          </div>
        </div>

        {/* ── Stats row ──────────────────────────────────────────────── */}
        {!loading && deployments.length > 0 && (
          <div className="flex gap-6 text-sm">
            {[
              { label: "Total deployments", value: deployments.length },
              {
                label: "Successful",
                value: deployments.filter((d) => d.status === "success").length,
                color: "text-[#69d1a7]",
              },
              {
                label: "Failed",
                value: deployments.filter((d) => d.status === "failed").length,
                color: "text-rose-400",
              },
              {
                label: "Last deploy",
                value: new Date(deployments[0].createdAt).toLocaleDateString(),
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col">
                <span className={`font-bold text-lg font-mono ${color ?? "text-foreground"}`}>
                  {value}
                </span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Deployment list ─────────────────────────────────────────── */}
        {loading ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            <RefreshIcon className="h-5 w-5 mx-auto mb-3 opacity-30 animate-spin" />
            Loading deployment history...
          </div>
        ) : deployments.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            <RefreshIcon className="h-5 w-5 mx-auto mb-3 opacity-20" />
            No deployments recorded for this project yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card/72 backdrop-blur-xl divide-y divide-border/40">
            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground bg-muted/20">
              <span>#</span>
              <span>Deployment ID</span>
              <span>Status</span>
              <span>Duration</span>
              <span>Started</span>
            </div>

            {deployments.map((dep, idx) => (
              <div key={dep.id}>
                {/* Row */}
                <div
                  className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-3 items-center hover:bg-accent/30 transition-colors cursor-pointer group"
                  onClick={() => setExpanded(expanded === dep.id ? null : dep.id)}
                >
                  {/* Index (newest = #1) */}
                  <span className="text-xs font-mono text-muted-foreground w-6 text-right">
                    {deployments.length - idx}
                  </span>

                  {/* ID */}
                  <div className="min-w-0">
                    <span className="text-sm font-mono text-foreground">{dep.id}</span>
                  </div>

                  {/* Status badge */}
                  <div
                    className={`flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full w-fit ${
                      dep.status === "success"
                        ? "bg-[#69d1a7]/15 text-[#69d1a7]"
                        : "bg-rose-500/15 text-rose-400"
                    }`}
                  >
                    {dep.status === "success" ? (
                      <CheckIcon className="h-3 w-3" />
                    ) : (
                      <XIcon className="h-3 w-3" />
                    )}
                    {dep.status}
                  </div>

                  {/* Duration */}
                  <span className="text-xs font-mono text-muted-foreground">{dep.duration}</span>

                  {/* Date */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(dep.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <ChevronDownIcon
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${
                        expanded === dep.id ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                {/* ── Expanded log output ───────────────────────────── */}
                {expanded === dep.id && (
                  <div className="border-t border-border/30 bg-[#f8f9fc] dark:bg-[#080910]">
                    {/* Log toolbar */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border/20">
                      <span className="text-[11px] font-mono text-muted-foreground/50 dark:text-slate-500">
                        Build log · {dep.logs.length} lines · {dep.duration}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/logs?appId=${appId}&mode=build`)
                        }}
                        className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground/50 hover:text-foreground dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer transition-colors"
                      >
                        <TerminalIcon className="h-3 w-3" />
                        Open full log
                      </button>
                    </div>

                    {/* Log lines */}
                    <div className="px-4 py-3 font-mono text-xs text-foreground dark:text-slate-300 max-h-96 overflow-y-auto space-y-0.5">
                      {dep.logs.length === 0 ? (
                        <span className="text-muted-foreground/40 dark:text-slate-600 italic">No log output recorded.</span>
                      ) : (
                        dep.logs.map((line, i) => (
                          <div key={i} className="flex gap-4 group/line hover:bg-foreground/[0.02] dark:hover:bg-white/[0.02] rounded -mx-1 px-1">
                            <span className="select-none text-muted-foreground/40 dark:text-slate-600 w-8 text-right shrink-0 group-hover/line:text-muted-foreground/60 dark:group-hover/line:text-slate-500">
                              {i + 1}
                            </span>
                            <span
                              className={
                                line.startsWith("✖") || line.includes("Error") || line.includes("failed")
                                  ? "text-rose-600 dark:text-rose-400"
                                  : line.startsWith("✅") || line.startsWith("✔") || line.includes("successfully")
                                    ? "text-emerald-600 dark:text-[#93e0c0]"
                                    : line.startsWith("📦") || line.startsWith("🔍") ||
                                        line.startsWith("🚀") || line.startsWith("🧹") ||
                                        line.startsWith("✨") || line.startsWith("💡")
                                      ? "text-amber-600 dark:text-amber-300"
                                      : "text-foreground dark:text-slate-300"
                              }
                            >
                              {line}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppShell>
  )
}
