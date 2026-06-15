import Link from 'next/link';
import { Metadata } from 'next';
import {
  ArrowRight,
  Check,
  X,
  DollarSign,
  Lock,
  Globe,
  Server,
  Repeat,
  Database,
  ShieldCheck,
} from 'lucide-react';
import { appName, githubUrl, siteUrl } from '@/lib/shared';
import { GithubIcon } from '@/components/landing/github-icon';
import { IconTile } from '@/components/landing/primitives';

export const metadata: Metadata = {
  title: 'Vercel Alternative for Indie Hackers | Better-PaaS',
  description:
    'Better-PaaS is the open-source Vercel alternative for solo founders. Deploy Next.js and full-stack apps from Git on your own $5/month VPS. No usage limits, no surprise bills, no lock-in.',
  keywords: [
    'Vercel alternative',
    'self-hosted Vercel',
    'Vercel alternative for indie hackers',
    'open source deployment platform',
    'deploy Next.js on VPS',
    'Vercel vs self-hosted',
  ],
  openGraph: {
    title: 'Vercel Alternative for Indie Hackers | Better-PaaS',
    description:
      'Deploy like Vercel on a server you actually own. Better-PaaS gives you git push deploys, HTTPS, and databases for the price of a cheap VPS.',
    url: `${siteUrl}/vercel-alternative`,
    siteName: appName,
    type: 'article',
  },
};

export default function VercelAlternativePage() {
  return (
    <main className="relative flex min-h-screen flex-1 flex-col bg-fd-background text-fd-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <CostComparison />
      <FeatureComparison />
      <WhoShouldSwitch />
      <MigrationPath />
      <Faq />
      <FinalCta />
    </main>
  );
}

/* ═══════════════════════════════  Hero  ═══════════════════════════════ */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-full max-w-7xl -translate-x-1/2 opacity-[0.14] dark:opacity-[0.22]"
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 50% 0%, var(--color-fd-primary) 0%, transparent 100%)',
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-16 sm:pt-32 sm:pb-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-primary">
            Vercel Alternative
          </p>
          <h1 className="bp-display mt-6 text-4xl font-normal tracking-tight text-fd-foreground sm:text-5xl md:text-6xl">
            The Vercel experience on a server you actually own
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-fd-muted-foreground">
            Better-PaaS is the open-source deployment platform for indie hackers who love Vercel&apos;s
            UX but hate the platform tax. Push to Git. Get HTTPS. Own your data. Pay for a VPS, not a
            billing surprise.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/docs/quickstart"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-fd-foreground px-6 text-sm font-semibold text-fd-background transition-opacity hover:opacity-90"
            >
              Deploy free in 5 minutes
              <ArrowRight className="size-4" />
            </Link>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-fd-border bg-fd-card/40 px-5 text-sm font-semibold text-fd-foreground transition-colors hover:bg-fd-card"
            >
              <GithubIcon className="size-4" />
              Star on GitHub
            </a>
          </div>
          <p className="mt-4 text-xs text-fd-muted-foreground">
            Free, open source, AGPL-3.0. No credit card required.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ═════════════════════════  Cost Comparison  ═════════════════════════ */

