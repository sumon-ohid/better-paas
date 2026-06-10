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
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: `${appName} — ${appTagline}`,
      },
    ],
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${appName} — ${appTagline}`,
    description: appDescription,
    images: ['/og-image.png'],
  },
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}

