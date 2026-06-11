import { SeoHubPage } from '@/components/seo/seo-hub';
import { getSeoHub, getSeoPagesByFamily } from '@/lib/seo/content';
import { seoHubMetadata } from '@/lib/seo/metadata';

const hub = getSeoHub('templates')!;

export const metadata = seoHubMetadata(hub);

export default function Page() {
  return <SeoHubPage hub={hub} pages={getSeoPagesByFamily('templates')} />;
}
