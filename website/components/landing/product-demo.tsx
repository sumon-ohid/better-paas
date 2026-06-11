'use client';

import { useState } from 'react';
import {
  Activity,
  Archive,
  ChevronDown,
  Clock,
  Database,
  ExternalLink,
  GitBranch,
  GitCommit,
  Globe,
  Keyboard,
  Layers,
  LayoutGrid,
  Link2,
  Link2Off,
  List,
  LogOut,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Search,
  Server,
  Settings,
  Store,
  Terminal,
} from 'lucide-react';
import { LogoMark } from '@/components/logo';
import { cn } from '@/lib/cn';
import { BranchBadge, Kbd, RepoPill, StatusBadge, StatusDot } from './primitives';

type AppStatus = 'running' | 'building' | 'stopped' | 'failed';

type NavItem = {
  icon: typeof Globe;
  label: string;
  active?: boolean;
  badge?: string | number;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

type DemoApp = {
  name: string;
  status: AppStatus;
  url: string;
  repo: string;
  branch: string;
  commit: string;
  deployed: string;
};

// Mirrors frontend/components/app-shell.tsx — Deploy / Operate / Data /
// Insights / Admin groupings, so the marketing demo reads identically to the
// real product sidebar.
const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Deploy',
    items: [
      { icon: Globe, label: 'Applications', active: true, badge: 6 },
      { icon: Store, label: 'App Catalog' },
    ],
  },
  {
    label: 'Operate',
    items: [
      { icon: Server, label: 'Servers' },
      { icon: Activity, label: 'Node Health' },
      { icon: List, label: 'Live Logs', badge: '●' },
      { icon: Terminal, label: 'Server Terminal' },
      { icon: Clock, label: 'Scheduled Jobs' },
    ],
  },
  {
    label: 'Data',
    items: [
      { icon: Database, label: 'Databases' },
      { icon: Archive, label: 'Backups' },
    ],
  },
  {
    label: 'Insights',
    items: [{ icon: Layers, label: 'Web Analytics' }],
  },
  {
    label: 'Admin',
    items: [{ icon: Settings, label: 'Settings' }],
  },
];

const APPS: DemoApp[] = [
  {
    name: 'storefront-web',
    status: 'running',
    url: 'shop.acme.dev',
    repo: 'acme/storefront',
    branch: 'main',
    commit: 'feat: checkout v2 redesign',
    deployed: '2m ago',
  },
  {
    name: 'api-gateway',
    status: 'building',
    url: 'api.acme.dev',
    repo: 'acme/api-gateway',
    branch: 'main',
    commit: 'feat: add per-route rate limiting',
    deployed: 'just now',
  },
  {
    name: 'docs-site',
    status: 'running',
    url: 'docs.acme.dev',
    repo: 'acme/docs',
    branch: 'main',
    commit: 'docs: update deploy guide',
    deployed: '1h ago',
  },
  {
    name: 'worker-billing',
    status: 'stopped',
    url: '—',
    repo: 'acme/billing',
    branch: 'release',
    commit: 'chore: bump stripe sdk',
    deployed: '3d ago',
  },
  {
    name: 'analytics-edge',
    status: 'running',
    url: 'stats.acme.dev',
    repo: 'acme/edge',
    branch: 'main',
    commit: 'perf: cache geo lookups',
    deployed: '5h ago',
  },
  {
    name: 'legacy-cron',
    status: 'failed',
    url: '—',
    repo: 'acme/cron',
    branch: 'main',
    commit: 'fix: timezone in digest job',
    deployed: '2d ago',
  },
];

const FILTERS: { label: string; status: AppStatus | null }[] = [
  { label: 'All', status: null },
  { label: 'Running', status: 'running' },
  { label: 'Building', status: 'building' },
  { label: 'Paused', status: 'stopped' },
  { label: 'Failed', status: 'failed' },
];

const panel =
  'border border-fd-border/70 bg-[color-mix(in_oklab,var(--color-fd-card)_74%,transparent)]';
const mutedPanel =
  'border border-fd-border/60 bg-[color-mix(in_oklab,var(--color-fd-muted)_24%,transparent)]';

/* ────────────────────────────────────────────────────────────────────────── *
 * Cards — visual port of frontend Frame + Card + FrameFooter
 * ────────────────────────────────────────────────────────────────────────── */

