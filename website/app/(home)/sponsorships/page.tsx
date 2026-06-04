import type { Metadata } from 'next';
import { Coffee, Heart, Check, ArrowUpRight, Sparkles, Trophy } from 'lucide-react';
import { GithubIcon } from '@/components/landing/github-icon';
import { Eyebrow, IconTile } from '@/components/landing/primitives';
import { BorderBeam } from '@/components/tailark/border-beam';

export const metadata: Metadata = {
  title: 'Sponsorships | Better-PaaS',
  description:
    'Support the development of Better-PaaS, an open-source self-hosted platform-as-a-service. Sponsor us on GitHub or Buy Me a Coffee.',
};

export default function SponsorshipsPage() {
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
        <Eyebrow className="justify-center">Support Open Source</Eyebrow>
        <h1 className="bp-display mt-6 text-4xl font-semibold sm:text-5xl md:text-6xl tracking-tight text-fd-foreground">
          Sponsor Us<span className="text-fd-primary">.</span>
        </h1>
        <p className="mt-4 text-lg font-medium text-fd-primary/80">
          We love doing open-source projects. ❤️
        </p>
        <p className="mx-auto mt-6 max-w-3xl text-md leading-relaxed text-fd-muted-foreground">
          We are self-funded and depend on your support to sustain the project. This allows for a focus on
          real users (like you) rather than on investors or revenue. If you opt for our self-hosted
          version, you have the option to support our work through donations.
        </p>
      </section>

      {/* Sponsorship Cards Grid */}
      <section className="relative mx-auto max-w-4xl px-6 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          {/* GitHub Sponsors Card */}
          <a
            href="https://github.com/sponsors/sumon-ohid"
            target="_blank"
            rel="noopener noreferrer"
            className="bp-card group relative overflow-hidden flex flex-col justify-between rounded-3xl p-8 border border-fd-border bg-fd-card/40 hover:bg-fd-card/70 transition-all duration-300"
          >
            <div className="relative z-10">
              <div className="flex items-start justify-between">
                <IconTile>
                  <GithubIcon className="size-6 text-fd-foreground" />
                </IconTile>
                <ArrowUpRight className="size-5 text-fd-muted-foreground group-hover:text-fd-foreground transition-colors group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <h3 className="mt-6 text-2xl font-semibold text-fd-foreground flex items-center gap-2">
                GitHub Sponsors
                <span className="inline-flex items-center rounded-full bg-pink-500/10 px-2 py-0.5 text-xs font-medium text-pink-500">
                  <Heart className="mr-1 size-3 fill-pink-500" />
                  Sponsor
                </span>
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">
                Support our development monthly or with a one-time donation. GitHub doesn't charge any fees for sponsorships, so 100% of your support goes to the project.
              </p>
            </div>
            <div className="mt-8 relative z-10">
              <div className="flex items-center justify-center w-full rounded-xl bg-fd-foreground text-fd-background py-3 text-sm font-semibold transition-opacity group-hover:opacity-95">
                Sponsor on GitHub
              </div>
            </div>
            <BorderBeam
              duration={10}
              size={200}
              colorFrom="var(--color-fd-primary)"
              colorTo="transparent"
              className="opacity-0 group-hover:opacity-30 transition-opacity"
            />
          </a>

          {/* Buy Me A Coffee Card */}
          <a
            href="https://buymeacoffee.com/sfursumon"
            target="_blank"
            rel="noopener noreferrer"
            className="bp-card group relative overflow-hidden flex flex-col justify-between rounded-3xl p-8 border border-fd-border bg-fd-card/40 hover:bg-fd-card/70 transition-all duration-300"
          >
            <div className="relative z-10">
              <div className="flex items-start justify-between">
                <IconTile className="bg-amber-500/10 text-amber-500">
                  <Coffee className="size-6" />
                </IconTile>
                <ArrowUpRight className="size-5 text-fd-muted-foreground group-hover:text-fd-foreground transition-colors group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <h3 className="mt-6 text-2xl font-semibold text-fd-foreground flex items-center gap-2">
                Buy Me a Coffee
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500">
                  Coffee
                </span>
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">
                A simple and fast way to support our work without creating a GitHub account. Show your support by buying one or multiple coffees.
              </p>
            </div>
            <div className="mt-8 relative z-10">
              <div className="flex items-center justify-center w-full rounded-xl bg-[#FFDD00] text-black py-3 text-sm font-semibold transition-opacity group-hover:opacity-95">
                Buy us a coffee
              </div>
            </div>
            <BorderBeam
              duration={10}
              size={200}
              colorFrom="#FFDD00"
              colorTo="transparent"
              className="opacity-0 group-hover:opacity-30 transition-opacity"
            />
          </a>
        </div>
      </section>

      {/* Sponsor Perks Section */}
      <section className="relative mx-auto max-w-4xl px-6 py-8">
        <div className="bp-card rounded-3xl border border-fd-border bg-fd-card/10 p-8 sm:p-10 relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <IconTile size="sm" className="bg-fd-primary/10 text-fd-primary">
                <Trophy className="size-4" />
              </IconTile>
              <h3 className="text-xl font-bold text-fd-foreground">What sponsors get</h3>
            </div>
            <p className="mt-4 text-sm text-fd-muted-foreground leading-relaxed">
              Showcase your support to our growing developer community. Depending on your sponsorship level, you can promote your brand or service:
            </p>
            
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                {
                  tier: 'Small Logo',
                  desc: 'Featured in the GitHub README'
                },
                {
                  tier: 'Large Logo',
                  desc: 'Featured on the Better-PaaS landing page & docs'
                },
                {
                  tier: 'Huge Logo',
                  desc: 'Premium placement with link on front page & docs'
                }
              ].map((p, idx) => (
                <div key={idx} className="flex flex-col p-4 rounded-xl bg-fd-card/30 border border-fd-border/50">
                  <span className="text-sm font-semibold text-fd-foreground flex items-center gap-1.5">
                    <Check className="size-4 text-fd-primary shrink-0" />
                    {p.tier}
                  </span>
                  <span className="mt-1 text-xs text-fd-muted-foreground">{p.desc}</span>
                </div>
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-fd-muted-foreground">
              Get visibility for your brand across our landing page, documentation, and GitHub repository as the project grows.
            </p>
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

      {/* Who Is Behind This Section */}
      <section className="relative mx-auto max-w-3xl px-6 py-16 sm:py-24 text-center">
        <h2 className="bp-display text-3xl font-semibold sm:text-4xl text-fd-foreground">
          Who Is Behind This<span className="text-fd-primary">?</span>
        </h2>
        <p className="mt-2 text-md text-fd-muted-foreground">
          A one-person mission that grew into a community.
        </p>

        <div className="mt-10 p-8 rounded-3xl border border-fd-border/60 bg-fd-card/5 text-left relative overflow-hidden group">
          <div className="relative z-10 space-y-6 text-sm sm:text-base leading-relaxed text-fd-muted-foreground/90">
            <p className="font-semibold text-fd-foreground text-md flex items-center gap-1">
              Hey, I'm{' '}
              <a
                href="https://github.com/sumon-ohid"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-fd-primary underline-offset-4 hover:text-fd-foreground inline-flex items-center gap-0.5"
              >
                Sumon Ohid
                <ArrowUpRight className="size-3.5 inline text-fd-primary" />
              </a>
            </p>

            <p>
              I'm a software developer based in Vienna, Austria who is dedicated to building and improving open-source projects. I created <span className="text-fd-foreground font-medium">Better-PaaS</span> to solve the complexity of self-hosted application deployments. It bridges the gap between raw servers and expensive PaaS solutions.
            </p>

            <p>
              Better-PaaS is born out of a desire to make managing apps, databases, and agents simple, reliable, and accessible for everyone. I've been able to devote significant time to crafting and refining this platform.
            </p>

            <p>
              If you find Better-PaaS helpful, or if it has saved your team time and hosting costs, please think about making a donation or sponsoring.
            </p>

            <p className="text-fd-foreground font-medium border-l-2 border-fd-primary pl-3 bg-fd-primary/5 py-1 rounded-r-md">
              This guarantees that the project stays free, accessible, and continues to evolve, enabling me to dedicate focused time to adding features and enhancements.
            </p>

            <p>It provides significant long-term benefits to the entire self-hosting community!</p>

            <p className="font-medium text-fd-foreground">Thank you!</p>
          </div>
          <BorderBeam
            duration={20}
            size={400}
            colorFrom="var(--color-fd-primary)"
            colorTo="transparent"
            className="opacity-0 group-hover:opacity-10 transition-opacity"
          />
        </div>
      </section>
    </main>
  );
}
