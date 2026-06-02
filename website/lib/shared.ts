export const appName = 'Better-PaaS';
export const appTagline =
  'Self-hosted platform for apps, databases, and agents';
export const appDescription =
  'Better-PaaS is a self-hosted platform-as-a-service. Push your code to Git and it builds, runs, and serves your apps with automatic HTTPS, managed databases, zero-downtime deploys, and a clean dashboard.';

export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const gitConfig = {
  user: 'sumon-ohid',
  repo: 'better-paas',
  branch: 'main',
};

export const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://better-paas.com';

