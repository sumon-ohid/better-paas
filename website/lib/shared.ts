export const appName = 'Better-PaaS';
export const appTagline = 'Vercel-like deploys on a server you own';
export const appDescription =
  'Better-PaaS is the open-source deployment platform for indie hackers who want Vercel-like deploys without the platform tax. Push code to Git, get automatic HTTPS, and run databases on any cheap VPS you control.';

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

/** Interactive dashboard demo served from the marketing site. */
export const demoUrl = '/demo';

