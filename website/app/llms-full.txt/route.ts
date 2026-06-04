import { getLLMText, source } from '@/lib/source';
import { seoPages, seoPageToMarkdown } from '@/lib/seo/content';

export const revalidate = false;

export async function GET() {
  const scan = source.getPages().map(getLLMText);
  const scanned = await Promise.all(scan);
  const seoMarkdown = seoPages.map(seoPageToMarkdown);

  return new Response([...scanned, ...seoMarkdown].join('\n\n'));
}
