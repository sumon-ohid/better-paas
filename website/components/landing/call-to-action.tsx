import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LogoMark } from '@/components/logo';
import { GithubIcon } from '@/components/landing/github-icon';
import { githubUrl } from '@/lib/shared';

export function LandingCallToAction() {
  return (
    <section className="bg-fd-background">
      <div className="mx-auto max-w-[1268px] px-4 py-16 sm:px-9 md:py-20 xl:px-12">
        <div
          className="relative flex min-h-[clamp(360px,52svh,520px)] w-full items-center justify-center overflow-hidden rounded-md px-5 py-8 shadow-none sm:px-9 sm:py-12"
          style={{
            background: 'linear-gradient(134deg, #d9e1ff 0%, #7197ff 20%, #4c69ff 48%, #3035d5 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute -bottom-24 -left-20 size-[31rem] rounded-full opacity-35 blur-[72px] dark:opacity-75"
            style={{ background: '#eef1ff' }}
          />
          <div
            className="pointer-events-none absolute -right-28 -top-20 size-[33rem] rounded-full opacity-20 blur-[82px] dark:opacity-45"
            style={{ background: '#2538d8' }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-15 mix-blend-soft-light dark:opacity-35"
            style={{ background: 'radial-gradient(circle at 9% 84%, #ffffff 0%, transparent 36%)' }}
          />

          <div className="relative w-full max-w-[720px] overflow-hidden rounded-[0.85rem] bg-[#f8fbff]/92 px-4 py-10 text-center shadow-[0_15px_52px_-21px_rgba(23,44,92,0.55)] sm:px-10 sm:py-12 dark:bg-[#050505]/90 dark:shadow-[0_15px_52px_-21px_rgba(0,0,0,0.95)]">
            <div className="relative z-10 flex flex-col items-center">
              <LogoMark className="size-10" />
              <p className="mt-6 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#66758e] dark:text-[#9a9a9f]">
                Start shipping
              </p>
              <h2 className="bp-display mt-3 max-w-2xl text-[clamp(2rem,7.8vw,2.8rem)] font-normal leading-[1.08] tracking-[-0.035em] text-[#121722] dark:text-[#f4f4f5]">
                Your VPS. Your agents. Your deploys.
              </h2>
              <p className="bp-balance mt-5 max-w-xl text-[clamp(0.92rem,3.2vw,1.1rem)] font-light leading-[1.5] tracking-[-0.006em] text-[#394355] dark:text-[#dfdfe2]">
                Install on a $5 VPS, connect with{' '}
                <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/10">
                  paas connect
                </code>
                , and manage deploys from your editor. Free, open source, yours forever.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
                <Link
                  href="/docs/guides/paas-cli"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-[#121722] px-6 text-sm font-medium text-white transition-colors hover:bg-[#26364d] dark:bg-[#f4f4f5] dark:text-[#080809] dark:hover:bg-white"
                >
                  Get started with the CLI
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/docs/quickstart"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-fd-border bg-fd-card/70 px-5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-card dark:bg-white/[0.055] dark:hover:bg-white/[0.09]"
                >
                  Install on a VPS
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
