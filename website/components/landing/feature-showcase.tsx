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
import { BorderBeam } from '@/components/tailark/border-beam';
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
  return <div className="bp-card flex flex-1 flex-col rounded-2xl p-5 bg-fd-card select-none">{children}</div>;
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
      <p className="mt-auto pt-4 text-xs text-fd-muted-foreground">
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
      <span className="text-sm font-semibold text-fd-foreground">Deploy history</span>
      <div className="mt-5 flex-1 flex flex-col justify-center space-y-2.5 my-4">
        {rows.map(([id, state, msg, time]) => (
          <div
            key={id}
            className="flex items-center gap-3 rounded-lg border border-fd-border bg-fd-muted/20 px-3 py-2.5"
          >
            <span className="font-mono text-xs text-fd-muted-foreground">{id}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-fd-foreground">{msg}</span>
            <span className="hidden text-[11px] text-fd-muted-foreground sm:block">{time}</span>
            {state === 'live' ? (
              <StatusBadge status="running" />
            ) : (
              <span className="flex items-center gap-1 rounded-md border border-fd-border px-2 py-0.5 text-[11px] text-fd-muted-foreground transition-colors hover:border-fd-primary/40 hover:text-fd-foreground">
                <RotateCcw className="size-3" /> Roll back
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-auto pt-4 text-xs text-fd-muted-foreground">
        Every build is kept. One click restores a previous deploy instantly.
      </p>
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
      <div className="mt-auto flex items-center gap-1.5 rounded-lg bg-fd-muted/30 px-3 py-2 font-mono text-[11px] text-fd-muted-foreground">
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
      <p className="mt-auto pt-4 text-xs text-fd-muted-foreground">
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
      <div className="mt-4 flex-1 flex flex-col justify-between overflow-hidden rounded-xl bg-transparent p-3.5 font-mono text-[11px] leading-relaxed border border-fd-border/30 my-2">
        <div className="space-y-1.5 flex-1 flex flex-col justify-center">
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
      className="grid gap-12 md:grid-cols-[1fr_1.15fr] lg:gap-20 items-stretch"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Left side list of custom animated accordion items */}
      <div className="w-full flex flex-col gap-1.5 justify-center">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <div
              key={tab.id}
              className={cn(
                "border-b border-fd-border/30 transition-all duration-350 ease-in-out pl-3 pr-2.5 rounded-r-xl rounded-l-none border-l-2",
                isActive 
                  ? "bg-fd-primary/[0.03] border-l-fd-primary shadow-xs" 
                  : "border-l-transparent hover:bg-fd-muted/15"
              )}
            >
              <button
                type="button"
                onClick={() => setActive(tab.id)}
                className="w-full flex items-center justify-between py-4 text-left font-semibold text-fd-foreground focus:outline-none cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 text-base w-full">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg transition-all duration-350",
                      isActive
                        ? "bg-fd-primary text-fd-primary-foreground scale-105 shadow-md shadow-fd-primary/20"
                        : "bg-fd-primary/10 text-fd-primary group-hover:bg-fd-primary/15"
                    )}
                  >
                    <tab.icon className="size-4.5" />
                  </span>
                  <span className={cn("transition-colors duration-250", isActive ? "text-fd-primary" : "text-fd-foreground/90")}>
                    {tab.title}
                  </span>
                </div>
                <svg
                  className={cn(
                    "size-4 text-fd-muted-foreground transition-transform duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    isActive ? "rotate-180 text-fd-primary" : "group-hover:text-fd-foreground"
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <AnimatePresence initial={false}>
                {isActive && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                      opacity: { duration: 0.25, ease: "linear" },
                    }}
                  >
                    <p className="text-fd-muted-foreground pl-12.5 pb-4 leading-relaxed text-[14px]">
                      {tab.desc}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Right side visual container */}
      <div className="bg-fd-card relative flex overflow-hidden rounded-3xl border border-fd-border p-2 min-h-96 md:min-h-[440px] flex-col flex-1">
        <div className="w-15 absolute inset-0 right-0 ml-auto border-l border-fd-border/50 bg-[repeating-linear-gradient(-45deg,var(--color-fd-border),var(--color-fd-border)_1px,transparent_1px,transparent_8px)] opacity-30"></div>
        <div className="relative w-full rounded-2xl bg-fd-card flex flex-col flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 6, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.985 }}
              transition={{ duration: 0.25 }}
              className="w-full h-full flex flex-col flex-1 overflow-hidden rounded-2xl bg-fd-card"
            >
              <ActiveDemo />
            </motion.div>
          </AnimatePresence>
        </div>
        <BorderBeam
          duration={6}
          size={200}
          colorFrom="var(--color-fd-primary)"
          colorTo="var(--color-fd-ring)"
          className="opacity-70"
        />
      </div>
    </div>
  );
}
