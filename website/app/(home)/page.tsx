import Link from 'next/link';
import {
  ArrowRight,
  Cpu,
  HardDrive,
  Bell,
  Lock,
  ShieldCheck,
  Gauge,
  Boxes,
  Terminal,
  Check,
} from 'lucide-react';
import { LogoMark } from '@/components/logo';
import { appName, githubUrl } from '@/lib/shared';
import { ProductDemo } from '@/components/landing/product-demo';
import { FeatureShowcase } from '@/components/landing/feature-showcase';
import { TechMarquee } from '@/components/landing/tech-marquee';
import { Reveal } from '@/components/landing/reveal';
import { Eyebrow, IconTile } from '@/components/landing/primitives';
import { GithubIcon } from '@/components/landing/github-icon';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <TechStrip />
      <Showcase />
      <Stats />
      <Bento />
      <HowItWorks />
      <Security />
      <CallToAction />
    </main>
  );
}

/* ═════════════════════════════════  Hero  ═══════════════════════════════ */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-16 sm:pt-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Reveal>
            <Link
              href="/docs/updates"
              className="group inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card px-3 py-1 text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fd-primary/10 px-2 py-0.5 text-xs font-medium text-fd-primary">
                New
              </span>
              One-click managed databases
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>

          <Reveal
            as="h1"
            delay={60}
            blur
            className="bp-display mt-7 text-[2.75rem] font-semibold text-fd-foreground sm:text-6xl md:text-7xl"
          >
            Your own Heroku,
            <br />
            on a server you control.
          </Reveal>

          <Reveal
            as="p"
            delay={120}
            blur
            className="bp-balance mt-6 max-w-xl text-lg leading-relaxed text-fd-muted-foreground"
          >
            {appName} connects to any Git repo, builds your code, and serves it with automatic
            HTTPS. The platform experience of a managed cloud — running entirely on your VPS.
          </Reveal>

          <Reveal
            delay={180}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Link
              href="/docs"
              className="bp-primary inline-flex h-11 items-center gap-2 rounded-lg px-6 text-sm font-medium"
            >
              Start deploying
              <ArrowRight className="size-4" />
            </Link>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bp-surface inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium text-fd-foreground"
            >
              <GithubIcon className="size-4" />
              Star on GitHub
            </a>
          </Reveal>

          <Reveal delay={240} className="mt-7 w-full max-w-md">
            <InstallLine />
          </Reveal>
        </div>

        {/* Product demo */}
        <Reveal delay={120} className="relative mx-auto mt-20 max-w-6xl">
          <ProductDemo />
        </Reveal>
      </div>
    </section>
  );
}

function InstallLine() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-fd-border bg-fd-card px-4 py-2.5 text-left font-mono text-sm">
      <span className="select-none text-fd-primary">$</span>
      <code className="flex-1 truncate text-fd-foreground">
        curl -fsSL better-paas.dev/install.sh | bash
      </code>
      <span className="hidden text-xs text-fd-muted-foreground sm:block">copy</span>
    </div>
  );
}

/* ════════════════════════════  Tech strip  ══════════════════════════════ */

function TechStrip() {
  return (
    <section className="bg-transparent">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-center text-xs font-medium uppercase tracking-[0.16em] text-fd-muted-foreground/70">
          Built on the tools you already trust
        </p>
        <div className="mt-8">
          <TechMarquee />
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════  Feature showcase  ═════════════════════════ */

function Showcase() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
      <Reveal className="max-w-2xl">
        <Eyebrow>The platform</Eyebrow>
        <h2 className="bp-display mt-4 text-3xl font-semibold text-fd-foreground sm:text-[2.75rem]">
          Everything a real platform needs
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-fd-muted-foreground">
          Not a toy. {appName} ships the capabilities you’d expect from a managed cloud. Move
          through them and watch the product respond.
        </p>
      </Reveal>

      <Reveal delay={80} className="mt-14">
        <FeatureShowcase />
      </Reveal>
    </section>
  );
}

/* ════════════════════════════════  Stats  ═══════════════════════════════ */

