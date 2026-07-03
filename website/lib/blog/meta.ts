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
