import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Calendar } from 'lucide-react';
import { Eyebrow } from '@/components/landing/primitives';
import { blogSource } from '@/lib/blog-source';
import { getBlogMeta, sortBlogSlugsByDate } from '@/lib/blog/meta';
import { appName, siteUrl } from '@/lib/shared';

export const metadata: Metadata = {
  title: 'Blog | Better-PaaS',
  description:
    'Guides on self-hosted PaaS, Vercel alternatives, deploying Next.js on a VPS, and owning your deployment stack as an indie hacker.',
  openGraph: {
    title: 'Better-PaaS Blog',
    description:
      'Long-form guides on self-hosting, Vercel alternatives, and flat-cost deployment for solo founders.',
    url: `${siteUrl}/blog`,
    siteName: appName,
    type: 'website',
  },
};

export default function BlogIndexPage() {
  const pages = blogSource.getPages();
  const slugs = sortBlogSlugsByDate(pages.map((page) => page.slugs[0]!));

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

      <section className="relative mx-auto w-full max-w-4xl px-6 pb-24 pt-24 sm:pt-32">
        <Eyebrow>Blog</Eyebrow>
        <h1 className="bp-display mt-4 text-4xl font-semibold tracking-tight text-fd-foreground sm:text-5xl">
          Self-hosting guides for indie hackers
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-fd-muted-foreground">
          Long-form tutorials on Vercel alternatives, deploying on your own VPS, and keeping hosting costs
          predictable.
        </p>

        <ul className="mt-14 space-y-6">
          {slugs.map((slug) => {
            const page = blogSource.getPage([slug]);
            if (!page) return null;
            const meta = getBlogMeta(slug);

            return (
              <li key={slug}>
                <article className="group rounded-lg border border-fd-border bg-fd-card/30 p-6 transition-colors hover:bg-fd-card/50">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fd-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="size-3.5" />
                      <time dateTime={meta.date}>
                        {new Date(meta.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                    </span>
                    <span>·</span>
                    <span>{meta.author}</span>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-fd-foreground">
                    <Link href={page.url} className="hover:text-fd-primary transition-colors">
                      {page.data.title}
                    </Link>
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-fd-muted-foreground">{page.data.description}</p>
                  <Link
                    href={page.url}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fd-primary transition-colors group-hover:gap-2"
                  >
                    Read article
                    <ArrowRight className="size-4" />
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
