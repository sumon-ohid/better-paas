import Link from 'next/link';
import { ArrowRight, Layers } from 'lucide-react';
import { Eyebrow, IconTile } from '@/components/landing/primitives';
import { getSeoUrl, type SeoHub, type SeoPage } from '@/lib/seo/content';

export function SeoHubPage({ hub, pages }: { hub: SeoHub; pages: SeoPage[] }) {
  return (
    <main className="relative flex min-h-screen flex-1 flex-col bg-fd-background text-fd-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-full max-w-7xl -translate-x-1/2 opacity-[0.14] dark:opacity-[0.22]"
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 50% 0%, var(--color-fd-primary) 0%, transparent 100%)',
        }}
      />

      <section className="relative mx-auto w-full max-w-6xl px-6 pb-10 pt-24 text-center sm:pt-32">
        <Eyebrow className="justify-center">{hub.eyebrow}</Eyebrow>
        <h1 className="bp-display mx-auto mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-fd-foreground sm:text-5xl">
          {hub.h1}
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-fd-muted-foreground sm:text-lg">
          {hub.description}
        </p>
      </section>

      <section className="relative mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <IconTile size="sm">
              <Layers className="size-4" />
            </IconTile>
            <p className="text-sm font-semibold text-fd-foreground">{pages.length} pages</p>
          </div>
          <Link
            href="/docs/quickstart"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-fd-foreground px-4 text-sm font-semibold text-fd-background transition-opacity hover:opacity-90"
          >
            Quickstart
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <Link
              key={page.slug}
              href={getSeoUrl(page)}
              className="group flex min-h-[210px] flex-col justify-between rounded-lg border border-fd-border bg-fd-card/30 p-5 transition-colors hover:bg-fd-card/65"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fd-primary">
                  {page.eyebrow}
                </p>
                <h2 className="mt-3 line-clamp-2 text-lg font-semibold text-fd-foreground">
                  {page.h1}
                </h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-fd-muted-foreground">
                  {page.description}
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-fd-border pt-4">
                <span className="min-w-0 truncate text-xs text-fd-muted-foreground">
                  {page.primaryKeyword}
                </span>
                <ArrowRight className="size-4 shrink-0 text-fd-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-fd-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