function AppGridCard({ app }: { app: DemoApp }) {
  return (
    <div
      className={cn(
        panel,
        'group flex flex-col rounded-xl transition-colors hover:border-fd-border',
      )}
    >
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <StatusDot status={app.status} className="opacity-80" />
            <span className="truncate text-sm font-semibold text-fd-foreground/90">
              {app.name}
            </span>
          </div>
          <MoreHorizontal className="size-4 shrink-0 text-fd-muted-foreground/45 transition-colors group-hover:text-fd-muted-foreground/75" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={app.status} className="bg-fd-muted/35 text-fd-muted-foreground" />
          <BranchBadge className="border-fd-border/60 bg-transparent text-fd-muted-foreground">
            <GitBranch className="size-3" />
            {app.branch}
          </BranchBadge>
        </div>

        <div className="space-y-1.5">
          {app.url === '—' ? (
            <span className="flex items-center gap-1.5 font-mono text-xs text-fd-muted-foreground/70">
              <Link2Off className="size-3 shrink-0 opacity-55" />
              No URL assigned
            </span>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
              <Link2 className="size-3 shrink-0 opacity-55" />
              <span className="truncate font-mono">{app.url}</span>
              <ExternalLink className="size-3 shrink-0 opacity-45" />
            </div>
          )}
          <RepoPill className="border-fd-border/55 bg-transparent px-2 py-0.5 text-fd-muted-foreground/75">
            <GitBranch className="size-3 shrink-0 opacity-70" />
            <span className="truncate">{app.repo}</span>
          </RepoPill>
        </div>

        <div className="mt-auto flex items-start gap-1.5 text-xs text-fd-muted-foreground/70">
          <GitCommit className="mt-0.5 size-3.5 shrink-0 opacity-50" />
          <span className="line-clamp-1 min-w-0">{app.commit}</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-fd-border/45 px-4 py-2.5">
        <span className="text-xs text-fd-muted-foreground/60">Deployed</span>
        <span className="text-xs tabular-nums text-fd-muted-foreground/75">{app.deployed}</span>
      </div>
    </div>
  );
}

