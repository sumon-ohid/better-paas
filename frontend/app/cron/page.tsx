"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardPanel } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
} from "@/components/ui/alert-dialog"
import {
  Frame,
  FramePanel,
  FrameTitle,
  FrameDescription,
  FrameFooter,
} from "@/components/ui/frame"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { AppShell, useToast } from "@/components/app-shell"
import { api } from "@/lib/api"
import type { CronJob, App } from "@/lib/types"
import { NucleoIcon } from "@/components/nucleo-icons"
import { timeAgo } from "@/app/app/[id]/app-detail-utils"
import { cn } from "@/lib/utils"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const ClockIcon = (props: IconProps) => <NucleoIcon {...props} name="clock" />
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />

const PRESETS = [
  { label: "Every 15 min", value: "*/15 * * * *" },
  { label: "Hourly", value: "0 * * * *" },
  { label: "Daily 2am", value: "0 2 * * *" },
  { label: "Weekly (Mon)", value: "0 0 * * 1" },
] as const

function presetLabel(schedule: string): string | null {
  return PRESETS.find((p) => p.value === schedule)?.label ?? null
}

function hasValidLastRun(lastRun: string): boolean {
  return !!lastRun && new Date(lastRun).getFullYear() > 1
}

function lastStatusVariant(status: string): "success" | "error" | "secondary" {
  if (status === "success") return "success"
  if (status === "failed" || status === "error") return "error"
  return "secondary"
}

