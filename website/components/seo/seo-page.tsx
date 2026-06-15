import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle, GitBranch, HelpCircle, ChevronRight, Calendar, X, Check, AlertCircle, User } from 'lucide-react';
import { Eyebrow, IconTile } from '@/components/landing/primitives';
import { appName, githubUrl, siteUrl } from '@/lib/shared';
import { getSeoUrl, type SeoPage } from '@/lib/seo/content';

export function SeoLandingPage({ page }: { page: SeoPage }) {
  const url = `${siteUrl}${getSeoUrl(page)}`;
  const jsonLd = buildJsonLd(page, url);

  return (
    <main className="relative flex min-h-screen flex-1 flex-col bg-fd-background text-fd-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-full max-w-7xl -translate-x-1/2 opacity-[0.14] dark:opacity-[0.22]"
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 50% 0%, var(--color-fd-primary) 0%, transparent 100%)',
        }}
      />

      {/* Breadcrumb navigation */}
      <nav aria-label="breadcrumb" className="relative mx-auto w-full max-w-6xl px-6 pt-20 sm:pt-28">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-fd-muted-foreground">
          <li>
            <Link href="/" className="hover:text-fd-foreground transition-colors">
              {appName}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5 opacity-60" />
          </li>
          <li>
            <Link href={`/${page.family}`} className="hover:text-fd-foreground transition-colors capitalize">
              {page.family.replace(/-/g, ' ')}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5 opacity-60" />
          </li>
          <li className="text-fd-foreground font-medium truncate max-w-[200px] sm:max-w-xs" aria-current="page">
            {page.h1}
          </li>
        </ol>
      </nav>

      <section className="relative mx-auto grid w-full max-w-6xl gap-10 px-6 pb-12 pt-6 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div>
          <Eyebrow>{page.eyebrow}</Eyebrow>
          <h1 className="bp-display mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-fd-foreground sm:text-5xl">
            {page.h1}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fd-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              <span>Last updated {new Date(page.dateModified).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className="size-3.5" />
              <span>Reviewed by Better-PaaS team</span>
            </div>
            {isContentFresh(page.lastReviewed) ? null : (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-amber-600 dark:text-amber-400">
                <AlertCircle className="size-3" />
                <span>Content may need review</span>
              </div>
            )}
          </div>
          <p className="mt-6 max-w-3xl text-base leading-8 text-fd-muted-foreground sm:text-lg">
            {page.description}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href={page.ctaHref ?? '/docs/quickstart'}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-fd-foreground px-5 text-sm font-semibold text-fd-background transition-opacity hover:opacity-90"
            >
              {page.ctaLabel ?? 'Start with the quickstart'}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-fd-border bg-fd-card/40 px-5 text-sm font-semibold text-fd-foreground transition-colors hover:bg-fd-card"
            >
              Read the docs
            </Link>
          </div>
        </div>

        <aside className="rounded-lg border border-fd-border bg-fd-card/40 p-5">
          <div className="flex items-center gap-3">
            <IconTile size="sm">
              <GitBranch className="size-4" />
            </IconTile>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-muted-foreground">
                Search Intent
              </p>
              <p className="mt-1 text-sm font-semibold text-fd-foreground">{page.primaryKeyword}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-fd-border pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-muted-foreground">
              Also Targets
            </p>
            <ul className="mt-3 space-y-2">
              {page.secondaryKeywords.map((keyword) => (
                <li key={keyword} className="flex gap-2 text-sm text-fd-muted-foreground">
                  <CheckCircle className="mt-0.5 size-4 shrink-0 text-fd-primary" />
                  <span>{keyword}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      <section className="relative mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <article className="min-w-0">
            <section className="rounded-lg border border-fd-border bg-fd-card/25 p-6 sm:p-8">
              <h2 className="text-2xl font-semibold text-fd-foreground">Overview</h2>
              <p className="mt-4 text-sm leading-7 text-fd-muted-foreground sm:text-base">
                {page.summary}
              </p>
            </section>

            <div className="mt-6 space-y-6">
              {page.sections.map((section) => (
                <section
                  key={section.title}
                  className="rounded-lg border border-fd-border bg-fd-card/20 p-6 sm:p-8"
                >
                  <h2 className="text-2xl font-semibold text-fd-foreground">{section.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-fd-muted-foreground sm:text-base">
                    {section.body}
                  </p>
                  {section.bullets?.length ? (
                    <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-2 text-sm leading-6 text-fd-muted-foreground">
                          <CheckCircle className="mt-1 size-4 shrink-0 text-fd-primary" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            {page.comparisonTable?.length ? (
              <section className="mt-6 rounded-lg border border-fd-border bg-fd-card/25 p-6 sm:p-8">
                <h2 className="text-2xl font-semibold text-fd-foreground">Side-by-side comparison</h2>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-fd-border">
                        <th className="pb-3 pr-4 text-left font-semibold text-fd-muted-foreground">Criterion</th>
                        <th className="pb-3 pr-4 text-left font-semibold text-fd-primary">{appName}</th>
                        <th className="pb-3 text-left font-semibold text-fd-muted-foreground">Competitor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-fd-border">
                      {page.comparisonTable.map((row) => (
                        <tr key={row.criterion} className="group">
                          <td className="py-3 pr-4 font-medium text-fd-foreground">{row.criterion}</td>
                          <td className="py-3 pr-4">
                            <div className="flex items-start gap-2">
                              {row.winner === 'app' ? (
                                <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                              ) : row.winner === 'competitor' ? (
                                <X className="mt-0.5 size-4 shrink-0 text-fd-muted-foreground opacity-50" />
                              ) : (
                                <span className="mt-0.5 size-4 shrink-0 text-center text-xs text-fd-muted-foreground">—</span>
                              )}
                              <span className="text-fd-foreground">{row.appName}</span>
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex items-start gap-2">
                              {row.winner === 'competitor' ? (
                                <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                              ) : row.winner === 'app' ? (
                                <X className="mt-0.5 size-4 shrink-0 text-fd-muted-foreground opacity-50" />
                              ) : (
                                <span className="mt-0.5 size-4 shrink-0 text-center text-xs text-fd-muted-foreground">—</span>
                              )}
                              <span className="text-fd-muted-foreground">{row.competitor}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <section className="mt-6 rounded-lg border border-fd-border bg-fd-card/25 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <IconTile size="sm">
                  <HelpCircle className="size-4" />
                </IconTile>
                <h2 className="text-2xl font-semibold text-fd-foreground">FAQ</h2>
              </div>
              <div className="mt-6 space-y-5">
                {page.faqs.map((faq) => (
                  <div key={faq.question} className="border-t border-fd-border pt-5 first:border-t-0 first:pt-0">
                    <h3 className="text-base font-semibold text-fd-foreground">{faq.question}</h3>
                    <p className="mt-2 text-sm leading-7 text-fd-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-fd-border bg-fd-card/35 p-5">
              <div className="flex items-center gap-3">
                <IconTile size="sm">
                  <BookOpen className="size-4" />
                </IconTile>
                <p className="text-sm font-semibold text-fd-foreground">Related reading</p>
              </div>
              <ul className="mt-4 space-y-2">
                {page.related.map((item) => (
                  <li key={item}>
                    <Link
                      href={item}
                      className="group flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-card hover:text-fd-foreground"
                    >
                      <span className="min-w-0 truncate">{labelFromHref(item)}</span>
                      <ArrowRight className="size-3 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-fd-border bg-fd-card/35 p-5">
              <p className="text-sm font-semibold text-fd-foreground">Build on your own server</p>
              <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
                {appName} is free and open source. Install it on a VPS, connect Git, and deploy with automatic HTTPS.
              </p>
              <Link
                href="/pricing"
                className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-fd-foreground px-4 text-sm font-semibold text-fd-background transition-opacity hover:opacity-90"
              >
                Free Forever
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function isContentFresh(lastReviewed: string): boolean {
  const sixMonthsAgo = Date.now() - 1000 * 60 * 60 * 24 * 180;
  return new Date(lastReviewed).getTime() > sixMonthsAgo;
}

function labelFromHref(href: string) {
  if (href === '/docs') return 'Documentation';
  if (href === '/docs/quickstart') return 'Quickstart';
  if (href === '/pricing') return 'Pricing';
  if (href === '/platform') return 'Platform';
  if (href === '/catalog') return 'App catalog';
  return href
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/-/g, ' '))
    .join(' / ');
}

function buildJsonLd(page: SeoPage, url: string) {
  const faq = {
    '@type': 'FAQPage',
    mainEntity: page.faqs.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  const article = {
    '@type': page.schemaType,
    headline: page.h1,
    description: page.description,
    url,
    name: page.h1,
    about: page.primaryKeyword,
    datePublished: page.datePublished,
    dateModified: page.dateModified,
    author: {
      '@type': 'Person',
      name: 'Better-PaaS maintainers',
      url: githubUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: appName,
    },
  };

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: appName,
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: page.eyebrow,
        item: `${siteUrl}/${page.family}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: page.h1,
        item: url,
      },
    ],
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [article, faq, breadcrumb],
  };
}
