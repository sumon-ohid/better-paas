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
  Rocket,
} from 'lucide-react';
import { LogoMark } from '@/components/logo';
import { appName, gitConfig, githubUrl } from '@/lib/shared';
import { ProductDemo } from '@/components/landing/product-demo';
import { FeatureShowcase } from '@/components/landing/feature-showcase';
import { TechMarquee } from '@/components/landing/tech-marquee';
import { InstallLine } from '@/components/landing/install-line';
import { IconTile } from '@/components/landing/primitives';
import { DockerLogo, NixLogo, CaddyLogo, NextjsLogo } from '@/components/landing/brand-logos';
import { TextEffect } from '@/components/tailark/text-effect';
import { AnimatedGroup } from '@/components/tailark/animated-group';
import { BorderBeam } from '@/components/tailark/border-beam';
import { AutomationsSection } from '@/components/landing/automations';
import { AgentFirstSection } from '@/components/landing/agent-first-section';
import { FAQSection } from '@/components/landing/faq';
import { LandingCallToAction } from '@/components/landing/call-to-action';
import { cn } from '@/lib/cn';

export default async function HomePage() {
  const latestRelease = await getLatestRelease();

  return (
    <main className="flex flex-1 flex-col relative">
      <Hero latestRelease={latestRelease} />
      <TechStrip />
      <AgentFirstSection />
      <Showcase />
      <Stats />
      <Bento />
      <AutomationsSection />
      <HowItWorks />
      <Integrations />
      <Security />
      <Pricing />
      <FAQSection />
      <LandingCallToAction />
    </main>
  );
}

/* ═════════════════════════════════  Hero  ═══════════════════════════════ */

type GitHubRelease = {
  tag_name?: string;
  html_url?: string;
};

