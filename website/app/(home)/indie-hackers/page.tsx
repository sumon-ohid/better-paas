import Link from 'next/link';
import { Metadata } from 'next';
import {
  ArrowRight,
  Check,
  DollarSign,
  Rocket,
  Shield,
  Zap,
  Code2,
  Globe,
  Database,
  Terminal,
  Lock,
  TrendingUp,
} from 'lucide-react';
import { appName, githubUrl, siteUrl } from '@/lib/shared';
import { GithubIcon } from '@/components/landing/github-icon';
import { IconTile } from '@/components/landing/primitives';

export const metadata: Metadata = {
  title: 'Deployment Platform for Indie Hackers | Better-PaaS',
  description:
    'Better-PaaS helps solo founders deploy full-stack apps, MVPs, and side projects on cheap VPS servers. Push to Git, get HTTPS, databases, and rollbacks for $5/month.',
  keywords: [
    'indie hacker hosting',
    'solo founder deployment',
    'cheap VPS deployment',
    'self hosted side project',
    'MVP hosting',
    'bootstrapper devops',
  ],
  openGraph: {
    title: 'Deployment Platform for Indie Hackers | Better-PaaS',
    description:
      'Push to Git. Run on a $5 VPS. Keep your data. Better-PaaS is the open-source deployment stack built for solo founders.',
    url: `${siteUrl}/indie-hackers`,
    siteName: appName,
    type: 'article',
  },
};

