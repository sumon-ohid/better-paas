'use client';

import { useState, useEffect } from 'react';
import {
  GitBranch,
  Globe,
  Database,
  Terminal,
  Clock,
  RotateCcw,
  GitCommit,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/cn';

type TabId = 'deploy' | 'https' | 'rollback' | 'databases' | 'cron' | 'logs';

const TABS: { id: TabId; icon: typeof GitBranch; title: string; desc: string }[] = [
  {
    id: 'deploy',
    icon: GitBranch,
    title: 'Git-based deploys',
    desc: 'Point at any repo. Every push to your branch auto-redeploys through a per-app webhook.',
  },
  {
    id: 'https',
    icon: Globe,
    title: 'Automatic HTTPS',
    desc: 'Add a custom domain and Caddy issues a Let’s Encrypt certificate. Nothing to configure.',
  },
  {
    id: 'rollback',
    icon: RotateCcw,
    title: 'Zero-downtime & rollback',
    desc: 'New builds are health-checked before traffic switches. Roll back to any deploy instantly.',
  },
  {
    id: 'databases',
    icon: Database,
    title: 'Managed databases',
    desc: 'One-click Postgres, Redis, and MySQL. Attach to an app and connection vars are injected.',
  },
  {
    id: 'cron',
    icon: Clock,
    title: 'Scheduled jobs',
    desc: 'Run any command inside a container on a cron schedule — migrations, cleanups, backups.',
  },
  {
    id: 'logs',
    icon: Terminal,
    title: 'Live logs & shell',
    desc: 'Stream container logs in real time and open an in-browser terminal into any container.',
  },
];

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="bp-card flex h-full min-h-0 pb-6 flex-col overflow-hidden rounded-2xl bg-fd-card p-4 select-none">
      {children}
    </div>
  );
}

function DemoHeader({
  title,
  badge,
  badgeTone = 'neutral',
}: {
  title: string;
  badge?: string;
  badgeTone?: 'neutral' | 'success' | 'warning';
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="truncate text-sm font-semibold tracking-[-0.01em] text-fd-foreground">
        {title}
      </span>
      {badge && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium leading-none",
            badgeTone === 'success'
              ? "bg-[color-mix(in_oklab,var(--bp-success)_16%,transparent)] text-(--bp-success)"
              : badgeTone === 'warning'
                ? "bg-[color-mix(in_oklab,var(--bp-warning)_16%,transparent)] text-(--bp-warning)"
                : "bg-fd-muted/55 text-fd-muted-foreground"
          )}
        >
          {badgeTone === 'success' && <span className="size-1.5 rounded-full bg-(--bp-success) bp-pulse-dot" />}
          {badge}
        </span>
      )}
    </div>
  );
}

function DemoFooter({ icon, label, value }: { icon?: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="mt-auto grid mb-6 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 rounded-[0.85rem] bg-fd-muted/35 px-3 py-2 text-[10px] leading-snug text-fd-muted-foreground">
      <span className="flex size-3.5 items-center justify-center text-(--bp-accent-2)">
        {icon}
      </span>
      <span className="truncate">
        {label}
        {value && <span className="font-medium text-fd-foreground"> {value}</span>}
      </span>
    </div>
  );
}

function DeployDemo() {
  const rows: [string, 'done' | 'active' | 'pending'][] = [
    ['Webhook received · push to main', 'done'],
    ['Detecting framework (Nixpacks)', 'done'],
    ['Building image', 'active'],
    ['Health check', 'pending'],
  ];
  return (
    <Frame>
      <DemoHeader title="Git deploy pipeline" badge="Building" badgeTone="warning" />
      <div className="my-4 flex min-h-0 flex-1 flex-col justify-center gap-2">
        {rows.map(([label, state]) => (
          <div
            key={label}
            className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-[0.85rem] border border-fd-border bg-fd-muted/20 px-3 py-2"
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border",
                state === 'done'
                  ? "border-[color-mix(in_oklab,var(--bp-success)_28%,transparent)] bg-[color-mix(in_oklab,var(--bp-success)_16%,transparent)] text-(--bp-success)"
                  : state === 'active'
                    ? "border-[color-mix(in_oklab,var(--bp-warning)_38%,transparent)] bg-[color-mix(in_oklab,var(--bp-warning)_13%,transparent)]"
                    : "border-fd-border bg-fd-card text-fd-muted-foreground"
              )}
            >
              {state === 'done' ? (
                <Check className="size-3" />
              ) : state === 'active' ? (
                <span className="size-2.5 animate-spin rounded-full border-2 border-(--bp-warning) border-t-transparent" />
              ) : (
                <span className="size-1.5 rounded-full bg-current opacity-50" />
              )}
            </span>
            <span className={cn("truncate text-[11px] font-medium", state === 'pending' ? 'text-fd-muted-foreground/65' : 'text-fd-foreground')}>
              {label}
            </span>
          </div>
        ))}
      </div>
      <DemoFooter icon={<GitCommit className="size-3.5" />} label="latest commit" value="a1b9f2c · feat: add rate limiting" />
    </Frame>
  );
}

