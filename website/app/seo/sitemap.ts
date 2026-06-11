import { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/shared';
import { getSeoUrl, seoHubs, seoPages } from '@/lib/seo/content';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const seoHubUrls = seoHubs.map((hub) => ({
    url: `${siteUrl}${hub.path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const seoUrls = seoPages.map((page) => {
    const priority =
      page.family === 'alternatives' || page.family === 'deploy' || page.family === 'fix'
        ? 0.85
        : page.family === 'glossary'
          ? 0.6
          : page.family === 'examples'
            ? 0.8
            : 0.75;
    return {
      url: `${siteUrl}${getSeoUrl(page)}`,
      lastModified: new Date(page.dateModified),
      changeFrequency: 'weekly' as const,
      priority,
    };
  });

  return [...seoHubUrls, ...seoUrls];
}
