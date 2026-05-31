import Link from 'next/link';
import {
  ArrowRight,
  GitBranch,
  ShieldCheck,
  Database,
  RotateCcw,
  Globe,
  Gauge,
  Clock,
  Bell,
  HardDrive,
  Terminal,
  Lock,
  Cpu,
} from 'lucide-react';
import { LogoMark } from '@/components/logo';
import { appName, githubUrl } from '@/lib/shared';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <LogoStrip />
      <Features />
      <HowItWorks />
      <Security />
      <CallToAction />
    </main>
  );
}

/* ─────────────────────────────  Hero  ───────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-fd-border">
      <div className="bp-hero-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 py-24 text-center sm:py-32">
        <Link
          href="/docs"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card px-3 py-1 text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
        >
          <span className="inline-block size-1.5 rounded-full bg-fd-primary" />
          Self-hosted PaaS · open source
          <ArrowRight className="size-3.5" />
        </Link>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-fd-foreground sm:text-6xl">
          Deploy from Git in one click.
          <span className="block text-fd-primary">On your own server.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-fd-muted-foreground">
          {appName} is your personal Heroku. Connect a repository and it builds your
          code, runs it in a container, and serves it with automatic HTTPS — no
          YAML, no cloud bill, no lock-in.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-5 py-3 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/docs/quickstart"
            className="inline-flex items-center gap-2 rounded-lg border border-fd-border bg-fd-card px-5 py-3 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
          >
            Quickstart guide
          </Link>
        </div>

        {/* Install snippet */}
        <div className="mt-12 w-full max-w-xl text-left">
          <div className="overflow-hidden rounded-xl border border-fd-border bg-fd-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-fd-border px-4 py-2.5">
              <span className="size-3 rounded-full bg-red-400/70" />
              <span className="size-3 rounded-full bg-yellow-400/70" />
              <span className="size-3 rounded-full bg-green-400/70" />
              <span className="ml-2 text-xs text-fd-muted-foreground">
                install on your VPS
              </span>
            </div>
            <pre className="overflow-x-auto px-4 py-4 text-sm leading-relaxed">
              <code className="font-mono text-fd-foreground">
                <span className="text-fd-muted-foreground"># one command, on a fresh Ubuntu/Debian box</span>
                {'\n'}
                <span className="text-fd-primary">curl</span> -fsSL
                https://raw.githubusercontent.com/
                {'\n  '}sumon-ohid/better-paas/main/install.sh | bash
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────  Logo strip  ────────────────────────── */

