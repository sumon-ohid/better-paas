export type BlogFaq = {
  question: string;
  answer: string;
};

export type BlogMeta = {
  date: string;
  dateModified?: string;
  author: string;
  keywords?: string[];
  faqs?: BlogFaq[];
};

export const blogMetaBySlug: Record<string, BlogMeta> = {
  'why-better-paas-beats-other-deployment-platforms-2026': {
    date: '2026-07-06',
    author: 'Better-PaaS team',
    keywords: [
      'heroku alternative',
      'coolify alternative',
      'self hosted paas',
      'agent first deployment',
      'caprover alternative',
      'better paas vs coolify',
      'deployment platform comparison',
    ],
    faqs: [
      {
        question: 'What is the difference between Better-PaaS and Coolify?',
        answer:
          'Both are self-hosted PaaS control planes on your VPS. Coolify offers a broader catalog and multi-server support. Better-PaaS emphasizes a lighter Go backend, agent-scoped tokens, MCP integration, and Caddy-first HTTPS. Choose based on RAM footprint, UI preference, and whether agent-native deploys matter to your workflow.',
      },
      {
        question: 'Is Better-PaaS a Heroku alternative?',
        answer:
          'Yes. Git push deploys, environment variables, Nixpacks builds, and dynamic PORT injection mirror Heroku patterns. The difference is you run the control plane on your own VPS for flat monthly cost instead of per-dyno billing.',
      },
      {
        question: 'Can Better-PaaS replace Vercel for Next.js?',
        answer:
          'Yes for standard Node server deployments. Features tightly coupled to Vercel Edge Runtime or Vercel KV may need architectural changes. Add Cloudflare CDN in front if you need geographic static caching.',
      },
      {
        question: 'Does Better-PaaS cost money?',
        answer:
          'Better-PaaS software is free and open source (AGPL-3.0). You pay for your VPS (typically $12–24/month) and any external services you attach.',
      },
      {
        question: 'Is Better-PaaS secure for AI agent access?',
        answer:
          'Agent tokens are scoped, revocable, and audited. Permission profiles (Observer, Deployer, Operator) enforce least privilege. Git and deploy secrets are encrypted at rest with AES-256-GCM. Prefer agent tokens over sharing your admin password with automation.',
      },
    ],
  },
  'self-hosted-vercel-alternative-guide': {
    date: '2026-07-03',
    author: 'Better-PaaS team',
    keywords: [
      'vercel alternative',
      'self hosted paas',
      'deploy nextjs on vps',
      'self hosted vercel',
      'coolify alternative',
      'git push deploy',
    ],
    faqs: [
      {
        question: 'What is the best self-hosted Vercel alternative in 2026?',
        answer:
          'For solo founders and small full-stack apps, Better-PaaS, Coolify, and Dokploy are the most common answers. Better-PaaS optimizes for a lean git-push workflow on one VPS; Coolify offers the broadest catalog; Dokploy targets Docker-native production patterns.',
      },
      {
        question: 'Is self-hosting cheaper than Vercel?',
        answer:
          'For multiple apps and steady traffic, yes-typically $5–12/month flat on a VPS vs per-seat and usage-based billing. For a single static marketing site, Vercel Hobby or Cloudflare Pages may still be cheaper and simpler.',
      },
      {
        question: 'Can I deploy Next.js on Hetzner without Docker knowledge?',
        answer:
          'Yes. Self-hosted PaaS tools detect Next.js, build containers for you, and handle HTTPS. You need basic VPS literacy (SSH, DNS), not deep Docker expertise.',
      },
      {
        question: 'How does Dokploy compare to Coolify?',
        answer:
          'Coolify emphasizes ease of use and a large one-click library. Dokploy emphasizes production workflows, Docker Swarm, and Traefik. Teams debating dokploy vs coolify usually pick Coolify for speed-to-first-deploy and Dokploy for ops-heavy Docker environments.',
      },
      {
        question: 'Will I lose preview deployments if I leave Vercel?',
        answer:
          'You lose Vercel’s native PR previews unless your self-hosted tool provides branch apps. Many teams run staging branch deploys instead of per-PR URLs until they need full preview parity.',
      },
      {
        question: 'Is Better-PaaS really free?',
        answer:
          'The control plane is open source (AGPL-3.0). You pay only for your VPS and optional backup storage-not per app or per seat.',
      },
    ],
  },
  'founder-story': {
    date: '2026-03-15',
    author: 'Better-PaaS founder',
    keywords: ['vercel alternative', 'indie hacker', 'self-hosted paas', 'side project hosting'],
  },
};

export function getBlogMeta(slug: string): BlogMeta {
  return (
    blogMetaBySlug[slug] ?? {
      date: new Date().toISOString().slice(0, 10),
      author: 'Better-PaaS team',
    }
  );
}

export function sortBlogSlugsByDate(slugs: string[]): string[] {
  return [...slugs].sort((a, b) => getBlogMeta(b).date.localeCompare(getBlogMeta(a).date));
}
