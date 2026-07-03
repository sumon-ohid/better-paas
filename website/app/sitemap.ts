import { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { blogSource } from '@/lib/blog-source';
import { getBlogMeta } from '@/lib/blog/meta';
import { siteUrl } from '@/lib/shared';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = source.getPages();
  const docsUrls = pages.map((page) => ({
    url: `${siteUrl}${page.url}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const staticPages = [
    '/blog',
    '/catalog',
    '/platform',
    '/pricing',
    '/privacy',
    '/sponsorships',
    '/terms',
    '/vercel-alternative',
    '/indie-hackers',
    '/cost-calculator',
  ].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  const blogUrls = blogSource.getPages().map((page) => {
    const slug = page.slugs[0]!;
    const meta = getBlogMeta(slug);
    return {
      url: `${siteUrl}${page.url}`,
      lastModified: new Date(meta.dateModified ?? meta.date),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    };
  });

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    ...staticPages,
    ...docsUrls,
    ...blogUrls,
  ];
}