function LogoStrip() {
  const stack = ['Go control plane', 'Docker', 'Nixpacks', 'Caddy', 'Next.js dashboard'];
  return (
    <section className="border-b border-fd-border bg-fd-card/40">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-fd-muted-foreground">
          Built on tools you already trust
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-fd-muted-foreground">
          {stack.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────  Features  ───────────────────────── */

const features = [
  {
    icon: GitBranch,
    title: 'Git-based deploys',
    desc: 'Point at any Git repo. Push to your branch and it auto-redeploys via a per-app GitHub webhook.',
  },
  {
    icon: Globe,
    title: 'Automatic HTTPS',
    desc: 'Add a custom domain and Caddy issues a Let’s Encrypt certificate for you. Nothing to configure.',
  },
  {
    icon: RotateCcw,
    title: 'Zero-downtime + rollback',
    desc: 'New builds are health-checked before traffic switches over. Roll back to any past deploy instantly.',
  },
  {
    icon: Database,
    title: 'Managed databases',
    desc: 'One-click Postgres, Redis, and MySQL. Attach one to an app and connection vars are injected for you.',
  },
  {
    icon: Cpu,
    title: 'Resource limits',
    desc: 'Cap memory and CPU per app. Enforced through Docker so a noisy app never starves the host.',
  },
  {
    icon: HardDrive,
    title: 'Persistent volumes',
    desc: 'Declare volumes that survive redeploys, so stateful apps keep their data between builds.',
  },
  {
    icon: Clock,
    title: 'Scheduled jobs',
    desc: 'Run commands inside a container on a cron schedule — migrations, cleanups, backups, anything.',
  },
  {
    icon: Bell,
    title: 'Deploy notifications',
    desc: 'Get a Slack or webhook ping on every deploy success or failure. Know the moment something ships.',
  },
  {
    icon: Terminal,
    title: 'Live logs & shell',
    desc: 'Stream container logs in real time and open an in-browser terminal straight into any container.',
  },
];

function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-fd-foreground sm:text-4xl">
          Everything a real platform needs
        </h2>
        <p className="mt-4 text-fd-muted-foreground">
          Not a toy. {appName} ships the features you’d expect from a managed cloud —
          you just run it yourself.
        </p>
      </div>

      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-fd-border bg-fd-border sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="group flex flex-col gap-3 bg-fd-background p-6 transition-colors hover:bg-fd-card"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-fd-primary/10 text-fd-primary">
              <f.icon className="size-5" />
            </div>
            <h3 className="font-semibold text-fd-foreground">{f.title}</h3>
            <p className="text-sm leading-relaxed text-fd-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────────  How it works  ─────────────────────── */

const steps = [
  {
    n: '01',
    title: 'Install on a server',
    desc: 'Run the one-command installer on any Ubuntu, Debian, or macOS box. It sets up Docker, Caddy, and the dashboard.',
  },
  {
    n: '02',
    title: 'Connect a repository',
    desc: 'Sign in with your admin token, paste a Git URL, pick a branch. Better-PaaS detects the framework automatically.',
  },
  {
    n: '03',
    title: 'Ship it',
    desc: 'It builds with Nixpacks, starts a container, and routes traffic through Caddy with HTTPS. Every git push redeploys.',
  },
];

function HowItWorks() {
  return (
    <section className="border-y border-fd-border bg-fd-card/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-fd-foreground sm:text-4xl">
            From zero to deployed in minutes
          </h2>
          <p className="mt-4 text-fd-muted-foreground">
            Three steps. No prior DevOps experience required.
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="relative">
              <div className="text-5xl font-bold text-fd-primary/20">{s.n}</div>
              <h3 className="mt-2 text-lg font-semibold text-fd-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────  Security  ───────────────────────── */

const securityPoints = [
  {
    icon: Lock,
    title: 'Single admin token',
    desc: 'Every API and WebSocket call is gated by a 256-bit bearer token, generated on first run.',
  },
  {
    icon: ShieldCheck,
    title: 'Brute-force lockout',
    desc: 'Repeated bad tokens trigger an escalating per-IP lockout, so guessing is infeasible.',
  },
  {
    icon: HardDrive,
    title: 'Encryption at rest',
    desc: 'Deploy tokens and secrets are AES-256-GCM encrypted before they ever touch the database.',
  },
  {
    icon: Gauge,
    title: 'Self-updating',
    desc: 'One-click updates back up your data, rebuild, health-check, and auto-roll-back on failure.',
  },
];

function Security() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-fd-foreground sm:text-4xl">
            Secure by default
          </h2>
          <p className="mt-4 text-fd-muted-foreground">
            Your server, your data, your keys. {appName} is built so the safe path is
            the default path — you don’t have to be a security expert to run it.
          </p>
          <Link
            href="/docs/security"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-fd-primary hover:underline"
          >
            Read the security model
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-fd-border bg-fd-border sm:grid-cols-2">
          {securityPoints.map((p) => (
            <div key={p.title} className="bg-fd-background p-6">
              <p.icon className="size-5 text-fd-primary" />
              <h3 className="mt-3 font-semibold text-fd-foreground">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fd-muted-foreground">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────  Call to action  ────────────────────── */

function CallToAction() {
  return (
    <section className="border-t border-fd-border">
      <div className="relative mx-auto max-w-5xl overflow-hidden px-4 py-24 text-center">
        <div className="bp-hero-grid pointer-events-none absolute inset-0" />
        <div className="relative flex flex-col items-center">
          <LogoMark className="size-12 text-fd-primary" />
          <h2 className="mt-6 max-w-2xl text-3xl font-bold tracking-tight text-fd-foreground sm:text-4xl">
            Own your deployment pipeline
          </h2>
          <p className="mt-4 max-w-xl text-fd-muted-foreground">
            Spin up {appName} on a $5 VPS and deploy as many apps as your server can
            hold. Free, open source, yours forever.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-5 py-3 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
            >
              Read the docs
              <ArrowRight className="size-4" />
            </Link>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-fd-border bg-fd-card px-5 py-3 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
            >
              Star on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
