import Link from 'next/link';
import { ArrowRight, Bot, KeyRound, Plug, Shield } from 'lucide-react';
import { appName } from '@/lib/shared';

const highlights = [
  {
    icon: KeyRound,
    title: 'Scoped agent tokens',
    desc: 'Separate credentials for Cursor, Claude Code, and CI - revocable, audited, never your admin password.',
  },
  {
    icon: Plug,
    title: 'MCP built in',
    desc: 'paas setup registers tools so your editor can list apps, deploy, redeploy, and read logs.',
  },
  {
    icon: Shield,
    title: 'Least privilege',
    desc: 'Observer, Deployer, or Operator profiles - pick what the agent needs, nothing more.',
  },
];

export function AgentFirstSection() {
  return (
    <section id="agents" className="relative overflow-hidden bg-fd-background py-10">
      <div className="mx-auto grid max-w-[1268px] grid-cols-1 gap-7 px-4 pb-7 pt-16 sm:px-9 sm:py-8 lg:grid-cols-[minmax(270px,0.55fr)_minmax(0,1.02fr)] lg:items-center lg:gap-9 lg:px-9 lg:py-9 xl:px-12">
        <div className="order-1 max-w-[443px] lg:pl-1.5">
          <p className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#66758e] dark:text-[#9a9a9f]">
            Agent-first
          </p>
          <h2 className="bp-display text-[clamp(2rem,7.8vw,2.35rem)] font-normal leading-[1.16] tracking-[-0.035em] text-[#121722] lg:text-[clamp(1.7rem,2.6vw,2.7rem)] dark:text-[#f4f4f5]">
            Manage deploys from your editor
          </h2>
          <p className="mt-5 text-[clamp(0.82rem,3.35vw,1rem)] font-light leading-[1.42] tracking-[-0.006em] text-[#394355] sm:text-[clamp(1rem,4.1vw,1.2rem)] sm:leading-[1.48] lg:mt-5 lg:text-[clamp(0.8rem,1.1vw,1.07rem)] dark:text-[#dfdfe2]">
            {appName} is built for humans and agents. Install on your VPS, run{' '}
            <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/10">
              paas connect
            </code>
            , authorize in the browser, and let Cursor or Claude Code deploy without copying
            admin tokens to your laptop.
          </p>

          <ul className="mt-8 space-y-4">
            {highlights.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-black/5 bg-white/60 dark:border-white/10 dark:bg-white/[0.03]">
                  <item.icon className="size-4 text-[#121722] dark:text-white" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#121722] dark:text-[#f4f4f5]">{item.title}</p>
                  <p className="mt-0.5 text-sm font-light leading-relaxed text-[#394355] dark:text-[#929297]">
                    {item.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <Link
            href="/docs/guides/paas-cli"
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[#121722] transition-colors hover:underline dark:text-[#f4f4f5]"
          >
            Read the CLI guide
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="relative order-2 w-full">
          <div
            className="relative flex w-full items-center justify-center overflow-hidden rounded-md px-3.5 py-4.5 shadow-none sm:px-9 sm:py-9"
            style={{
              background:
                'linear-gradient(134deg, #d9e1ff 0%, #7197ff 20%, #4c69ff 48%, #3035d5 100%)',
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

            <div className="relative w-full max-w-[540px] rounded-[0.85rem] bg-[#f8fbff]/92 p-4 sm:p-6 dark:bg-[#050505]/90 dark:shadow-[0_15px_52px_-21px_rgba(0,0,0,0.95)]">
              <div className="mb-4 flex items-center gap-2 border-b border-black/5 pb-3 dark:border-white/10">
                <Bot className="size-4 text-[#4c69ff]" />
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-[#66758e] dark:text-[#9a9a9f]">
                  Laptop → your VPS
                </span>
              </div>

              <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-[#121722] sm:text-xs dark:text-[#eceff5]">
                <code>{`$ go install github.com/sumon-ohid/better-paas/backend/cmd/paas@latest
$ paas connect https://paas.example.com
Opening browser to authorize…
Connected. Profile: deployer

$ paas setup
MCP configured for Cursor and Claude Code

# In your editor:
"List my Better-PaaS apps"
"Redeploy my-api and show the last 100 log lines"
"Deploy https://github.com/me/app as staging from main"`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