export default function IndieHackersPage() {
  return (
    <main className="relative flex min-h-screen flex-1 flex-col bg-fd-background text-fd-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <PainPoints />
      <UseCases />
      <HowItWorks />
      <Cost />
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
            Built for Indie Hackers
          </p>
          <h1 className="bp-display mt-6 text-4xl font-normal tracking-tight text-fd-foreground sm:text-5xl md:text-6xl">
            The deployment stack for solo founders
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-fd-muted-foreground">
            Ship your MVP, side project, or bootstrapped SaaS on a $5 VPS. Better-PaaS gives you
            push-to-deploy, automatic HTTPS, and managed databases - without the platform tax or
            the DevOps degree.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/docs/quickstart"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-fd-foreground px-6 text-sm font-semibold text-fd-background transition-opacity hover:opacity-90"
            >
              Ship your MVP today
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/vercel-alternative"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-fd-border bg-fd-card/40 px-5 text-sm font-semibold text-fd-foreground transition-colors hover:bg-fd-card"
            >
              See Vercel comparison
            </Link>
          </div>
          <p className="mt-4 text-xs text-fd-muted-foreground">
            Open source. Free forever. You own the server.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ═════════════════════════  Pain Points  ═════════════════════════════ */

const painPoints = [
  {
    icon: DollarSign,
    title: 'Surprise bills',
    body: 'Hosted platforms start free and get expensive once your project grows. A flat VPS cost is easier to budget around.',
  },
  {
    icon: Lock,
    title: 'Platform lock-in',
    body: 'Your app, data, and domain config live inside someone else&apos;s dashboard. Moving later is painful.',
  },
  {
    icon: Terminal,
    title: 'DevOps complexity',
    body: 'Kubernetes and raw VPS setups steal days you should spend on product. You need a dashboard, not a certification.',
  },
];

function PainPoints() {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-primary">
            The problem
          </p>
          <h2 className="bp-display mt-4 text-3xl font-normal tracking-tight text-fd-foreground sm:text-4xl">
            Hosting should not be a second job
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {painPoints.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-fd-border bg-fd-card/20 p-6 text-center transition-colors hover:bg-fd-card/30"
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-fd-border bg-fd-background">
                <p.icon className="size-5 text-fd-muted-foreground" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-fd-foreground">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═════════════════════════  Use Cases  ═══════════════════════════════ */

const useCases = [
  {
    icon: Rocket,
    title: 'SaaS MVPs',
    body: 'Next.js or React frontend, Node/Python API, Postgres database - all on one server for under $10/month.',
  },
  {
    icon: Globe,
    title: 'Marketing sites',
    body: 'Static or Jamstack landing pages with custom domains, HTTPS, and fast deploys from Git.',
  },
  {
    icon: Database,
    title: 'APIs and backends',
    body: 'Deploy REST or GraphQL APIs with managed Postgres, Redis, or MySQL and auto-rollback.',
  },
  {
    icon: Code2,
    title: 'Side projects',
    body: 'Run experiments without worrying about per-app platform costs or usage limits.',
  },
  {
    icon: Zap,
    title: 'Internal tools',
    body: 'Self-host dashboards, admin panels, and automation tools privately on your own server.',
  },
  {
    icon: TrendingUp,
    title: 'Bootstrapped products',
    body: 'Keep overhead low while you find product-market fit. Scale up the VPS when revenue grows.',
  },
];

function UseCases() {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-primary">
            Use cases
          </p>
          <h2 className="bp-display mt-4 text-3xl font-normal tracking-tight text-fd-foreground sm:text-4xl">
            One server for every project
          </h2>
          <p className="mt-4 text-base leading-7 text-fd-muted-foreground">
            Solo founders usually run multiple apps at once. Better-PaaS lets you host all of them on
            a single cheap VPS.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((u) => (
            <div
              key={u.title}
              className="rounded-2xl border border-fd-border bg-fd-card/20 p-6 transition-colors hover:bg-fd-card/30"
            >
              <IconTile size="sm">
                <u.icon className="size-4" />
              </IconTile>
              <h3 className="mt-4 text-base font-semibold text-fd-foreground">{u.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">{u.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═════════════════════════  How It Works  ════════════════════════════ */

const steps = [
  {
    n: '01',
    title: 'Grab a cheap VPS',
    body: 'Hetzner, DigitalOcean, Linode, or any Ubuntu/Debian server. 2 vCPU / 2 GB RAM is plenty to start.',
  },
  {
    n: '02',
    title: 'Run one install command',
    body: 'The installer sets up Docker, Caddy, and the dashboard. You get a login token and a browser URL.',
  },
  {
    n: '03',
    title: 'Push code, get HTTPS',
    body: 'Connect your Git repo, add env vars, and deploy. Better-PaaS builds the app and issues a free SSL certificate.',
  },
];

function HowItWorks() {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-primary">
            How it works
          </p>
          <h2 className="bp-display mt-4 text-3xl font-normal tracking-tight text-fd-foreground sm:text-4xl">
            From server to live app in minutes
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="relative">
              <div className="flex size-12 items-center justify-center rounded-full border border-fd-border bg-fd-background text-sm font-semibold text-fd-foreground">
                {s.n}
              </div>
              <h3 className="mt-5 text-base font-semibold text-fd-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/docs/quickstart"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-fd-foreground px-6 text-sm font-semibold text-fd-background transition-opacity hover:opacity-90"
          >
            Read the quickstart
            <ArrowRight className="size-4" />
          </Link>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-fd-border bg-fd-card/40 px-5 text-sm font-semibold text-fd-foreground transition-colors hover:bg-fd-card"
          >
            <GithubIcon className="size-4" />
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

/* ═════════════════════════════  Cost  ════════════════════════════════ */

function Cost() {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-primary">
            Pricing
          </p>
          <h2 className="bp-display mt-4 text-3xl font-normal tracking-tight text-fd-foreground sm:text-4xl">
            One flat VPS bill
          </h2>
          <p className="mt-4 text-base leading-7 text-fd-muted-foreground">
            Better-PaaS is free and open source. You only pay your cloud provider. For most indie
            projects, that means a single small server.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {[
            {
              label: 'Hobby VPS',
              price: '$5–$7',
              specs: '2 vCPU / 2–4 GB RAM',
              apps: '2–4 small apps + 1 database',
            },
            {
              label: 'Growth VPS',
              price: '$10–$15',
              specs: '4 vCPU / 8 GB RAM',
              apps: '5–10 apps + multiple databases',
            },
            {
              label: 'Better-PaaS',
              price: '$0',
              specs: 'Open source',
              apps: 'Unlimited control planes',
            },
          ].map((tier) => (
            <div
              key={tier.label}
              className="rounded-2xl border border-fd-border bg-fd-card/20 p-6"
            >
              <p className="text-sm font-medium text-fd-muted-foreground">{tier.label}</p>
              <p className="mt-2 text-4xl font-semibold text-fd-foreground">{tier.price}</p>
              <p className="mt-1 text-sm text-fd-muted-foreground">/month</p>
              <div className="mt-6 space-y-2 text-sm text-fd-muted-foreground">
                <p className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-500" />
                  {tier.specs}
                </p>
                <p className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-500" />
                  {tier.apps}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════  FAQ  ═══════════════════════════════ */

const faqs = [
  {
    question: 'Do I need to be a Linux expert?',
    answer:
      'No. The installer handles Docker, Caddy, and the dashboard. You should be comfortable copying a server IP and running SSH commands, but you do not need to hand-configure reverse proxies or containers.',
  },
  {
    question: 'Can I run multiple projects on one server?',
    answer:
      'Yes. That is the main point. One Better-PaaS control plane can deploy many apps and databases on a single VPS, each with its own domain and environment variables.',
  },
  {
    question: 'What frameworks are supported?',
    answer:
      'Nixpacks auto-detects Next.js, Node, Python, Go, Ruby, PHP, and more. If auto-detection fails, you can provide a Dockerfile or custom build and start commands.',
  },
  {
    question: 'Is this production-ready?',
    answer:
      'Better-PaaS is actively developed and used for real projects. As with any self-hosted tool, you own backups, updates, and server security. The dashboard includes one-click backups and safe self-updates to help.',
  },
  {
    question: 'How is this different from Coolify?',
    answer:
      'Coolify is excellent and has a larger ecosystem. Better-PaaS focuses on a smaller, opinionated workflow for solo founders: install on a cheap VPS, connect Git, and deploy with minimal configuration.',
  },
];

function Faq() {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-primary">FAQ</p>
          <h2 className="bp-display mt-4 text-3xl font-normal tracking-tight text-fd-foreground sm:text-4xl">
            Questions solo founders ask
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
            <Shield className="mx-auto size-10 text-fd-primary" />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-fd-muted-foreground">
              Start building
            </p>
            <h2 className="bp-display mt-3 text-3xl font-normal tracking-tight text-fd-foreground sm:text-4xl">
              Ship your next project for $5/month
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-fd-muted-foreground">
              Install Better-PaaS on a cheap VPS and get back to building your product instead of
              fighting infrastructure.
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
      '@id': `${siteUrl}/indie-hackers`,
      url: `${siteUrl}/indie-hackers`,
      name: 'Deployment Platform for Indie Hackers | Better-PaaS',
      description:
        'Better-PaaS helps solo founders deploy full-stack apps, MVPs, and side projects on cheap VPS servers.',
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
          name: 'Indie Hackers',
          item: `${siteUrl}/indie-hackers`,
        },
      ],
    },
  ],
};