function CostComparison() {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-primary">
            Cost
          </p>
          <h2 className="bp-display mt-4 text-3xl font-normal tracking-tight text-fd-foreground sm:text-4xl">
            Stop paying rent for your own side projects
          </h2>
          <p className="mt-4 text-base leading-7 text-fd-muted-foreground">
            Vercel is free to start. Then it gets expensive fast. Better-PaaS turns a cheap VPS into
            your own deployment platform with no per-app, per-seat, or usage-based fees.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Vercel Hobby card */}
          <div className="rounded-2xl border border-fd-border bg-fd-card/25 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full border border-fd-border bg-fd-background">
                <DollarSign className="size-5 text-fd-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-fd-foreground">Vercel Hobby</h3>
                <p className="text-sm text-fd-muted-foreground">Free, until it is not</p>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {[
                'Free for personal projects',
                'Bandwidth, function execution, and database limits',
                'Custom domains only with verified accounts',
                'Team features require Pro ($20/seat/month)',
                'Overage bills can be unexpected',
              ].map((item, i) => (
                <li key={item} className="flex items-start gap-3 text-sm text-fd-muted-foreground">
                  {i < 2 ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0 text-red-500/70" />
                  )}
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Better-PaaS card */}
          <div className="relative rounded-2xl border border-fd-primary/20 bg-fd-primary/5 p-6 sm:p-8">
            <div className="absolute -top-3 right-6 rounded-full bg-fd-primary px-3 py-1 text-xs font-semibold text-fd-primary-foreground">
              Flat cost
            </div>
            <div className="flex items-center gap-3">
              <IconTile>
                <Server className="size-5" />
              </IconTile>
              <div>
                <h3 className="text-lg font-semibold text-fd-foreground">Better-PaaS on a VPS</h3>
                <p className="text-sm text-fd-muted-foreground">One server, unlimited apps</p>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {[
                '$5–$10/month VPS handles multiple apps',
                'No per-app or per-seat pricing',
                'Unlimited bandwidth within your server limits',
                'Automatic HTTPS on custom domains',
                'Predictable cost, no overages',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-fd-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-6 text-sm text-fd-muted-foreground">
          Example: a Next.js blog with a Postgres database on Hetzner CX21 (2 vCPU / 4 GB) costs
          about $5.35/month. The same project on Vercel stays free on Hobby, but scales to paid plans
          once you need analytics, team access, or higher limits.
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════  Feature Comparison  ════════════════════════ */

const comparisonRows = [
  { feature: 'Git push deploys', vercel: 'Yes', better: 'Yes' },
  { feature: 'Automatic HTTPS', vercel: 'Yes', better: 'Yes (via Caddy)' },
  { feature: 'Custom domains', vercel: 'Yes', better: 'Yes' },
  { feature: 'Preview deployments', vercel: 'Yes', better: 'Branch-based deploys' },
  { feature: 'Serverless functions', vercel: 'First-class', better: 'Docker containers' },
  { feature: 'Postgres / Redis / MySQL', vercel: 'Managed add-ons', better: 'One-click containers' },
  { feature: 'Data ownership', vercel: 'Hosted by Vercel', better: 'On your server' },
  { feature: 'Pricing model', vercel: 'Usage/seat based', better: 'Flat VPS cost' },
  { feature: 'Vendor lock-in', vercel: 'High', better: 'None' },
  { feature: 'Open source', vercel: 'No', better: 'Yes (AGPL-3.0)' },
];

function FeatureComparison() {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-primary">
            Features
          </p>
          <h2 className="bp-display mt-4 text-3xl font-normal tracking-tight text-fd-foreground sm:text-4xl">
            Vercel-like DX, self-hosted control
          </h2>
          <p className="mt-4 text-base leading-7 text-fd-muted-foreground">
            Better-PaaS gives you the parts of Vercel that matter for most indie projects: push to
            deploy, HTTPS, domains, and databases. The rest runs on your infrastructure.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-fd-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fd-border bg-fd-card/40">
                <th className="px-6 py-4 text-left font-semibold text-fd-foreground">Feature</th>
                <th className="px-6 py-4 text-left font-semibold text-fd-muted-foreground">Vercel</th>
                <th className="px-6 py-4 text-left font-semibold text-fd-primary">Better-PaaS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fd-border">
              {comparisonRows.map((row) => (
                <tr key={row.feature} className="bg-fd-background">
                  <td className="px-6 py-4 font-medium text-fd-foreground">{row.feature}</td>
                  <td className="px-6 py-4 text-fd-muted-foreground">{row.vercel}</td>
                  <td className="px-6 py-4 font-medium text-fd-foreground">{row.better}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════  Who Should Switch  ═══════════════════════ */

const personas = [
  {
    icon: DollarSign,
    title: 'Budget-conscious founders',
    body: 'You want predictable hosting costs while you validate a product. A flat $5–$10 VPS is easier to reason about than usage-based platform bills.',
  },
  {
    icon: Lock,
    title: 'Privacy-first builders',
    body: 'You would rather keep app data, logs, and secrets on a server you control than trust a hosted platform.',
  },
  {
    icon: Repeat,
    title: 'Developers tired of lock-in',
    body: 'You want git push deploys and automatic HTTPS without building around a specific vendor.',
  },
  {
    icon: Database,
    title: 'Full-stack app builders',
    body: 'You run Next.js, Node, Python, or Go apps with real databases, not just static frontends.',
  },
];

function WhoShouldSwitch() {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-primary">
            Who it is for
          </p>
          <h2 className="bp-display mt-4 text-3xl font-normal tracking-tight text-fd-foreground sm:text-4xl">
            Better-PaaS is built for solo builders, not enterprise teams
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {personas.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-fd-border bg-fd-card/20 p-6 transition-colors hover:bg-fd-card/30"
            >
              <IconTile size="sm">
                <p.icon className="size-4" />
              </IconTile>
              <h3 className="mt-4 text-base font-semibold text-fd-foreground">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-fd-border bg-fd-card/15 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 size-6 shrink-0 text-fd-primary" />
            <div>
              <h3 className="text-base font-semibold text-fd-foreground">
                When Vercel is still the better choice
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">
                If you need edge functions, global CDN caching, serverless auto-scaling, or a
                serverless database, Vercel is purpose-built for that. Better-PaaS is for apps that
                fit comfortably on a single VPS and value ownership over managed scale.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═════════════════════════  Migration Path  ══════════════════════════ */

const migrationSteps = [
  {
    n: '01',
    title: 'Buy a cheap VPS',
    body: 'Hetzner, DigitalOcean, or any Ubuntu/Debian VPS. 2 vCPU / 2 GB RAM is enough to start.',
  },
  {
    n: '02',
    title: 'Install Better-PaaS',
    body: 'Run the one-line installer. It sets up Docker, Caddy, and the dashboard automatically.',
  },
  {
    n: '03',
    title: 'Connect your repo',
    body: 'Paste your Git URL, pick a branch, and let Nixpacks detect your framework.',
  },
  {
    n: '04',
    title: 'Add env vars and databases',
    body: 'Copy your environment variables from Vercel and attach Postgres, Redis, or MySQL if needed.',
  },
  {
    n: '05',
    title: 'Point your domain',
    body: 'Add a custom domain in Better-PaaS. Caddy issues a free Let&apos;s Encrypt certificate.',
  },
];

function MigrationPath() {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-primary">
            Migration
          </p>
          <h2 className="bp-display mt-4 text-3xl font-normal tracking-tight text-fd-foreground sm:text-4xl">
            Move a Vercel app to Better-PaaS in one evening
          </h2>
        </div>

        <div className="relative">
          <div className="absolute left-[19px] top-8 bottom-8 hidden w-px bg-gradient-to-b from-fd-primary/30 to-transparent sm:block" />
          <div className="space-y-8">
            {migrationSteps.map((s) => (
              <div key={s.n} className="relative pl-0 sm:pl-16">
                <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-fd-border bg-fd-background text-sm font-semibold text-fd-foreground sm:absolute sm:left-0 sm:top-0">
                  {s.n}
                </div>
                <h3 className="text-base font-semibold text-fd-foreground">{s.title}</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fd-muted-foreground">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12">
          <Link
            href="/docs/quickstart"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-fd-foreground px-6 text-sm font-semibold text-fd-background transition-opacity hover:opacity-90"
          >
            Read the full quickstart
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════  FAQ  ═══════════════════════════════ */

const faqs = [
  {
    question: 'Is Better-PaaS a true drop-in replacement for Vercel?',
    answer:
      'Not for every workload. Better-PaaS replaces Vercel for full-stack apps that fit on a single VPS. It does not replicate edge functions, global CDN caching, or serverless auto-scaling. If your app is a Next.js, Node, Python, or Go app with a database, it is a strong fit.',
  },
  {
    question: 'Can I host Next.js apps with Better-PaaS?',
    answer:
      'Yes. Better-PaaS uses Nixpacks to detect Next.js projects, builds them, and runs them in a Docker container. You get custom domains, HTTPS, and environment variables out of the box.',
  },
  {
    question: 'How much does it actually cost?',
    answer:
      'Better-PaaS itself is free. You only pay for your VPS. A 2 vCPU / 4 GB RAM Hetzner server costs around $5.35/month at the time of writing and can host multiple apps and databases.',
  },
  {
    question: 'Do I need DevOps experience?',
    answer:
      'Some Linux basics help, but the installer handles most setup. The dashboard replaces manual reverse proxy and Docker configuration. You still own server updates and security.',
  },
  {
    question: 'What happens if I want to move away later?',
    answer:
      'You own everything: the server, the Docker containers, the Git repository, and the data. There is no proprietary format to escape.',
  },
];

function Faq() {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-primary">FAQ</p>
          <h2 className="bp-display mt-4 text-3xl font-normal tracking-tight text-fd-foreground sm:text-4xl">
            Common questions
          </h2>
        </div>

        <div className="space-y-6">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="rounded-2xl border border-fd-border bg-fd-card/20 p-6"
            >
              <h3 className="text-base font-semibold text-fd-foreground">{faq.question}</h3>
              <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════  Final CTA  ═════════════════════════════ */

function FinalCta() {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div
          className="relative flex min-h-[360px] w-full items-center justify-center overflow-hidden rounded-2xl px-6 py-12"
          style={{
            background: 'linear-gradient(134deg, #d9e1ff 0%, #7197ff 20%, #4c69ff 48%, #3035d5 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute -bottom-24 -left-20 size-[31rem] rounded-full opacity-35 dark:opacity-75 blur-[72px]"
            style={{ background: '#eef1ff' }}
          />
          <div
            className="pointer-events-none absolute -right-28 -top-20 size-[33rem] rounded-full opacity-20 dark:opacity-45 blur-[82px]"
            style={{ background: '#2538d8' }}
          />

          <div className="relative w-full max-w-2xl rounded-2xl bg-[#f8fbff]/92 px-6 py-10 text-center shadow-[0_15px_52px_-21px_rgba(23,44,92,0.55)] dark:bg-[#050505]/90 dark:shadow-[0_15px_52px_-21px_rgba(0,0,0,0.95)] sm:px-10 sm:py-12">
            <Globe className="mx-auto size-10 text-fd-primary" />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-fd-muted-foreground">
              Start shipping
            </p>
            <h2 className="bp-display mt-3 text-3xl font-normal tracking-tight text-fd-foreground sm:text-4xl">
              Own your deploys
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-fd-muted-foreground">
              Install Better-PaaS on a $5 VPS and get Vercel-like deploys without the platform tax.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/docs/quickstart"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#121722] px-6 text-sm font-medium text-white transition-colors hover:bg-[#26364d] dark:bg-[#f4f4f5] dark:text-[#080809] dark:hover:bg-white"
              >
                Read the docs
                <ArrowRight className="size-4" />
              </Link>
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-fd-border bg-fd-card/70 px-5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-card dark:bg-white/[0.055] dark:hover:bg-white/[0.09]"
              >
                <GithubIcon className="size-4" />
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═════════════════════════  JSON-LD Schema  ══════════════════════════ */

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${siteUrl}/vercel-alternative`,
      url: `${siteUrl}/vercel-alternative`,
      name: 'Vercel Alternative for Indie Hackers | Better-PaaS',
      description:
        'Better-PaaS is the open-source Vercel alternative for solo founders. Deploy Next.js and full-stack apps from Git on your own $5/month VPS.',
      isPartOf: {
        '@id': siteUrl,
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
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
          name: 'Vercel Alternative',
          item: `${siteUrl}/vercel-alternative`,
        },
      ],
    },
  ],
};
