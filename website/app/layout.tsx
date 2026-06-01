import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import { appName, appDescription, appTagline, siteUrl } from '@/lib/shared';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${appName} — ${appTagline}`,
    template: `%s — ${appName}`,
  },
  description: appDescription,
  applicationName: appName,
  keywords: [
    'Self-hosted PaaS',
    'Heroku alternative',
    'Vercel alternative',
    'Coolify alternative',
    'Dokku alternative',
    'GitOps deployment',
    'Docker container deployment',
    'Automatic HTTPS',
    'Caddy reverse proxy',
    'Developer Platform-as-a-Service',
  ],
  authors: [{ name: 'sumon-ohid', url: 'https://github.com/sumon-ohid' }],
  alternates: {
    canonical: './',
  },
  openGraph: {
    title: `${appName} — ${appTagline}`,
    description: appDescription,
    url: siteUrl,
    siteName: appName,
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${appName} — ${appTagline}`,
    description: appDescription,
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: appName,
    description: appDescription,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Linux, macOS',
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'USD',
    },
    url: siteUrl,
    author: {
      '@type': 'Organization',
      name: 'sumon-ohid',
      url: 'https://github.com/sumon-ohid',
    },
  };

  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}

