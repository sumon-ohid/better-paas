"use client"

import React, { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import {
  Frame,
  FrameFooter,
  FramePanel,
  FrameTitle,
  FrameDescription,
} from "@/components/ui/frame"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { NucleoIcon } from "@/components/nucleo-icons"
import type { App, Vulnerability } from "@/lib/types"
import { timeAgo } from "@/app/app/[id]/app-detail-utils"
import { IconShield } from "nucleo-isometric"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const RefreshIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="refresh" />
)
const SearchIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="search" />
)
const ExternalIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="external" />
)
const CircleAlertIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="circle-alert" />
)
const ServerIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="server" />
)
const GitBranchIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="branch" />
)
const ChevronDownIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="chevron-down" />
)
const FixIcon = (props: IconProps) => (
  <NucleoIcon {...props} name="settings" />
)

type Severity = "critical" | "high" | "moderate" | "low"
type FixOption = "git" | "local"

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
}

const SEVERITY_CONFIG: Record<
  Severity,
  { variant: "destructive" | "error" | "warning" | "secondary"; bar: string }
> = {
  critical: { variant: "destructive", bar: "bg-destructive" },
  high: { variant: "error", bar: "bg-orange-500" },
  moderate: { variant: "warning", bar: "bg-warning" },
  low: { variant: "secondary", bar: "bg-muted-foreground/40" },
}

function severityRank(severity: string): number {
  return SEVERITY_ORDER[severity as Severity] ?? 99
}

function severityBadgeVariant(
  severity: string,
): "destructive" | "error" | "warning" | "secondary" {
  const config = SEVERITY_CONFIG[severity as Severity]
  return config?.variant ?? "secondary"
}

export interface AppVulnerabilitiesProps {
  app: App
  vulnerabilities: Vulnerability[]
  packageManager: string
  loading: boolean
  scanRun: boolean
  scannedAt: Date | null
  fixing: boolean
  updatePending: boolean
  onScan: () => void
  onFix: (opts: { package?: string; option: FixOption }) => Promise<void>
}

