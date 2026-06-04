import { SeoLandingPage } from '@/components/seo/seo-page';
import { getSeoPage, getSeoPagesByFamily } from '@/lib/seo/content';
import { seoPageMetadata } from '@/lib/seo/metadata';
import { notFound } from 'next/navigation';

export default async function Page(props: PageProps<'/integrations/[slug]'>) {
  const { slug } = await props.params;
  const page = getSeoPage('integrations', slug);
  if (!page) notFound();
  return <SeoLandingPage page={page} />;
}

export function generateStaticParams() {
  return getSeoPagesByFamily('integrations').map((page) => ({ slug: page.slug }));
}

export async function generateMetadata(props: PageProps<'/integrations/[slug]'>) {
  const { slug } = await props.params;
  const page = getSeoPage('integrations', slug);
  if (!page) notFound();
  return seoPageMetadata(page);
}
