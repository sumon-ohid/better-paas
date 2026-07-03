import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogArticlePage } from '@/components/blog/blog-article-page';
import { blogSource } from '@/lib/blog-source';
import { getBlogMeta } from '@/lib/blog/meta';
import { appName, siteUrl } from '@/lib/shared';

export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params;
  const page = blogSource.getPage([slug]);
  if (!page) notFound();

  const MDX = page.data.body;
  const meta = getBlogMeta(slug);

  return (
    <BlogArticlePage
      slug={slug}
      title={page.data.title}
      description={page.data.description ?? ''}
      meta={meta}
      MDX={MDX}
    />
  );
}

export function generateStaticParams() {
  return blogSource.getPages().map((page) => ({
    slug: page.slugs[0]!,
  }));
}

export async function generateMetadata(props: PageProps<'/blog/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const page = blogSource.getPage([slug]);
  if (!page) notFound();

  const meta = getBlogMeta(slug);
  const url = `${siteUrl}/blog/${slug}`;

  return {
    title: `${page.data.title} | ${appName}`,
    description: page.data.description,
    keywords: meta.keywords,
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      url,
      siteName: appName,
      type: 'article',
      publishedTime: meta.date,
      modifiedTime: meta.dateModified ?? meta.date,
      authors: [meta.author],
    },
    alternates: {
      canonical: url,
    },
  };
}