async function getLatestRelease(): Promise<{ version: string; url: string } | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${gitConfig.user}/${gitConfig.repo}/releases/latest`,
      {
        next: { revalidate: 1800 },
      },
    );

    if (!res.ok) return null;

    const release = (await res.json()) as GitHubRelease;
    if (!release.tag_name) return null;

    return {
      version: release.tag_name,
      url: release.html_url || `${githubUrl}/releases/latest`,
    };
  } catch {
    return null;
  }
}

function Hero({
  latestRelease,
}: {
  latestRelease: { version: string; url: string } | null;
}) {
  const releaseLabel = latestRelease
    ? `${latestRelease.version} beta`
    : 'Beta release';

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
              Deploy and manage apps with AI - on infrastructure you own
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
                Better-PaaS is an agent-first, self-hosted PaaS. Git push deploys, automatic HTTPS,
                and databases on your VPS - plus scoped tokens,{' '}
                <code className="rounded bg-fd-muted/50 px-1.5 py-0.5 font-mono text-[0.9em]">
                  paas connect
                </code>
                , and MCP tools for Cursor and Claude Code.
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
              href={latestRelease?.url || `${githubUrl}/releases`}
              className="group inline-flex items-center gap-3 text-sm font-medium text-fd-muted-foreground transition-colors hover:text-fd-foreground"
              target="_blank"
              rel="noreferrer"
            >
              <span className="size-2 rounded-full bg-fd-primary/80 shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-fd-primary)_18%,transparent)]" />
              {releaseLabel}
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
          className="mt-9 w-full max-w-xl"
        >
          <InstallLine />
          <div className="mt-4 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/docs/guides/paas-cli"
              className="inline-flex items-center gap-1.5 text-fd-muted-foreground transition-colors hover:text-fd-foreground"
            >
              Connect with the paas CLI
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </AnimatedGroup>

        {/* Product demo */}
        <div className="relative z-10 mx-auto mt-[4.5rem] max-w-6xl sm:mt-20">
          <div 
            className="relative flex w-full items-center justify-center overflow-hidden rounded-[1.2rem] sm:rounded-[1.5rem] px-3 py-4 sm:px-6 sm:py-7 lg:px-7 lg:py-8 shadow-none"
            style={{
              background: 'linear-gradient(134deg, #d9e1ff 0%, #7197ff 20%, #4c69ff 48%, #3035d5 100%)',
            }}
          >
            {/* Soft sky-blue/mystic-blue radial glow in the top-left */}
            <div 
              className="pointer-events-none absolute -bottom-24 -left-20 size-[31rem] rounded-full opacity-35 dark:opacity-75 blur-[72px]"
              style={{ background: '#eef1ff' }}
            />
            
            {/* Soft indigo/purple glow in the bottom-right */}
            <div 
              className="pointer-events-none absolute -right-28 -top-20 size-[33rem] rounded-full opacity-20 dark:opacity-45 blur-[82px]"
              style={{ background: '#2538d8' }}
            />

            {/* Radial highlight in center */}
            <div 
              className="pointer-events-none absolute inset-0 opacity-15 dark:opacity-35 mix-blend-soft-light"
              style={{
                background: 'radial-gradient(circle at 9% 84%, #ffffff 0%, transparent 36%)',
              }}
            />

            {/* Glassmorphism Parent Container */}
            <div className="relative w-full rounded-[1.5rem] bg-[#f8fbff]/92 p-2 dark:bg-[#050505]/90 dark:shadow-[0_15px_52px_-21px_rgba(0,0,0,0.95)] shadow-[0_15px_52px_-21px_rgba(23,44,92,0.55)]">
              <ProductDemo />
            </div>
          </div>
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
    <section id="platform" className="relative py-10 overflow-hidden bg-fd-background">
      <div className="mx-auto grid max-w-[1268px] grid-cols-1 gap-7 px-4 pb-7 pt-16 sm:px-6 sm:py-8 md:grid-cols-1 md:gap-8 lg:grid-cols-[minmax(270px,0.55fr)_minmax(0,1.02fr)] lg:items-center lg:gap-9 lg:px-9 lg:py-9 xl:px-12">
        <div className="order-1 max-w-[443px] lg:pl-1.5">
          <h2 className="bp-display text-[clamp(2rem,7.8vw,2.35rem)] font-normal leading-[1.16] tracking-[-0.035em] text-[#121722] lg:text-[clamp(1.7rem,2.6vw,2.7rem)] dark:text-[#f4f4f5]">
            Self-hosted platform, agent-ready
          </h2>
          <p className="mt-5 text-[clamp(0.82rem,3.35vw,1rem)] font-light leading-[1.42] tracking-[-0.006em] text-[#394355] sm:text-[clamp(1rem,4.1vw,1.2rem)] sm:leading-[1.48] lg:mt-5 lg:text-[clamp(0.8rem,1.1vw,1.07rem)] dark:text-[#dfdfe2]">
            Deploy from Git, route HTTPS, add databases, inspect logs, and roll back - then hand
            day-to-day ops to scoped agents from your editor.
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
  { value: '7', label: 'MCP tools for deploy and ops' },
  { value: '3', label: 'agent permission profiles' },
  { value: '$5', label: 'a month is enough to run it' },
];

function Stats() {
  return (
    <section className="py-16 md:py-24 bg-fd-background">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 md:grid-cols-4 md:gap-2 md:divide-x md:divide-fd-border/50 *:md:px-6">
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
    <section className="bg-fd-background">
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

        <div 
          className="relative flex w-full items-center justify-center overflow-hidden rounded-md px-3.5 py-4.5 shadow-none sm:px-9 sm:py-9 lg:px-9 lg:py-9"
          style={{
            background: 'linear-gradient(134deg, #d9e1ff 0%, #7197ff 20%, #4c69ff 48%, #3035d5 100%)',
          }}
        >
          {/* Soft sky-blue/mystic-blue radial glow in the top-left */}
          <div 
            className="pointer-events-none absolute -bottom-24 -left-20 size-[31rem] rounded-full opacity-35 dark:opacity-75 blur-[72px]"
            style={{ background: '#eef1ff' }}
          />
          
          {/* Soft indigo/purple glow in the bottom-right */}
          <div 
            className="pointer-events-none absolute -right-28 -top-20 size-[33rem] rounded-full opacity-20 dark:opacity-45 blur-[82px]"
            style={{ background: '#2538d8' }}
          />

          {/* Radial highlight in center */}
          <div 
            className="pointer-events-none absolute inset-0 opacity-15 dark:opacity-35 mix-blend-soft-light"
            style={{
              background: 'radial-gradient(circle at 9% 84%, #ffffff 0%, transparent 36%)',
            }}
          />

          {/* Bento Grid Parent Translucent Card */}
          <div className="relative w-full rounded-[0.85rem] bg-[#f8fbff]/92 p-3 sm:p-7 xl:p-8 dark:bg-[#050505]/90 dark:shadow-[0_15px_52px_-21px_rgba(0,0,0,0.95)]">
            <div className="grid gap-3.5 sm:gap-6 grid-cols-1 sm:grid-cols-6">
              {/* Wide feature cell - live logs */}
              <div className="sm:col-span-6 md:col-span-4 relative overflow-hidden flex h-full flex-col justify-between gap-4 rounded-[0.85rem] p-4.5 sm:p-6 md:flex-row md:items-center group bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 transition-all duration-300 hover:bg-white/80 dark:hover:bg-white/[0.06]">
                <div className="max-w-sm relative z-10">
                  <Terminal className="size-4.5 sm:size-5.5 text-black dark:text-white" />
                  <h3 className="mt-2 sm:mt-3 text-base sm:text-lg font-semibold text-[#121722] dark:text-[#f4f4f5]">
                    Live logs & in-browser shell
                  </h3>
                  <p className="mt-1.5 text-[11.5px] sm:text-sm leading-relaxed text-[#394355] dark:text-[#929297]">
                    Stream container output in real time and drop into a terminal on any container,
                    straight from the dashboard.
                  </p>
                </div>
                <div className="w-full shrink-0 overflow-hidden rounded-xl bg-transparent p-2.5 sm:p-3.5 font-mono text-[10px] sm:text-[11px] leading-relaxed md:w-64 relative z-10 border border-[#121722]/10 dark:border-white/15">
                  <div className="text-slate-450 dark:text-slate-300">› Ready on :3000</div>
                  <div className="hidden sm:block text-slate-450 dark:text-slate-300">GET /api/health 200 · 4ms</div>
                  <div className="text-[#3c9f7a] dark:text-[#93e0c0]">✔ deploy promoted</div>
                  <div className="hidden sm:block text-slate-450 dark:text-slate-300">POST /checkout 201 · 38ms</div>
                  <div className="flex items-center gap-1.5 text-[#3c9f7a] dark:text-[#5fe0a0]">
                    <span className="size-1 sm:size-1.5 rounded-full bg-[#3c9f7a] dark:bg-[#5fe0a0] bp-pulse-dot" />
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

              {/* Tall-ish cell - resource limits */}
              <div className="sm:col-span-3 md:col-span-2 relative overflow-hidden flex h-full flex-col rounded-[0.85rem] p-4.5 sm:p-6 group bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 transition-all duration-300 hover:bg-white/80 dark:hover:bg-white/[0.06]">
                <div className="relative z-10">
                  <Cpu className="size-4.5 sm:size-5.5 text-black dark:text-white" />
                  <h3 className="mt-2 sm:mt-3 text-base sm:text-lg font-semibold text-[#121722] dark:text-[#f4f4f5]">Resource limits</h3>
                  <p className="mt-1.5 text-[11.5px] sm:text-sm leading-relaxed text-[#394355] dark:text-[#929297]">
                    Cap memory and CPU per app, enforced by Docker so a noisy neighbor never starves
                    the host.
                  </p>
                </div>
                <div className="mt-auto space-y-2 pt-4 sm:pt-5 relative z-10">
                  {[
                    ['CPU', '38%', '38%'],
                    ['Memory', '512MB', '64%'],
                  ].map(([label, val, w]) => (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] sm:text-[11px] text-[#394355] dark:text-[#929297]">
                        <span>{label}</span>
                        <span className="font-mono">{val}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
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
                <div key={f.title} className="sm:col-span-3 md:col-span-2 relative overflow-hidden flex h-full flex-col rounded-[0.85rem] p-4.5 sm:p-6 group bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 transition-all duration-300 hover:bg-white/80 dark:hover:bg-white/[0.06]">
                  <div className="relative z-10">
                    <f.icon className="size-4.5 sm:size-5.5 text-black dark:text-white" />
                    <h3 className="mt-2 sm:mt-3 text-base sm:text-lg font-semibold text-[#121722] dark:text-[#f4f4f5]">{f.title}</h3>
                    <p className="mt-1.5 text-[11.5px] sm:text-sm leading-relaxed text-[#394355] dark:text-[#929297]">{f.desc}</p>
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
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════  How it works  ══════════════════════════ */

const steps = [
  {
    n: '01',
    title: 'Install on your VPS',
    desc: 'Run the one-command installer. Docker, Caddy, and the dashboard are ready in minutes.',
    icon: Terminal,
  },
  {
    n: '02',
    title: 'Connect a Git repo',
    desc: 'Sign in to the dashboard, paste a Git URL, and pick a branch. Nixpacks detects your stack.',
    icon: GitBranch,
  },
  {
    n: '03',
    title: 'Authorize the CLI',
    desc: 'Run paas connect from your laptop, approve in the browser, and get a scoped agent token.',
    icon: Rocket,
  },
  {
    n: '04',
    title: 'Deploy with your editor',
    desc: 'Run paas setup for MCP. Ask Cursor or Claude Code to list apps, redeploy, or ship from Git.',
    icon: Cpu,
  },
];

function HowItWorks() {
  return (
    <section className="relative py-10 bg-fd-background">
      <div className="mx-auto max-w-[1268px] px-4 py-16 sm:px-9 sm:py-20 xl:px-12">
        <div className="grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#66758e] dark:text-[#9a9a9f]">How it works</p>
            <h2 className="bp-display text-[clamp(2rem,7.8vw,2.35rem)] font-normal leading-[1.16] tracking-[-0.035em] text-[#121722] lg:text-[clamp(1.7rem,2.6vw,2.7rem)] dark:text-[#f4f4f5]">
              From VPS install to AI-managed deploys
            </h2>
            <p className="mt-5 text-[clamp(0.82rem,3.35vw,1rem)] font-light leading-[1.42] tracking-[-0.006em] text-[#394355] sm:text-[clamp(1rem,4.1vw,1.2rem)] sm:leading-[1.48] lg:text-[clamp(0.8rem,1.1vw,1.07rem)] dark:text-[#dfdfe2]">
              Install the control plane, connect Git, authorize your laptop, then manage deploys from
              the dashboard or your AI tools.
            </p>
            <Link
              href="/docs/guides/paas-cli"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium hover:underline"
            >
              paas CLI quickstart
              <ArrowRight className="size-4" />
            </Link>
          </div>

        <div className="relative order-2 w-full">
          <div 
            className="relative flex w-full items-stretch justify-center overflow-hidden rounded-md px-3 py-4.5 shadow-none sm:px-9 sm:py-9"
            style={{
              background: 'linear-gradient(134deg, #d9e1ff 0%, #7197ff 20%, #4c69ff 48%, #3035d5 100%)',
            }}
          >
            {/* Soft sky-blue/mystic-blue radial glow in the top-left */}
            <div 
              className="pointer-events-none absolute -bottom-24 -left-20 size-[31rem] rounded-full opacity-35 dark:opacity-75 blur-[72px]"
              style={{ background: '#eef1ff' }}
            />
            
            {/* Soft indigo/purple glow in the bottom-right */}
            <div 
              className="pointer-events-none absolute -right-28 -top-20 size-[33rem] rounded-full opacity-20 dark:opacity-45 blur-[82px]"
              style={{ background: '#2538d8' }}
            />

            {/* Radial highlight in center */}
            <div 
              className="pointer-events-none absolute inset-0 opacity-15 dark:opacity-35 mix-blend-soft-light"
              style={{
                background: 'radial-gradient(circle at 9% 84%, #ffffff 0%, transparent 36%)',
              }}
            />

            {/* Timeline Flow Inside Card */}
            <div className="relative w-full max-w-[500px] rounded-[0.85rem] bg-[#f8fbff]/92 p-3 sm:max-w-[518px] sm:rounded-[0.675rem] sm:px-6 sm:py-6 xl:max-w-[540px] dark:bg-[#050505]/90 dark:shadow-[0_15px_52px_-21px_rgba(0,0,0,0.95)]">
              <div className="relative flex flex-col gap-4">
                {/* Vertical timeline connector line */}
                <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-fd-primary/35 via-fd-primary/10 to-transparent sm:left-[23px]" />

                {steps.map((s, i) => (
                  <div key={s.n} className="relative pl-14 sm:pl-16 group">
                    {/* Circular icon badge */}
                    <div className="absolute left-0 top-1.5 z-10 flex size-10 items-center justify-center rounded-full border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] text-black dark:text-white shadow-sm sm:size-12">
                      <s.icon className="size-4.5 sm:size-5" />
                    </div>

                    {/* Card Container */}
                    <div className="relative overflow-hidden flex flex-col rounded-[0.75rem] bg-white/60 p-3 sm:py-3.5 sm:px-4.5 border border-black/5 dark:border-white/10 dark:bg-white/[0.03] transition-all duration-300 hover:bg-white/80 dark:hover:bg-white/[0.06]">
                      <div className="relative z-10">
                        <span className="inline-flex rounded-full bg-fd-primary/10 px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-fd-primary sm:text-[9.5px]">
                          Step {s.n}
                        </span>
                        <h3 className="mt-1 text-sm font-semibold tracking-[-0.01em] text-[#121722] sm:text-[0.95rem] dark:text-[#f4f4f5]">
                          {s.title}
                        </h3>
                        <p className="mt-1 text-[11px] font-light leading-snug text-[#394355] sm:text-[12.5px] dark:text-[#929297]">
                          {s.desc}
                        </p>
                      </div>
                      <BorderBeam
                        duration={8}
                        size={100}
                        colorFrom="var(--color-fd-primary)"
                        colorTo="transparent"
                        className="opacity-0 group-hover:opacity-30 transition-opacity"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════  Integrations  ═══════════════════════════ */

function Integrations() {
  return (
    <section className="relative py-10 bg-fd-background">
      <div className="mx-auto max-w-[1268px] px-4 py-16 sm:px-9 md:py-20 xl:px-12">
        <div className="grid items-center gap-16 sm:grid-cols-2">
          <div className="relative order-2 lg:order-1 w-full">
            <div 
              className="relative flex min-h-[220px] sm:min-h-[clamp(315px,54vh,510px)] w-full items-center justify-center overflow-hidden rounded-md px-3 py-4.5 shadow-none sm:px-9 sm:py-9 lg:min-h-[clamp(375px,57vh,540px)]"
              style={{
                background: 'linear-gradient(134deg, #d9e1ff 0%, #7197ff 20%, #4c69ff 48%, #3035d5 100%)',
              }}
            >
              {/* Soft sky-blue/mystic-blue radial glow in the top-left */}
              <div 
                className="pointer-events-none absolute -bottom-24 -left-20 size-[31rem] rounded-full opacity-35 dark:opacity-75 blur-[72px]"
                style={{ background: '#eef1ff' }}
              />
              
              {/* Soft indigo/purple glow in the bottom-right */}
              <div 
                className="pointer-events-none absolute -right-28 -top-20 size-[33rem] rounded-full opacity-20 dark:opacity-45 blur-[82px]"
                style={{ background: '#2538d8' }}
              />

              {/* Radial highlight in center */}
              <div 
                className="pointer-events-none absolute inset-0 opacity-15 dark:opacity-35 mix-blend-soft-light"
                style={{
                  background: 'radial-gradient(circle at 9% 84%, #ffffff 0%, transparent 36%)',
                }}
              />

              {/* Integration Tiles Inside Card */}
              <div className="relative flex items-center justify-center w-full max-w-[500px] rounded-[0.85rem] bg-[#f8fbff]/92 p-3 sm:max-w-[518px] sm:rounded-[0.675rem] sm:px-7 sm:py-10 xl:max-w-[540px] dark:bg-[#050505]/90 dark:shadow-[0_15px_52px_-21px_rgba(0,0,0,0.95)]">
                <div className="relative mx-auto w-fit">
                  <div className="mx-auto mb-1.5 sm:mb-2 flex w-fit justify-center gap-1.5 sm:gap-2">
                    <IntegrationCard className="bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 shadow-sm">
                      <DockerLogo className="size-6.5 sm:size-8" />
                    </IntegrationCard>
                    <IntegrationCard className="bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 shadow-sm">
                      <NixLogo className="size-6.5 sm:size-8" />
                    </IntegrationCard>
                  </div>
                  <div className="mx-auto my-1.5 sm:my-2 flex w-fit justify-center gap-1.5 sm:gap-2">
                    <IntegrationCard className="bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 shadow-sm">
                      <CaddyLogo className="size-6.5 sm:size-8" />
                    </IntegrationCard>
                    <IntegrationCard
                      borderClassName="shadow-fd-primary/10 shadow-xl border-fd-primary/30 dark:border-fd-primary/30"
                      className="bg-fd-primary/10 border border-fd-primary/20"
                    >
                      <LogoMark className="size-6.5 sm:size-8" />
                    </IntegrationCard>
                    <IntegrationCard className="bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 shadow-sm">
                      <NextjsLogo className="size-6.5 sm:size-8" />
                    </IntegrationCard>
                  </div>

                  <div className="mx-auto flex w-fit justify-center gap-1.5 sm:gap-2">
                    <IntegrationCard className="bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 shadow-sm">
                      <Database className="size-6.5 sm:size-8 text-[#121722] dark:text-white" />
                    </IntegrationCard>
                    <IntegrationCard className="bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 shadow-sm">
                      <GitBranch className="size-6.5 sm:size-8 text-[#121722] dark:text-white" />
                    </IntegrationCard>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-6 max-w-lg space-y-6 text-center sm:mt-0 sm:text-left order-1 lg:order-2">
            <p className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#66758e] dark:text-[#9a9a9f]">Integrations</p>
            <h2 className="bp-display text-[clamp(2rem,7.8vw,2.35rem)] font-normal leading-[1.16] tracking-[-0.035em] text-[#121722] lg:text-[clamp(1.7rem,2.6vw,2.7rem)] dark:text-[#f4f4f5]">
              Works with your existing stack
            </h2>
            <p className="font-light leading-relaxed text-[#394355] dark:text-[#dfdfe2]">
              Better-PaaS builds your code with Nixpacks, runs it via Docker, and manages certificates and routing automatically with Caddy. No lock-in, just open standards.
            </p>
            <Link
              href="/docs#whats-under-the-hood"
              className="inline-flex h-9 items-center gap-2 rounded-lg hover:underline text-xs font-medium"
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
    <div className={cn('bg-fd-card relative flex size-16 sm:size-20 rounded-[0.85rem] items-center justify-center border border-fd-border shadow-[0_16px_45px_-32px_rgba(23,44,92,0.45)]', className)}>
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
    title: 'Scoped agent tokens',
    desc: 'AI tools and CI get their own credentials with fixed permissions - not your admin password.',
  },
  {
    icon: ShieldCheck,
    title: 'Audit logs',
    desc: 'Every agent action is recorded with scope, timestamp, and resource so you can review what ran.',
  },
  {
    icon: HardDrive,
    title: 'Encryption at rest',
    desc: 'Deploy tokens and secrets are AES-256-GCM encrypted before they touch the database.',
  },
  {
    icon: Gauge,
    title: 'Brute-force lockout',
    desc: 'Repeated bad tokens trigger escalating per-IP lockout, so guessing is infeasible.',
  },
];

function Security() {
  return (
    <section className="relative py-10 bg-fd-background">
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
            path - you don’t have to be a security expert to run it well.
          </p>
          <ul className="mt-6 space-y-2.5">
            {['Scoped tokens for AI tools and CI', 'Admin password stays on the server', 'Audited, open source control plane'].map(
              (item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-fd-muted-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full ">
                    <Check className="size-3" />
                  </span>
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>

        <div className="relative order-2 w-full">
          <div 
            className="relative flex min-h-[220px] sm:min-h-[clamp(315px,54vh,510px)] w-full items-center justify-center overflow-hidden rounded-md px-3 py-4.5 shadow-none sm:px-9 sm:py-9 lg:min-h-[clamp(375px,57vh,540px)]"
            style={{
              background: 'linear-gradient(134deg, #d9e1ff 0%, #7197ff 20%, #4c69ff 48%, #3035d5 100%)',
            }}
          >
            {/* Soft sky-blue/mystic-blue radial glow in the top-left */}
            <div 
              className="pointer-events-none absolute -bottom-24 -left-20 size-[31rem] rounded-full opacity-35 dark:opacity-75 blur-[72px]"
              style={{ background: '#eef1ff' }}
            />
            
            {/* Soft indigo/purple glow in the bottom-right */}
            <div 
              className="pointer-events-none absolute -right-28 -top-20 size-[33rem] rounded-full opacity-20 dark:opacity-45 blur-[82px]"
              style={{ background: '#2538d8' }}
            />

            {/* Radial highlight in center */}
            <div 
              className="pointer-events-none absolute inset-0 opacity-15 dark:opacity-35 mix-blend-soft-light"
              style={{
                background: 'radial-gradient(circle at 9% 84%, #ffffff 0%, transparent 36%)',
              }}
            />

            {/* Security Points Inside Card */}
            <div className="relative w-full max-w-[500px] rounded-[0.85rem] bg-[#f8fbff]/92 p-3 sm:max-w-[518px] sm:rounded-[0.675rem] sm:px-7 sm:py-6 xl:max-w-[540px] dark:bg-[#050505]/90 dark:shadow-[0_15px_52px_-21px_rgba(0,0,0,0.95)]">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                {securityPoints.map((p, i) => (
                  <div 
                    key={p.title} 
                    className="relative overflow-hidden group rounded-[0.75rem] bg-white/60 p-3 sm:p-5 border border-black/5 dark:border-white/10 dark:bg-white/[0.03] transition-all duration-300 hover:bg-white/80 dark:hover:bg-white/[0.06]"
                  >
                    <p.icon className="size-4 sm:size-5 text-black dark:text-white" />
                    <h3 className="mt-2.5 text-[11px] sm:text-sm font-semibold leading-tight text-[#121722] dark:text-[#f4f4f5]">
                      {p.title}
                    </h3>
                    <p className="mt-1 text-[9.5px] sm:text-[11.5px] leading-normal sm:leading-relaxed text-[#394355] dark:text-[#929297]">
                      {p.desc}
                    </p>
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
        </div>
      </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════  Pricing  ═══════════════════════════════ */

function Pricing() {
  return (
    <section id="pricing" className="bg-fd-background">
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

        <div 
          className="relative flex w-full items-center justify-center overflow-hidden rounded-md px-3.5 py-4.5 shadow-none sm:px-9 sm:py-9 lg:px-9 lg:py-9 mt-14"
          style={{
            background: 'linear-gradient(134deg, #d9e1ff 0%, #7197ff 20%, #4c69ff 48%, #3035d5 100%)',
          }}
        >
          {/* Soft sky-blue/mystic-blue radial glow in the top-left */}
          <div 
            className="pointer-events-none absolute -bottom-24 -left-20 size-[31rem] rounded-full opacity-35 dark:opacity-75 blur-[72px]"
            style={{ background: '#eef1ff' }}
          />
          
          {/* Soft indigo/purple glow in the bottom-right */}
          <div 
            className="pointer-events-none absolute -right-28 -top-20 size-[33rem] rounded-full opacity-20 dark:opacity-45 blur-[82px]"
            style={{ background: '#2538d8' }}
          />

          {/* Radial highlight in center */}
          <div 
            className="pointer-events-none absolute inset-0 opacity-15 dark:opacity-35 mix-blend-soft-light"
            style={{
              background: 'radial-gradient(circle at 9% 84%, #ffffff 0%, transparent 36%)',
            }}
          />

          {/* Parent Translucent Card */}
          <div className="relative w-full rounded-[0.85rem] bg-[#f8fbff]/92 p-3 sm:p-7 xl:p-8 dark:bg-[#050505]/90 dark:shadow-[0_15px_52px_-21px_rgba(0,0,0,0.95)] shadow-[0_15px_52px_-21px_rgba(23,44,92,0.55)]">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              {/* Card 1 - Self-hosted */}
              <div className="relative overflow-hidden group rounded-[0.85rem] p-5 sm:p-8 bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 transition-all duration-300 hover:bg-white/80 dark:hover:bg-white/[0.06]">
                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <IconTile>
                        <LogoMark className="size-5" />
                      </IconTile>
                      <h3 className="mt-5 text-2xl font-semibold text-[#121722] dark:text-[#f4f4f5]">
                        Self-hosted
                      </h3>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-[#394355] dark:text-[#929297]">
                        Install it on your VPS, home lab, or private cloud. You own the app,
                        data, credentials, and runtime.
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <div className="bp-display text-6xl font-semibold text-[#121722] dark:text-[#f4f4f5]">$0</div>
                      <p className="mt-1 text-sm font-medium text-[#394355] dark:text-[#929297]">
                        Free to use
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {[
                      'Unlimited apps on your hardware',
                      'Git deploys, HTTPS, logs, shell',
                      'Scoped agent tokens and MCP tools',
                      'Databases, volumes, backups',
                      'No platform markup or seat pricing',
                      'No vendor lock-in',
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2.5 text-sm text-[#394355] dark:text-[#929297]">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-black/5 dark:border-white/10 bg-white/80 dark:bg-[#1a1a1a]">
                          <Check className="size-3 text-black dark:text-white" />
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

              {/* Card 2 - Managed */}
              <div className="relative overflow-hidden group rounded-[0.85rem] p-5 sm:p-8 bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 transition-all duration-300 hover:bg-white/80 dark:hover:bg-white/[0.06]">
                <div className="relative z-10 flex h-full flex-col justify-between gap-10">
                  <div>
                    <span className="inline-flex rounded-full border border-black/5 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] px-3 py-1 text-xs font-medium text-[#121722] dark:text-[#f4f4f5]">
                      Coming soon
                    </span>
                    <h3 className="mt-5 text-2xl font-semibold text-[#121722] dark:text-[#f4f4f5]">
                      Managed {appName}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#394355] dark:text-[#929297]">
                      We will host and maintain the {appName} control plane for you. You still
                      connect and manage your own servers, so workloads stay on infrastructure you
                      control.
                    </p>
                  </div>
                  <div className="border-t border-black/5 dark:border-white/10 pt-5">
                    <p className="text-sm font-medium text-[#121722] dark:text-[#f4f4f5]">Price announced later</p>
                    <p className="mt-1 text-sm text-[#394355] dark:text-[#929297]">
                      Built for teams that want less maintenance without giving up server ownership.
                    </p>
                  </div>
                </div>
                <BorderBeam
                  duration={12}
                  size={180}
                  colorFrom="var(--color-fd-primary)"
                  colorTo="transparent"
                  className="opacity-0 transition-opacity group-hover:opacity-30"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

