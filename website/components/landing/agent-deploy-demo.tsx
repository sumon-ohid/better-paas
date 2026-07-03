'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronRight,
  Globe,
  Loader2,
  Mic,
  Paperclip,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/cn';

type Phase = 'typing' | 'working' | 'report' | 'pause';

const PROMPT = 'check my better-paas deployed app';

const ACTIVITY = [
  { icon: Globe, label: 'Searching the repo for deployed Better-PaaS URL' },
  { icon: Terminal, label: 'Ran HTTP checks on better-paas.com & paas.better-paas.com' },
  { icon: Globe, label: 'Ran 2 browser actions' },
  { icon: Sparkles, label: 'Thought briefly' },
];

const DASHBOARD_ROWS = [
  { check: 'Homepage', status: '200', note: 'loads login screen' },
  {
    check: 'API health (via domain)',
    status: '200',
    note: '{"status":"healthy","version":"v1.8.4-8-g025e8c0"}',
  },
  { check: 'Direct API (92.113.150.63:8080)', status: '200', note: 'uptime ~409h' },
];

const MARKETING_ROWS = [
  { check: 'Homepage', status: '200' },
  { check: '/demo', status: '200' },
  { check: '/docs/quickstart', status: '200' },
];

const PHASE_TIMING: Record<Phase, number> = {
  typing: 2800,
  working: 3800,
  report: 5500,
  pause: 800,
};

function StatusTable({
  rows,
  visible,
}: {
  rows: { check: string; status: string; note?: string }[];
  visible: boolean;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded border border-[#333] transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-[#333] bg-[#1f1f1f] text-left text-[#707070]">
            <th className="px-2 py-1 font-medium">Check</th>
            <th className="px-2 py-1 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="text-[#b4b4b4]">
          {rows.map((row) => (
            <tr key={row.check} className="border-b border-[#2a2a2a] last:border-0">
              <td className="px-2 py-1.5 align-top">{row.check}</td>
              <td className="px-2 py-1.5 align-top">
                <span className="font-semibold text-[#cccccc]">{row.status}</span>
                {row.note && (
                  <span className="mt-0.5 block font-mono text-[9px] leading-snug text-[#707070]">
                    {row.note}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityStep({
  icon: Icon,
  label,
  state,
}: {
  icon: typeof Globe;
  label: string;
  state: 'pending' | 'running' | 'done';
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-[10px] transition-opacity duration-200',
        state === 'pending' ? 'opacity-0' : state === 'running' ? 'text-[#858585]' : 'text-[#606060]',
      )}
    >
      {state === 'running' ? (
        <Loader2 className="size-3 shrink-0 animate-spin text-[#707070]" />
      ) : (
        <Icon className="size-3 shrink-0 text-[#606060]" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}

export function AgentDeployDemo() {
  const [phase, setPhase] = useState<Phase>('typing');
  const [typed, setTyped] = useState('');
  const [activeStep, setActiveStep] = useState(0);

  const submitted = phase !== 'typing' && phase !== 'pause';
  const showActivity = phase === 'working' || phase === 'report';
  const showReport = phase === 'report';

  useEffect(() => {
    if (phase !== 'typing') return;

    setTyped('');
    let i = 0;
    const interval = window.setInterval(() => {
      i += 1;
      setTyped(PROMPT.slice(0, i));
      if (i >= PROMPT.length) window.clearInterval(interval);
    }, 32);

    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'working') {
      setActiveStep(0);
      return;
    }

    let step = 0;
    const interval = window.setInterval(() => {
      step += 1;
      setActiveStep(step);
      if (step >= ACTIVITY.length) window.clearInterval(interval);
    }, 750);

    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    const order: Phase[] = ['typing', 'working', 'report', 'pause'];
    const timeout = window.setTimeout(() => {
      setPhase((current) => order[(order.indexOf(current) + 1) % order.length]);
    }, PHASE_TIMING[phase]);

    return () => window.clearTimeout(timeout);
  }, [phase]);

  return (
    <div className="relative z-10 flex h-[480px] w-full max-w-[580px] flex-col overflow-hidden rounded-lg border border-[#2b2b2b] bg-[#181818] shadow-[0_24px_64px_-16px_rgba(0,0,0,0.65)]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* User prompt - Cursor chip style */}
          <motion.div
            animate={{ opacity: submitted ? 1 : 0, y: submitted ? 0 : 6 }}
            className={cn('mb-3 flex justify-end', !submitted && 'pointer-events-none')}
          >
            <div className="inline-block max-w-[85%] rounded-lg border border-[#383838] bg-[#252526] px-3 py-2">
              <p className="text-[12px] leading-snug text-[#cccccc]">{PROMPT}</p>
            </div>
          </motion.div>

          <div className="flex gap-2">
            <div className="min-w-0 flex-1 space-y-2.5">
              {/* Activity log */}
              <div className="min-h-[72px] space-y-1">
                {ACTIVITY.map((step, index) => {
                  let state: 'pending' | 'running' | 'done' = 'pending';
                  if (showActivity) {
                    if (phase === 'report' || index < activeStep) state = 'done';
                    else if (index === activeStep) state = 'running';
                  }
                  return (
                    <ActivityStep
                      key={step.label}
                      icon={step.icon}
                      label={step.label}
                      state={state}
                    />
                  );
                })}
              </div>

              {/* Structured report */}
              <motion.div
                animate={{ opacity: showReport ? 1 : 0, y: showReport ? 0 : 8 }}
                transition={{ duration: 0.35 }}
                className={cn('space-y-3 pb-1', !showReport && 'pointer-events-none')}
              >
                <div>
                  <h3 className="text-[12px] font-semibold text-[#e8e8e8]">Production health summary</h3>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] text-[#b4b4b4]">
                    Dashboard -{' '}
                    <span className="text-[#6b9fff]">paas.better-paas.com</span>
                  </p>
                  <StatusTable rows={DASHBOARD_ROWS} visible={showReport} />
                  <p className="text-[10px] text-[#707070]">
                    Control plane up ~17 days on{' '}
                    <code className="rounded bg-[#2a2a2a] px-1 py-px font-mono text-[9px] text-[#858585]">
                      v1.8.4-8-g025e8c0
                    </code>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] text-[#b4b4b4]">
                    Marketing site -{' '}
                    <span className="text-[#6b9fff]">better-paas.com</span>
                  </p>
                  <StatusTable rows={MARKETING_ROWS} visible={showReport} />
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-2.5 pb-2.5">
          <div className="flex h-9 items-center gap-2 rounded-lg border border-[#383838] bg-[#252526] px-2.5">
            <Paperclip className="size-3.5 shrink-0 text-[#606060]" />
            <div className="min-w-0 flex-1 truncate text-[12px] text-[#cccccc]">
              {phase === 'typing' ? (
                <>
                  {typed}
                  <span className="ml-px inline-block h-3.5 w-[1.5px] animate-pulse bg-[#cccccc] align-middle" />
                </>
              ) : (
                <span className="text-[#606060]">Send follow-up…</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="rounded bg-[#333] px-1.5 py-0.5 text-[10px] font-medium text-[#a8b1ff]">
                Agent
              </span>
              <span className="hidden text-[10px] text-[#606060] sm:inline">GPT-5</span>
              <Mic className="size-3.5 text-[#606060]" />
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-md transition-colors',
                  phase === 'typing' && typed.length > 0
                    ? 'bg-[#cccccc] text-[#181818]'
                    : 'bg-[#383838] text-[#606060]',
                )}
              >
                <ChevronRight className="size-3 rotate-[-90deg]" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
