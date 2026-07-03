'use client';

import { useState, useEffect } from 'react';
import {
  GitBranch,
  Globe,
  Database,
  Terminal,
  Clock,
  RotateCcw,
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
    desc: 'Run any command inside a container on a cron schedule - migrations, cleanups, backups.',
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden select-none">
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
    <div className="mb-1.5 flex items-center justify-between gap-3 sm:mb-3">
      <span className="truncate text-[8.5px] font-medium tracking-[-0.01em] text-[#66758e] sm:text-[11.5px] dark:text-[#9a9a9f]">
        {title}
      </span>
      {badge && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 text-[8.5px] font-medium tracking-[-0.01em] sm:text-[9px]",
            badgeTone === 'success'
              ? "text-(--bp-success)"
              : badgeTone === 'warning'
                ? "text-(--bp-warning)"
                : "text-[#657286] dark:text-[#929297]"
          )}
        >
          {badgeTone === 'success' && <span className="size-1.5 rounded-full bg-(--bp-success) bp-pulse-dot" />}
          {badge}
        </span>
      )}
    </div>
  );
}

function DemoListItem({
  icon: Icon,
  title,
  subtitle,
  trailing,
  active = false,
}: {
  icon: typeof Database;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-[0.3125rem] sm:gap-3 sm:py-2",
        active && "bg-[#edf2ff]/75 dark:bg-white/[0.035]"
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full transition-colors sm:size-6",
          active
            ? "bg-[#26364d] text-white dark:bg-[#f2f4f8] dark:text-[#080809]"
            : "text-[#4d5f7a]/70 dark:text-[#eceff5]/80"
        )}
      >
        <Icon className="size-2.5 sm:size-3" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-medium tracking-[-0.01em] text-[#172033] sm:text-[12px] dark:text-[#eeeeee]">
          {title}
        </span>
        {subtitle && (
          <span className="block truncate text-[9px] font-light leading-snug text-[#657286] dark:text-[#929297]">
            {subtitle}
          </span>
        )}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </div>
  );
}

function DeployDemo() {
  const rows: [string, 'done' | 'active' | 'pending'][] = [
    ['Webhook received · push to main', 'done'],
    ['Detecting framework (Nixpacks)', 'done'],
    ['Building image', 'active'],
    ['Running health check', 'pending'],
    ['Switching traffic', 'pending'],
  ];
  return (
    <Frame>
      <DemoHeader title="Git deploy pipeline" badge="Building" badgeTone="warning" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {rows.map(([label, state]) => (
            <DemoListItem
              key={label}
              icon={GitBranch}
              title={label}
              active={state === 'active'}
              trailing={
                state === 'done' ? (
                  <Check className="size-2.5 text-[#657286] dark:text-[#929297]" />
                ) : state === 'active' ? (
                  <span className="size-2 animate-spin rounded-full border-2 border-(--bp-warning) border-t-transparent" />
                ) : (
                  <span className="size-1.5 rounded-full bg-[#657286]/40 dark:bg-[#929297]/40" />
                )
              }
            />
          ))}
        </div>
      </div>
    </Frame>
  );
}

function HttpsDemo() {
  const rows: [string, boolean][] = [
    ['shop.acme.dev', true],
    ['api.acme.dev', true],
    ['staging.acme.dev', true],
    ['www.acme.dev', false],
  ];
  return (
    <Frame>
      <DemoHeader title="Custom domains" badge="Auto TLS" badgeTone="success" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {rows.map(([domain, secured]) => (
            <DemoListItem
              key={domain}
              icon={Globe}
              title={domain}
              subtitle={secured ? 'TLS active · Let’s Encrypt' : 'Issuing certificate'}
              trailing={
                secured ? (
                  <Check className="size-2.5 text-(--bp-success)" />
                ) : (
                  <span className="size-1.5 rounded-full bg-(--bp-warning) bp-pulse-dot" />
                )
              }
            />
          ))}
        </div>
      </div>
    </Frame>
  );
}

