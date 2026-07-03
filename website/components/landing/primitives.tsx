import type { ReactNode } from 'react';
import { CheckCircle, Loader, Square, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ──────────────────────────────────────────────────────────────────────────
 * Landing-page micro-components.
 *
 * These are 1:1 ports of the dashboard's primitives (frontend/components):
 * the status pill + dot (frontend/components/status-badge.tsx + lib/status.ts),
 * the Badge/Kbd treatments, and the repo/branch/url chips from the apps grid
 * (frontend/app/page.tsx). The marketing demo therefore renders the exact same
 * vocabulary as the real product.
 * ────────────────────────────────────────────────────────────────────────── */

type AppStatus = 'running' | 'building' | 'stopped' | 'failed';

// Mirrors lib/status.ts: label, semantic color, icon, and whether it pulses.
const STATUS_META: Record<
  AppStatus,
  {
    label: string;
    dot: string;
    text: string;
    bg: string;
    icon: typeof CheckCircle;
    pulse: boolean;
  }
> = {
  running: {
    label: 'Running',
    dot: 'bg-(--bp-success)',
    text: 'text-(--bp-success)',
    bg: 'bg-[color-mix(in_oklab,var(--bp-success)_16%,transparent)]',
    icon: CheckCircle,
    pulse: false,
  },
  building: {
    label: 'Building',
    dot: 'bg-(--bp-warning)',
    text: 'text-(--bp-warning)',
    bg: 'bg-[color-mix(in_oklab,var(--bp-warning)_16%,transparent)]',
    icon: Loader,
    pulse: true,
  },
  stopped: {
    label: 'Paused',
    dot: 'bg-fd-muted-foreground/50',
    text: 'text-fd-muted-foreground',
    bg: 'bg-fd-muted',
    icon: Square,
    pulse: false,
  },
  failed: {
    label: 'Failed',
    dot: 'bg-(--bp-danger)',
    text: 'text-(--bp-danger)',
    bg: 'bg-[color-mix(in_oklab,var(--bp-danger)_16%,transparent)]',
    icon: AlertTriangle,
    pulse: false,
  },
};

/** Bare status dot with a state-aware ping - frontend StatusDot. */
export function StatusDot({ status, className }: { status: AppStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn('relative flex size-2 shrink-0', className)}>
      {meta.pulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
            meta.dot,
          )}
        />
      )}
      <span className={cn('relative inline-flex size-2 rounded-full', meta.dot)} />
    </span>
  );
}

/** Status pill with icon + label - frontend StatusBadge (rounded-full chip). */
export function StatusBadge({ status, className }: { status: AppStatus; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        meta.bg,
        meta.text,
        className,
      )}
    >
      <Icon className={cn('size-3', meta.pulse && 'animate-spin')} />
      {meta.label}
    </span>
  );
}

/** Outline badge, e.g. the branch tag - frontend Badge variant="outline". */
export function BranchBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border border-fd-border bg-fd-card px-1.5 py-0.5 font-mono text-[11px] text-fd-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Rounded repo chip - frontend RepoLink. */
export function RepoPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-fd-border bg-fd-muted/30 px-2.5 py-1 font-mono text-[11px] text-fd-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Keycap - frontend Kbd. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center gap-0.5 rounded bg-fd-muted/50 px-1 font-mono text-[10px] leading-none text-fd-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** Brand-tinted icon tile beside section/card titles. */
export function IconTile({
  children,
  className,
  size = 'md',
}: {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={cn(
        'bp-feature-orb-tile inline-flex shrink-0 items-center justify-center text-black/80 dark:text-white/80',
        size === 'md' ? 'size-11' : 'size-9',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Small uppercase eyebrow used above section headings. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-fd-primary',
        className,
      )}
    >
      <span className="h-px w-5 bg-fd-primary/50" />
      {children}
    </span>
  );
}
