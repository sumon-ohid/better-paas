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
  Database,
  GitBranch,
} from 'lucide-react';
import { LogoMark } from '@/components/logo';
import { appName, githubUrl } from '@/lib/shared';
import { ProductDemo } from '@/components/landing/product-demo';
import { FeatureShowcase } from '@/components/landing/feature-showcase';
import { TechMarquee } from '@/components/landing/tech-marquee';
import { InstallLine } from '@/components/landing/install-line';
import { IconTile } from '@/components/landing/primitives';
import { GithubIcon } from '@/components/landing/github-icon';
import { DockerLogo, NixLogo, CaddyLogo, NextjsLogo } from '@/components/landing/brand-logos';
import { TextEffect } from '@/components/tailark/text-effect';
import { AnimatedGroup } from '@/components/tailark/animated-group';
import { BorderBeam } from '@/components/tailark/border-beam';
import { AutomationsSection } from '@/components/landing/automations';
import { cn } from '@/lib/cn';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col relative">
      <Hero />
      <TechStrip />
      <Showcase />
      <Stats />
      <Bento />
      <AutomationsSection />
      <HowItWorks />
      <Integrations />
      <Security />
      <Pricing />
      <CallToAction />
    </main>
  );
}

/* ═════════════════════════════════  Hero  ═══════════════════════════════ */

