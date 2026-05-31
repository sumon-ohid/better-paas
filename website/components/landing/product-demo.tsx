import {
  Globe,
  Activity,
  Terminal,
  Database,
  Clock,
  Archive,
  Grid,
  Settings,
  Search,
  Plus,
  GitBranch,
  GitCommit,
  Link2,
  ExternalLink,
  MoreHorizontal,
  PanelLeft,
  LogOut,
  Keyboard,
  LayoutGrid,
  List,
} from 'lucide-react';
import { LogoMark } from '@/components/logo';
import { StatusDot, StatusBadge, BranchBadge, RepoPill, Kbd } from './primitives';

/* ──────────────────────────────────────────────────────────────────────────
 * ProductDemo — a pixel-faithful static replica of the Better-PaaS dashboard.
 *
 * Reconstructed directly from the real app:
 *   · the inset AppShell (frontend/components/app-shell.tsx): sidebar header
 *     with logo + version pill, the "Search commands… ⌘K" button, the nav list
 *     with colored glyphs and badges, and the footer (Sign out / shortcuts);
 *     the h-14 header with a sidebar trigger and the "Deploy service · N" CTA.
 *   · the Applications screen (frontend/app/page.tsx): the filter toolbar
 *     (search, status toggles, view toggle, Prune Docker) and the AppGridCard
 *     grid with status, branch, url, repo, commit message, and deployed time.
 *
 * It is the hero focal point, so it is rendered large.
 * ────────────────────────────────────────────────────────────────────────── */

const NAV = [
  { icon: Globe, label: 'Applications', color: 'text-fd-primary', active: true, badge: '6' },
  { icon: Activity, label: 'Node Health', color: 'text-(--bp-success)' },
  { icon: Terminal, label: 'Live Logs', color: 'text-(--bp-accent-2)', badge: '●' },
  { icon: Database, label: 'Databases', color: 'text-(--bp-warning)' },
  { icon: Clock, label: 'Scheduled Jobs', color: 'text-(--bp-danger)' },
  { icon: Archive, label: 'Backups', color: 'text-(--bp-accent-2)' },
  { icon: Grid, label: 'Web Analytics', color: 'text-fd-primary' },
  { icon: Settings, label: 'Settings', color: 'text-fd-muted-foreground' },
];

type DemoApp = {
  name: string;
  status: 'running' | 'building' | 'stopped' | 'failed';
  url: string;
  repo: string;
  branch: string;
  commit: string;
  deployed: string;
};

const APPS: DemoApp[] = [
  { name: 'storefront-web', status: 'running', url: 'shop.acme.dev', repo: 'acme/storefront', branch: 'main', commit: 'feat: checkout v2 redesign', deployed: '2m ago' },
  { name: 'api-gateway', status: 'building', url: 'api.acme.dev', repo: 'acme/api-gateway', branch: 'main', commit: 'feat: add per-route rate limiting', deployed: 'just now' },
  { name: 'docs-site', status: 'running', url: 'docs.acme.dev', repo: 'acme/docs', branch: 'main', commit: 'docs: update deploy guide', deployed: '1h ago' },
  { name: 'worker-billing', status: 'stopped', url: '—', repo: 'acme/billing', branch: 'release', commit: 'chore: bump stripe sdk', deployed: '3d ago' },
  { name: 'analytics-edge', status: 'running', url: 'stats.acme.dev', repo: 'acme/edge', branch: 'main', commit: 'perf: cache geo lookups', deployed: '5h ago' },
  { name: 'legacy-cron', status: 'failed', url: '—', repo: 'acme/cron', branch: 'main', commit: 'fix: timezone in digest job', deployed: '2d ago' },
];

