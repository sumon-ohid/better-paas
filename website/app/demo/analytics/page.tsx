"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { NucleoIcon } from "@/dashboard/components/nucleo-icons"
import { AppShell, useToast } from "@/dashboard/components/app-shell"
import { useAppRouter } from "@/dashboard/lib/app-router"
import { Card, CardPanel } from "@/dashboard/components/ui/card"
import { Badge } from "@/dashboard/components/ui/badge"
import { Button } from "@/dashboard/components/ui/button"
import { Skeleton } from "@/dashboard/components/ui/skeleton"
import {
  Frame,
  FramePanel,
  FrameTitle,
  FrameDescription,
  FrameFooter,
} from "@/dashboard/components/ui/frame"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/dashboard/components/ui/empty"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/dashboard/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/dashboard/components/ui/toggle-group"
import { api } from "@/dashboard/lib/api"
import { getAppUrl } from "@/dashboard/lib/utils"
import type { App, AnalyticsSummary, AnalyticsBreakdown, AnalyticsBucket } from "@/dashboard/lib/types"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const ActivityIcon = (props: IconProps) => <NucleoIcon {...props} name="activity" />
const EyeIcon = (props: IconProps) => <NucleoIcon {...props} name="eye" />
const GlobeIcon = (props: IconProps) => <NucleoIcon {...props} name="web" />
const LinkIcon = (props: IconProps) => <NucleoIcon {...props} name="link" />
const CopyIcon = (props: IconProps) => <NucleoIcon {...props} name="copy" />
const CheckIcon = (props: IconProps) => <NucleoIcon {...props} name="check" />
const CpuIcon = (props: IconProps) => <NucleoIcon {...props} name="cpu" />
const ExternalLinkIcon = (props: IconProps) => <NucleoIcon {...props} name="external" />

const RANGES = [
  { value: "1", label: "24h", days: 1 as const },
  { value: "7", label: "7d", days: 7 as const },
  { value: "30", label: "30d", days: 30 as const },
  { value: "90", label: "90d", days: 90 as const },
]

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

// ── Timeseries bar chart ──────────────────────────────────────────────────────
// A dependency-free SVG bar chart. Bars encode pageviews; a thinner overlay bar
// encodes unique visitors so both series read at a glance.

