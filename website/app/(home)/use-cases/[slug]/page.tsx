import { SeoLandingPage } from '@/components/seo/seo-page';
import { getSeoPage, getSeoPagesByFamily } from '@/lib/seo/content';
import { seoPageMetadata } from '@/lib/seo/metadata';
import { notFound } from 'next/navigation';

export default async function Page(props: PageProps<'/use-cases/[slug]'>) {
  const { slug } = await props.params;
  const page = getSeoPage('use-cases', slug);
  if (!page) notFound();
  return <SeoLandingPage page={page} />;
}

export function generateStaticParams() {
  return getSeoPagesByFamily('use-cases').map((page) => ({ slug: page.slug }));
}

export async function generateMetadata(props: PageProps<'/use-cases/[slug]'>) {
  const { slug } = await props.params;
  const page = getSeoPage('use-cases', slug);
  if (!page) notFound();
  return seoPageMetadata(page);
}