function Hero() {
  return (
    <section className="bp-hero-stage relative overflow-hidden">
      <div className="relative mx-auto max-w-6xl px-4 pt-28 pb-8 sm:pt-36">
        <div className="relative z-10 grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-4xl text-left">
            <TextEffect
              preset="fade-in-blur"
              speedSegment={0.5}
              as="h1"
              className="bp-display max-w-4xl text-[2rem] font-normal text-fd-foreground sm:text-[3.25rem] md:text-[4rem]"
            >
              The self-hosted platform for apps, databases, and agents
            </TextEffect>

            <AnimatedGroup
              preset="fade"
              variants={{
                container: {
                  visible: {
                    transition: {
                      delayChildren: 0.55,
                    },
                  },
                },
              }}
              className="mt-7 max-w-2xl"
            >
              <p className="text-base leading-7 text-fd-muted-foreground sm:text-md">
                Deploy from Git, manage services, and run production workloads on servers you
                control.
              </p>
            </AnimatedGroup>
          </div>

          <AnimatedGroup
            preset="fade"
            variants={{
              container: {
                visible: {
                  transition: {
                    delayChildren: 0.7,
                  },
                },
              },
            }}
            className="hidden pb-2 mt-3 lg:block"
          >
            <Link
              href="/docs/updates"
              className="group inline-flex items-center gap-3 text-sm font-medium text-fd-muted-foreground transition-colors hover:text-fd-foreground"
            >
              <span className="size-2 rounded-full bg-fd-primary/80 shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-fd-primary)_18%,transparent)]" />
              Managed databases are live
              <ArrowRight className="size-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </AnimatedGroup>
        </div>

        <AnimatedGroup
          preset="fade"
          variants={{
            container: {
              visible: {
                transition: {
                  delayChildren: 0.78,
                },
              },
            },
          }}
          className="mt-9 w-full max-w-md"
        >
          <InstallLine />
        </AnimatedGroup>

        {/* Product demo */}
        <div className="bp-hero-demo relative z-10 mx-auto mt-[4.5rem] max-w-6xl rounded-t-[1.5rem] sm:mt-20">
          <ProductDemo />
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════  Tech strip  ══════════════════════════════ */

function TechStrip() {
  return (
    <section className="bg-transparent py-10">
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
    <section id="platform" className="relative py-10 overflow-hidden  bg-[#f7f8fb] dark:bg-fd-background">
      <div className="mx-auto grid max-w-[1268px] grid-cols-1 gap-7 px-4 pb-7 pt-16 sm:px-6 sm:py-8 md:grid-cols-1 md:gap-8 lg:grid-cols-[minmax(270px,0.55fr)_minmax(0,1.02fr)] lg:items-center lg:gap-9 lg:px-9 lg:py-9 xl:px-12">
        <div className="order-1 max-w-[443px] lg:pl-1.5">
          <p className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#66758e] dark:text-[#9a9a9f]">
            The platform
          </p>
          <h2 className="bp-display text-[clamp(2rem,7.8vw,2.35rem)] font-normal leading-[1.16] tracking-[-0.035em] text-[#121722] lg:text-[clamp(1.7rem,2.6vw,2.7rem)] dark:text-[#f4f4f5]">
            Everything a real platform needs
          </h2>
          <p className="mt-5 text-[clamp(0.82rem,3.35vw,1rem)] font-light leading-[1.42] tracking-[-0.006em] text-[#394355] sm:text-[clamp(1rem,4.1vw,1.2rem)] sm:leading-[1.48] lg:mt-5 lg:text-[clamp(0.8rem,1.1vw,1.07rem)] dark:text-[#dfdfe2]">
            Deploy from Git, route HTTPS, add databases, run scheduled jobs, inspect logs, and roll
            back safely from one self-hosted control plane.
          </p>
        </div>

        <div className="relative order-2 w-full">
          <FeatureShowcase />
        </div>
      </div>
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
    <section className="py-16 md:py-24 bg-fd-card/10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 divide-y divide-fd-border/50 *:pt-8 first:*:pt-0 md:grid-cols-4 md:gap-2 md:divide-x md:divide-y-0 md:divide-fd-border/50 *:md:pt-0 *:md:px-6">
          {stats.map((s, i) => (
            <div key={s.label} className="text-center md:text-left space-y-2">
              <div className="bg-gradient-to-r from-fd-foreground to-fd-muted-foreground/80 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl dark:from-white dark:to-zinc-600">
                {s.value}
              </div>
              <p className="text-sm font-medium text-fd-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════  Bento  ═══════════════════════════════ */

function Bento() {
  return (
    <section className="bg-[#f7f8fb] dark:border-white/5 dark:bg-fd-background">
      <div className="mx-auto max-w-[1268px] px-4 py-16 sm:px-9 sm:py-20 xl:px-12">
      <div className="mb-10 max-w-[520px]">
        <p className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#66758e] dark:text-[#9a9a9f]">And the details</p>
        <h2 className="bp-display text-[clamp(2rem,7.8vw,2.35rem)] font-normal leading-[1.16] tracking-[-0.035em] text-[#121722] lg:text-[clamp(1.7rem,2.6vw,2.7rem)] dark:text-[#f4f4f5]">
          The parts that make it yours
        </h2>
        <p className="mt-5 text-[clamp(0.82rem,3.35vw,1rem)] font-light leading-[1.42] tracking-[-0.006em] text-[#394355] sm:text-[clamp(1rem,4.1vw,1.2rem)] sm:leading-[1.48] lg:text-[clamp(0.8rem,1.1vw,1.07rem)] dark:text-[#dfdfe2]">
          Thoughtful defaults so the boring parts of running a platform just work.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-6">
        {/* Wide feature cell — live logs */}
        <div className="md:col-span-4 bp-card relative overflow-hidden flex h-full flex-col justify-between gap-6 rounded-[0.85rem] p-6 md:flex-row md:items-center group">
          <div className="max-w-sm relative z-10">
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
          <div className="w-full shrink-0 overflow-hidden rounded-xl bg-transparent p-3.5 font-mono text-[11px] leading-relaxed md:w-64 relative z-10 border border-fd-border/40">
            <div className="text-slate-450 dark:text-slate-300">› Ready on :3000</div>
            <div className="text-slate-450 dark:text-slate-300">GET /api/health 200 · 4ms</div>
            <div className="text-[#3c9f7a] dark:text-[#93e0c0]">✔ deploy promoted</div>
            <div className="text-slate-450 dark:text-slate-300">POST /checkout 201 · 38ms</div>
            <div className="flex items-center gap-1.5 text-(--bp-success)">
              <span className="size-1.5 rounded-full bg-(--bp-success) bp-pulse-dot" />
              streaming
            </div>
          </div>
          <BorderBeam
            duration={12}
            size={250}
            colorFrom="var(--color-fd-primary)"
            colorTo="transparent"
            className="opacity-0 group-hover:opacity-30 transition-opacity"
          />
        </div>

        {/* Tall-ish cell — resource limits */}
        <div className="md:col-span-2 bp-card relative overflow-hidden flex h-full flex-col rounded-[0.85rem] p-6 group">
          <div className="relative z-10">
            <IconTile>
              <Cpu className="size-5" />
            </IconTile>
            <h3 className="mt-4 text-lg font-semibold text-fd-foreground">Resource limits</h3>
            <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">
              Cap memory and CPU per app, enforced by Docker so a noisy neighbor never starves
              the host.
            </p>
          </div>
          <div className="mt-auto space-y-2 pt-5 relative z-10">
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
          <BorderBeam
            duration={12}
            size={180}
            colorFrom="var(--color-fd-primary)"
            colorTo="transparent"
            className="opacity-0 group-hover:opacity-30 transition-opacity"
          />
        </div>

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
          <div key={f.title} className="md:col-span-2 bp-card relative overflow-hidden flex h-full flex-col rounded-[0.85rem] p-6 group">
            <div className="relative z-10">
              <IconTile>
                <f.icon className="size-5" />
              </IconTile>
              <h3 className="mt-4 text-lg font-semibold text-fd-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">{f.desc}</p>
            </div>
            <BorderBeam
              duration={12}
              size={150}
              colorFrom="var(--color-fd-primary)"
              colorTo="transparent"
              className="opacity-0 group-hover:opacity-30 transition-opacity"
            />
          </div>
        ))}
      </div>
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
    <section className="py-10 bg-[#f7f8fb] dark:border-white/5 dark:bg-fd-background">
      <div className="mx-auto max-w-[1268px] px-4 py-16 sm:px-9 sm:py-20 xl:px-12">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#66758e] dark:text-[#9a9a9f]">How it works</p>
            <h2 className="bp-display text-[clamp(2rem,7.8vw,2.35rem)] font-normal leading-[1.16] tracking-[-0.035em] text-[#121722] lg:text-[clamp(1.7rem,2.6vw,2.7rem)] dark:text-[#f4f4f5]">
              From zero to deployed in minutes
            </h2>
            <p className="mt-5 text-[clamp(0.82rem,3.35vw,1rem)] font-light leading-[1.42] tracking-[-0.006em] text-[#394355] sm:text-[clamp(1rem,4.1vw,1.2rem)] sm:leading-[1.48] lg:text-[clamp(0.8rem,1.1vw,1.07rem)] dark:text-[#dfdfe2]">
              Three steps, no prior DevOps experience required.
            </p>
            <Link
              href="/docs/quickstart"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-fd-primary hover:underline"
            >
              Read the quickstart
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="flex flex-col gap-6">
            {steps.map((s, i) => (
              <div key={s.n} className="bp-card relative overflow-hidden flex gap-5 rounded-[0.85rem] p-6 group">
                <span className="shrink-0 font-mono text-[0.8rem] font-medium text-fd-primary/70">
                  {s.n}
                </span>
                <div className="relative z-10">
                  <h3 className="text-[1rem] font-medium tracking-[-0.01em] text-fd-foreground">{s.title}</h3>
                  <p className="mt-2 text-sm font-light leading-relaxed text-fd-muted-foreground">{s.desc}</p>
                </div>
                <BorderBeam
                  duration={8}
                  size={120}
                  colorFrom="var(--color-fd-primary)"
                  colorTo="transparent"
                  className="opacity-0 group-hover:opacity-30 transition-opacity"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════  Integrations  ═══════════════════════════ */

function Integrations() {
  return (
    <section className=" bg-[#f7f8fb] dark:border-white/5 dark:bg-fd-background">
      <div className="mx-auto max-w-[1268px] px-4 py-16 sm:px-9 md:py-20 xl:px-12">
        <div className="grid items-center gap-16 sm:grid-cols-2">
          <div className="relative mx-auto w-fit">
            <div
              aria-hidden
              className="bg-radial to-fd-background absolute inset-0 z-10 from-transparent to-75% pointer-events-none"
            />
            <div className="mx-auto mb-2 flex w-fit justify-center gap-2">
              <IntegrationCard>
                <DockerLogo className="size-8" />
              </IntegrationCard>
              <IntegrationCard>
                <NixLogo className="size-8" />
              </IntegrationCard>
            </div>
            <div className="mx-auto my-2 flex w-fit justify-center gap-2">
              <IntegrationCard>
                <CaddyLogo className="size-8" />
              </IntegrationCard>
              <IntegrationCard
                borderClassName="shadow-fd-primary/10 shadow-xl border-fd-primary/30 dark:border-fd-primary/30"
                className="bg-fd-primary/10"
              >
                <LogoMark className="size-8 text-fd-primary" />
              </IntegrationCard>
              <IntegrationCard>
                <NextjsLogo className="size-8" />
              </IntegrationCard>
            </div>

            <div className="mx-auto flex w-fit justify-center gap-2">
              <IntegrationCard>
                <Database className="size-8 text-fd-muted-foreground" />
              </IntegrationCard>
              <IntegrationCard>
                <GitBranch className="size-8 text-fd-muted-foreground" />
              </IntegrationCard>
            </div>
          </div>
          <div className="mx-auto mt-6 max-w-lg space-y-6 text-center sm:mt-0 sm:text-left">
            <p className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#66758e] dark:text-[#9a9a9f]">Integrations</p>
            <h2 className="bp-display text-[clamp(2rem,7.8vw,2.35rem)] font-normal leading-[1.16] tracking-[-0.035em] text-[#121722] lg:text-[clamp(1.7rem,2.6vw,2.7rem)] dark:text-[#f4f4f5]">
              Works with your existing stack
            </h2>
            <p className="font-light leading-relaxed text-[#394355] dark:text-[#dfdfe2]">
              Better-PaaS builds your code with Nixpacks, runs it via Docker, and manages certificates and routing automatically with Caddy. No lock-in, just open standards.
            </p>
            <Link
              href="/docs#whats-under-the-hood"
              className="bp-primary inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-medium"
            >
              Learn about the architecture
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function IntegrationCard({ children, className, borderClassName }: { children: React.ReactNode; className?: string; borderClassName?: string }) {
  return (
    <div className={cn('bg-fd-card relative flex size-20 rounded-[0.85rem] items-center justify-center border border-fd-border shadow-[0_16px_45px_-32px_rgba(23,44,92,0.45)]', className)}>
      <div
        role="presentation"
        className={cn('absolute inset-0 rounded-[0.85rem]', borderClassName)}
      />
      <div className="relative z-20 m-auto flex items-center justify-center">{children}</div>
    </div>
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
    <section className="bg-[#f7f8fb] dark:border-white/5 dark:bg-fd-background">
      <div className="mx-auto max-w-[1268px] px-4 py-16 sm:px-9 sm:py-20 xl:px-12">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#66758e] dark:text-[#9a9a9f]">Security</p>
          <h2 className="bp-display text-[clamp(2rem,7.8vw,2.35rem)] font-normal leading-[1.16] tracking-[-0.035em] text-[#121722] lg:text-[clamp(1.7rem,2.6vw,2.7rem)] dark:text-[#f4f4f5]">
            Secure by default,
            <br />
            not by configuration
          </h2>
          <p className="mt-5 text-[clamp(0.82rem,3.35vw,1rem)] font-light leading-[1.42] tracking-[-0.006em] text-[#394355] sm:text-[clamp(1rem,4.1vw,1.2rem)] sm:leading-[1.48] lg:text-[clamp(0.8rem,1.1vw,1.07rem)] dark:text-[#dfdfe2]">
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {securityPoints.map((p, i) => (
            <div key={p.title} className="bp-card h-full rounded-[0.85rem] p-6 relative overflow-hidden group hover:border-fd-primary/50 transition-colors">
              <IconTile size="sm">
                <p.icon className="size-4" />
              </IconTile>
              <h3 className="mt-4 font-semibold text-fd-foreground">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fd-muted-foreground">{p.desc}</p>
              <BorderBeam
                duration={8}
                size={80}
                colorFrom="var(--color-fd-primary)"
                colorTo="transparent"
                className="opacity-0 group-hover:opacity-45 transition-opacity"
              />
            </div>
          ))}
        </div>
      </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════  Pricing  ═══════════════════════════════ */

function Pricing() {
  return (
    <section id="pricing" className="bg-[#f7f8fb] dark:border-white/5 dark:bg-fd-background">
      <div className="mx-auto max-w-[1268px] px-4 py-16 sm:px-9 sm:py-20 xl:px-12">
        <div className="max-w-[560px]">
          <p className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#66758e] dark:text-[#9a9a9f]">Pricing</p>
          <h2 className="bp-display text-[clamp(2rem,7.8vw,2.35rem)] font-normal leading-[1.16] tracking-[-0.035em] text-[#121722] lg:text-[clamp(1.7rem,2.6vw,2.7rem)] dark:text-[#f4f4f5]">
            Free to self-host
          </h2>
          <p className="mt-5 text-[clamp(0.82rem,3.35vw,1rem)] font-light leading-[1.42] tracking-[-0.006em] text-[#394355] sm:text-[clamp(1rem,4.1vw,1.2rem)] sm:leading-[1.48] lg:text-[clamp(0.8rem,1.1vw,1.07rem)] dark:text-[#dfdfe2]">
            Run {appName} on your own servers for free. A managed control plane is coming soon
            for teams who want us to operate {appName} while they keep control of their servers.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bp-card group relative overflow-hidden rounded-[0.85rem] p-7 sm:p-8">
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <IconTile>
                    <LogoMark className="size-5" />
                  </IconTile>
                  <h3 className="mt-5 text-2xl font-semibold text-fd-foreground">
                    Self-hosted
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-fd-muted-foreground">
                    Install it on your VPS, home lab, or private cloud. You own the app,
                    data, credentials, and runtime.
                  </p>
                </div>
                <div className="sm:text-right">
                  <div className="bp-display text-6xl font-semibold text-fd-foreground">$0</div>
                  <p className="mt-1 text-sm font-medium text-fd-muted-foreground">
                    Free to use
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  'Unlimited apps on your hardware',
                  'Git deploys, HTTPS, logs, shell',
                  'Databases, volumes, backups',
                  'No platform markup or seat pricing',
                  'No request limits or egress charges',
                  'No vendor lock-in',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-fd-muted-foreground">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-fd-primary/10 text-fd-primary">
                      <Check className="size-3" />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <BorderBeam
              duration={10}
              size={240}
              colorFrom="var(--color-fd-primary)"
              colorTo="transparent"
              className="opacity-0 transition-opacity group-hover:opacity-30"
            />
          </div>

          <div className="bp-card relative overflow-hidden rounded-[0.85rem] p-7 sm:p-8">
            <div className="relative z-10 flex h-full flex-col justify-between gap-10">
              <div>
                <span className="inline-flex rounded-full border border-fd-border px-3 py-1 text-xs font-medium text-fd-muted-foreground">
                  Coming soon
                </span>
                <h3 className="mt-5 text-2xl font-semibold text-fd-foreground">
                  Managed {appName}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">
                  We will host and maintain the {appName} control plane for you. You still
                  connect and manage your own servers, so workloads stay on infrastructure you
                  control.
                </p>
              </div>
              <div className="border-t border-fd-border pt-5">
                <p className="text-sm font-medium text-fd-foreground">Price announced later</p>
                <p className="mt-1 text-sm text-fd-muted-foreground">
                  Built for teams that want less maintenance without giving up server ownership.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════  Call to action  ══════════════════════════ */

function CallToAction() {
  return (
    <section className="bg-[#f7f8fb] dark:border-white/5 dark:bg-fd-background">
      <div className="mx-auto max-w-[1268px] px-4 py-16 sm:px-9 md:py-20 xl:px-12">
        <div
          className="relative flex min-h-[clamp(360px,52svh,520px)] w-full items-center justify-center overflow-hidden rounded-md px-5 py-8 shadow-none sm:px-9 sm:py-12"
          style={{
            background: 'linear-gradient(134deg, #d9e1ff 0%, #7197ff 20%, #4c69ff 48%, #3035d5 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute -bottom-24 -left-20 size-[31rem] rounded-full opacity-75 blur-[72px]"
            style={{ background: '#eef1ff' }}
          />
          <div
            className="pointer-events-none absolute -right-28 -top-20 size-[33rem] rounded-full opacity-45 blur-[82px]"
            style={{ background: '#2538d8' }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-35 mix-blend-soft-light"
            style={{ background: 'radial-gradient(circle at 9% 84%, #ffffff 0%, transparent 36%)' }}
          />

          <div className="relative w-full max-w-[720px] overflow-hidden rounded-[0.85rem] bg-[#f8fbff]/92 px-4 py-10 text-center shadow-[0_15px_52px_-21px_rgba(23,44,92,0.55)] sm:px-10 sm:py-12 dark:bg-[#050505]/90 dark:shadow-[0_15px_52px_-21px_rgba(0,0,0,0.95)]">
            <div className="relative flex flex-col items-center z-10">
              <LogoMark className="size-10 text-fd-primary" />
              <p className="mt-6 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#66758e] dark:text-[#9a9a9f]">
                Start shipping
              </p>
              <h2 className="bp-display mt-3 max-w-2xl text-[clamp(2rem,7.8vw,2.8rem)] font-normal leading-[1.08] tracking-[-0.035em] text-[#121722] dark:text-[#f4f4f5]">
                Own your deployment pipeline
              </h2>
              <p className="bp-balance mt-5 max-w-xl text-[clamp(0.92rem,3.2vw,1.1rem)] font-light leading-[1.5] tracking-[-0.006em] text-[#394355] dark:text-[#dfdfe2]">
                Spin up {appName} on a $5 VPS and deploy as many apps as your server can hold.
                Free, open source, yours forever.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
                <Link
                  href="/docs"
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
      </div>
    </section>
  );
}
