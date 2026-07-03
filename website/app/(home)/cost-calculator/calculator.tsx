'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, Server, TrendingDown } from 'lucide-react';
import { appName, githubUrl } from '@/lib/shared';
import { GithubIcon } from '@/components/landing/github-icon';

const serverTiers = [
  { label: 'Hobby', price: 5, specs: '2 vCPU / 2 GB RAM' },
  { label: 'Growth', price: 10, specs: '2 vCPU / 4 GB RAM' },
  { label: 'Pro', price: 20, specs: '4 vCPU / 8 GB RAM' },
  { label: 'Power', price: 40, specs: '8 vCPU / 16 GB RAM' },
];

export function CostCalculator() {
  const [apps, setApps] = useState(1);
  const [visits, setVisits] = useState(10000);
  const [bandwidth, setBandwidth] = useState(50);
  const [team, setTeam] = useState(1);
  const [needsDatabase, setNeedsDatabase] = useState(true);
  const [serverTier, setServerTier] = useState(1);

  // Vercel estimate (conservative, approximate)
  let vercelBase = 0;
  let vercelProReason = '';

  const needsPro = team > 1 || bandwidth > 1000 || visits > 100000 || apps > 3;

  if (needsPro) {
    vercelBase = 20 * team;
    vercelProReason = 'Pro plan required for team, scale, or multiple apps';
  } else {
    vercelBase = 0;
    vercelProReason = 'Hobby plan may fit';
  }

  const bandwidthOverage = Math.max(0, bandwidth - 1000) * 0.4;
  const functionInvocations = visits * 5;
  const computeOverage = Math.max(0, functionInvocations - 1_000_000) * 0.00000015;
  const databaseCost = needsDatabase ? 20 : 0;

  const vercelTotal = vercelBase + bandwidthOverage + computeOverage + databaseCost;
  const selfHostedTotal = serverTiers[serverTier].price;
  const monthlySavings = vercelTotal - selfHostedTotal;
  const yearlySavings = monthlySavings * 12;

  return (
    <section className="mx-auto w-full max-w-4xl px-6 pb-24">
      <div className="rounded-2xl border border-fd-border bg-fd-card/20 p-6 sm:p-10">
        <div className="grid gap-8 sm:grid-cols-2">
          <RangeInput
            label="Number of apps"
            value={apps}
            min={1}
            max={20}
            step={1}
            onChange={setApps}
            suffix=""
          />
          <RangeInput
            label="Monthly visits"
            value={visits}
            min={1000}
            max={1_000_000}
            step={1000}
            onChange={setVisits}
            suffix=""
            formatter={(v) =>
              v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`
            }
          />
          <RangeInput
            label="Bandwidth (GB/month)"
            value={bandwidth}
            min={10}
            max={2000}
            step={10}
            onChange={setBandwidth}
            suffix=" GB"
          />
          <RangeInput
            label="Team members"
            value={team}
            min={1}
            max={10}
            step={1}
            onChange={setTeam}
            suffix=""
          />
        </div>

        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={needsDatabase}
              onChange={(e) => setNeedsDatabase(e.target.checked)}
              className="size-5 rounded border-fd-border bg-fd-background text-fd-primary focus:ring-fd-primary"
            />
            <span className="text-sm text-fd-foreground">Needs managed database</span>
          </label>

          <div className="flex items-center gap-3">
            <span className="text-sm text-fd-muted-foreground">VPS tier:</span>
            <select
              value={serverTier}
              onChange={(e) => setServerTier(Number(e.target.value))}
              className="rounded-lg border border-fd-border bg-fd-background px-3 py-2 text-sm text-fd-foreground focus:outline-none focus:ring-2 focus:ring-fd-primary"
            >
              {serverTiers.map((tier, i) => (
                <option key={tier.label} value={i}>
                  {tier.label} - {formatCurrency(tier.price)}/mo
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <CostCard
          icon={Calculator}
          label="Estimated Vercel cost"
          price={vercelTotal}
          subtext={vercelProReason}
          highlight={false}
        />
        <CostCard
          icon={Server}
          label={`${appName} on ${serverTiers[serverTier].label} VPS`}
          price={selfHostedTotal}
          subtext={serverTiers[serverTier].specs}
          highlight={false}
        />
        <CostCard
          icon={TrendingDown}
          label="Estimated monthly savings"
          price={monthlySavings}
          subtext={`${formatCurrency(yearlySavings)} per year`}
          highlight
        />
      </div>

      <div className="mt-8 rounded-2xl border border-fd-border bg-fd-card/15 p-6 text-sm leading-relaxed text-fd-muted-foreground">
        <p className="font-semibold text-fd-foreground">How this estimate works</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>
            Vercel Hobby is free but has limits. We flag Pro ($20/seat) when you have a team, more
            than 3 apps, more than 100k visits, or more than 1 TB bandwidth.
          </li>
          <li>Vercel bandwidth overage is estimated at $0.40/GB beyond 1 TB/month.</li>
          <li>
            Function execution is estimated at 5 invocations per visit, with overage beyond 1M
            invocations.
          </li>
          <li>
            Managed database is estimated at $20/month. With {appName}, databases run as containers
            on the same VPS.
          </li>
          <li>Self-hosted pricing is just your VPS cost. {appName} itself is free and open source.</li>
        </ul>
        <p className="mt-4">
          These are rough numbers. Use them for directional comparison, not exact budgeting.
        </p>
      </div>

      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/docs/quickstart"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-fd-foreground px-6 text-sm font-semibold text-fd-background transition-opacity hover:opacity-90"
        >
          Try {appName} free
          <ArrowRight className="size-4" />
        </Link>
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-fd-border bg-fd-card/40 px-5 text-sm font-semibold text-fd-foreground transition-colors hover:bg-fd-card"
        >
          <GithubIcon className="size-4" />
          Star on GitHub
        </a>
      </div>
    </section>
  );
}

/* ═════════════════════════  Components  ═══════════════════════════════ */

function RangeInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
  formatter,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  suffix: string;
  formatter?: (value: number) => string;
}) {
  const display = formatter ? formatter(value) : value.toLocaleString();

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-fd-foreground">{label}</label>
        <span className="text-sm font-semibold text-fd-primary">
          {display}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-fd-primary"
      />
    </div>
  );
}

function CostCard({
  icon: Icon,
  label,
  price,
  subtext,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  price: number;
  subtext: string;
  highlight: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        highlight
          ? 'border-fd-primary/30 bg-fd-primary/5'
          : 'border-fd-border bg-fd-card/20'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center">
          <Icon className="size-5 text-fd-muted-foreground" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fd-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-5 text-4xl font-semibold text-fd-foreground">
        <span className="align-top text-lg text-fd-muted-foreground">$</span>
        {Math.round(price).toLocaleString()}
        <span className="text-lg text-fd-muted-foreground">/mo</span>
      </p>
      <p className="mt-2 text-sm text-fd-muted-foreground">{subtext}</p>
    </div>
  );
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}