const stats = [
  { value: '~90s', label: 'cold deploy, from git push to live' },
  { value: '$5', label: 'a month is enough to run it' },
  { value: '0', label: 'YAML files to write' },
  { value: '100%', label: 'your data, on your hardware' },
];

function Stats() {
  return (
    <section className="border-y border-fd-border bg-fd-card/30">
      <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-fd-border border-x border-fd-border sm:grid-cols-4 sm:divide-y-0">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 70} className="px-6 py-10 text-center sm:text-left">
            <div className="bp-display text-4xl font-semibold text-fd-foreground sm:text-5xl">
              {s.value}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ════════════════════════════════  Bento  ═══════════════════════════════ */

function Bento() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Eyebrow className="justify-center">And the details</Eyebrow>
        <h2 className="bp-display mt-4 text-3xl font-semibold text-fd-foreground sm:text-[2.75rem]">
          The parts that make it yours
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-fd-muted-foreground">
          Thoughtful defaults so the boring parts of running a platform just work.
        </p>
      </Reveal>

      <div className="mt-16 grid gap-4 md:grid-cols-6">
        {/* Wide feature cell — live logs */}
        <Reveal className="md:col-span-4">
          <div className="bp-card flex h-full flex-col justify-between gap-6 rounded-2xl p-7 md:flex-row md:items-center">
            <div className="max-w-sm">
              <IconTile>
                <Terminal className="size-5" />
              </IconTile>
              <h3 className="mt-4 text-lg font-semibold text-fd-foreground">
                Live logs & in-browser shell
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">
                Stream container output in real time and drop into a terminal on any container,
                straight from the dashboard.
              </p>
            </div>
            <div className="w-full shrink-0 overflow-hidden rounded-xl bg-transparent p-3.5 font-mono text-[11px] leading-relaxed md:w-64">
              <div className="text-slate-300">› Ready on :3000</div>
              <div className="text-slate-300">GET /api/health 200 · 4ms</div>
              <div className="text-[#93e0c0]">✔ deploy promoted</div>
              <div className="text-slate-300">POST /checkout 201 · 38ms</div>
              <div className="flex items-center gap-1.5 text-(--bp-success)">
                <span className="size-1.5 rounded-full bg-(--bp-success) bp-pulse-dot" />
                streaming
              </div>
            </div>
          </div>
        </Reveal>

        {/* Tall-ish cell — resource limits */}
        <Reveal delay={80} className="md:col-span-2">
          <div className="bp-card flex h-full flex-col rounded-2xl p-7">
            <IconTile>
              <Cpu className="size-5" />
            </IconTile>
            <h3 className="mt-4 text-lg font-semibold text-fd-foreground">Resource limits</h3>
            <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">
              Cap memory and CPU per app, enforced by Docker so a noisy neighbor never starves
              the host.
            </p>
            <div className="mt-auto space-y-2 pt-5">
              {[
                ['CPU', '38%', '38%'],
                ['Memory', '512MB', '64%'],
              ].map(([label, val, w]) => (
                <div key={label}>
                  <div className="flex justify-between text-[11px] text-fd-muted-foreground">
                    <span>{label}</span>
                    <span className="font-mono">{val}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fd-muted">
                    <div className="h-full rounded-full bg-fd-primary" style={{ width: w }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Three even cells */}
        {[
          {
            icon: HardDrive,
            title: 'Persistent volumes',
            desc: 'Declare volumes that survive redeploys, so stateful apps keep their data between builds.',
          },
          {
            icon: Bell,
            title: 'Deploy notifications',
            desc: 'Slack or webhook pings on every success or failure. Know the moment something ships.',
          },
          {
            icon: Boxes,
            title: 'Framework detection',
            desc: 'Nixpacks auto-detects Node, Python, Go, Ruby and more. No Dockerfile required.',
          },
        ].map((f, i) => (
          <Reveal key={f.title} delay={i * 80} className="md:col-span-2">
            <div className="bp-card flex h-full flex-col rounded-2xl p-7">
              <IconTile>
                <f.icon className="size-5" />
              </IconTile>
              <h3 className="mt-4 text-lg font-semibold text-fd-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">{f.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════  How it works  ══════════════════════════ */

const steps = [
  {
    n: '01',
    title: 'Install on a server',
    desc: 'Run the one-command installer on any Ubuntu, Debian, or macOS box. It provisions Docker, Caddy, and the dashboard for you.',
  },
  {
    n: '02',
    title: 'Connect a repository',
    desc: 'Sign in with your admin token, paste a Git URL, pick a branch. The framework is detected automatically.',
  },
  {
    n: '03',
    title: 'Ship on every push',
    desc: 'It builds with Nixpacks, health-checks the container, and routes traffic through Caddy with HTTPS. Every git push redeploys.',
  },
];

function HowItWorks() {
  return (
    <section className="bg-fd-card/30">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal className="lg:sticky lg:top-24 lg:self-start">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="bp-display mt-4 text-3xl font-semibold text-fd-foreground sm:text-[2.75rem]">
              From zero to deployed in minutes
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-fd-muted-foreground">
              Three steps, no prior DevOps experience required.
            </p>
            <Link
              href="/docs/quickstart"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-fd-primary hover:underline"
            >
              Read the quickstart
              <ArrowRight className="size-4" />
            </Link>
          </Reveal>

          <div className="flex flex-col">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="flex gap-5 border-t border-fd-border py-7 first:border-t-0 first:pt-0">
                  <span className="bp-display shrink-0 font-mono text-2xl font-semibold text-fd-primary/40">
                    {s.n}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-fd-foreground">{s.title}</h3>
                    <p className="mt-2 leading-relaxed text-fd-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════  Security  ═════════════════════════════ */

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
    title: 'Safe self-updates',
    desc: 'Updates back up your data, rebuild, health-check, and auto-roll-back on any failure.',
  },
];

function Security() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <Eyebrow>Security</Eyebrow>
          <h2 className="bp-display mt-4 text-3xl font-semibold text-fd-foreground sm:text-[2.75rem]">
            Secure by default,
            <br />
            not by configuration
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-fd-muted-foreground">
            Your server, your data, your keys. {appName} is built so the safe path is the default
            path — you don’t have to be a security expert to run it well.
          </p>
          <ul className="mt-6 space-y-2.5">
            {['No third-party access to your code', 'Secrets encrypted before storage', 'Audited, open source control plane'].map(
              (item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-fd-muted-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full bg-fd-primary/10 text-fd-primary">
                    <Check className="size-3" />
                  </span>
                  {item}
                </li>
              ),
            )}
          </ul>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2">
          {securityPoints.map((p, i) => (
            <Reveal key={p.title} delay={i * 70}>
              <div className="bp-card h-full rounded-2xl p-6">
                <IconTile size="sm">
                  <p.icon className="size-4" />
                </IconTile>
                <h3 className="mt-4 font-semibold text-fd-foreground">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fd-muted-foreground">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════  Call to action  ══════════════════════════ */

function CallToAction() {
  return (
    <section className="border-none">
      <div className="mx-auto max-w-6xl px-6 py-28">
        <Reveal>
          <div className="bp-card relative overflow-hidden rounded-3xl px-6 py-20 text-center sm:px-12">
            <div className="relative flex flex-col items-center">
              <LogoMark className="size-12 text-fd-primary" />
              <h2 className="bp-display mt-7 max-w-2xl text-3xl font-semibold text-fd-foreground sm:text-5xl">
                Own your deployment pipeline
              </h2>
              <p className="bp-balance mt-5 max-w-xl text-lg leading-relaxed text-fd-muted-foreground">
                Spin up {appName} on a $5 VPS and deploy as many apps as your server can hold.
                Free, open source, yours forever.
              </p>
              <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
                <Link
                  href="/docs"
                  className="bp-primary inline-flex h-11 items-center gap-2 rounded-lg px-6 text-sm font-medium"
                >
                  Read the docs
                  <ArrowRight className="size-4" />
                </Link>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bp-surface inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium text-fd-foreground"
                >
                  <GithubIcon className="size-4" />
                  Star on GitHub
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