function AppListRow({ app }: { app: DemoApp }) {
  return (
    <div className={cn(panel, 'flex items-center gap-3 rounded-lg px-3.5 py-2.5 sm:px-4 sm:py-3')}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <StatusDot status={app.status} className="opacity-80" />
        <span className="truncate text-sm font-semibold text-fd-foreground/90">{app.name}</span>
      </div>
      <div className="hidden w-24 shrink-0 sm:block">
        <StatusBadge status={app.status} className="bg-fd-muted/35 text-fd-muted-foreground" />
      </div>
      <span className="hidden w-36 shrink-0 truncate font-mono text-xs text-fd-muted-foreground md:block">
        {app.url === '—' ? '—' : app.url}
      </span>
      <span className="hidden w-36 shrink-0 truncate font-mono text-xs text-fd-muted-foreground lg:block">
        {app.repo}
      </span>
      <span className="hidden shrink-0 text-xs tabular-nums text-fd-muted-foreground sm:block">
        {app.deployed}
      </span>
      <MoreHorizontal className="size-4 shrink-0 text-fd-muted-foreground/45" />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── *
 * The dashboard preview
 * ────────────────────────────────────────────────────────────────────────── */

export function ProductDemo() {
  const [filter, setFilter] = useState<string>('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const activeStatus = FILTERS.find((f) => f.label === filter)?.status ?? null;
  const visibleApps = activeStatus ? APPS.filter((a) => a.status === activeStatus) : APPS;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[1.35rem] border border-fd-border/70',
        'bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-fd-card)_82%,transparent),color-mix(in_oklab,var(--color-fd-card)_55%,transparent))]',
      )}
    >
      <div className="flex h-[34rem] overflow-hidden rounded-[1.15rem] sm:h-[38rem] lg:h-[42rem]">
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="hidden w-62 shrink-0 flex-col bg-transparent lg:flex">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <LogoMark className="size-5" />
            <span className="text-sm font-semibold leading-none text-fd-foreground/90">
              Better-PaaS
            </span>
            <span className="rounded bg-fd-muted/35 px-1.5 py-0.5 font-mono text-[10px] leading-none text-fd-muted-foreground/55">
              v1.4.0
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-hidden px-3 py-2">
            <div
              className={cn(
                mutedPanel,
                'flex items-center justify-between rounded-lg px-3 py-2 text-xs text-fd-muted-foreground/70',
              )}
            >
              <span className="flex items-center gap-1.5">
                <Search className="size-3.5" />
                Search commands...
              </span>
              <Kbd className="bg-transparent px-1 text-fd-muted-foreground/55">⌘K</Kbd>
            </div>

            <div className="space-y-4 overflow-hidden">
              {NAV_SECTIONS.map((section) => (
                <div key={section.label} className="space-y-1">
                  <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-fd-muted-foreground/50">
                    {section.label}
                  </div>
                  <nav className="space-y-0.5">
                    {section.items.map((item) => (
                      <div
                        key={item.label}
                        className={cn(
                          'flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                          item.active
                            ? 'bg-fd-muted/35 text-fd-foreground'
                            : 'text-fd-muted-foreground/72 hover:bg-fd-muted/20 hover:text-fd-foreground',
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <item.icon className="size-3.5 opacity-70" />
                          {item.label}
                        </span>
                        {item.badge !== undefined && (
                          <span
                            className={cn(
                              'rounded-sm px-1 font-mono text-[11px]',
                              item.badge === '●'
                                ? 'text-(--bp-success)'
                                : 'bg-fd-muted/35 text-fd-muted-foreground/65',
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    ))}
                  </nav>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1 p-3 text-xs font-medium text-fd-muted-foreground/70">
            <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5">
              <LogOut className="size-3.5" />
              Sign out
            </div>
            <div className="flex items-center justify-between px-2 pt-1 text-fd-muted-foreground/45">
              <span className="flex items-center gap-1.5">
                <Keyboard className="size-3.5" />
                Keyboard shortcuts
              </span>
              <Kbd className="bg-transparent px-1 text-fd-muted-foreground/45">?</Kbd>
            </div>
          </div>
        </aside>

        {/* ── Inset content ───────────────────────────────────────────── */}
        <div className="relative z-10 m-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bp-card !bg-fd-background/30 sm:m-3">
          {/* Header bar */}
          <header className="flex h-12 shrink-0 items-center justify-between gap-3 px-3 sm:h-13 sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <PanelLeft className="size-4 shrink-0 text-fd-muted-foreground/65" />
              <div className="hidden h-4 w-px bg-fd-border sm:block" />
              <button
                type="button"
                className={cn(
                  mutedPanel,
                  'hidden items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-fd-muted-foreground/80 sm:inline-flex',
                )}
              >
                <Server className="size-3.5 opacity-70" />
                <span className="font-medium text-fd-foreground/85">localhost</span>
                <ChevronDown className="size-3 opacity-60" />
              </button>
            </div>
            <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-fd-foreground px-2.5 text-xs font-semibold text-fd-background transition-opacity hover:opacity-90 sm:px-3">
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">Deploy service</span>
              <span className="sm:hidden">Deploy</span>
              <Kbd className="ml-1 hidden bg-fd-background/15 px-1 text-[11px] text-fd-background/75 sm:inline-flex">
                N
              </Kbd>
            </span>
          </header>

          {/* Page heading */}
          <div className="shrink-0 border-t border-fd-border/40 px-4 pt-3.5 pb-2 sm:px-5 sm:pt-4">
            <h3 className="text-sm font-bold tracking-tight text-fd-foreground sm:text-base">
              Deployed Services
            </h3>
            <p className="mt-0.5 hidden text-xs text-fd-muted-foreground sm:block">
              Manage your deployed services. Filter by what&apos;s running, building, paused, or
              failed.
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 pb-2.5 sm:px-5">
            <div
              className={cn(
                mutedPanel,
                'flex items-center overflow-hidden rounded-lg pl-2.5 text-xs text-fd-muted-foreground/70',
              )}
            >
              <Search className="size-3.5 shrink-0" />
              <span className="px-2 py-1.5">Filter by name...</span>
              <span className="m-0.5 rounded-md bg-fd-card px-2 py-1 text-[11px] font-medium text-fd-foreground/85 shadow-xs">
                Search
              </span>
            </div>

            <div className={cn(mutedPanel, 'flex items-center gap-0.5 rounded-lg p-0.5')}>
              {FILTERS.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setFilter(f.label)}
                  className={cn(
                    'cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    filter === f.label
                      ? 'bg-fd-card text-fd-foreground'
                      : 'text-fd-muted-foreground/70 hover:text-fd-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div
                className={cn(
                  mutedPanel,
                  'hidden items-center gap-0.5 rounded-lg p-0.5 md:flex',
                )}
              >
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  aria-label="Grid view"
                  className={cn(
                    'flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors',
                    view === 'grid'
                      ? 'bg-fd-card text-fd-foreground'
                      : 'text-fd-muted-foreground/70 hover:text-fd-foreground',
                  )}
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  aria-label="List view"
                  className={cn(
                    'flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors',
                    view === 'list'
                      ? 'bg-fd-card text-fd-foreground'
                      : 'text-fd-muted-foreground/70 hover:text-fd-foreground',
                  )}
                >
                  <List className="size-4" />
                </button>
              </div>
              <button
                type="button"
                className={cn(
                  mutedPanel,
                  'hidden h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-fd-muted-foreground/80 transition-colors hover:text-fd-foreground lg:inline-flex',
                )}
              >
                <Layers className="size-3.5 opacity-70" />
                Prune Docker
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden border-t border-fd-border/40 p-3 sm:p-5">
            {visibleApps.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-fd-muted-foreground">
                No applications match this filter.
              </div>
            ) : view === 'grid' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-2 2xl:grid-cols-3">
                {visibleApps.map((app) => (
                  <AppGridCard key={app.name} app={app} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {visibleApps.map((app) => (
                  <AppListRow key={app.name} app={app} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