/* AppGridCard — frontend/app/page.tsx */
function AppGridCard({ app }: { app: DemoApp }) {
  return (
    <div className="bp-card group flex flex-col rounded-xl p-4">
      {/* Header: name + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <StatusDot status={app.status} />
          <span className="truncate text-[15px] font-semibold text-fd-foreground">{app.name}</span>
        </div>
        <MoreHorizontal className="size-4 shrink-0 text-fd-muted-foreground/70" />
      </div>

      {/* Status + branch */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={app.status} />
        <BranchBadge>
          <GitBranch className="size-3" />
          {app.branch}
        </BranchBadge>
      </div>

      {/* URL + repo */}
      <div className="mt-3 space-y-1.5 border-t border-fd-border/50 pt-3">
        {app.url === '—' ? (
          <span className="font-mono text-sm text-fd-muted-foreground">—</span>
        ) : (
          <div className="flex items-center gap-1 text-sm text-fd-primary">
            <Link2 className="size-3 shrink-0 opacity-60" />
            <span className="truncate font-mono">{app.url}</span>
            <ExternalLink className="size-3 shrink-0 opacity-60" />
          </div>
        )}
        <RepoPill>
          <GitBranch className="size-3 shrink-0" />
          <span className="truncate">{app.repo}</span>
        </RepoPill>
      </div>

      {/* Latest commit */}
      <div className="mt-3 flex items-start gap-1.5 text-xs text-fd-muted-foreground">
        <GitCommit className="mt-0.5 size-3.5 shrink-0 opacity-60" />
        <span className="line-clamp-2 min-w-0">{app.commit}</span>
      </div>

      {/* Footer: deployed time */}
      <div className="mt-3 flex items-center justify-between border-t border-fd-border/50 pt-3">
        <span className="text-xs text-fd-muted-foreground">Deployed</span>
        <span className="text-xs tabular-nums text-fd-muted-foreground">{app.deployed}</span>
      </div>
    </div>
  );
}

export function ProductDemo() {
  return (
    // Mirrors the AppShell frame: inset content panel with rounded corners on a
    // transparent app background, rendered large for the hero.
    <div className="bp-card overflow-hidden rounded-2xl p-1.5 sm:p-2">
      <div className="flex h-136 overflow-hidden rounded-xl sm:h-152 lg:h-168">
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside className="hidden w-64 shrink-0 flex-col lg:flex">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3.5">
            <LogoMark className="size-6 text-fd-primary" />
            <span className="text-base font-bold leading-none text-fd-foreground">Better-PaaS</span>
            <span className="rounded-sm bg-fd-muted/60 px-1.5 py-0.5 font-mono text-[10px] leading-none text-fd-muted-foreground/80">
              v1.4.0
            </span>
          </div>

          {/* Body */}
          <div className="flex flex-1 flex-col gap-4 p-2">
            <div className="pt-2">
              <div className="flex w-full items-center justify-between rounded-md border border-fd-border/80 bg-fd-muted/20 px-3 py-1.5 text-sm text-fd-muted-foreground/80">
                <span className="flex items-center gap-1.5">
                  <Search className="size-3.5" />
                  Search commands...
                </span>
                <Kbd className="bg-fd-muted/40 px-1">⌘K</Kbd>
              </div>
            </div>

            <nav className="space-y-0.5">
              {NAV.map((item) => (
                <div
                  key={item.label}
                  className={`flex w-full items-center justify-between rounded px-3 py-1.5 text-sm ${
                    item.active
                      ? 'bg-fd-accent font-medium text-fd-foreground'
                      : 'text-fd-foreground/75'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <item.icon className={`size-3.5 ${item.color}`} />
                    {item.label}
                  </span>
                  {item.badge && (
                    <span
                      className={`rounded-sm px-1 font-mono text-xs ${
                        item.badge === '●'
                          ? 'text-(--bp-accent-2)'
                          : 'bg-fd-muted/40 text-fd-muted-foreground/80'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              ))}
            </nav>
          </div>

          {/* Footer */}
          <div className="space-y-1 p-3">
            <div className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-fd-foreground/75">
              <LogOut className="size-3.5" />
              Sign out
            </div>
            <div className="flex items-center justify-between px-2 pt-1 text-sm text-fd-muted-foreground/60">
              <span className="flex items-center gap-1.5">
                <Keyboard className="size-3.5" />
                Keyboard shortcuts
              </span>
              <Kbd className="bg-fd-muted/40 px-1">?</Kbd>
            </div>
          </div>
        </aside>

        {/* ── Main content frame (sidebar inset card) ─────────────── */}
        <div className="bp-card relative z-10 m-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl lg:my-2 lg:mr-2">
          {/* Header bar — h-14, pinned */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-fd-border px-4">
            <div className="flex items-center gap-2 text-fd-muted-foreground">
              <PanelLeft className="size-[18px]" />
            </div>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md bp-primary px-3 text-xs font-medium">
              <Plus className="size-3.5" />
              Deploy service
              <Kbd className="ml-1 bg-white/20 px-1 text-[11px] text-fd-primary-foreground">N</Kbd>
            </span>
          </header>

          {/* Subheader toolbar */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-fd-border px-4 py-2.5">
            <div className="flex items-center gap-1.5 rounded-md border border-fd-border bg-fd-muted/25 px-2.5 py-1.5 text-sm text-fd-muted-foreground">
              <Search className="size-4" />
              <span className="text-fd-muted-foreground/60">Filter by name...</span>
            </div>

            <div className="flex items-center gap-0.5 rounded-md border border-fd-border p-0.5">
              {['All', 'Running', 'Building', 'Paused', 'Failed'].map((f, i) => (
                <span
                  key={f}
                  className={`rounded px-2.5 py-0.5 text-sm ${
                    i === 0 ? 'bg-fd-accent text-fd-foreground' : 'text-fd-muted-foreground'
                  }`}
                >
                  {f}
                </span>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden items-center gap-0.5 rounded-md border border-fd-border p-0.5 md:flex">
                <span className="flex size-7 items-center justify-center rounded bg-fd-accent text-fd-foreground">
                  <LayoutGrid className="size-4" />
                </span>
                <span className="flex size-7 items-center justify-center rounded text-fd-muted-foreground">
                  <List className="size-4" />
                </span>
              </div>
            </div>
          </div>

          {/* Page content — applications grid */}
          <div className="flex-1 overflow-hidden p-4 md:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {APPS.map((app) => (
                <AppGridCard key={app.name} app={app} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
