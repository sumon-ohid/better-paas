import type { Metadata } from 'next';
import { GitBranch, ShieldCheck, Database, Zap, Cpu, Lock, ArrowRight, Server, Globe } from 'lucide-react';
import { Eyebrow, IconTile } from '@/components/landing/primitives';
import { BorderBeam } from '@/components/tailark/border-beam';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Platform Features & Core Capabilities | Better-PaaS',
  description:
    'Discover Better-PaaS features. Simplify app deployment with auto git-push builds, managed databases, zero-downtime deployments, and free automatic HTTPS on your own VPS.',
};

export default function PlatformPage() {
  return (
    <main className="flex flex-1 flex-col relative min-h-screen bg-fd-background text-fd-foreground">
      {/* Background radial glow */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none opacity-[0.15] dark:opacity-[0.25]"
        style={{
          background: 'radial-gradient(ellipse 50% 50% at 50% 0%, var(--color-fd-primary) 0%, transparent 100%)',
        }}
      />

      {/* Hero Header */}
      <section className="relative mx-auto max-w-6xl px-6 pt-24 pb-8 sm:pt-32 text-center" id="hero-section">
        <Eyebrow className="justify-center">The Platform</Eyebrow>
        <h1 className="bp-display mt-6 text-4xl font-semibold sm:text-5xl md:text-6xl tracking-tight text-fd-foreground">
          PaaS power on your own server<span className="text-fd-primary">.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-fd-muted-foreground">
          Better-PaaS is a self-hosted platform-as-a-service. It behaves like Heroku, Render, or Netlify, but runs entirely on your own virtual private server (VPS). Get 100% control, privacy, and zero platform markups.
        </p>
      </section>

      {/* Visual Workflow Section */}
      <section className="relative mx-auto max-w-5xl px-6 py-12" id="workflow-section">
        <h2 className="text-center text-2xl font-bold mb-10 text-fd-foreground">How it works (in 3 simple steps)</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Connect Git',
              desc: 'Point Better-PaaS to your GitHub repository. It works with Node.js, Go, Python, Rust, and more.',
              icon: GitBranch,
            },
            {
              step: '02',
              title: 'Automatic Build',
              desc: 'We automatically detect your language and framework, compile it securely, and prepare the container.',
              icon: Zap,
            },
            {
              step: '03',
              title: 'Live with SSL',
              desc: 'Your app goes live instantly with automated SSL certificates, ready to receive web traffic.',
              icon: Globe,
            },
          ].map((item, idx) => (
            <div key={idx} className="bp-card relative overflow-hidden flex flex-col justify-between rounded-2xl p-6 border border-fd-border/60 bg-fd-card/25">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-mono font-bold text-fd-primary/30">{item.step}</span>
                  <item.icon className="size-5 text-fd-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-fd-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-fd-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Core Features Breakdown */}
      <section className="relative mx-auto max-w-6xl px-6 py-16" id="features-section">
        <h2 className="text-center text-3xl font-semibold mb-12 text-fd-foreground">Core Platform Capabilities</h2>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Zero-Downtime */}
          <div className="bp-card group relative overflow-hidden rounded-3xl p-8 border border-fd-border bg-fd-card/40 hover:bg-fd-card/70 transition-all duration-300">
            <div className="relative z-10">
              <IconTile className="bg-green-500/10 text-green-500">
                <Zap className="size-5" />
              </IconTile>
              <h3 className="mt-6 text-xl font-bold text-fd-foreground">Zero-Downtime Deployments</h3>
              <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">
                When you push updates to your application, your visitors won't notice a thing. We boot up the new version of your app in the background, perform health checks, switch the router traffic over automatically once healthy, and retire the old version safely.
              </p>
            </div>
            <BorderBeam
              duration={10}
              size={200}
              colorFrom="var(--color-fd-primary)"
              colorTo="transparent"
              className="opacity-0 group-hover:opacity-30 transition-opacity"
            />
          </div>

          {/* Managed Databases */}
          <div className="bp-card group relative overflow-hidden rounded-3xl p-8 border border-fd-border bg-fd-card/40 hover:bg-fd-card/70 transition-all duration-300">
            <div className="relative z-10">
              <IconTile className="bg-blue-500/10 text-blue-500">
                <Database className="size-5" />
              </IconTile>
              <h3 className="mt-6 text-xl font-bold text-fd-foreground">One-Click Managed Databases</h3>
              <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">
                Provision PostgreSQL, Redis, or MySQL containers with a single click. Better-PaaS automatically configures secure shared networks and auto-injects connection credentials to your applications. Managing databases has never been this simple.
              </p>
            </div>
            <BorderBeam
              duration={10}
              size={200}
              colorFrom="var(--color-fd-primary)"
              colorTo="transparent"
              className="opacity-0 group-hover:opacity-30 transition-opacity"
            />
          </div>

          {/* Automatic HTTPS */}
          <div className="bp-card group relative overflow-hidden rounded-3xl p-8 border border-fd-border bg-fd-card/40 hover:bg-fd-card/70 transition-all duration-300">
            <div className="relative z-10">
              <IconTile className="bg-amber-500/10 text-amber-500">
                <Globe className="size-5" />
              </IconTile>
              <h3 className="mt-6 text-xl font-bold text-fd-foreground">Automatic HTTPS & Domains</h3>
              <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">
                Just type in your custom domain name. Better-PaaS automatically obtains free SSL certificates from Let's Encrypt, configures secure routing, and handles automatic renewals. You never have to manually touch DNS certificates or routing configurations.
              </p>
            </div>
            <BorderBeam
              duration={10}
              size={200}
              colorFrom="var(--color-fd-primary)"
              colorTo="transparent"
              className="opacity-0 group-hover:opacity-30 transition-opacity"
            />
          </div>

          {/* Real-time Monitoring */}
          <div className="bp-card group relative overflow-hidden rounded-3xl p-8 border border-fd-border bg-fd-card/40 hover:bg-fd-card/70 transition-all duration-300">
            <div className="relative z-10">
              <IconTile className="bg-red-500/10 text-red-500">
                <Cpu className="size-5" />
              </IconTile>
              <h3 className="mt-6 text-xl font-bold text-fd-foreground">Real-time Metrics & Logs</h3>
              <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">
                Know exactly what's happening. Stream container logs in real time over WebSockets directly in your browser. Inspect live graphs for CPU and memory usage, and execute commands within your containers via the integrated, web-based secure shell terminal.
              </p>
            </div>
            <BorderBeam
              duration={10}
              size={200}
              colorFrom="var(--color-fd-primary)"
              colorTo="transparent"
              className="opacity-0 group-hover:opacity-30 transition-opacity"
            />
          </div>

          {/* Hardened Security */}
          <div className="bp-card group relative overflow-hidden rounded-3xl p-8 border border-fd-border bg-fd-card/40 hover:bg-fd-card/70 transition-all duration-300">
            <div className="relative z-10">
              <IconTile className="bg-purple-500/10 text-purple-500">
                <Lock className="size-5" />
              </IconTile>
              <h3 className="mt-6 text-xl font-bold text-fd-foreground">Secrets Encryption & Lockout</h3>
              <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">
                Security is built-in. Database secrets and Git credentials are encrypted at rest using AES-256-GCM before writing to storage. Failed login attempts trigger an automatic, escalating brute-force lockout window to protect your admin dashboard.
              </p>
            </div>
            <BorderBeam
              duration={10}
              size={200}
              colorFrom="var(--color-fd-primary)"
              colorTo="transparent"
              className="opacity-0 group-hover:opacity-30 transition-opacity"
            />
          </div>

          {/* Backups & Cron */}
          <div className="bp-card group relative overflow-hidden rounded-3xl p-8 border border-fd-border bg-fd-card/40 hover:bg-fd-card/70 transition-all duration-300">
            <div className="relative z-10">
              <IconTile className="bg-indigo-500/10 text-indigo-500">
                <Server className="size-5" />
              </IconTile>
              <h3 className="mt-6 text-xl font-bold text-fd-foreground">Scheduled Backups & Cron</h3>
              <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">
                Set up automated backups of your server configurations and databases to run on schedules. Run routine maintenance tasks, database migrations, or cleanup jobs inside your application containers automatically with standard Cron schedules.
              </p>
            </div>
            <BorderBeam
              duration={10}
              size={200}
              colorFrom="var(--color-fd-primary)"
              colorTo="transparent"
              className="opacity-0 group-hover:opacity-30 transition-opacity"
            />
          </div>
        </div>
      </section>

      {/* SEO Feature List / Call to action */}
      <section className="relative mx-auto max-w-4xl px-6 py-12 text-center" id="cta-section">
        <div className="bp-card rounded-3xl border border-fd-border bg-fd-card/10 p-8 sm:p-10 relative overflow-hidden group">
          <div className="relative z-10 flex flex-col items-center">
            <ShieldCheck className="size-12 text-fd-primary animate-pulse" />
            <h2 className="text-2xl font-bold mt-4 text-fd-foreground">Deploy your first app in 2 minutes</h2>
            <p className="mt-2 text-sm text-fd-muted-foreground leading-relaxed max-w-lg">
              Better-PaaS is free, open source, and lightweight. Run it on a cheap VPS and deploy as many applications as your server can hold.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 items-center">
              <Link
                href="/docs/quickstart"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-fd-foreground text-fd-background px-6 text-sm font-semibold transition-opacity hover:opacity-90 w-full sm:w-auto"
              >
                Quickstart Guide
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="https://github.com/sumon-ohid/better-paas"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-fd-border bg-fd-card px-6 text-sm font-semibold text-fd-foreground transition-colors hover:bg-fd-accent w-full sm:w-auto"
              >
                Star on GitHub
              </a>
            </div>
          </div>
          <BorderBeam
            duration={15}
            size={300}
            colorFrom="var(--color-fd-primary)"
            colorTo="transparent"
            className="opacity-0 group-hover:opacity-20 transition-opacity"
          />
        </div>
      </section>
    </main>
  );
}
