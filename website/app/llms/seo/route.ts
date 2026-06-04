import { getSeoUrl, seoHubs, seoPages } from '@/lib/seo/content';
import { siteUrl } from '@/lib/shared';

export const revalidate = false;

export function GET() {
  const hubs = seoHubs.map((hub) => `- [${hub.h1}](${siteUrl}${hub.path}): ${hub.description}`);
  const pages = seoPages.map((page) => `- [${page.h1}](${siteUrl}${getSeoUrl(page)}): ${page.description}`);

  return new Response(`# Better-PaaS SEO Page Index\n\n## Hubs\n\n${hubs.join('\n')}\n\n## Pages\n\n${pages.join('\n')}`, {
    headers: {
      'Content-Type': 'text/markdown',
    },
  });
}