function HttpsDemo() {
  const rows: [string, boolean][] = [
    ['shop.acme.dev', true],
    ['api.acme.dev', true],
    ['www.acme.dev', false],
  ];
  return (
    <Frame>
      <DemoHeader title="Custom domains" badge="Auto TLS" badgeTone="success" />
      <div className="my-4 flex min-h-0 flex-1 flex-col justify-center gap-2.5">
        {rows.map(([domain, secured]) => (
          <div
            key={domain}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[0.85rem] border border-fd-border bg-fd-muted/20 px-3 py-2.5"
          >
            <span className="flex size-7 items-center justify-center rounded-[0.7rem] bg-[color-mix(in_oklab,var(--color-fd-primary)_13%,transparent)] text-fd-primary ring-1 ring-fd-primary/10">
              <Globe className="size-3.5 stroke-[1.9]" />
            </span>
            <span className="truncate font-mono text-[12px] font-medium text-fd-foreground">
              {domain}
            </span>
            {secured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--bp-success)_16%,transparent)] px-2 py-1 text-[10px] font-medium leading-none text-(--bp-success)">
                <Check className="size-3" /> TLS active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--bp-warning)_16%,transparent)] px-2 py-1 text-[10px] font-medium leading-none text-(--bp-warning)">
                <span className="size-1.5 rounded-full bg-(--bp-warning) bp-pulse-dot" />
                Issuing
              </span>
            )}
          </div>
        ))}
      </div>
      <DemoFooter icon={<Globe className="size-3.5" />} label="certificates renew automatically" value="with Caddy" />
    </Frame>
  );
}

