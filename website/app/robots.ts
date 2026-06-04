import { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/shared';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/docs'],
        disallow: ['/api/'],
      },
      {
        // Custom rules for AI and LLM agents to ensure they crawl optimized routes
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'ClaudeBot',
          'Claude-Web',
          'Google-Extended',
          'Anthropic-AI',
          'PerplexityBot',
          'cohere-ai',
        ],
        allow: ['/', '/docs', '/llms.txt', '/llms-full.txt', '/llms-pages.txt', '/llms/seo', '/llms.mdx/docs'],
        disallow: ['/api/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
