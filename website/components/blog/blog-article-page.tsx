import Link from 'next/link';
import type { MDXComponents } from 'mdx/types';
import { ArrowRight, Calendar, ChevronRight, User } from 'lucide-react';
import { getMDXComponents } from '@/components/mdx';
import { Eyebrow } from '@/components/landing/primitives';
import { appName, githubUrl, siteUrl } from '@/lib/shared';
import { getBlogMeta, type BlogMeta } from '@/lib/blog/meta';

type BlogArticlePageProps = {
  slug: string;
  title: string;
  description: string;
  meta: BlogMeta;
  MDX: React.ComponentType<{ components?: MDXComponents }>;
};

export function BlogArticlePage({ slug, title, description, meta, MDX }: BlogArticlePageProps) {
  const url = `${siteUrl}/blog/${slug}`;
  const jsonLd = buildJsonLd({ slug, title, description, meta, url });

  return (
    <main className="relative flex min-h-screen flex-1 flex-col bg-fd-background text-fd-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-full max-w-7xl -translate-x-1/2 opacity-[0.14] dark:opacity-[0.22]"
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 50% 0%, var(--color-fd-primary) 0%, transparent 100%)',
        }}
      />

      <nav aria-label="breadcrumb" className="relative mx-auto w-full max-w-3xl px-6 pt-20 sm:pt-28">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-fd-muted-foreground">
          <li>
            <Link href="/" className="transition-colors hover:text-fd-foreground">
              {appName}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5 opacity-60" />
          </li>
          <li>
            <Link href="/blog" className="transition-colors hover:text-fd-foreground">
              Blog
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5 opacity-60" />
          </li>
          <li className="max-w-[200px] truncate font-medium text-fd-foreground sm:max-w-xs" aria-current="page">
            {title}
          </li>
        </ol>
      </nav>

      <article className="relative mx-auto w-full max-w-3xl px-6 pb-24 pt-8 sm:pb-32">
        <Eyebrow>Blog</Eyebrow>
        <h1 className="bp-display mt-4 text-4xl font-semibold tracking-tight text-fd-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 text-lg leading-8 text-fd-muted-foreground">{description}</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fd-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            <time dateTime={meta.date}>
              {new Date(meta.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </div>
          <div className="flex items-center gap-1.5">
            <User className="size-3.5" />
            <span>{meta.author}</span>
          </div>
        </div>

        <div className="prose prose-fd-neutral dark:prose-invert mt-12 max-w-none prose-headings:scroll-mt-24 prose-a:text-fd-primary prose-th:text-left">
          <MDX components={getMDXComponents()} />
        </div>

        <aside className="mt-16 rounded-lg border border-fd-border bg-fd-card/40 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-fd-muted-foreground">
            Next steps
          </h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/docs/quickstart"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-fd-foreground px-5 text-sm font-semibold text-fd-background transition-opacity hover:opacity-90"
            >
              5-minute quickstart
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/vercel-alternative"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-fd-border bg-fd-card/40 px-5 text-sm font-semibold text-fd-foreground transition-colors hover:bg-fd-card"
            >
              Vercel alternative
            </Link>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-fd-border bg-fd-card/40 px-5 text-sm font-semibold text-fd-foreground transition-colors hover:bg-fd-card"
            >
              Star on GitHub
            </a>
          </div>
        </aside>
      </article>
    </main>
  );
}

function buildJsonLd({
  title,
  description,
  meta,
  url,
}: {
  slug: string;
  title: string;
  description: string;
  meta: BlogMeta;
  url: string;
}) {
  const graphs: Record<string, unknown>[] = [
    {
      '@type': 'Article',
      headline: title,
      description,
      datePublished: meta.date,
      dateModified: meta.dateModified ?? meta.date,
      author: { '@type': 'Person', name: meta.author },
      publisher: {
        '@type': 'Organization',
        name: appName,
        url: siteUrl,
      },
      mainEntityOfPage: url,
      keywords: meta.keywords?.join(', '),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: appName, item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
        { '@type': 'ListItem', position: 3, name: title, item: url },
      ],
    },
  ];

  if (meta.faqs?.length) {
    graphs.push({
      '@type': 'FAQPage',
      mainEntity: meta.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graphs };
}
