"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { useAppRouter } from "@/dashboard/lib/app-router"
import { NucleoIcon } from "@/dashboard/components/nucleo-icons"
import { AppShell } from "@/dashboard/components/app-shell"
import { StatusBadge } from "@/dashboard/components/status-badge"
import { Badge, badgeVariants } from "@/dashboard/components/ui/badge"
import { Button } from "@/dashboard/components/ui/button"
import { CardFrame } from "@/dashboard/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/dashboard/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/dashboard/components/ui/menu"
import { api } from "@/dashboard/lib/api"
import type { App, DeploymentRecord } from "@/dashboard/lib/types"
import { cn } from "@/dashboard/lib/utils"
import type { VariantProps } from "class-variance-authority"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const RefreshIcon = (props: IconProps) => <NucleoIcon {...props} name="refresh" />
const ChevronLeftIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-left" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const XIcon = (props: IconProps) => <NucleoIcon {...props} name="x" />
const ChevronDownIcon = (props: IconProps) => <NucleoIcon {...props} name="chevron-down" />
const TerminalIcon = (props: IconProps) => <NucleoIcon {...props} name="terminal" />
const GitBranchIcon = (props: IconProps) => <NucleoIcon {...props} name="branch" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />
const Trash2Icon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const LoaderIcon = (props: IconProps) => <NucleoIcon {...props} name="loader" />

function depStatusMeta(status: string): {
  variant: NonNullable<VariantProps<typeof badgeVariants>["variant"]>
  Icon: React.FC<IconProps> | null
  label: string
  spin?: boolean
} {
  if (status === "success") {
    return { variant: "success", Icon: CheckIcon, label: "Success" }
  }
  if (status === "failed") {
    return { variant: "error", Icon: XIcon, label: "Failed" }
  }
  if (status === "building" || status === "in_progress") {
    return { variant: "warning", Icon: LoaderIcon, label: "Building", spin: true }
  }
  return { variant: "outline", Icon: null, label: status }
}

