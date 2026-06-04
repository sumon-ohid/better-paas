import { SeoLandingPage } from '@/components/seo/seo-page';
import { getSeoPage, getSeoPagesByFamily } from '@/lib/seo/content';
import { seoPageMetadata } from '@/lib/seo/metadata';
import { notFound } from 'next/navigation';

export default async function Page(props: PageProps<'/fix/[slug]'>) {
  const { slug } = await props.params;
  const page = getSeoPage('fix', slug);
  if (!page) notFound();
  return <SeoLandingPage page={page} />;
}

export function generateStaticParams() {
  return getSeoPagesByFamily('fix').map((page) => ({ slug: page.slug }));
}

export async function generateMetadata(props: PageProps<'/fix/[slug]'>) {
  const { slug } = await props.params;
  const page = getSeoPage('fix', slug);
  if (!page) notFound();
  return seoPageMetadata(page);
}
