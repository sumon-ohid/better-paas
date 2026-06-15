import { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/shared';
import { getSeoUrl, seoHubs, seoPages } from '@/lib/seo/content';
import { seoSitemapFamilies, seoSitemapPriority } from '@/lib/seo/unique-content';

export const dynamic = 'force-static';

const sitemapLastUpdated = '2026-06-15';

export default function sitemap(): MetadataRoute.Sitemap {
  const seoHubUrls = seoHubs.map((hub) => ({
    url: `${siteUrl}${hub.path}`,
    lastModified: new Date(sitemapLastUpdated),
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }));

  const seoUrls = seoPages
    .filter((page) => seoSitemapFamilies.has(page.family))
    .map((page) => ({
      url: `${siteUrl}${getSeoUrl(page)}`,
      lastModified: new Date(page.dateModified),
      changeFrequency: 'weekly' as const,
      priority: seoSitemapPriority(page),
    }));

  return [...seoHubUrls, ...seoUrls];
}
