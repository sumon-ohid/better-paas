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
import { StatusDot, StatusBadge, RepoPill } from './primitives';
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
    <div className="bp-card flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-fd-card p-5 select-none">
      {children}
    </div>
  );
}

function DeployDemo() {
  const rows: [string, 'done' | 'active' | 'pending'][] = [
    ['Webhook received · push to main', 'done'],
    ['Detecting framework (Nixpacks)', 'done'],
    ['Building image', 'active'],
    ['Health check', 'pending'],
    ['Switch traffic', 'pending'],
  ];
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-fd-foreground">
          <StatusDot status="building" />
          api-gateway
        </span>
        <StatusBadge status="building" />
      </div>
      <div className="mt-5 flex-1 flex flex-col justify-center space-y-3.5 font-mono text-xs my-4">
        {rows.map(([label, state]) => (
          <div key={label} className="flex items-center gap-2.5">
            {state === 'done' ? (
              <span className="flex size-4 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--bp-success)_18%,transparent)] text-(--bp-success)">
                <Check className="size-2.5" />
              </span>
            ) : state === 'active' ? (
              <span className="size-4 animate-spin rounded-full border-2 border-(--bp-warning) border-t-transparent" />
            ) : (
              <span className="size-4 rounded-full border border-fd-border" />
            )}
            <span className={state === 'pending' ? 'text-fd-muted-foreground/60' : 'text-fd-foreground'}>
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-1.5 border-t border-fd-border/60 pt-3 text-xs text-fd-muted-foreground">
        <GitCommit className="size-3.5 opacity-60" />
        <span className="truncate font-mono">a1b9f2c · feat: add rate limiting</span>
      </div>
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
      <span className="text-sm font-semibold text-fd-foreground">Custom domains</span>
      <div className="mt-5 flex-1 flex flex-col justify-center space-y-3 my-4">
        {rows.map(([domain, secured]) => (
          <div
            key={domain}
            className="flex items-center justify-between rounded-lg border border-fd-border bg-fd-muted/20 px-3 py-2.5"
          >
            <span className="flex items-center gap-2 font-mono text-sm text-fd-foreground">
              <Globe className="size-4 text-fd-primary" />
              {domain}
            </span>
            {secured ? (
              <span className="flex items-center gap-1.5 text-xs text-(--bp-success)">
                <Check className="size-3.5" /> TLS active
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-(--bp-warning)">
                <span className="size-1.5 rounded-full bg-(--bp-warning) bp-pulse-dot" />
                Issuing…
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-auto pt-4 text-[10px] text-fd-muted-foreground">
        Certificates renew automatically. No certbot, no cron, no downtime.
      </p>
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
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-fd-foreground">Deploy history</span>
        <span className="rounded-full bg-[color-mix(in_oklab,var(--bp-success)_16%,transparent)] px-2 py-1 text-[10px] font-medium text-(--bp-success)">
          Traffic protected
        </span>
      </div>
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
                <StatusBadge status="running" />
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-fd-border bg-fd-card px-2 py-1 text-[10px] font-medium text-fd-muted-foreground transition-colors hover:border-fd-primary/40 hover:text-fd-foreground">
                  <RotateCcw className="size-3" /> Restore
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
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
      <span className="text-sm font-semibold text-fd-foreground">Add-ons</span>
      <div className="mt-5 flex-1 flex flex-col justify-center my-4">
        <div className="grid grid-cols-2 gap-3">
          {rows.map(([name, ver, status], i) => (
            <div key={i} className="bp-card rounded-xl p-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-fd-primary/10 text-fd-primary">
                  <Database className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-fd-foreground">{name}</div>
                  <div className="font-mono text-[10px] text-fd-muted-foreground">v{ver}</div>
                </div>
              </div>
              <div className="mt-2.5">
                <StatusBadge status={status} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-auto flex items-center gap-1.5 rounded-lg bg-fd-muted/30 px-3 py-2 font-mono text-[10px] text-fd-muted-foreground">
        <span className="text-(--bp-success)">DATABASE_URL</span> injected into storefront-web
      </div>
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
      <span className="text-sm font-semibold text-fd-foreground">Scheduled jobs</span>
      <div className="mt-5 flex-1 flex flex-col justify-center space-y-2.5 my-4">
        {rows.map(([name, schedule, cmd, status]) => (
          <div
            key={name}
            className="flex items-center gap-3 rounded-lg border border-fd-border bg-fd-muted/20 px-3 py-2.5"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-fd-primary/10 text-fd-primary">
              <Clock className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-fd-foreground">{name}</div>
              <div className="truncate font-mono text-[10px] text-fd-muted-foreground">{cmd}</div>
            </div>
            <RepoPill className="hidden sm:inline-flex">{schedule}</RepoPill>
            <StatusDot status={status} />
          </div>
        ))}
      </div>
      <p className="mt-auto pt-4 text-[10px] text-fd-muted-foreground">
        Standard cron syntax, executed inside your app’s container.
      </p>
    </Frame>
  );
}

function LogsDemo() {
  const lines: [string, 'info' | 'ok' | 'err'][] = [
    ['$ npm run start', 'info'],
    ['› Ready on http://0.0.0.0:3000', 'ok'],
    ['GET /api/health 200 · 4ms', 'info'],
    ['POST /api/checkout 201 · 38ms', 'info'],
    ['✔ webhook processed · order_8821', 'ok'],
    ['GET /assets/app.js 200 · 1ms', 'info'],
    ['✖ upstream timeout · retrying', 'err'],
    ['› reconnected to redis', 'ok'],
    ['GET /api/users/me 200 · 12ms', 'info'],
    ['POST /api/webhooks/stripe 200 · 45ms', 'ok'],
    ['✔ volume backup completed', 'ok'],
  ];
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-fd-foreground">
          <Terminal className="size-4 text-(--bp-accent-2)" />
          storefront-web
        </span>
        <span className="flex items-center gap-1.5 text-xs text-(--bp-success)">
          <span className="size-1.5 rounded-full bg-(--bp-success) bp-pulse-dot" />
          streaming
        </span>
      </div>
      <div className="my-2 mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl  bg-transparent p-3.5 font-mono text-[9px] leading-relaxed">
        <div className="flex min-h-0 flex-1 flex-col justify-center space-y-1 overflow-hidden">
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="shrink-0 text-slate-500">[{`12:0${i}:11`}]</span>
              <span
                className={
                  l[1] === 'err' ? 'text-rose-450' : l[1] === 'ok' ? 'text-[#3c9f7a] dark:text-[#93e0c0]' : 'text-slate-650 dark:text-slate-300'
                }
              >
                {l[0]}
              </span>
            </div>
          ))}
        </div>
      </div>
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
        <div className="mb-6 flex min-w-0 flex-col gap-1 md:mb-0">
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
