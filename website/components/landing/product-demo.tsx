'use client';

import { useState } from 'react';
import {
  Activity,
  Archive,
  Clock,
  Database,
  ExternalLink,
  GitBranch,
  GitCommit,
  Globe,
  Grid,
  Keyboard,
  Layers,
  LayoutGrid,
  Link2,
  List,
  LogOut,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Terminal,
} from 'lucide-react';
import { LogoMark } from '@/components/logo';
import { cn } from '@/lib/cn';
import { BranchBadge, Kbd, RepoPill, StatusBadge, StatusDot } from './primitives';

type AppStatus = 'running' | 'building' | 'stopped' | 'failed';

type NavItem = {
  icon: typeof Globe;
  label: string;
  color: string;
  active?: boolean;
  badge?: string;
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

const NAV: NavItem[] = [
  { icon: Globe, label: 'Applications', color: 'text-fd-primary', active: true, badge: '6' },
  { icon: Layers, label: 'App Catalog', color: 'text-(--bp-accent-2)' },
  { icon: Activity, label: 'Node Health', color: 'text-(--bp-success)' },
  { icon: Terminal, label: 'Live Logs', color: 'text-(--bp-accent-2)', badge: '●' },
  { icon: Terminal, label: 'Server Terminal', color: 'text-(--bp-success)' },
  { icon: Database, label: 'Databases', color: 'text-(--bp-warning)' },
  { icon: Clock, label: 'Scheduled Jobs', color: 'text-(--bp-danger)' },
  { icon: Archive, label: 'Backups', color: 'text-(--bp-accent-2)' },
  { icon: Grid, label: 'Web Analytics', color: 'text-fd-primary' },
  { icon: Settings, label: 'Settings', color: 'text-fd-muted-foreground' },
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

function AppGridCard({ app }: { app: DemoApp }) {
  return (
    <div
      className={cn(
        panel,
        'group flex min-h-47 flex-col rounded-lg p-4 transition-colors hover:border-fd-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <StatusDot status={app.status} className="opacity-80" />
          <span className="truncate text-sm font-semibold text-fd-foreground/90">{app.name}</span>
        </div>
        <MoreHorizontal className="size-4 shrink-0 text-fd-muted-foreground/45 transition-colors group-hover:text-fd-muted-foreground/75" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={app.status} className="bg-fd-muted/35 text-fd-muted-foreground" />
        <BranchBadge className="border-fd-border/60 bg-transparent text-fd-muted-foreground">
          <GitBranch className="size-3" />
          {app.branch}
        </BranchBadge>
      </div>

      <div className="mt-3 space-y-2 border-t border-fd-border/40 pt-3">
        {app.url === '—' ? (
          <span className="font-mono text-xs text-fd-muted-foreground/65">—</span>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
            <Link2 className="size-3 shrink-0 opacity-50" />
            <span className="truncate font-mono">{app.url}</span>
            <ExternalLink className="size-3 shrink-0 opacity-45" />
          </div>
        )}
        <RepoPill className="border-fd-border/50 bg-transparent px-2 py-0.5 text-fd-muted-foreground/70">
          <GitBranch className="size-3 shrink-0 opacity-70" />
          <span className="truncate">{app.repo}</span>
        </RepoPill>
      </div>

      <div className="mt-3 flex items-start gap-1.5 text-xs text-fd-muted-foreground/70">
        <GitCommit className="mt-0.5 size-3.5 shrink-0 opacity-45" />
        <span className="line-clamp-2 min-w-0">{app.commit}</span>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-fd-border/35 pt-3">
        <span className="text-xs text-fd-muted-foreground/60">Deployed</span>
        <span className="text-xs tabular-nums text-fd-muted-foreground/70">{app.deployed}</span>
      </div>
    </div>
  );
}

function AppListRow({ app }: { app: DemoApp }) {
  return (
    <div className={cn(panel, 'flex items-center gap-3 rounded-lg px-4 py-3')}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <StatusDot status={app.status} className="opacity-80" />
        <span className="truncate text-sm font-semibold text-fd-foreground/90">{app.name}</span>
      </div>
      <div className="hidden w-24 shrink-0 sm:block">
        <StatusBadge status={app.status} className="bg-fd-muted/35 text-fd-muted-foreground" />
      </div>
      <span className="hidden w-40 shrink-0 truncate font-mono text-xs text-fd-muted-foreground md:block">
        {app.url === '—' ? '—' : app.url}
      </span>
      <span className="hidden w-40 shrink-0 truncate font-mono text-xs text-fd-muted-foreground lg:block">
        {app.repo}
      </span>
      <span className="hidden shrink-0 text-xs tabular-nums text-fd-muted-foreground sm:block">
        {app.deployed}
      </span>
      <MoreHorizontal className="size-4 shrink-0 text-fd-muted-foreground/45" />
    </div>
  );
}

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
      <div className="flex h-136 overflow-hidden rounded-[1.15rem] sm:h-152 lg:h-168">
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

          <div className="flex flex-1 flex-col gap-4 px-3 py-2">
            <div className={cn(mutedPanel, 'flex items-center justify-between rounded-lg px-3 py-2 text-xs text-fd-muted-foreground/70')}>
              <span className="flex items-center gap-1.5">
                <Search className="size-3.5" />
                Search commands...
              </span>
              <Kbd className="bg-transparent px-1 text-fd-muted-foreground/55">⌘K</Kbd>
            </div>

            <nav className="space-y-1">
              {NAV.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-colors',
                    item.active
                      ? 'bg-fd-muted/35 text-fd-foreground'
                      : 'text-fd-muted-foreground/72 hover:bg-fd-muted/20 hover:text-fd-foreground',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <item.icon className={cn('size-3.5 opacity-70', item.color)} />
                    {item.label}
                  </span>
                  {item.badge && (
                    <span
                      className={cn(
                        'rounded-sm px-1 font-mono text-[11px]',
                        item.badge === '●'
                          ? 'text-fd-muted-foreground/60'
                          : 'bg-fd-muted/35 text-fd-muted-foreground/60',
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              ))}
            </nav>
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

        <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl m-2 sm:m-3 bp-card !bg-fd-background/30">
          <header className="flex h-13 shrink-0 items-center justify-between px-4">
            <div className="flex items-center gap-2 text-fd-muted-foreground/65">
              <PanelLeft className="size-4" />
            </div>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-fd-foreground px-3 text-xs font-semibold text-fd-background transition-opacity hover:opacity-90">
              <Plus className="size-3.5" />
              Deploy service
              <Kbd className="ml-1 bg-fd-background/15 px-1 text-[11px] text-fd-background/75">
                N
              </Kbd>
            </span>
          </header>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-fd-border/55 px-4 py-2.5">
            <div className={cn(mutedPanel, 'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-fd-muted-foreground/70')}>
              <Search className="size-3.5" />
              <span>Filter by name...</span>
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
              <div className={cn(mutedPanel, 'hidden items-center gap-0.5 rounded-lg p-0.5 md:flex')}>
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
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-4 md:p-5">
            {visibleApps.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-fd-muted-foreground">
                No applications match this filter.
              </div>
            ) : view === 'grid' ? (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
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