function RollbackDemo() {
  const rows: [string, 'live' | 'past', string, string][] = [
    ['#48', 'live', 'feat: checkout v2', '2m ago'],
    ['#47', 'past', 'fix: cart totals', '5h ago'],
    ['#46', 'past', 'chore: bump deps', '1d ago'],
  ];
  return (
    <Frame>
      <DemoHeader title="Deploy history" badge="Traffic protected" badgeTone="success" />
      <div className="relative my-4 flex min-h-0 flex-1 flex-col justify-center gap-2.5">
        {rows.map(([id, state, msg, time]) => (
          <div
            key={id}
            className={cn(
              "relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
              state === 'live'
                ? "border-[color-mix(in_oklab,var(--bp-success)_26%,var(--color-fd-border))] bg-[color-mix(in_oklab,var(--bp-success)_7%,var(--color-fd-card))]"
                : "border-fd-border bg-fd-muted/20"
            )}
          >
            <span
              className={cn(
                "relative z-10 flex size-6 items-center justify-center rounded-full border text-[10px]",
                state === 'live'
                  ? "border-[color-mix(in_oklab,var(--bp-success)_36%,transparent)] bg-[color-mix(in_oklab,var(--bp-success)_18%,var(--color-fd-card))] text-(--bp-success)"
                  : "border-fd-border bg-fd-card text-fd-muted-foreground"
              )}
            >
              {state === 'live' ? <Check className="size-3" /> : id.replace('#', '')}
            </span>
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-fd-foreground">{msg}</span>
                <span className="shrink-0 font-mono text-[10px] text-fd-muted-foreground">{id}</span>
              </span>
              <span className="mt-0.5 block text-[11px] text-fd-muted-foreground">
                {state === 'live' ? `Live for ${time}` : `Last active ${time}`}
              </span>
            </span>
            <span className="justify-self-end">
              {state === 'live' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--bp-success)_16%,transparent)] px-2 py-1 text-[10px] font-medium leading-none text-(--bp-success)">
                  <Check className="size-3" /> Running
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-fd-border bg-fd-card px-2 py-1 text-[10px] font-medium text-fd-muted-foreground transition-colors hover:border-fd-primary/40 hover:text-fd-foreground">
                  <RotateCcw className="size-3" /> Restore
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      <DemoFooter icon={<RotateCcw className="size-3.5" />} label="previous releases stay ready" value="for instant restore" />
    </Frame>
  );
}

function DatabasesDemo() {
  const rows: [string, string, 'running' | 'stopped'][] = [
    ['Postgres', '16.2', 'running'],
    ['Redis', '7.2', 'running'],
    ['MySQL', '8.0', 'stopped'],
    ['Postgres', '15.6', 'running'],
  ];
  return (
    <Frame>
      <DemoHeader title="Add-ons" badge="4 services" />
      <div className="my-4 flex min-h-0 flex-1 flex-col justify-center">
        <div className="grid grid-cols-2 gap-2.5">
          {rows.map(([name, ver, status], i) => (
            <div
              key={`${name}-${ver}-${i}`}
              className="group rounded-[1rem] border border-fd-border bg-fd-muted/20 p-3 transition-colors hover:border-fd-primary/25 hover:bg-fd-muted/30"
            >
              <div className="flex items-start gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[0.8rem] bg-[color-mix(in_oklab,var(--color-fd-primary)_13%,transparent)] text-fd-primary ring-1 ring-fd-primary/10">
                  <Database className="size-4 stroke-[1.9]" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium leading-tight tracking-[-0.01em] text-fd-foreground">{name}</div>
                  <div className="mt-0.5 font-mono text-[10px] leading-none text-fd-muted-foreground">v{ver}</div>
                </div>
              </div>
              <span
                className={cn(
                  "mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium leading-none",
                  status === 'running'
                    ? "bg-[color-mix(in_oklab,var(--bp-success)_16%,transparent)] text-(--bp-success)"
                    : "bg-fd-muted text-fd-muted-foreground"
                )}
              >
                {status === 'running' ? <Check className="size-3 stroke-[2.2]" /> : <span className="size-2 rounded-[0.2rem] border border-current opacity-70" />}
                {status === 'running' ? 'Running' : 'Paused'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <DemoFooter icon={<Database className="size-3.5" />} label="DATABASE_URL injected into" value="storefront-web" />
    </Frame>
  );
}

function CronDemo() {
  const rows: [string, string, string, 'running' | 'stopped'][] = [
    ['nightly-backup', '0 2 * * *', 'pg_dump → s3', 'running'],
    ['cleanup-temp', '*/30 * * * *', 'rm -rf /tmp/*', 'running'],
    ['send-digest', '0 9 * * 1', 'node digest.js', 'stopped'],
  ];
  return (
    <Frame>
      <DemoHeader title="Scheduled jobs" badge="Cron enabled" />
      <div className="my-4 flex min-h-0 flex-1 flex-col justify-center gap-2.5">
        {rows.map(([name, schedule, cmd, status]) => (
          <div
            key={name}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-[0.85rem] border border-fd-border bg-fd-muted/20 px-3 py-2.5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[0.8rem] bg-[color-mix(in_oklab,var(--color-fd-primary)_13%,transparent)] text-fd-primary ring-1 ring-fd-primary/10">
              <Clock className="size-4 stroke-[1.9]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium leading-tight tracking-[-0.01em] text-fd-foreground">{name}</div>
              <div className="truncate font-mono text-[10px] text-fd-muted-foreground">{cmd}</div>
            </div>
            <span className="hidden rounded-full border border-fd-border bg-fd-card px-2 py-1 font-mono text-[10px] leading-none text-fd-muted-foreground sm:inline-flex">
              {schedule}
            </span>
            <span
              className={cn(
                "size-2 rounded-full",
                status === 'running' ? "bg-(--bp-success)" : "bg-fd-muted-foreground/45"
              )}
            />
          </div>
        ))}
      </div>
      <DemoFooter icon={<Clock className="size-3.5" />} label="standard cron syntax runs inside" value="app containers" />
    </Frame>
  );
}

function LogsDemo() {
  const lines: [string, string, 'info' | 'ok' | 'err'][] = [
    ['12:01', 'Ready on :3000', 'ok'],
    ['12:02', 'GET /api/health 200 · 4ms', 'info'],
    ['12:04', 'webhook processed · order_8821', 'ok'],
    ['12:06', 'upstream timeout · retrying', 'err'],
    ['12:07', 'reconnected to redis', 'ok'],
  ];
  return (
    <Frame>
      <DemoHeader title="Live logs & shell" badge="Streaming" badgeTone="success" />
      <div className="my-4 flex min-h-0 flex-1 flex-col justify-center gap-2 overflow-hidden">
        {lines.map(([time, message, state]) => (
          <div
            key={`${time}-${message}`}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[0.85rem] border border-fd-border bg-fd-muted/20 px-3 py-2"
          >
            <span className="font-mono text-[10px] text-fd-muted-foreground">{time}</span>
            <span
              className={cn(
                "truncate font-mono text-[10px]",
                state === 'ok'
                  ? "text-(--bp-success)"
                  : state === 'err'
                    ? "text-(--bp-warning)"
                    : "text-fd-foreground"
              )}
            >
              {message}
            </span>
            <span
              className={cn(
                "size-1.5 rounded-full",
                state === 'ok' ? "bg-(--bp-success)" : state === 'err' ? "bg-(--bp-warning)" : "bg-fd-muted-foreground/45"
              )}
            />
          </div>
        ))}
      </div>
      <DemoFooter icon={<Terminal className="size-3.5" />} label="shell attached to" value="storefront-web" />
    </Frame>
  );
}

const DEMOS: Record<TabId, () => React.ReactElement> = {
  deploy: DeployDemo,
  https: HttpsDemo,
  rollback: RollbackDemo,
  databases: DatabasesDemo,
  cron: CronDemo,
  logs: LogsDemo,
};

export function FeatureShowcase() {
  const [active, setActive] = useState<TabId>('deploy');
  const [paused, setPaused] = useState(false);

  const ActiveDemo = DEMOS[active];

  // Auto-advance logic
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setActive((current) => {
        const i = TABS.findIndex((t) => t.id === current);
        return TABS[(i + 1) % TABS.length].id;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <div 
      className="relative flex min-h-[clamp(310px,45svh,360px)] w-full items-center justify-center overflow-hidden rounded-md px-5 py-6 shadow-none sm:min-h-[clamp(315px,54vh,510px)] sm:px-9 sm:py-9 lg:min-h-[clamp(375px,57vh,540px)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        background: 'linear-gradient(134deg, #d9e1ff 0%, #7197ff 20%, #4c69ff 48%, #3035d5 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute -bottom-24 -left-20 size-[31rem] rounded-full opacity-75 blur-[72px]"
        style={{ background: '#eef1ff' }}
      />
      <div
        className="pointer-events-none absolute -right-28 -top-20 size-[33rem] rounded-full opacity-45 blur-[82px]"
        style={{ background: '#2538d8' }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-35 mix-blend-soft-light"
        style={{ background: 'radial-gradient(circle at 9% 84%, #ffffff 0%, transparent 36%)' }}
      />

      <div className="relative grid w-full max-w-[500px] gap-5 overflow-hidden rounded-[0.85rem] bg-[#f8fbff]/92 px-4 pb-8 pt-4 shadow-[0_15px_52px_-21px_rgba(23,44,92,0.55)] sm:max-w-[620px] sm:rounded-[0.675rem] sm:px-7 sm:pb-10 sm:pt-6 md:h-[360px] md:grid-cols-[0.82fr_1fr] xl:max-w-[680px] dark:bg-[#050505]/90 dark:shadow-[0_15px_52px_-21px_rgba(0,0,0,0.95)]">
        <div className="mb-6 flex min-w-0 flex-col gap-1 md:mb-10">
          <h3 className="mb-1.5 text-[8.5px] font-medium tracking-[-0.01em] text-[#66758e] sm:mb-3 sm:text-[11.5px] dark:text-[#9a9a9f]">
            Core features
          </h3>
          {TABS.map((tab) => {
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={cn(
                  "group grid -mt-0.5 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md px-2 py-[0.3125rem] text-left transition-all duration-300 sm:gap-3 sm:py-2",
                  isActive ? "bg-[#edf2ff]/75 dark:bg-white/[0.035]" : "hover:bg-white/[0.2] dark:hover:bg-white/[0.025]"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full transition-colors sm:size-6",
                    isActive
                      ? "bg-[#26364d] text-white dark:bg-[#f2f4f8] dark:text-[#080809]"
                      : "text-[#4d5f7a]/70 dark:text-[#eceff5]/80"
                  )}
                >
                  <tab.icon className="size-2.5 sm:size-3" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-medium tracking-[-0.01em] text-[#172033] sm:text-[12px] dark:text-[#eeeeee]">
                    {tab.title}
                  </span>
                  <span className="hidden truncate text-[9px] font-light leading-snug text-[#657286] sm:block dark:text-[#929297]">
                    {tab.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="hidden min-h-0 min-w-0 flex-col md:flex">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 6, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.985 }}
              transition={{ duration: 0.25 }}
              className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[0.65rem]"
            >
              <ActiveDemo />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
