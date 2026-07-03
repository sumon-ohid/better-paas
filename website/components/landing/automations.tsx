'use client';

import { Circle, Check, RotateCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { appName } from '@/lib/shared';

interface TaskItemProps {
  title: string;
  agent: string;
  badge?: string;
  status: string;
  type: 'up-next' | 'unread' | 'completed';
}

function TaskRow({ title, agent, badge, status, type }: TaskItemProps) {
  return (
    <div className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-0 py-[0.3125rem] transition-all duration-300 hover:bg-white/[0.025] sm:gap-4 sm:py-2">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {type === 'up-next' && (
          <Circle className="size-2.5 shrink-0 text-[#4d5f7a]/70 transition-colors group-hover:text-[#1f2937] sm:size-3 dark:text-[#eceff5]/80 dark:group-hover:text-white" />
        )}
        {type === 'unread' && (
          <span className="relative flex size-2 shrink-0 my-auto rounded-full bg-[#4c83ff] sm:size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4c83ff] opacity-35" />
          </span>
        )}
        {type === 'completed' && (
          <span className="flex size-2.5 shrink-0 items-center justify-center rounded-full bg-[#26364d] text-white transition-transform group-hover:scale-105 sm:size-3 dark:bg-[#f2f4f8] dark:text-[#080809]">
            <Check className="size-2 stroke-[4]" />
          </span>
        )}

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-2.5">
          <span className="truncate text-[10px] font-medium tracking-[-0.01em] text-[#172033] sm:text-[12px] dark:text-[#eeeeee]">
            {title}
          </span>
          <span className="text-[9.5px] font-medium text-[#6a7281] sm:text-[11.5px] dark:text-[#8e8e93]">
            {agent}
          </span>
          {badge && (
            <span className="hidden items-center gap-1 rounded-full bg-[#ece7ff] px-2 py-0.5 text-[8.5px] font-medium leading-none text-[#5c3ea4] sm:inline-flex sm:px-2.5 sm:py-1 sm:text-[10px] dark:bg-[#2d174d] dark:text-[#d7c1ff]">
              <RotateCw className="size-2.5 animate-spin-slow text-[#9a76d8] sm:size-3" style={{ animationDuration: '6s' }} />
              {badge}
            </span>
          )}
        </div>
      </div>

      <span
        className={cn(
          'shrink-0 text-right text-[9.5px] font-medium tabular-nums text-[#657286] transition-colors group-hover:text-[#26364d] sm:text-[11.5px] dark:text-[#929297] dark:group-hover:text-[#d7d7dc]',
          status === 'In progress' && 'text-[#4a3c8f] group-hover:text-[#312565] dark:text-[#a9a9ae] dark:group-hover:text-[#d7d7dc]',
        )}
      >
        {status}
      </span>
    </div>
  );
}

export function AutomationsSection() {
  return (
    <section className="relative overflow-hidden bg-[#f7f8fb] py-10 dark:bg-fd-background">
      <div className="mx-auto grid max-w-[1268px] grid-cols-1 gap-7 px-4 pb-7 pt-16 sm:px-9 sm:py-8 md:grid-cols-1 md:gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(270px,0.55fr)] lg:items-center lg:gap-9 lg:px-9 lg:py-9 xl:px-12">
        <div className="relative order-2 w-full lg:order-1">
          <div
            className="relative flex min-h-[220px] sm:min-h-[clamp(315px,54vh,510px)] w-full items-center justify-center overflow-hidden rounded-md px-3 py-4.5 shadow-none sm:px-9 sm:py-9 lg:min-h-[clamp(375px,57vh,540px)]"
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
              style={{
                background: 'radial-gradient(circle at 9% 84%, #ffffff 0%, transparent 36%)',
              }}
            />

            <div className="relative w-full max-w-[500px] rounded-[0.85rem] bg-[#f8fbff]/92 p-3 sm:max-w-[518px] sm:rounded-[0.675rem] sm:px-7 sm:py-6 xl:max-w-[540px] dark:bg-[#050505]/90 dark:shadow-[0_15px_52px_-21px_rgba(0,0,0,0.95)]">
              <div className="space-y-1">
                <h4 className="mb-1.5 text-[8.5px] font-medium tracking-[-0.01em] text-[#66758e] sm:mb-3 sm:text-[11.5px] dark:text-[#9a9a9f]">
                  Agent activity
                </h4>
                <TaskRow
                  title="Redeploy my-api"
                  agent="Cursor · deployer"
                  badge="MCP"
                  status="In progress"
                  type="up-next"
                />
                <TaskRow
                  title="Fetch runtime logs"
                  agent="Claude Code · deployer"
                  badge="paas_get_logs"
                  status="Queued"
                  type="up-next"
                />
                <TaskRow
                  title="List deployed apps"
                  agent="Codex · observer"
                  badge="paas_list_apps"
                  status="Starts next"
                  type="up-next"
                />
              </div>

              <div className="h-2.5 sm:h-5" />

              <div className="space-y-1">
                <h4 className="mb-1.5 text-[8.5px] font-medium tracking-[-0.01em] text-[#66758e] sm:mb-3 sm:text-[11.5px] dark:text-[#9a9a9f]">
                  Live events
                </h4>
                <TaskRow title="Git webhook received" agent="better-paas-web" status="Just now" type="unread" />
                <TaskRow title="Health check passed" agent="auth-service" status="5m ago" type="unread" />
              </div>

              <div className="h-2.5 sm:h-5" />

              <div className="space-y-1">
                <h4 className="mb-1.5 text-[8.5px] font-medium tracking-[-0.01em] text-[#66758e] sm:mb-3 sm:text-[11.5px] dark:text-[#9a9a9f]">
                  Completed
                </h4>
                <TaskRow title="Nixpacks image build" agent="better-paas-web" status="1h ago" type="completed" />
                <TaskRow title="paas connect authorized" agent="my-macbook CLI" status="2h ago" type="completed" />
                <TaskRow title="Caddy TLS provisioned" agent="api.example.com" status="1d ago" type="completed" />
              </div>
            </div>
          </div>
        </div>

        <div className="order-1 max-w-[443px] lg:order-2 lg:pl-1.5">
          <p className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#66758e] dark:text-[#9a9a9f]">
            Platform automations
          </p>
          <h2 className="bp-display text-[clamp(2rem,7.8vw,2.35rem)] font-normal leading-[1.16] tracking-[-0.035em] text-[#121722] lg:text-[clamp(1.7rem,2.6vw,2.7rem)] dark:text-[#f4f4f5]">
            Agents deploy. {appName} keeps things running.
          </h2>
          <p className="mt-5 text-[clamp(0.82rem,3.35vw,1rem)] font-light leading-[1.42] tracking-[-0.006em] text-[#394355] sm:text-[clamp(1rem,4.1vw,1.2rem)] sm:leading-[1.48] lg:mt-5 lg:text-[clamp(0.8rem,1.1vw,1.07rem)] dark:text-[#dfdfe2]">
            Your editor handles deploys and log checks through MCP. The control plane handles
            webhooks, health checks, TLS renewal, cron jobs, and backups in the background.
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>
    </section>
  );
}