function RollbackDemo() {
  const rows: [string, 'live' | 'past', string, string][] = [
    ['#48', 'live', 'feat: checkout v2', '2m ago'],
    ['#47', 'past', 'fix: cart totals', '5h ago'],
    ['#46', 'past', 'chore: bump deps', '1d ago'],
    ['#45', 'past', 'feat: product filters', '3d ago'],
  ];
  return (
    <Frame>
      <DemoHeader title="Deploy history" badge="Traffic protected" badgeTone="success" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {rows.map(([id, state, msg, time]) => (
            <DemoListItem
              key={id}
              icon={RotateCcw}
              title={msg}
              subtitle={state === 'live' ? `Live for ${time}` : `Last active ${time}`}
              active={state === 'live'}
              trailing={
                <span className="font-mono text-[9px] font-light text-[#657286] dark:text-[#929297]">
                  {id}
                </span>
              }
            />
          ))}
        </div>
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
      <DemoHeader title="Add-ons" badge="4 services" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {rows.map(([name, ver, status], i) => (
            <DemoListItem
              key={`${name}-${ver}-${i}`}
              icon={Database}
              title={name}
              subtitle={`v${ver} · ${status === 'running' ? 'attached to storefront-web' : 'not attached'}`}
              trailing={
                <span
                  className={cn(
                    "text-[9px] font-light leading-snug",
                    status === 'running'
                      ? "text-[#657286] dark:text-[#929297]"
                      : "text-[#657286]/60 dark:text-[#929297]/60"
                  )}
                >
                  {status === 'running' ? 'Running' : 'Paused'}
                </span>
              }
            />
          ))}
        </div>
      </div>
    </Frame>
  );
}

function CronDemo() {
  const rows: [string, string, string, 'running' | 'stopped'][] = [
    ['nightly-backup', '0 2 * * *', 'pg_dump → s3', 'running'],
    ['cleanup-temp', '*/30 * * * *', 'rm -rf /tmp/*', 'running'],
    ['send-digest', '0 9 * * 1', 'node digest.js', 'stopped'],
    ['sync-inventory', '0 */6 * * *', 'node sync.js', 'running'],
  ];
  return (
    <Frame>
      <DemoHeader title="Scheduled jobs" badge="Cron enabled" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {rows.map(([name, schedule, cmd, status]) => (
            <DemoListItem
              key={name}
              icon={Clock}
              title={name}
              subtitle={`${schedule} · ${cmd}`}
              trailing={
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    status === 'running' ? "bg-(--bp-success)" : "bg-[#657286]/40 dark:bg-[#929297]/40"
                  )}
                />
              }
            />
          ))}
        </div>
      </div>
    </Frame>
  );
}

function LogsDemo() {
  const lines: [string, string, 'info' | 'ok' | 'err'][] = [
    ['12:01', 'Ready on :3000', 'ok'],
    ['12:02', 'GET /api/health 200 · 4ms', 'info'],
    ['12:04', 'webhook processed · order_8821', 'ok'],
    ['12:05', 'POST /api/checkout 201 · 118ms', 'info'],
    ['12:06', 'upstream timeout · retrying', 'err'],
    ['12:07', 'reconnected to redis', 'ok'],
    ['12:08', 'cache warmed · 842 keys', 'ok'],
  ];
  return (
    <Frame>
      <DemoHeader title="Live logs & shell" badge="Streaming" badgeTone="success" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {lines.map(([time, message, state]) => (
            <div
              key={`${time}-${message}`}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-[0.3125rem] sm:gap-3 sm:py-2"
            >
              <span className="font-mono text-[9px] font-light text-[#657286] dark:text-[#929297]">{time}</span>
              <span
                className={cn(
                  "truncate font-mono text-[9px] font-light sm:text-[10px]",
                  state === 'ok'
                    ? "text-(--bp-success)"
                    : state === 'err'
                      ? "text-(--bp-warning)"
                      : "text-[#172033] dark:text-[#eeeeee]"
                )}
              >
                {message}
              </span>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  state === 'ok' ? "bg-(--bp-success)" : state === 'err' ? "bg-(--bp-warning)" : "bg-[#657286]/40 dark:bg-[#929297]/40"
                )}
              />
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
          <div className="bp-card flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl p-3 sm:rounded-2xl sm:p-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 6, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.985 }}
                transition={{ duration: 0.25 }}
                className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
              >
                <ActiveDemo />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
