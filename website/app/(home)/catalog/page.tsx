'use client';

import React, { useState, useMemo } from 'react';
import { Search, Globe, ArrowUpRight, Grid } from 'lucide-react';
import { Eyebrow, IconTile } from '@/components/landing/primitives';
import { BorderBeam } from '@/components/tailark/border-beam';
import Link from 'next/link';

// CatalogTemplate interface mirroring backend
interface CatalogTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  website: string;
  icon: string;
}

// Pre-seeded list of popular templates matching backend/catalog.go
const TEMPLATES: CatalogTemplate[] = [
  {
    id: 'uptime-kuma',
    name: 'Uptime Kuma',
    description: 'Self-hosted uptime monitoring with status pages and alerts.',
    category: 'Monitoring',
    website: 'https://github.com/louislam/uptime-kuma',
    icon: 'uptime-kuma',
  },
  {
    id: 'dozzle',
    name: 'Dozzle',
    description: 'Real-time log viewer for your Docker containers.',
    category: 'Monitoring',
    website: 'https://dozzle.dev',
    icon: 'dozzle',
  },
  {
    id: 'beszel',
    name: 'Beszel',
    description: 'Lightweight server resource monitoring hub with history and alerts.',
    category: 'Monitoring',
    website: 'https://beszel.dev',
    icon: 'beszel',
  },
  {
    id: 'changedetection',
    name: 'Changedetection.io',
    description: 'Website change detection, price watch, and content monitoring with alerts.',
    category: 'Monitoring',
    website: 'https://changedetection.io',
    icon: 'changedetection',
  },
  {
    id: 'memos',
    name: 'Memos',
    description: 'A lightweight, privacy-first, self-hosted note-taking service.',
    category: 'Productivity',
    website: 'https://usememos.com',
    icon: 'memos',
  },
  {
    id: 'linkding',
    name: 'Linkding',
    description: 'Minimal, fast self-hosted bookmark manager.',
    category: 'Productivity',
    website: 'https://linkding.link',
    icon: 'linkding',
  },
  {
    id: 'freshrss',
    name: 'FreshRSS',
    description: 'A free, self-hostable RSS feed aggregator (SQLite mode).',
    category: 'Productivity',
    website: 'https://freshrss.org',
    icon: 'freshrss',
  },
  {
    id: 'nextcloud',
    name: 'Nextcloud',
    description: 'File sync, sharing, calendars, contacts, and collaboration suite.',
    category: 'Productivity',
    website: 'https://nextcloud.com',
    icon: 'nextcloud',
  },
  {
    id: 'paperless-ngx',
    name: 'Paperless-ngx',
    description: 'Document management with OCR, tagging, search, and archiving.',
    category: 'Productivity',
    website: 'https://docs.paperless-ngx.com',
    icon: 'paperless-ngx',
  },
  {
    id: 'pocketbase',
    name: 'PocketBase',
    description: 'Lightweight backend with database, auth, file storage, and an admin UI.',
    category: 'CMS',
    website: 'https://pocketbase.io',
    icon: 'pocketbase',
  },
  {
    id: 'directus',
    name: 'Directus',
    description: 'Headless CMS and data platform with instant APIs and a polished admin studio.',
    category: 'CMS',
    website: 'https://directus.io',
    icon: 'directus',
  },
  {
    id: 'wikijs',
    name: 'Wiki.js',
    description: 'Modern wiki and documentation CMS with a clean editor experience.',
    category: 'Productivity',
    website: 'https://js.wiki',
    icon: 'wikijs',
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    description: 'The classic open-source CMS for websites, blogs, and content-heavy pages.',
    category: 'CMS',
    website: 'https://wordpress.org',
    icon: 'wordpress',
  },
  {
    id: 'gitea',
    name: 'Gitea',
    description: 'Lightweight Git hosting with issues, pull requests, packages, and actions.',
    category: 'Developer Tools',
    website: 'https://about.gitea.com',
    icon: 'gitea',
  },
  {
    id: 'forgejo',
    name: 'Forgejo',
    description: 'Community-driven Git forge for code hosting, collaboration, and packages.',
    category: 'Developer Tools',
    website: 'https://forgejo.org',
    icon: 'forgejo',
  },
  {
    id: 'woodpecker',
    name: 'Woodpecker CI',
    description: 'Lightweight CI/CD server that pairs well with Gitea and Forgejo.',
    category: 'Developer Tools',
    website: 'https://woodpecker-ci.org',
    icon: 'homepage', // fallback or overrides
  },
  {
    id: 'gotify',
    name: 'Gotify',
    description: 'A simple server for sending and receiving push notifications.',
    category: 'Notifications',
    website: 'https://gotify.net',
    icon: 'gotify',
  },
  {
    id: 'ntfy',
    name: 'ntfy',
    description: 'Pub-sub notifications to your phone or desktop over HTTP.',
    category: 'Notifications',
    website: 'https://ntfy.sh',
    icon: 'ntfy',
  },
  {
    id: 'vaultwarden',
    name: 'Vaultwarden',
    description: 'Lightweight Bitwarden-compatible password manager server.',
    category: 'Security',
    website: 'https://github.com/dani-garcia/vaultwarden',
    icon: 'vaultwarden',
  },
  {
    id: 'adguard-home',
    name: 'AdGuard Home',
    description: 'Network-wide DNS server for blocking ads & tracking and managing your DNS.',
    category: 'Security',
    website: 'https://github.com/AdguardTeam/AdGuardHome',
    icon: 'adguard-home',
  },
  {
    id: 'it-tools',
    name: 'IT Tools',
    description: 'A handy collection of tools for developers (stateless).',
    category: 'Utilities',
    website: 'https://it-tools.tech',
    icon: 'it-tools',
  },
  {
    id: 'cyberchef',
    name: 'CyberChef',
    description: 'The cyber swiss-army knife for encoding, encryption and analysis.',
    category: 'Utilities',
    website: 'https://github.com/gchq/CyberChef',
    icon: 'cyberchef',
  },
  {
    id: 'excalidraw',
    name: 'Excalidraw',
    description: 'Virtual whiteboard for sketching hand-drawn style diagrams (stateless).',
    category: 'Utilities',
    website: 'https://excalidraw.com',
    icon: 'excalidraw',
  },
  {
    id: 'stirling-pdf',
    name: 'Stirling PDF',
    description: 'A powerful, locally-hosted web-based PDF manipulation toolkit.',
    category: 'Utilities',
    website: 'https://stirlingpdf.com',
    icon: 'stirling-pdf',
  },
  {
    id: 'n8n',
    name: 'n8n',
    description: 'Workflow automation for APIs, webhooks, AI workflows, and internal tools.',
    category: 'Automation',
    website: 'https://n8n.io',
    icon: 'n8n',
  },
  {
    id: 'umami',
    name: 'Umami',
    description: 'Simple, privacy-friendly web analytics for your sites and apps.',
    category: 'Analytics',
    website: 'https://umami.is',
    icon: 'umami',
  },
  {
    id: 'jellyfin',
    name: 'Jellyfin',
    description: 'The free software media system for streaming your own library.',
    category: 'Media',
    website: 'https://jellyfin.org',
    icon: 'jellyfin',
  },
];