function BarChart({ data, days }: { data: AnalyticsBucket[]; days: number }) {
  const max = Math.max(1, ...data.map((d) => d.views))
  const hourly = days === 1

  const formatLabel = (dateStr: string, i: number): string | null => {
    if (hourly) {
      // "YYYY-MM-DD HH:00" → show every 4th hour.
      if (i % 4 !== 0) return null
      const hh = dateStr.slice(11, 13)
      return `${hh}:00`
    }
    // Daily: thin labels so they don't collide.
    const step = days <= 7 ? 1 : days <= 30 ? 5 : 15
    if (i % step !== 0) return null
    const d = new Date(dateStr + "T00:00:00Z")
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }

  return (
    <div className="w-full">
      <div className="flex h-48 items-end gap-px sm:gap-0.5">
        {data.map((d, i) => {
          const viewH = (d.views / max) * 100
          const visitorH = (d.visitors / max) * 100
          const title = `${d.views} views · ${d.visitors} visitors`
          return (
            <div
              key={d.date + i}
              className="group relative flex flex-1 items-end justify-center"
              style={{ height: "100%" }}
              title={title}
            >
              {/* Views bar */}
              <div
                className="w-full rounded-t-sm bg-primary/25 transition-colors group-hover:bg-primary/40"
                style={{ height: `${Math.max(viewH, d.views > 0 ? 2 : 0)}%` }}
              >
                {/* Visitors overlay (narrower, on top) */}
                <div
                  className="absolute bottom-0 left-1/2 w-[45%] -translate-x-1/2 rounded-t-sm bg-primary transition-colors"
                  style={{ height: `${Math.max(visitorH, d.visitors > 0 ? 2 : 0)}%` }}
                />
              </div>
              {/* Hover tooltip */}
              <div className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block">
                <div className="font-mono">{title}</div>
              </div>
            </div>
          )
        })}
      </div>
      {/* X axis labels */}
      <div className="mt-2 flex gap-px sm:gap-0.5">
        {data.map((d, i) => {
          const label = formatLabel(d.date, i)
          return (
            <div
              key={d.date + i}
              className="flex-1 truncate text-center text-[10px] text-muted-foreground/70"
            >
              {label ?? ""}
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
          Unique visitors
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary/25" />
          Pageviews
        </span>
      </div>
    </div>
  )
}

// ── Breakdown list (top pages / referrers / tech) ─────────────────────────────

function BreakdownList({
  items,
  emptyLabel,
  mono,
}: {
  items: AnalyticsBreakdown[]
  emptyLabel: string
  mono?: boolean
}) {
  const total = items.reduce((sum, it) => sum + it.count, 0)
  if (items.length === 0) {
    return <div className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</div>
  }
  return (
    <div className="space-y-1.5">
      {items.map((it) => {
        const pct = total > 0 ? (it.count / total) * 100 : 0
        return (
          <div key={it.label} className="relative">
            {/* Proportional background fill */}
            <div
              className="absolute inset-y-0 left-0 rounded-md bg-primary/10"
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
            <div className="relative flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5">
              <span
                className={`min-w-0 truncate text-sm text-foreground ${mono ? "font-mono" : ""}`}
                title={it.label}
              >
                {it.label}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {compactNumber(it.count)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Embed snippet card ────────────────────────────────────────────────────────

function EmbedSnippet({ appId }: { appId: string }) {
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  const snippet = api.analytics.snippet(appId)
  const prompt = api.analytics.installPrompt(appId)

  const copySnippet = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      showToast("Copied", "Tracking snippet copied to clipboard.", "success")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast("Error", "Could not copy to clipboard.", "destructive")
    }
  }, [snippet, showToast])

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setPromptCopied(true)
      showToast(
        "Prompt copied",
        "Paste it into any AI assistant to install tracking.",
        "success",
      )
      setTimeout(() => setPromptCopied(false), 2000)
    } catch {
      showToast("Error", "Could not copy to clipboard.", "destructive")
    }
  }, [prompt, showToast])

  return (
    <Frame className="w-full">
      <FramePanel className="shrink-0 mb-2">
        <FrameTitle>Install Tracking</FrameTitle>
        <FrameDescription>
          Paste this snippet into your site&apos;s{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">&lt;head&gt;</code>. No
          cookies, no consent banner required.
        </FrameDescription>
      </FramePanel>
      <Card>
        <CardPanel>
          {/* Code block - themed via the design-system code tokens so it reads
              cleanly in both light and dark mode. */}
          <div className="overflow-hidden rounded-lg border border-border bg-transparent shadow-xs">
            <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-code-foreground">
              <code>{snippet}</code>
            </pre>
          </div>

          {/* Action buttons - stack on mobile, row from sm up */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={copySnippet}
              className="w-full justify-center gap-1.5 sm:w-auto"
            >
              {copied ? (
                <CheckIcon className="h-4 w-4 text-success" />
              ) : (
                <CopyIcon className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy snippet"}
            </Button>
            <Button
              onClick={copyPrompt}
              className="w-full justify-center gap-1.5 sm:w-auto"
            >
              {promptCopied ? (
                <CheckIcon className="h-4 w-4" />
              ) : (
                ""
              )}
              {promptCopied ? "Prompt copied" : "Copy AI prompt"}
            </Button>
          </div>
        </CardPanel>
      </Card>
      <FrameFooter>
        <div className="flex gap-1.5 text-xs text-muted-foreground">
          <NucleoIcon name="terminal" className="mt-0.5 size-3 shrink-0" />
          <p>
            Pageviews are recorded automatically, including SPA route changes. Not sure where it
            goes? Use{" "}
            <span className="font-medium text-foreground">Copy AI prompt</span> and paste it into
            Cursor, Copilot, or any AI assistant - it explains how to install on plain HTML,
            Next.js, Vite, Vue, SvelteKit, Astro, and more.
          </p>
        </div>
      </FrameFooter>
    </Frame>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useAppRouter()
  const [apps, setApps] = useState<App[]>([])
  const [appsLoaded, setAppsLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState<string>("")
  const [range, setRange] = useState<string>("7")
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const rangeDays = useMemo(
    () => RANGES.find((r) => r.value === range)?.days ?? 7,
    [range],
  )

  const selectedApp = useMemo(
    () => apps.find((a) => a.id === selectedId),
    [apps, selectedId],
  )

  // Load apps once and default to the first one.
  useEffect(() => {
    let cancelled = false
    api.apps
      .list()
      .then((data) => {
        if (cancelled) return
        setApps(data)
        setSelectedId((prev) => prev || data[0]?.id || "")
      })
      .catch((err) => console.error("Failed to load apps", err))
      .finally(() => {
        if (!cancelled) setAppsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Load analytics whenever the selected app or range changes.
  const fetchSummary = useCallback(async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      const data = await api.analytics.summary(selectedId, rangeDays)
      setSummary(data)
    } catch (err) {
      console.error("Failed to load analytics", err)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [selectedId, rangeDays])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSummary()
  }, [fetchSummary])

  // Auto-refresh the live view every 30s.
  useEffect(() => {
    if (!selectedId) return
    const interval = setInterval(fetchSummary, 30_000)
    return () => clearInterval(interval)
  }, [selectedId, fetchSummary])

  const hasData = summary && summary.totalViews > 0

  const statCards = [
    {
      label: "Pageviews",
      value: compactNumber(summary?.totalViews ?? 0),
      icon: <EyeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
    },
    {
      label: "Unique Visitors",
      value: compactNumber(summary?.totalVisitors ?? 0),
      icon: <GlobeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
    },
    {
      label: "Views / Visitor",
      value:
        summary && summary.totalVisitors > 0
          ? (summary.totalViews / summary.totalVisitors).toFixed(1)
          : "0.0",
      icon: <ActivityIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
    },
  ]

  return (
    <AppShell appCount={apps.length}>
      <div className="animate-in fade-in-50 p-4 duration-200 md:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Page header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Web Analytics
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Privacy-friendly visitor stats for your deployed sites.
                {selectedApp && (
                  <span className="ml-2 font-medium text-foreground">{selectedApp.name}</span>
                )}
              </p>
            </div>

            {apps.length > 0 && (
              <div className="flex items-center gap-2">
                <Select
                  value={selectedId}
                  onValueChange={(v) => setSelectedId(v as string)}
                >
                  <SelectTrigger size="sm" className="w-48">
                    <SelectValue placeholder="Select a site">
                      {selectedApp ? selectedApp.name : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {apps.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <ToggleGroup
                  variant="outline"
                  size="sm"
                  value={[range]}
                  onValueChange={(v) => setRange(v[0] ?? "7")}
                >
                  {RANGES.map((r) => (
                    <ToggleGroupItem key={r.value} value={r.value} className="px-2.5 text-sm">
                      {r.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            )}
          </div>

          {/* No apps at all */}
          {appsLoaded && apps.length === 0 ? (
            <Frame>
              <FramePanel>
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <GlobeIcon />
                    </EmptyMedia>
                    <EmptyTitle>No sites to track yet</EmptyTitle>
                    <EmptyDescription>
                      Deploy a service first, then come back to add analytics to it.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button onClick={() => router.push("/deploy")} className="gap-1.5">
                      Deploy a service
                    </Button>
                  </EmptyContent>
                </Empty>
              </FramePanel>
            </Frame>
          ) : (
            <>
              {/* Selected site URL */}
              {selectedApp && getAppUrl(selectedApp) && (
                <a
                  href={getAppUrl(selectedApp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-mono text-primary hover:underline"
                >
                  <LinkIcon className="h-3.5 w-3.5 opacity-60" />
                  {getAppUrl(selectedApp).replace(/^https?:\/\//, "")}
                  <ExternalLinkIcon className="h-3 w-3 opacity-60" />
                </a>
              )}

              {/* Stat cards */}
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {loading && !summary ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                  ))
                ) : (
                  statCards.map((card) => (
                    <Frame key={card.label}>
                      <Card className="before:hidden shadow-none">
                        <CardPanel className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              {card.label}
                            </span>
                            {card.icon}
                          </div>
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <span className="shrink-0 font-mono text-2xl font-bold tabular-nums sm:text-3xl">
                              {card.value}
                            </span>
                            <Badge variant="secondary" size="sm">
                              {RANGES.find((r) => r.value === range)?.label ?? "7d"}
                            </Badge>
                          </div>
                        </CardPanel>
                      </Card>
                    </Frame>
                  ))
                )}
              </section>

              {/* Chart */}
              <Frame className="w-full">
                <FramePanel className="shrink-0 mb-2">
                  <FrameTitle>Traffic Over Time</FrameTitle>
                  <FrameDescription>
                    {rangeDays === 1 ? "Hourly" : "Daily"} pageviews and unique visitors.
                  </FrameDescription>
                </FramePanel>
                <Card>
                  <CardPanel>
                    {loading && !summary ? (
                      <Skeleton className="h-48 w-full rounded-lg" />
                    ) : summary && summary.timeseries.length > 0 ? (
                      <BarChart data={summary.timeseries} days={rangeDays} />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                        <ActivityIcon className="h-6 w-6 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">
                          No traffic recorded in this range.
                        </p>
                      </div>
                    )}
                  </CardPanel>
                </Card>
                <FrameFooter>
                  <div className="flex gap-1.5 text-xs text-muted-foreground">
                    <NucleoIcon name="activity" className="mt-0.5 size-3 shrink-0" />
                    <p>Stats refresh automatically every 30 seconds.</p>
                  </div>
                </FrameFooter>
              </Frame>

              {/* Breakdowns + embed */}
              {hasData ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
                  <Frame className="w-full">
                    <FramePanel className="shrink-0 mb-2">
                      <FrameTitle>Top Pages</FrameTitle>
                      <FrameDescription>Most visited paths.</FrameDescription>
                    </FramePanel>
                    <Card>
                      <CardPanel>
                        <BreakdownList items={summary!.topPages} emptyLabel="No pages yet" mono />
                      </CardPanel>
                    </Card>
                  </Frame>

                  <Frame className="w-full">
                    <FramePanel className="shrink-0 mb-2">
                      <FrameTitle>Top Referrers</FrameTitle>
                      <FrameDescription>Where your visitors come from.</FrameDescription>
                    </FramePanel>
                    <Card>
                      <CardPanel>
                        <BreakdownList items={summary!.topReferrers} emptyLabel="No referrers yet" />
                      </CardPanel>
                    </Card>
                  </Frame>

                  <Frame className="w-full">
                    <FramePanel className="shrink-0 mb-2">
                      <FrameTitle className="flex items-center gap-2">
                        <CpuIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        Browsers &amp; Devices
                      </FrameTitle>
                      <FrameDescription>Visitor environment breakdown.</FrameDescription>
                    </FramePanel>
                    <Card>
                      <CardPanel className="space-y-5">
                        <div>
                          <span className="mb-2 block text-xs font-medium text-muted-foreground">
                            Browser
                          </span>
                          <BreakdownList items={summary!.browsers} emptyLabel="-" />
                        </div>
                        <div>
                          <span className="mb-2 block text-xs font-medium text-muted-foreground">
                            Operating system
                          </span>
                          <BreakdownList items={summary!.os} emptyLabel="-" />
                        </div>
                        <div>
                          <span className="mb-2 block text-xs font-medium text-muted-foreground">
                            Device
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {summary!.devices.length === 0 ? (
                              <span className="text-sm text-muted-foreground">-</span>
                            ) : (
                              summary!.devices.map((d) => (
                                <Badge key={d.label} variant="outline" className="gap-1.5">
                                  {d.label}
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {compactNumber(d.count)}
                                  </span>
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>
                      </CardPanel>
                    </Card>
                  </Frame>

                  {selectedId && <EmbedSnippet appId={selectedId} />}
                </div>
              ) : (
                // No data yet → lead with the install instructions.
                !loading && selectedId && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
                    <Frame className="w-full lg:self-stretch">
                      <FramePanel className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
                        <ActivityIcon className="h-6 w-6 text-muted-foreground/30" />
                        <p className="text-sm font-medium text-foreground">No data yet</p>
                        <p className="text-sm text-muted-foreground">
                          Add the snippet to your site to start collecting pageviews.
                        </p>
                      </FramePanel>
                    </Frame>
                    {selectedId && <EmbedSnippet appId={selectedId} />}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