function JobActions({
  job,
  onToggle,
  onRun,
  onDelete,
  running,
  toggling,
}: {
  job: CronJob
  onToggle: () => void
  onRun: () => void
  onDelete: () => void
  running: boolean
  toggling: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Switch
        checked={job.enabled}
        disabled={toggling}
        onCheckedChange={onToggle}
        aria-label={job.enabled ? "Disable job" : "Enable job"}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={onRun}
        loading={running}
        className="h-8 gap-1.5"
      >
        <PlayIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Run</span>
      </Button>
      <Button
        variant="destructive-outline"
        size="icon-sm"
        onClick={onDelete}
        aria-label="Delete job"
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function JobMeta({ job }: { job: CronJob }) {
  const friendly = presetLabel(job.schedule)

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{job.appName}</span>
        <Badge variant="info" size="sm" className="font-mono">
          {job.schedule}
        </Badge>
        {friendly && (
          <Badge variant="secondary" size="sm">
            {friendly}
          </Badge>
        )}
        <Badge variant={job.enabled ? "success" : "secondary"} size="sm">
          {job.enabled ? "Active" : "Paused"}
        </Badge>
        {job.lastStatus && (
          <Badge variant={lastStatusVariant(job.lastStatus)} size="sm">
            {job.lastStatus}
          </Badge>
        )}
      </div>
      <p className="truncate font-mono text-xs text-muted-foreground" title={job.command}>
        {job.command}
      </p>
      {hasValidLastRun(job.lastRun) && (
        <p className="text-[11px] text-muted-foreground/70">
          Last run {timeAgo(job.lastRun)} · {new Date(job.lastRun).toLocaleString()}
        </p>
      )}
    </div>
  )
}

export default function CronPage() {
  const { showToast } = useToast()
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [appId, setAppId] = useState("")
  const selectedApp = apps.find((app) => app.id === appId)
  const [schedule, setSchedule] = useState("0 * * * *")
  const [command, setCommand] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleteJob, setDeleteJob] = useState<CronJob | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [j, ap] = await Promise.all([api.cron.list(), api.apps.list()])
      setJobs(j || [])
      setApps(ap || [])
    } catch {
      showToast("Failed to load", "Could not fetch scheduled jobs.", "destructive")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const enabledCount = jobs.filter((j) => j.enabled).length
  const pausedCount = jobs.length - enabledCount

  const handleCreate = async () => {
    if (!appId || !command.trim()) {
      showToast("Missing fields", "Pick an app and enter a command.", "destructive")
      return
    }
    setCreating(true)
    try {
      await api.cron.create(appId, schedule, command.trim())
      showToast("Job created", "Scheduled job added.", "success")
      setCommand("")
      await load()
    } catch (err) {
      showToast("Create failed", err instanceof Error ? err.message : "Error", "destructive")
    } finally {
      setCreating(false)
    }
  }

  const toggle = async (job: CronJob) => {
    setTogglingId(job.id)
    try {
      await api.cron.update({ id: job.id, enabled: !job.enabled })
      await load()
    } catch {
      showToast("Update failed", "Could not toggle job.", "destructive")
    } finally {
      setTogglingId(null)
    }
  }

  const runNow = async (job: CronJob) => {
    setRunningId(job.id)
    try {
      await api.cron.run(job.id)
      showToast("Triggered", `Running "${job.command}" now.`, "success")
    } catch {
      showToast("Run failed", "Could not run job.", "destructive")
    } finally {
      setRunningId(null)
    }
  }

  const remove = async () => {
    if (!deleteJob) return
    setDeleting(true)
    try {
      await api.cron.delete(deleteJob.id)
      showToast("Deleted", "Scheduled job removed.", "success")
      setDeleteJob(null)
      await load()
    } catch {
      showToast("Delete failed", "Could not delete job.", "destructive")
    } finally {
      setDeleting(false)
    }
  }

  const submitOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !creating) void handleCreate()
  }

  return (
    <AppShell appCount={apps.length}>
      <div className="animate-in fade-in-50 p-4 duration-200 md:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Scheduled Jobs
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Run commands inside an app&apos;s container on a cron schedule.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            {/* Main column */}
            <div className="min-w-0 space-y-6">
              {/* Create form */}
              <Frame className="w-full">
                <FramePanel className="shrink-0 mb-2">
                  <FrameTitle>New scheduled job</FrameTitle>
                  <FrameDescription>
                    5-field cron expression — minute, hour, day, month, weekday.
                  </FrameDescription>
                </FramePanel>
                <Card>
                  <CardPanel className="space-y-4">
                    {apps.length === 0 && !loading ? (
                      <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-6 text-center">
                        <p className="text-sm font-medium text-foreground">No apps deployed yet</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Deploy an app first, then schedule commands to run inside its container.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <Field>
                            <FieldLabel className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                              App
                            </FieldLabel>
                            <Select
                              value={appId}
                              onValueChange={(v) => setAppId(v || "")}
                              disabled={loading || apps.length === 0}
                            >
                              <SelectTrigger className="h-9 w-full text-sm">
                                <SelectValue placeholder="Select app...">
                                  {selectedApp ? selectedApp.name : undefined}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectPopup alignItemWithTrigger={false}>
                                {apps.map((app) => (
                                  <SelectItem key={app.id} value={app.id}>
                                    {app.name}
                                  </SelectItem>
                                ))}
                              </SelectPopup>
                            </Select>
                          </Field>

                          <Field>
                            <FieldLabel className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                              Schedule
                            </FieldLabel>
                            <Input
                              value={schedule}
                              onChange={(e) => setSchedule(e.target.value)}
                              placeholder="0 * * * *"
                              className="h-9 font-mono text-sm"
                            />
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {PRESETS.map((p) => (
                                <Button
                                  key={p.value}
                                  type="button"
                                  size="xs"
                                  variant={schedule === p.value ? "default" : "outline"}
                                  onClick={() => setSchedule(p.value)}
                                  className="font-normal"
                                >
                                  {p.label}
                                </Button>
                              ))}
                            </div>
                          </Field>
                        </div>

                        <Field>
                          <FieldLabel className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                            Command
                          </FieldLabel>
                          <Input
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            onKeyDown={submitOnEnter}
                            placeholder="e.g. npm run migrate  or  python manage.py cleanup"
                            className="h-9 font-mono text-sm"
                            disabled={apps.length === 0}
                          />
                          <FieldDescription>
                            Runs inside the selected app&apos;s container with its environment and files.
                          </FieldDescription>
                        </Field>

                        <Button
                          onClick={handleCreate}
                          loading={creating}
                          disabled={apps.length === 0}
                          className="gap-1.5"
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                          Add job
                        </Button>
                      </>
                    )}
                  </CardPanel>
                </Card>
                <FrameFooter>
                  <div className="flex gap-1.5 text-xs text-muted-foreground">
                    <ClockIcon className="mt-0.5 size-3 shrink-0" />
                    <p>Times follow the server&apos;s timezone. Press Enter in the command field to submit.</p>
                  </div>
                </FrameFooter>
              </Frame>

              {/* Jobs list */}
              <Frame className="w-full">
                <FramePanel className="shrink-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <FrameTitle>Active jobs</FrameTitle>
                      <FrameDescription>
                        {loading
                          ? "Loading scheduled jobs…"
                          : jobs.length === 0
                            ? "No jobs configured yet."
                            : `${jobs.length} job${jobs.length !== 1 ? "s" : ""} configured`}
                      </FrameDescription>
                    </div>
                    {!loading && jobs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="success" size="sm">
                          {enabledCount} active
                        </Badge>
                        {pausedCount > 0 && (
                          <Badge variant="secondary" size="sm">
                            {pausedCount} paused
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </FramePanel>

                {loading ? (
                  <FramePanel className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </FramePanel>
                ) : jobs.length === 0 ? (
                  <FramePanel className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <ClockIcon className="h-6 w-6 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No scheduled jobs yet.</p>
                    <p className="max-w-sm text-xs text-muted-foreground/70">
                      Create one above to run maintenance scripts, migrations, or cleanups on a schedule.
                    </p>
                  </FramePanel>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden overflow-x-auto md:block">
                      <Table variant="card">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Job</TableHead>
                            <TableHead className="w-36">Last run</TableHead>
                            <TableHead className="w-44 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jobs.map((job) => (
                            <TableRow key={job.id} className={cn(!job.enabled && "opacity-70")}>
                              <TableCell>
                                <JobMeta job={job} />
                              </TableCell>
                              <TableCell>
                                {hasValidLastRun(job.lastRun) ? (
                                  <div className="space-y-1">
                                    <span className="block text-xs text-muted-foreground">
                                      {timeAgo(job.lastRun)}
                                    </span>
                                    {job.lastStatus && (
                                      <Badge variant={lastStatusVariant(job.lastStatus)} size="sm">
                                        {job.lastStatus}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Never</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end">
                                  <JobActions
                                    job={job}
                                    onToggle={() => toggle(job)}
                                    onRun={() => runNow(job)}
                                    onDelete={() => setDeleteJob(job)}
                                    running={runningId === job.id}
                                    toggling={togglingId === job.id}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile cards */}
                    <div className="space-y-1 p-1 md:hidden">
                      {jobs.map((job) => (
                        <Card key={job.id} className={cn("before:hidden shadow-none", !job.enabled && "opacity-70")}>
                          <CardPanel className="space-y-3">
                            <JobMeta job={job} />
                            <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-3">
                              <div>
                                {hasValidLastRun(job.lastRun) ? (
                                  <span className="text-xs text-muted-foreground">
                                    Last run {timeAgo(job.lastRun)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Never run</span>
                                )}
                              </div>
                              <JobActions
                                job={job}
                                onToggle={() => toggle(job)}
                                onRun={() => runNow(job)}
                                onDelete={() => setDeleteJob(job)}
                                running={runningId === job.id}
                                toggling={togglingId === job.id}
                              />
                            </div>
                          </CardPanel>
                        </Card>
                      ))}
                    </div>
                  </>
                )}

                {!loading && jobs.length > 0 && (
                  <FrameFooter>
                    <div className="flex gap-1.5 text-xs text-muted-foreground">
                      <NucleoIcon name="info" className="mt-0.5 size-3 shrink-0" />
                      <p>
                        Toggle a job off to pause it without deleting. &ldquo;Run&rdquo; triggers it immediately.
                      </p>
                    </div>
                  </FrameFooter>
                )}
              </Frame>
            </div>

            {/* Sidebar reference */}
            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <Frame className="w-full">
                <FramePanel>
                  <div className="mb-3 flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-primary" />
                    <FrameTitle>Cron format</FrameTitle>
                  </div>
                  <pre className="mb-3 overflow-x-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
{`* * * * *
│ │ │ │ └─ weekday (0-6)
│ │ │ └─── month   (1-12)
│ │ └───── day     (1-31)
│ └─────── hour    (0-23)
└───────── minute  (0-59)`}
                  </pre>
                  <FrameDescription className="text-[11px] leading-snug">
                    Use{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">*</code> for
                    every,{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">*/5</code> for
                    steps, and{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">1,15</code> for
                    lists.
                  </FrameDescription>
                </FramePanel>
              </Frame>

              <Frame className="w-full">
                <Card className="before:hidden shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Examples</CardTitle>
                    <CardDescription className="text-xs">Common patterns you can paste into the schedule field.</CardDescription>
                  </CardHeader>
                  <CardPanel className="space-y-2 pt-0">
                    {[
                      ["0 0 * * *", "Every day at midnight"],
                      ["0 9 * * 1-5", "Weekdays at 9am"],
                      ["*/30 * * * *", "Every 30 minutes"],
                      ["0 0 1 * *", "First day of each month"],
                    ].map(([expr, desc]) => (
                      <button
                        key={expr}
                        type="button"
                        onClick={() => setSchedule(expr)}
                        className="flex w-full items-start gap-2 rounded-lg border border-border/50 bg-muted/10 px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-muted/20"
                      >
                        <code className="shrink-0 font-mono text-[11px] text-foreground">{expr}</code>
                        <span className="text-[11px] text-muted-foreground">{desc}</span>
                      </button>
                    ))}
                  </CardPanel>
                </Card>
              </Frame>
            </aside>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteJob} onOpenChange={(open) => !open && setDeleteJob(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:mx-0">
              <TrashIcon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Delete scheduled job?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the scheduled job
              {deleteJob ? (
                <>
                  {" "}
                  for <span className="font-medium text-foreground">{deleteJob.appName}</span>
                </>
              ) : null}
              . It will stop running on its schedule. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteJob && (
            <div className="px-6">
              <div className="space-y-1 rounded-lg border border-border bg-muted/20 p-3 font-mono text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">schedule</span>
                  <span className="text-foreground">{deleteJob.schedule}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground">command</span>
                  <span className="break-all text-foreground">{deleteJob.command}</span>
                </div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button variant="destructive" onClick={remove} loading={deleting} className="gap-1.5">
              <TrashIcon className="h-3.5 w-3.5" />
              Delete job
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