export default function ProjectDeploymentsPage() {
  const router = useAppRouter()
  const params = useParams()
  const appId = params.appId as string

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
    // fetchData is async; setState runs after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [fetchData])

  const handleRedeploy = async (noCache: boolean = false) => {
    if (!app) return
    try {
      await api.apps.redeploy(app.id, noCache)
      // Redirect to live build log
      router.push(`/logs?appId=${app.id}&mode=build`)
    } catch (err) {
      console.error("Redeploy failed", err)
    }
  }

  const handleRollback = async (dep: DeploymentRecord) => {
    if (!app) return
    if (!confirm(`Roll back ${app.name} to deployment ${dep.id}? This re-releases the image from that deploy.`)) return
    try {
      await api.apps.rollback(app.id, dep.id)
      router.push(`/logs?appId=${app.id}&mode=build`)
    } catch (err) {
      console.error("Rollback failed", err)
      alert(err instanceof Error ? err.message : "Rollback failed.")
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
              <h1 className="flex items-center gap-2">
                {app?.name ?? appId}
                {app && <StatusBadge status={app.status} />}
              </h1>
               {app && (
                 <p className="text-xs font-mono text-muted-foreground mt-0.5">
                   {app.gitRepo ? (
                     <a
                       href={app.gitRepo}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="hover:text-primary transition-colors"
                     >
                       {app.gitRepo}
                     </a>
                   ) : (
                     <span>{app.image || "No repository"}</span>
                   )}
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
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
              <RefreshIcon className="h-3.5 w-3.5" />
              Refresh
            </Button>

            {/* Live logs shortcut */}
            {app && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/logs?appId=${app.id}&mode=runtime`)}
                className="gap-1.5"
              >
                <TerminalIcon className="h-3.5 w-3.5" />
                Live Logs
              </Button>
            )}

            {/* Redeploy */}
            {app && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button size="sm" className="gap-1.5">
                      <PlayIcon className="h-3.5 w-3.5" />
                      Redeploy
                      <ChevronDownIcon className="h-3 w-3 opacity-80" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => handleRedeploy(false)}>
                    <PlayIcon className="mr-2 h-4 w-4" />
                    Redeploy (Default)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleRedeploy(true)}>
                    <Trash2Icon className="mr-2 h-4 w-4 text-destructive" />
                    Redeploy & Clear Cache
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                color: "text-success",
              },
              {
                label: "Failed",
                value: deployments.filter((d) => d.status === "failed").length,
                color: "text-destructive",
              },
              {
                label: "Last deploy",
                value: new Date(deployments[0].createdAt).toLocaleDateString(),
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col">
                <span className={cn("font-bold text-lg font-mono", color ?? "text-foreground")}>
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
          <CardFrame className="w-full">
            <Table variant="card">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-right">#</TableHead>
                  <TableHead>Deployment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.map((dep, idx) => {
                  const isExpanded = expanded === dep.id
                  const number = deployments.length - idx
                  const meta = depStatusMeta(dep.status)

                  return (
                    <React.Fragment key={dep.id}>
                      <TableRow
                        className="cursor-pointer group"
                        onClick={() => setExpanded(isExpanded ? null : dep.id)}
                      >
                        <TableCell className="text-right">
                          <span className="text-xs font-mono text-muted-foreground">
                            {number}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-sm font-mono text-foreground truncate">
                              {dep.id}
                            </span>
                            {dep.commit && (
                              <span className="text-[11px] font-mono text-muted-foreground">
                                {dep.commit.slice(0, 7)}
                                {dep.commitMsg ? ` - ${dep.commitMsg}` : ""}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant={meta.variant} size="sm" className="w-fit">
                            {meta.Icon && (
                              <meta.Icon
                                className={cn(
                                  "h-3 w-3",
                                  meta.spin && "animate-spin"
                                )}
                              />
                            )}
                            {meta.label}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <span className="text-xs font-mono text-muted-foreground">
                            {dep.duration}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(dep.createdAt).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <ChevronDownIcon
                              className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </div>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={5} className="p-0 !border-0 !bg-transparent">
                            <div className="border-t border-border/30 bg-[#f8f9fc] dark:bg-[#080910]">
                              {/* Log toolbar */}
                              <div className="flex items-center justify-between px-4 py-2 border-b border-border/20">
                                <span className="text-[11px] font-mono text-muted-foreground/50 dark:text-slate-500">
                                  Build log · {dep.logs.length} lines · {dep.duration}
                                  {dep.trigger && <span className="ml-2">· {dep.trigger}</span>}
                                  {dep.commit && <span className="ml-2">· {dep.commit.slice(0, 7)}</span>}
                                </span>
                                <div className="flex items-center gap-3">
                                  {dep.image && dep.status === "success" && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleRollback(dep)
                                      }}
                                      className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground/50 hover:text-primary dark:text-slate-500 dark:hover:text-primary cursor-pointer transition-colors"
                                    >
                                      <RefreshIcon className="h-3 w-3" />
                                      Roll back to this
                                    </button>
                                  )}
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
                              </div>

                              {/* Log lines */}
                              <div className="px-4 py-3 font-mono text-xs text-foreground dark:text-slate-300 max-h-96 overflow-y-auto space-y-0.5">
                                {dep.logs.length === 0 ? (
                                  <span className="text-muted-foreground/40 dark:text-slate-600 italic">
                                    No log output recorded.
                                  </span>
                                ) : (
                                  dep.logs.map((line, i) => (
                                    <div
                                      key={i}
                                      className="flex gap-4 group/line hover:bg-foreground/2 dark:hover:bg-white/2 rounded -mx-1 px-1"
                                    >
                                      <span className="select-none text-muted-foreground/40 dark:text-slate-600 w-8 text-right shrink-0 group-hover/line:text-muted-foreground/60 dark:group-hover/line:text-slate-500">
                                        {i + 1}
                                      </span>
                                      <span
                                        className={cn(
                                          line.startsWith("✖") || line.includes("Error") || line.includes("failed")
                                            ? "text-destructive"
                                            : line.startsWith("✅") || line.startsWith("✔") || line.includes("successfully")
                                              ? "text-success"
                                              : line.startsWith("📦") || line.startsWith("🔍") ||
                                                  line.startsWith("🚀") || line.startsWith("🧹") ||
                                                  line.startsWith("✨") || line.startsWith("💡")
                                                ? "text-warning"
                                                : "text-foreground dark:text-slate-300"
                                        )}
                                      >
                                        {line}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </CardFrame>
        )}
      </div>
    </AppShell>
  )
}
