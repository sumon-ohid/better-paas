import { seoPages, seoPageToMarkdown } from '@/lib/seo/content';

export const revalidate = false;

export function GET() {
  return new Response(seoPages.map(seoPageToMarkdown).join('\n\n'), {
    headers: {
      'Content-Type': 'text/markdown',
    },
  });
}
