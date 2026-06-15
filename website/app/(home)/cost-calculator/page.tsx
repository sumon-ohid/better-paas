import { Metadata } from 'next';
import { appName, siteUrl } from '@/lib/shared';
import { CostCalculator } from './calculator';

export const metadata: Metadata = {
  title: 'Vercel vs Self-Hosted Cost Calculator | Better-PaaS',
  description:
    'Compare the estimated cost of hosting your apps on Vercel versus running them on your own VPS with Better-PaaS.',
  openGraph: {
    title: 'Vercel vs Self-Hosted Cost Calculator | Better-PaaS',
    description:
      'Compare the estimated cost of hosting your apps on Vercel versus running them on your own VPS with Better-PaaS.',
    url: `${siteUrl}/cost-calculator`,
    siteName: appName,
    type: 'article',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${siteUrl}/cost-calculator`,
      url: `${siteUrl}/cost-calculator`,
      name: 'Vercel vs Self-Hosted Cost Calculator | Better-PaaS',
      description:
        'Compare the estimated cost of hosting your apps on Vercel versus running them on your own VPS with Better-PaaS.',
      isPartOf: {
        '@id': siteUrl,
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Better-PaaS',
          item: siteUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Cost Calculator',
          item: `${siteUrl}/cost-calculator`,
        },
      ],
    },
  ],
};

export default function CostCalculatorPage() {
  return (
    <main className="relative flex min-h-screen flex-1 flex-col bg-fd-background text-fd-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-full max-w-7xl -translate-x-1/2 opacity-[0.14] dark:opacity-[0.22]"
          style={{
            background:
              'radial-gradient(ellipse 50% 50% at 50% 0%, var(--color-fd-primary) 0%, transparent 100%)',
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6 pt-24 pb-12 sm:pt-32 sm:pb-20">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-primary">
              Cost Calculator
            </p>
            <h1 className="bp-display mt-6 text-4xl font-normal tracking-tight text-fd-foreground sm:text-5xl">
              Vercel vs self-hosted
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-fd-muted-foreground sm:text-lg">
              A rough estimate of what you could save by running your apps on a cheap VPS with{' '}
              {appName}. Actual Vercel pricing depends on your exact usage and plan.
            </p>
          </div>
        </div>
      </section>

      <CostCalculator />
    </main>
  );
}
