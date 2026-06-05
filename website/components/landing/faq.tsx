'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { appName } from '@/lib/shared';
import { Eyebrow, IconTile } from '@/components/landing/primitives';

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: `Is ${appName} really free to self-host?`,
      answer: (
        <>
          <strong>Yes, it is 100% free.</strong> {appName} is open-source under the MIT license. You can install it on your own server for <strong>$0/month</strong> and run unlimited applications, databases, and cron jobs. There are no request caps, user seat limits, or platform markup fees.
        </>
      ),
    },
    {
      question: "What are the server requirements and infrastructure costs?",
      answer: (
        <>
          You only pay for your VPS/server directly to your cloud provider. {appName} runs efficiently on a minimal server with <strong>1 vCPU and 1 GB RAM</strong> (typically costing <strong>$4 to $5/month</strong> on providers like Hetzner or DigitalOcean). For production workloads or heavy Docker image compilations via Nixpacks, we recommend <strong>2 vCPUs and 2 GB+ RAM</strong>.
        </>
      ),
    },
    {
      question: "Are custom domains and SSL certificates free?",
      answer: (
        <>
          <strong>Yes, absolutely.</strong> {appName} integrates out-of-the-box with Caddy. When you point any custom domain to your server, it automatically provisions and renews free Let's Encrypt SSL certificates. There is <strong>no limit</strong> on the number of custom domains you can map.
        </>
      ),
    },
    {
      question: "Can I deploy multiple apps on a single server?",
      answer: (
        <>
          <strong>Yes, absolutely.</strong> You can deploy as many web applications, static sites, APIs, and databases on a single server as its hardware (CPU and RAM) can handle. {appName} does not impose any artificial caps or resource container limits.
        </>
      ),
    },
    {
      question: "How does database management and backup billing work?",
      answer: (
        <>
          You can spin up PostgreSQL, MySQL, Redis, MongoDB, and MariaDB directly on your server with one click. {appName} handles backups (configured to run daily or on custom cron schedules) and uploads them to your own S3-compatible storage. There are <strong>$0 database platform fees</strong> — you only pay for storage.
        </>
      ),
    },
    {
      question: "How do I migrate my applications to another VPS?",
      answer: (
        <>
          Since your projects are linked to your Git repositories, migrating to a new server is as simple as installing {appName} on the new VPS and re-deploying. You can export your app configurations and environment variables, then apply them to the new server with a few clicks.
        </>
      ),
    },
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="bg-fd-background">
      <div className="mx-auto max-w-[1268px] px-4 py-16 sm:px-9 sm:py-20 xl:px-12">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:items-start">
          {/* Left Column: Heading and info */}
          <div className="max-w-[480px]">
            <h2 className="bp-display mt-6 text-[clamp(2rem,7.8vw,2.35rem)] font-normal leading-[1.16] tracking-[-0.035em] text-[#121722] lg:text-[clamp(1.7rem,2.6vw,2.7rem)] dark:text-[#f4f4f5]">
              Frequently Asked Questions
            </h2>
            <p className="mt-5 text-[clamp(0.82rem,3.35vw,1rem)] font-light leading-[1.42] tracking-[-0.006em] text-[#394355] sm:text-[clamp(1rem,4.1vw,1.2rem)] sm:leading-[1.48] lg:text-[clamp(0.8rem,1.1vw,1.07rem)] dark:text-[#dfdfe2]">
              Everything you need to know about {appName} pricing, self-hosting server requirements, and capabilities.
            </p>
            <div className="mt-8">
              <Link
                href="/docs"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#121722] px-6 text-sm font-medium text-white transition-colors hover:bg-[#26364d] dark:bg-white/[0.055] dark:hover:bg-white/[0.09] dark:text-[#dfdfe2]"
              >
                Can't find your answer? Read the Docs
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* Right Column: Accordion */}
          <div className="flex flex-col">
            {faqs.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <div
                  key={index}
                  className="relative overflow-hidden rounded-[0.85rem] bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 transition-all duration-300 hover:bg-white/80 dark:hover:bg-white/[0.06] mb-3"
                >
                  <button
                    onClick={() => toggleFAQ(index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors focus:outline-none"
                  >
                    <span className="flex-1 text-base font-medium text-[#121722] dark:text-[#f4f4f5]">
                      {item.question}
                    </span>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/50 text-[#121722] transition-transform duration-300 dark:border-white/10 dark:bg-white/[0.02] dark:text-[#f4f4f5]">
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform duration-300 ease-in-out",
                          isOpen && "rotate-180"
                        )}
                      />
                    </span>
                  </button>

                  <div
                    className={cn(
                      "grid transition-all duration-300 ease-in-out text-sm text-[#394355] dark:text-[#929297]",
                      isOpen
                        ? "grid-rows-[1fr] opacity-100 pb-5 px-5 border-t border-black/5 dark:border-white/10 pt-4"
                        : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="leading-relaxed font-light">{item.answer}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