export function AppVulnerabilities({
  app,
  vulnerabilities,
  packageManager,
  loading,
  scanRun,
  scannedAt,
  fixing,
  updatePending,
  onScan,
  onFix,
}: AppVulnerabilitiesProps) {
  const [query, setQuery] = useState("")
  const [severityFilter, setSeverityFilter] = useState<Severity | null>(null)
  const [fixDialogOpen, setFixDialogOpen] = useState(false)
  const [fixPackage, setFixPackage] = useState("")
  const [fixAllMode, setFixAllMode] = useState(false)
  const [fixOption, setFixOption] = useState<FixOption>("local")
  const [headerOpen, setHeaderOpen] = useState(true)

  const sorted = useMemo(
    () =>
      [...vulnerabilities].sort(
        (a, b) =>
          severityRank(a.severity) - severityRank(b.severity) ||
          a.package.localeCompare(b.package),
      ),
    [vulnerabilities],
  )

  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
    }
    for (const vul of vulnerabilities) {
      const sev = vul.severity as Severity
      if (sev in counts) counts[sev] += 1
    }
    return counts
  }, [vulnerabilities])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sorted.filter((vul) => {
      if (severityFilter && vul.severity !== severityFilter) return false
      if (!q) return true
      return (
        vul.package.toLowerCase().includes(q) ||
        vul.title.toLowerCase().includes(q) ||
        (vul.range?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [sorted, query, severityFilter])

  const openFixDialog = (opts?: { packageName?: string; all?: boolean }) => {
    setFixAllMode(opts?.all ?? false)
    setFixPackage(opts?.packageName ?? "")
    setFixOption("local")
    setFixDialogOpen(true)
  }

  const handleConfirmFix = async () => {
    const target = fixAllMode ? undefined : fixPackage.trim() || undefined
    await onFix({ package: target, option: fixOption })
    setFixDialogOpen(false)
  }

  const toggleSeverityFilter = (sev: Severity) => {
    setSeverityFilter((current) => (current === sev ? null : sev))
  }

  const totalCount = vulnerabilities.length
  const hasResults = scanRun && totalCount > 0
  const isBusy = fixing || app.status === "building"

  return (
    <div className="animate-in fade-in-50 h-full overflow-y-auto p-4 duration-200 md:p-6">
      <div className="mx-auto max-w-6xl">
        <Frame className="w-full">
          <FramePanel className="shrink-0">
            <Collapsible open={headerOpen} onOpenChange={setHeaderOpen}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <CollapsibleTrigger className="group flex min-w-0 flex-1 items-start gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <ChevronDownIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-panel-open:rotate-180" />
                  <div className="min-w-0 space-y-0.5">
                    <FrameTitle>Security Vulnerabilities</FrameTitle>
                    {!headerOpen && (
                      <FrameDescription className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        {hasResults ? (
                          <>
                            <span>
                              {totalCount} advisories
                              {packageManager ? ` · ${packageManager}` : ""}
                            </span>
                            {severityCounts.critical > 0 && (
                              <Badge variant="destructive" size="sm">
                                {severityCounts.critical} critical
                              </Badge>
                            )}
                            {severityCounts.high > 0 && (
                              <Badge variant="error" size="sm">
                                {severityCounts.high} high
                              </Badge>
                            )}
                          </>
                        ) : scanRun ? (
                          "No vulnerabilities detected."
                        ) : (
                          "Scan package dependencies for security issues."
                        )}
                      </FrameDescription>
                    )}
                  </div>
                </CollapsibleTrigger>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:pl-0 pl-6">
                  {headerOpen && hasResults && (
                    <>
                      <div className="relative w-full sm:w-44">
                        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Filter packages…"
                          className="h-7 w-full pl-7 text-xs"
                        />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isBusy}
                              className="h-7 gap-1.5 text-xs"
                            >
                              <FixIcon className="h-3.5 w-3.5" />
                              Fix
                              <ChevronDownIcon className="h-3 w-3 opacity-60" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openFixDialog({ all: true })}
                          >
                            Fix all vulnerable packages
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openFixDialog()}>
                            Fix a specific package…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                  <Button
                    onClick={onScan}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                  >
                    <RefreshIcon
                      className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                    />
                    {loading ? "Scanning..." : scanRun ? "Rescan" : "Scan now"}
                  </Button>
                </div>
              </div>

              <CollapsibleContent>
                <div className="mt-3 space-y-3 pl-6">
                  <FrameDescription className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    {hasResults ? (
                      <>
                        <span>
                          {totalCount} advisories found
                          {packageManager ? ` · ${packageManager}` : ""}
                        </span>
                        {scannedAt && (
                          <span className="text-muted-foreground/60">
                            · scanned {timeAgo(scannedAt)}
                          </span>
                        )}
                      </>
                    ) : scanRun ? (
                      "No vulnerabilities detected."
                    ) : (
                      "Scan package dependencies for security issues."
                    )}
                  </FrameDescription>

                  {updatePending && app.status === "building" && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                      <RefreshIcon className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      Package update in progress. Results will refresh when the
                      deploy finishes.
                    </div>
                  )}

                  {hasResults && (
                    <div className="space-y-2.5">
                      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted/40">
                        {(["critical", "high", "moderate", "low"] as const).map(
                          (sev) => {
                            const count = severityCounts[sev]
                            if (!count) return null
                            return (
                              <div
                                key={sev}
                                className={`${SEVERITY_CONFIG[sev].bar} transition-all`}
                                style={{
                                  width: `${(count / totalCount) * 100}%`,
                                }}
                                title={`${count} ${sev}`}
                              />
                            )
                          },
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(["critical", "high", "moderate", "low"] as const).map(
                          (sev) => {
                            const count = severityCounts[sev]
                            if (!count) return null
                            const active = severityFilter === sev
                            return (
                              <button
                                key={sev}
                                type="button"
                                onClick={() => toggleSeverityFilter(sev)}
                                className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <Badge
                                  variant={SEVERITY_CONFIG[sev].variant}
                                  size="sm"
                                  className={
                                    active
                                      ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                                      : "opacity-80 hover:opacity-100"
                                  }
                                >
                                  {count} {sev}
                                </Badge>
                              </button>
                            )
                          },
                        )}
                        {severityFilter && (
                          <button
                            type="button"
                            onClick={() => setSeverityFilter(null)}
                            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            Clear filter
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {!headerOpen && updatePending && app.status === "building" && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 pl-6 text-xs text-amber-600 dark:text-amber-400">
                <RefreshIcon className="h-3.5 w-3.5 shrink-0 animate-spin" />
                Package update in progress. Results will refresh when the deploy
                finishes.
              </div>
            )}
          </FramePanel>

          {loading ? (
            <FramePanel className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <RefreshIcon className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Running package audit scan...
              </p>
            </FramePanel>
          ) : !scanRun ? (
            <FramePanel className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <CircleAlertIcon className="h-6 w-6 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Scan dependencies to check for known security issues.
              </p>
              <Button
                onClick={onScan}
                size="sm"
                className="h-8 gap-1.5 text-xs"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
                Scan now
              </Button>
            </FramePanel>
          ) : totalCount === 0 ? (
            <FramePanel className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <IconShield className="h-7 w-7" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  No vulnerabilities found
                </p>
                <p className="text-xs text-muted-foreground">
                  {packageManager
                    ? `The ${packageManager} audit passed cleanly.`
                    : "Package scanning is not applicable for this deployment."}
                </p>
              </div>
            </FramePanel>
          ) : filtered.length === 0 ? (
            <FramePanel className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <SearchIcon className="h-6 w-6 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No advisories match your filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setSeverityFilter(null)
                }}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            </FramePanel>
          ) : (
            <div className="max-h-[min(70vh,720px)] overflow-y-auto border-t border-border/40">
              <Table variant="card">
                <TableHeader className="sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-[11%]">Severity</TableHead>
                    <TableHead className="w-[20%]">Package</TableHead>
                    <TableHead>Vulnerability</TableHead>
                    <TableHead className="w-[88px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((vul, idx) => (
                    <TableRow
                      key={`${vul.package}-${vul.title}-${idx}`}
                      className={
                        vul.severity === "critical"
                          ? "border-l-2 border-l-destructive/60"
                          : vul.severity === "high"
                            ? "border-l-2 border-l-orange-500/50"
                            : undefined
                      }
                    >
                      <TableCell>
                        <Badge
                          variant={severityBadgeVariant(vul.severity)}
                          size="sm"
                          className="font-mono text-[10px] uppercase"
                        >
                          {vul.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {vul.package}
                        </span>
                        {vul.range && (
                          <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                            {vul.range}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="line-clamp-2 text-sm leading-snug text-foreground">
                          {vul.title}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          {vul.url && (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <a
                                    href={vul.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    aria-label="View advisory"
                                  />
                                }
                              />
                              <TooltipContent>View advisory</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  onClick={() =>
                                    openFixDialog({ packageName: vul.package })
                                  }
                                  variant="ghost"
                                  size="sm"
                                  disabled={isBusy}
                                  className="h-7 px-2 text-xs"
                                />
                              }
                            >
                              Fix
                            </TooltipTrigger>
                            <TooltipContent>
                              Update {vul.package}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {hasResults && filtered.length > 0 && (
            <FrameFooter className="shrink-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  Showing {filtered.length} of {totalCount} advisories
                </span>
                <Button
                  onClick={() => openFixDialog({ all: true })}
                  disabled={isBusy}
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 border-amber-500/20 text-xs text-amber-500 hover:bg-amber-500/10"
                >
                  <RefreshIcon className="h-3.5 w-3.5" />
                  Fix all
                </Button>
              </div>
            </FrameFooter>
          )}
        </Frame>
      </div>

      <Dialog open={fixDialogOpen} onOpenChange={setFixDialogOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {fixAllMode ? "Fix all vulnerabilities" : "Update package"}
            </DialogTitle>
            <DialogDescription>
              {fixAllMode
                ? "Run an audit fix across all vulnerable packages, then redeploy."
                : "Update the selected package to a patched version, then redeploy."}
            </DialogDescription>
          </DialogHeader>

          <DialogPanel>
            <div className="space-y-4">
              {!fixAllMode && (
                <Field>
                  <FieldLabel>Package name</FieldLabel>
                  <Input
                    value={fixPackage}
                    onChange={(e) => setFixPackage(e.target.value)}
                    placeholder={
                      packageManager
                        ? `e.g., lodash (${packageManager})`
                        : "e.g., lodash"
                    }
                    className="h-9 font-mono text-sm"
                  />
                  <FieldDescription>
                    Leave blank when fixing all vulnerable packages from the
                    menu.
                  </FieldDescription>
                </Field>
              )}

              <Field>
                <FieldLabel>Update strategy</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFixOption("local")}
                    className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                      fixOption === "local"
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-muted/30"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <ServerIcon
                        className={`h-3.5 w-3.5 ${
                          fixOption === "local"
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                      Keep locally
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      Updates directly on the server. Git is not modified.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFixOption("git")}
                    className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                      fixOption === "git"
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-muted/30"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <GitBranchIcon
                        className={`h-3.5 w-3.5 ${
                          fixOption === "git"
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                      Push to Git
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      Commits and pushes back to your repo branch.
                    </span>
                  </button>
                </div>
              </Field>
            </div>
          </DialogPanel>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFixDialogOpen(false)}
              disabled={fixing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleConfirmFix()}
              disabled={fixing || (!fixAllMode && !fixPackage.trim())}
              className="gap-1.5"
            >
              {fixing ? (
                <>
                  <RefreshIcon className="h-3.5 w-3.5 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <RefreshIcon className="h-3.5 w-3.5" />
                  Update and redeploy
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
