export const appName = 'Better-PaaS';
export const appTagline = 'Agent-first PaaS on a server you own';
export const appDescription =
  'Better-PaaS is the open-source, self-hosted PaaS for indie hackers and AI-assisted workflows. Deploy from Git on your VPS, connect with paas CLI, and manage apps from Cursor or Claude Code using scoped agent tokens and MCP.';

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