// Map of community/jsdelivr slugs to direct URL overrides
const iconUrlOverrides: Record<string, string> = {
  homepage: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/homepage.png',
  pairdrop: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/pairdrop.png',
  woodpecker: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/woodpecker-ci.png',
  prestashop: 'https://cdn.jsdelivr.net/npm/simple-icons/icons/prestashop.svg',
  matomo: 'https://cdn.jsdelivr.net/npm/simple-icons/icons/matomo.svg',
  seonaut: 'https://seonaut.org/favicon.ico',
  seopanel: 'https://raw.githubusercontent.com/seopanel/Seo-Panel-Docs/master/_static/seo_lg.png',
  openui: 'https://cdn.jsdelivr.net/npm/simple-icons/icons/weightsandbiases.svg',
};

function getIconUrl(slug: string): string {
  if (iconUrlOverrides[slug]) return iconUrlOverrides[slug];
  return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${slug}.svg`;
}

// Logo image component with textual fallback if CDN fails
function AppLogo({ template }: { template: CatalogTemplate }) {
  const [failed, setFailed] = useState(false);

  if (failed || !template.icon) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fd-muted text-sm font-bold text-fd-muted-foreground border border-fd-border">
        {template.name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={getIconUrl(template.icon)}
      alt={`${template.name} logo`}
      className="h-10 w-10 shrink-0 object-contain bg-white rounded-lg border border-fd-border p-1.5"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function CatalogPage() {
  const [search, setSearch] = useState('');

  // Filter templates based on search
  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [search]);

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
      <section className="relative mx-auto max-w-6xl px-6 pt-24 pb-8 sm:pt-32 text-center" id="catalog-hero">
        <Eyebrow className="justify-center font-semibold">1-Click Apps</Eyebrow>
        <h1 className="bp-display mt-6 text-4xl font-semibold sm:text-5xl md:text-6xl tracking-tight text-fd-foreground">
          App Catalog<span className="text-fd-primary">.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-md leading-relaxed text-fd-muted-foreground">
          Deploy popular open-source apps instantly on your own VPS. Each template runs as a single preconfigured container with its own storage, automatic Let's Encrypt HTTPS, and clean routing.
        </p>
      </section>

      {/* Search Section */}
      <section className="relative mx-auto max-w-xl px-6 py-6 w-full" id="catalog-controls">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fd-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 1-click apps..."
            className="h-10 w-full pl-9 pr-4 rounded-lg border border-fd-border bg-fd-card/50 text-sm placeholder:text-fd-muted-foreground focus:outline-none focus:border-fd-primary transition-colors text-fd-foreground"
          />
        </div>
      </section>

      {/* Grid of Templates */}
      <section className="relative mx-auto max-w-6xl px-6 py-8 w-full" id="catalog-grid">
        {filteredTemplates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-fd-border py-20 text-center">
            <Grid className="mx-auto mb-3 h-8 w-8 text-fd-muted-foreground/50" />
            <p className="text-sm font-semibold text-fd-foreground">No apps found</p>
            <p className="mt-1 text-xs text-fd-muted-foreground">Try searching another app or select "All".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((tpl) => (
              <a
                key={tpl.id}
                href={tpl.website}
                target="_blank"
                rel="noopener noreferrer"
                className="bp-card group relative flex flex-col justify-between h-[180px] w-full rounded-2xl border border-fd-border bg-fd-card/35 hover:bg-fd-card/75 transition-all duration-300 p-5 cursor-pointer overflow-hidden"
              >
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex items-start justify-between gap-3">
                    <AppLogo template={tpl} />
                    <ArrowUpRight className="size-4 text-fd-muted-foreground group-hover:text-fd-foreground transition-colors group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
                  </div>

                  <div className="mt-3 min-w-0">
                    <h3 className="truncate text-sm font-bold text-fd-foreground">{tpl.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fd-muted-foreground">
                      {tpl.description}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full bg-fd-primary/10 px-2 py-0.5 text-[10px] font-semibold text-fd-primary">
                      {tpl.category}
                    </span>
                    <span className="text-[10px] font-medium text-fd-muted-foreground inline-flex items-center gap-1 group-hover:underline">
                      <Globe className="size-3" />
                      Visit site
                    </span>
                  </div>
                </div>

                <BorderBeam
                  duration={12}
                  size={140}
                  colorFrom="var(--color-fd-primary)"
                  colorTo="transparent"
                  className="opacity-0 group-hover:opacity-25 transition-opacity"
                />
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Call to action at bottom */}
      <section className="relative mx-auto max-w-4xl px-6 py-12 text-center" id="catalog-footer">
        <p className="text-sm text-fd-muted-foreground">
          Don't see your favorite app? Better-PaaS supports deploying any custom Docker image or Git repo.
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Link
            href="/docs/configuration"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-fd-foreground text-fd-background px-5 text-xs font-semibold transition-opacity hover:opacity-90"
          >
            Custom Deployment Guide
          </Link>
        </div>
      </section>
    </main>
  );
}
