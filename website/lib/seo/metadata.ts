import type { Metadata } from 'next';
import { siteUrl } from '@/lib/shared';
import { getSeoUrl, type SeoHub, type SeoPage } from '@/lib/seo/content';

export function seoPageMetadata(page: SeoPage): Metadata {
  const path = getSeoUrl(page);
  return {
    title: page.title,
    description: page.description,
    keywords: [page.primaryKeyword, ...page.secondaryKeywords],
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `${siteUrl}${path}`,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
    },
  };
}

export function seoHubMetadata(hub: SeoHub): Metadata {
  return {
    title: hub.title,
    description: hub.description,
    alternates: {
      canonical: hub.path,
    },
    openGraph: {
      title: hub.title,
      description: hub.description,
      url: `${siteUrl}${hub.path}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: hub.title,
      description: hub.description,
    },
  };
}
