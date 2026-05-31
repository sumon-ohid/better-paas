"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { AppShell, useToast } from "@/components/app-shell"
import { api } from "@/lib/api"
import type { CronJob, App } from "@/lib/types"
import { NucleoIcon } from "@/components/nucleo-icons"

type IconProps = Omit<React.ComponentProps<typeof NucleoIcon>, "name">
const ClockIcon = (props: IconProps) => <NucleoIcon {...props} name="activity" />
const TrashIcon = (props: IconProps) => <NucleoIcon {...props} name="trash" />
const PlusIcon = (props: IconProps) => <NucleoIcon {...props} name="plus" />
const PlayIcon = (props: IconProps) => <NucleoIcon {...props} name="play" />

const PRESETS = [
  { label: "Every 15 min", value: "*/15 * * * *" },
  { label: "Hourly", value: "0 * * * *" },
  { label: "Daily 2am", value: "0 2 * * *" },
  { label: "Weekly (Mon)", value: "0 0 * * 1" },
]

export default function CronPage() {
  const { showToast } = useToast()
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [appId, setAppId] = useState("")
  const [schedule, setSchedule] = useState("0 * * * *")
  const [command, setCommand] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleteJob, setDeleteJob] = useState<CronJob | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const [j, ap] = await Promise.all([api.cron.list(), api.apps.list()])
      setJobs(j || [])
      setApps(ap || [])
    } catch {
      showToast("Failed to load", "Could not fetch scheduled jobs.", "destructive")
    }
  }, [showToast])

  useEffect(() => {
    // load is async; setState runs after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

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
    try {
      await api.cron.update({ id: job.id, enabled: !job.enabled })
      await load()
    } catch {
      showToast("Update failed", "Could not toggle job.", "destructive")
    }
  }

  const runNow = async (job: CronJob) => {
    try {
      await api.cron.run(job.id)
      showToast("Triggered", `Running "${job.command}" now.`, "success")
    } catch {
      showToast("Run failed", "Could not run job.", "destructive")
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

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClockIcon className="h-6 w-6" />
          </div>
          <div>
            <h2>Scheduled Jobs</h2>
            <p className="text-sm text-muted-foreground">
              Run commands inside an app&apos;s container on a cron schedule.
            </p>
          </div>
        </div>

        {/* Two-column layout: actions on the left, reference rail on the right. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Main column */}
          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader className="border-b border-border/40">
                <CardTitle className="text-base">New scheduled job</CardTitle>
                <CardDescription>5-field cron expression (minute hour day month weekday).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">App</Label>
                    <Select value={appId} onValueChange={(v) => setAppId(v || "")}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select app..." />
                      </SelectTrigger>
                      <SelectPopup alignItemWithTrigger={false}>
                        {apps.map((app) => (
                          <SelectItem key={app.id} value={app.id}>
                            {app.name}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Schedule</Label>
                    <Input
                      value={schedule}
                      onChange={(e) => setSchedule(e.target.value)}
                      placeholder="0 * * * *"
                      className="font-mono text-sm"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {PRESETS.map((p) => (
                        <button
                          key={p.value}
                          onClick={() => setSchedule(p.value)}
                          className="text-[10px] rounded border border-border bg-muted/30 px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Command</Label>
                  <Input
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="e.g. npm run migrate  or  python manage.py cleanup"
                    className="font-mono text-sm"
                  />
                </div>
                <Button onClick={handleCreate} loading={creating} className="gap-1.5">
                  <PlusIcon className="h-3.5 w-3.5" />
                  Add job
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border/40">
                <CardTitle className="text-base">Active jobs</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {jobs.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                    No scheduled jobs.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {jobs.map((job) => (
                      <div key={job.id} className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{job.appName}</span>
                            <Badge variant="info" size="sm" className="font-mono">{job.schedule}</Badge>
                            {job.lastStatus && (
                              <Badge variant={job.lastStatus === "success" ? "success" : "destructive"} size="sm">
                                {job.lastStatus}
                              </Badge>
                            )}
                          </div>
                          <p className="font-mono text-xs text-muted-foreground truncate">{job.command}</p>
                          {job.lastRun && new Date(job.lastRun).getFullYear() > 1 && (
                            <p className="text-[10px] text-muted-foreground/60">
                              Last run: {new Date(job.lastRun).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch checked={job.enabled} onCheckedChange={() => toggle(job)} />
                          <Button variant="outline" onClick={() => runNow(job)} className="h-8 gap-1.5">
                            <PlayIcon className="h-3.5 w-3.5" />
                            Run
                          </Button>
                          <Button variant="destructive-outline" onClick={() => setDeleteJob(job)} className="h-8 w-8 p-0">
                            <TrashIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right rail: informative, secondary reference content. Stacks below
              the main column on small screens, so nothing important is hidden. */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {/* Cron format reference */}
            <Card className="border-primary/20 bg-primary/3">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <ClockIcon className="h-4 w-4 text-primary" />
                  Cron format
                </div>
                <pre className="mb-3 overflow-x-auto rounded-md border border-border bg-muted/20 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
{`* * * * *
│ │ │ │ └─ weekday (0-6)
│ │ │ └─── month   (1-12)
│ │ └───── day     (1-31)
│ └─────── hour    (0-23)
└───────── minute  (0-59)`}
                </pre>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Use <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">*</code> for
                  &ldquo;every&rdquo;, <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">*/5</code>{" "}
                  for steps, and <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">1,15</code>{" "}
                  for lists.
                </p>
              </CardContent>
            </Card>
            {/* Good to know */}
            <Card>
              <CardContent className="space-y-2.5 p-4 text-[11px] leading-snug text-muted-foreground">
                <p className="text-sm font-semibold text-foreground">Good to know</p>
                <p>Commands run inside the app&apos;s running container, so they share its environment and files.</p>
                <p>Toggle a job off to pause it without deleting. &ldquo;Run&rdquo; triggers it immediately, ignoring the schedule.</p>
                <p>Times follow the server&apos;s timezone.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteJob} onOpenChange={(open) => !open && setDeleteJob(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:mx-0">
              <TrashIcon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Delete scheduled job?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the scheduled job
              {deleteJob ? <> for <span className="font-medium text-foreground">{deleteJob.appName}</span></> : null}.
              It will stop running on its schedule. This cannot be undone.
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
