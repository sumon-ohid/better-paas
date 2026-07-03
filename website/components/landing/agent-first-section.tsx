import Link from 'next/link';
import { ArrowRight, KeyRound, Monitor, Plug } from 'lucide-react';
import { AgentDeployDemo } from '@/components/landing/agent-deploy-demo';

const highlights = [
  { icon: Monitor, title: 'Status, logs, and deploys from the editor' },
  { icon: Plug, title: 'MCP tools wired to your VPS' },
  { icon: KeyRound, title: 'Scoped tokens - no admin key on your laptop' },
];

export function AgentFirstSection() {
  return (
    <section id="agents" className="relative overflow-hidden bg-fd-background py-10">
      <div className="mx-auto grid max-w-[1268px] grid-cols-1 gap-7 px-4 pb-7 pt-16 sm:px-9 sm:py-8 lg:grid-cols-[minmax(270px,0.55fr)_minmax(0,1.02fr)] lg:items-center lg:gap-9 lg:px-9 lg:py-9 xl:px-12">
        <div className="order-1 max-w-[400px] lg:pl-1.5">
          <p className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#66758e] dark:text-[#9a9a9f]">
            Agent-first
          </p>
          <h2 className="bp-display text-[clamp(2rem,7.8vw,2.35rem)] font-normal leading-[1.16] tracking-[-0.035em] text-[#121722] lg:text-[clamp(1.7rem,2.6vw,2.7rem)] dark:text-[#f4f4f5]">
            Ask. Inspect. Ship.
          </h2>
          <p className="mt-4 text-base font-light leading-relaxed text-[#394355] dark:text-[#dfdfe2]">
            Connect with{' '}
            <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/10">
              paas connect
            </code>
            . Check status, tail logs, and deploy from Cursor or Claude Code - no dashboard hopping.
          </p>

          <ul className="mt-6 space-y-3">
            {highlights.map((item) => (
              <li key={item.title} className="flex items-center gap-2.5 text-sm text-[#394355] dark:text-[#dfdfe2]">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-black/5 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]">
                  <item.icon className="size-3.5 text-[#121722] dark:text-white" />
                </span>
                {item.title}
              </li>
            ))}
          </ul>

          <Link
            href="/docs/guides/paas-cli"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#121722] transition-colors hover:underline dark:text-[#f4f4f5]"
          >
            Set up MCP
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="relative order-2 w-full">
          <div
            className="relative flex h-[520px] w-full items-center justify-center overflow-hidden rounded-md px-3.5 py-5 sm:px-8 sm:py-8"
            style={{
              background:
                'linear-gradient(134deg, #d9e1ff 0%, #7197ff 20%, #4c69ff 48%, #3035d5 100%)',
            }}
          >
            <AgentDeployDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
