import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { Eyebrow, IconTile } from '@/components/landing/primitives';
import { BorderBeam } from '@/components/tailark/border-beam';
import { LogoMark } from '@/components/logo';
import { appName } from '@/lib/shared';
import { FAQSection } from '@/components/landing/faq';

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
      <section className="relative mx-auto max-w-[1268px] px-4 py-12 sm:px-9 xl:px-12">
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
                      'Databases, volumes, backups',
                      'No platform markup or seat pricing',
                      'No request limits or egress charges',
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
      </section>

      <FAQSection />
    </main>
  );
}
