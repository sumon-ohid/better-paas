import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { Eyebrow, IconTile } from '@/components/landing/primitives';
import { BorderBeam } from '@/components/tailark/border-beam';
import { LogoMark } from '@/components/logo';
import { appName } from '@/lib/shared';

export const metadata: Metadata = {
  title: 'Pricing | Better-PaaS',
  description:
    'Better-PaaS is free to self-host on your own servers. Simple, transparent pricing for teams and enterprise plans.',
};

export default function PricingPage() {
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
      <section className="relative mx-auto max-w-6xl px-6 pt-24 pb-8 sm:pt-32 text-center">
        <Eyebrow className="justify-center">Pricing</Eyebrow>
        <h1 className="bp-display mt-6 text-4xl font-semibold sm:text-5xl md:text-6xl tracking-tight text-fd-foreground">
          Free to self-host<span className="text-fd-primary">.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-md leading-relaxed text-fd-muted-foreground">
          Run {appName} on your own servers for free. A managed control plane is coming soon for teams
          who want us to operate {appName} while they keep control of their servers.
        </p>
      </section>

      {/* Pricing Cards Grid */}
      <section className="relative mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Self-hosted Card */}
          <div className="bp-card group relative overflow-hidden rounded-3xl p-7 sm:p-8 border border-fd-border bg-fd-card/40 hover:bg-fd-card/70 transition-all duration-300">
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
                    Install it on your VPS, home lab, or private cloud. You own the app, data, credentials, and runtime.
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

          {/* Managed Card */}
          <div className="bp-card group relative overflow-hidden rounded-3xl p-7 sm:p-8 border border-fd-border bg-fd-card/40 hover:bg-fd-card/70 transition-all duration-300">
            <div className="relative z-10 flex h-full flex-col justify-between gap-10">
              <div>
                <span className="inline-flex rounded-full border border-fd-border px-3 py-1 text-xs font-medium text-fd-muted-foreground">
                  Coming soon
                </span>
                <h3 className="mt-5 text-2xl font-semibold text-fd-foreground">
                  Managed {appName}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">
                  We will host and maintain the {appName} control plane for you. You still connect and manage your own servers, so workloads stay on infrastructure you control.
                </p>
              </div>
              <div className="border-t border-fd-border pt-5">
                <p className="text-sm font-medium text-fd-foreground">Price announced later</p>
                <p className="mt-1 text-sm text-fd-muted-foreground">
                  Built for teams that want less maintenance without giving up server ownership.
                </p>
              </div>
            </div>
            <BorderBeam
              duration={12}
              size={180}
              colorFrom="var(--color-fd-primary)"
              colorTo="transparent"
              className="opacity-0 group-hover:opacity-30 transition-opacity"
            />
          </div>
        </div>
      </section>

      {/* FAQ or Bottom Info section */}
      <section className="relative mx-auto max-w-4xl px-6 py-12 text-center">
        <h3 className="text-xl font-semibold text-fd-foreground">Have questions about self-hosting?</h3>
        <p className="mt-2 text-sm text-fd-muted-foreground">
          Check out our documentation for system requirements, detailed configurations, and step-by-step guides.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <a
            href="/docs"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-fd-foreground text-fd-background px-6 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            Read Docs
          </a>
          <a
            href="/docs/quickstart"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-fd-border bg-fd-card px-6 text-sm font-semibold text-fd-foreground transition-colors hover:bg-fd-accent"
          >
            Quickstart Guide
          </a>
        </div>
      </section>
    </main>
  );
}
