import { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { siteUrl } from '@/lib/shared';
import { getSeoUrl, seoHubs, seoPages } from '@/lib/seo/content';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = source.getPages();
  const docsUrls = pages.map((page) => ({
    url: `${siteUrl}${page.url}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));
  const seoHubUrls = seoHubs.map((hub) => ({
    url: `${siteUrl}${hub.path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));
  const seoUrls = seoPages.map((page) => ({
    url: `${siteUrl}${getSeoUrl(page)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: page.family === 'alternatives' || page.family === 'deploy' ? 0.85 : 0.75,
  }));

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    ...docsUrls,
    ...seoHubUrls,
    ...seoUrls,
  ];
}
