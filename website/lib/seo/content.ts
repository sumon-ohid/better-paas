import { appName } from '@/lib/shared';

export type SeoFamily =
  | 'alternatives'
  | 'compare'
  | 'deploy'
  | 'use-cases'
  | 'features'
  | 'integrations'
  | 'glossary'
  | 'fix'
  | 'best'
  | 'templates'
  | 'examples';

export type SeoSection = {
  title: string;
  body: string;
  bullets?: string[];
};

export type SeoFAQ = {
  question: string;
  answer: string;
};

export type ComparisonRow = {
  criterion: string;
  appName: string;
  competitor: string;
  winner: 'app' | 'competitor' | 'tie' | null;
};

export type SeoPage = {
  family: SeoFamily;
  slug: string;
  title: string;
  h1: string;
  description: string;
  eyebrow: string;
  intent: string;
  summary: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  sections: SeoSection[];
  faqs: SeoFAQ[];
  related: string[];
  ctaLabel?: string;
  ctaHref?: string;
  schemaType: 'TechArticle' | 'SoftwareApplication' | 'FAQPage' | 'HowTo' | 'DefinedTerm' | 'ItemList';
  datePublished: string;
  dateModified: string;
  lastReviewed: string;
  comparisonTable?: ComparisonRow[];
};

export type SeoHub = {
  family: SeoFamily;
  path: string;
  title: string;
  h1: string;
  description: string;
  eyebrow: string;
};

const quickstart = '/docs/quickstart';
const deployGuide = '/docs/guides/deploying-an-app';

const familyPath: Record<SeoFamily, string> = {
  alternatives: '/alternatives',
  compare: '/compare',
  deploy: '/deploy',
  'use-cases': '/use-cases',
  features: '/features',
  integrations: '/integrations',
  glossary: '/glossary',
  fix: '/fix',
  best: '/best',
  templates: '/templates',
  examples: '/examples',
};

export const seoHubs: SeoHub[] = [
  {
    family: 'alternatives',
    path: '/alternatives',
    title: `${appName} Alternatives Library`,
    h1: 'Self-hosted PaaS alternatives',
    description: 'Compare Better-PaaS with hosted platforms, open-source PaaS tools, and VPS deployment control panels.',
    eyebrow: 'Alternatives',
  },
  {
    family: 'compare',
    path: '/compare',
    title: `${appName} Comparison Guides`,
    h1: 'Deployment platform comparisons',
    description: 'Side-by-side guides for choosing between Better-PaaS, open-source PaaS tools, and hosted deployment platforms.',
    eyebrow: 'Compare',
  },
  {
    family: 'deploy',
    path: '/deploy',
    title: `Deploy Apps and Frameworks on a VPS | ${appName}`,
    h1: 'Deploy apps and frameworks on your own server',
    description: 'Practical deployment guides for frameworks, APIs, databases, and popular self-hosted apps.',
    eyebrow: 'Deploy',
  },
  {
    family: 'use-cases',
    path: '/use-cases',
    title: `${appName} Use Cases`,
    h1: 'Use cases for a self-hosted app platform',
    description: 'Ways teams, agencies, homelabs, and indie developers use Better-PaaS to host apps on infrastructure they control.',
    eyebrow: 'Use Cases',
  },
  {
    family: 'features',
    path: '/features',
    title: `${appName} Feature Guides`,
    h1: 'Platform feature guides',
    description: 'Deep dives into the deployment, routing, database, security, backup, and observability features in Better-PaaS.',
    eyebrow: 'Features',
  },
  {
    family: 'integrations',
    path: '/integrations',
    title: `${appName} Integrations`,
    h1: 'Tools that power Better-PaaS workflows',
    description: 'How Better-PaaS works with GitHub, Docker, Caddy, Nixpacks, databases, Cloudflare, Slack, and more.',
    eyebrow: 'Integrations',
  },
  {
    family: 'glossary',
    path: '/glossary',
    title: 'Developer Hosting Glossary | Better-PaaS',
    h1: 'Developer hosting glossary',
    description: 'Plain-English definitions for PaaS, Docker, reverse proxies, GitOps, custom domains, and self-hosted deployment terms.',
    eyebrow: 'Glossary',
  },
  {
    family: 'fix',
    path: '/fix',
    title: 'Deployment Troubleshooting Guides | Better-PaaS',
    h1: 'Fix common VPS and Docker deployment problems',
    description: 'Troubleshooting guides for build failures, HTTPS issues, ports, webhooks, private repositories, databases, and Docker resources.',
    eyebrow: 'Fix',
  },
  {
    family: 'best',
    path: '/best',
    title: 'Best Self-Hosted Deployment Tools | Better-PaaS',
    h1: 'Best tools for self-hosted app deployment',
    description: 'Curated lists for choosing self-hosted PaaS tools, Heroku alternatives, Docker deployment platforms, and VPS app hosts.',
    eyebrow: 'Best',
  },
  {
    family: 'templates',
    path: '/templates',
    title: 'Deployment Templates | Better-PaaS',
    h1: 'Ready-to-deploy templates',
    description: 'Pre-configured deployment templates for popular frameworks, databases, and app stacks on your own VPS.',
    eyebrow: 'Templates',
  },
  {
    family: 'examples',
    path: '/examples',
    title: 'Deployment Examples | Better-PaaS',
    h1: 'Real-world deployment examples',
    description: 'Step-by-step examples of deploying real applications on Better-PaaS with configuration details and production recommendations.',
    eyebrow: 'Examples',
  },
];

const launchDate = '2025-01-15';
const lastUpdated = '2025-06-11';

const competitors = [
  { slug: 'heroku', name: 'Heroku', angle: 'hosted dynos and add-ons', choose: 'you want a mature hosted platform and do not need server ownership' },
  { slug: 'render', name: 'Render', angle: 'hosted web services and managed infrastructure', choose: 'you want managed hosting with minimal server administration' },
  { slug: 'vercel', name: 'Vercel', angle: 'frontend and serverless deployment', choose: 'your app is primarily frontend or edge/serverless' },
  { slug: 'railway', name: 'Railway', angle: 'developer-friendly hosted projects', choose: 'you want hosted preview environments and usage-based cloud billing' },
  { slug: 'fly-io', name: 'Fly.io', angle: 'distributed app hosting close to users', choose: 'multi-region placement matters more than simple VPS control' },
  { slug: 'netlify', name: 'Netlify', angle: 'static sites and frontend workflows', choose: 'your workload is mostly Jamstack and frontend builds' },
  { slug: 'coolify', name: 'Coolify', angle: 'open-source self-hosted deployment', choose: 'you prefer its larger ecosystem and interface conventions' },
  { slug: 'dokku', name: 'Dokku', angle: 'minimal Heroku-like deployments over SSH', choose: 'you are comfortable with command-line administration' },
  { slug: 'caprover', name: 'CapRover', angle: 'Docker-based app and one-click deployment', choose: 'you already like CapRover workflows and templates' },
  { slug: 'cloudron', name: 'Cloudron', angle: 'managed app marketplace for servers', choose: 'you want an app-store model with paid platform support' },
  { slug: 'digitalocean-app-platform', name: 'DigitalOcean App Platform', angle: 'managed app hosting on DigitalOcean', choose: 'you want DigitalOcean to operate the platform layer' },
  { slug: 'aws-elastic-beanstalk', name: 'AWS Elastic Beanstalk', angle: 'AWS application orchestration', choose: 'you are already deep in AWS and need AWS-native integration' },
  { slug: 'google-cloud-run', name: 'Google Cloud Run', angle: 'serverless containers on Google Cloud', choose: 'you want autoscaling containers without owning servers' },
  { slug: 'azure-app-service', name: 'Azure App Service', angle: 'managed web apps on Microsoft Azure', choose: 'your organization standardizes on Azure' },
  { slug: 'kubernetes', name: 'Kubernetes', angle: 'cluster orchestration', choose: 'you need cluster-level scheduling, operators, and multi-node scale' },
  { slug: 'docker-compose', name: 'Docker Compose', angle: 'manual multi-container orchestration', choose: 'you want direct YAML control and do not need a dashboard' },
  { slug: 'plesk', name: 'Plesk', angle: 'traditional hosting control panels', choose: 'you need broad website hosting and email administration' },
  { slug: 'cpanel', name: 'cPanel', angle: 'shared-hosting style administration', choose: 'your main workload is classic PHP hosting' },
  { slug: 'portainer', name: 'Portainer', angle: 'container management UI', choose: 'you want Docker administration more than app deployment automation' },
  { slug: 'rancher', name: 'Rancher', angle: 'Kubernetes fleet management', choose: 'you manage multiple Kubernetes clusters' },
  { slug: 'nomad', name: 'Nomad', angle: 'HashiCorp workload scheduling', choose: 'you need scheduler flexibility across containers and binaries' },
  { slug: 'cyclic', name: 'Cyclic', angle: 'hosted serverless app deployment', choose: 'you want a hosted serverless developer experience' },
];

const appCatalog = [
  ['uptime-kuma', 'Uptime Kuma', 'self-hosted uptime monitoring', 'Monitoring', 'status pages, alerts, and persistent monitor history'],
  ['dozzle', 'Dozzle', 'real-time Docker log viewing', 'Monitoring', 'live container logs without giving every user SSH access'],
  ['beszel', 'Beszel', 'server resource monitoring', 'Monitoring', 'resource history and lightweight server health dashboards'],
  ['changedetection', 'Changedetection.io', 'website change detection', 'Monitoring', 'content alerts, price checks, and change watch jobs'],
  ['memos', 'Memos', 'privacy-first notes', 'Productivity', 'small personal knowledge bases with persistent storage'],
  ['linkding', 'Linkding', 'bookmark management', 'Productivity', 'private bookmark archiving on a custom domain'],
  ['freshrss', 'FreshRSS', 'RSS feed aggregation', 'Productivity', 'feed reading with a simple persistent data volume'],
  ['nextcloud', 'Nextcloud', 'file sync and collaboration', 'Productivity', 'private file storage with careful volume and backup planning'],
  ['paperless-ngx', 'Paperless-ngx', 'document management', 'Productivity', 'OCR, tagging, and document archive workflows'],
  ['pocketbase', 'PocketBase', 'lightweight backend apps', 'CMS', 'SQLite-backed APIs, auth, and admin UI'],
  ['directus', 'Directus', 'headless CMS projects', 'CMS', 'data-backed content APIs and an admin studio'],
  ['wikijs', 'Wiki.js', 'team wiki hosting', 'Productivity', 'documentation sites with a private admin interface'],
  ['wordpress', 'WordPress', 'classic CMS hosting', 'CMS', 'blogs and content-heavy sites with database persistence'],
  ['gitea', 'Gitea', 'lightweight Git hosting', 'Developer Tools', 'repositories, issues, pull requests, and packages'],
  ['forgejo', 'Forgejo', 'community Git forge hosting', 'Developer Tools', 'self-hosted source control with collaboration features'],
  ['woodpecker', 'Woodpecker CI', 'self-hosted CI/CD', 'Developer Tools', 'pipelines that pair well with private Git hosting'],
  ['gotify', 'Gotify', 'push notifications', 'Notifications', 'simple server-to-device notifications'],
  ['ntfy', 'ntfy', 'pub-sub notifications', 'Notifications', 'topic-based notifications over HTTP'],
  ['vaultwarden', 'Vaultwarden', 'password manager hosting', 'Security', 'Bitwarden-compatible storage with strict backup habits'],
  ['adguard-home', 'AdGuard Home', 'network DNS filtering', 'Security', 'ad blocking and local DNS management'],
  ['it-tools', 'IT Tools', 'developer utility hosting', 'Utilities', 'stateless tools on a private domain'],
  ['cyberchef', 'CyberChef', 'encoding and analysis tools', 'Utilities', 'browser-based operations for developers and security teams'],
  ['excalidraw', 'Excalidraw', 'virtual whiteboarding', 'Utilities', 'simple collaborative diagrams and sketches'],
  ['stirling-pdf', 'Stirling PDF', 'PDF tools', 'Utilities', 'private PDF manipulation without uploading documents elsewhere'],
  ['n8n', 'n8n', 'workflow automation', 'Automation', 'API workflows, webhooks, and AI automation jobs'],
  ['umami', 'Umami', 'privacy-friendly analytics', 'Analytics', 'website analytics with database-backed reporting'],
  ['jellyfin', 'Jellyfin', 'media server hosting', 'Media', 'private media streaming with persistent libraries'],
] as const;

const catalogOperationalDetails: Record<
  string,
  {
    image: string;
    port: number;
    healthPath?: string;
    volumes?: string[];
    env?: string[];
    addons?: string[];
    notes?: string;
  }
> = {
  'uptime-kuma': {
    image: 'louislam/uptime-kuma:1',
    port: 3001,
    healthPath: '/',
    volumes: ['/app/data'],
    notes: 'Persist monitor history and status-page configuration before relying on it for production uptime alerts.',
  },
  dozzle: {
    image: 'amir20/dozzle:v8',
    port: 8080,
    healthPath: '/',
    volumes: ['/var/run/docker.sock:/var/run/docker.sock:ro'],
    notes: 'Needs read-only Docker socket access to inspect container logs, so treat access to the app as sensitive.',
  },
  beszel: {
    image: 'henrygd/beszel:0',
    port: 8090,
    healthPath: '/',
    volumes: ['/beszel_data'],
  },
  changedetection: {
    image: 'dgtlmoon/changedetection.io:latest',
    port: 5000,
    healthPath: '/',
    volumes: ['/datastore'],
    env: ['BASE_URL'],
    notes: 'Basic HTTP checks fit the one-container starter. Browser-based checks may need a helper container.',
  },
  memos: {
    image: 'neosmemo/memos:stable',
    port: 5230,
    healthPath: '/',
    volumes: ['/var/opt/memos'],
  },
  linkding: {
    image: 'sissbruecker/linkding:latest',
    port: 9090,
    healthPath: '/',
    volumes: ['/etc/linkding/data'],
    env: ['LD_SUPERUSER_NAME', 'LD_SUPERUSER_PASSWORD'],
  },
  freshrss: {
    image: 'freshrss/freshrss:latest',
    port: 80,
    healthPath: '/',
    volumes: ['/var/www/FreshRSS/data'],
  },
  nextcloud: {
    image: 'nextcloud:31-apache',
    port: 80,
    healthPath: '/',
    volumes: ['/var/www/html'],
    env: ['SQLITE_DATABASE', 'NEXTCLOUD_ADMIN_USER', 'NEXTCLOUD_ADMIN_PASSWORD'],
    notes: 'SQLite is fine for a starter install. For heavier production usage, attach Postgres or MySQL and plan file storage carefully.',
  },
  'paperless-ngx': {
    image: 'ghcr.io/paperless-ngx/paperless-ngx:latest',
    port: 8000,
    healthPath: '/',
    volumes: ['/usr/src/paperless/data', '/usr/src/paperless/media', '/usr/src/paperless/consume', '/usr/src/paperless/export'],
    env: ['PAPERLESS_REDIS', 'PAPERLESS_SECRET_KEY', 'PAPERLESS_ADMIN_USER', 'PAPERLESS_ADMIN_PASSWORD', 'PAPERLESS_URL'],
    addons: ['Redis'],
    notes: 'Document archives are stateful. Back up both data and media volumes before automating uploads.',
  },
  pocketbase: {
    image: 'ghcr.io/muchobien/pocketbase:latest',
    port: 8090,
    healthPath: '/',
    volumes: ['/pb_data'],
    notes: 'The admin UI is usually at /_/. The root path can return JSON until public files are uploaded.',
  },
  directus: {
    image: 'directus/directus:11',
    port: 8055,
    healthPath: '/',
    volumes: ['/directus/database', '/directus/uploads', '/directus/extensions'],
    env: ['KEY', 'SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'DB_CLIENT', 'DB_FILENAME'],
  },
  wikijs: {
    image: 'lscr.io/linuxserver/wikijs:latest',
    port: 3000,
    healthPath: '/',
    volumes: ['/config'],
    env: ['DB_TYPE', 'TZ'],
    notes: 'SQLite is convenient for a small wiki. Larger teams should pair Wiki.js with Postgres.',
  },
  wordpress: {
    image: 'wordpress:6-php8.3-apache',
    port: 80,
    volumes: ['/var/www/html'],
    addons: ['MySQL or MariaDB recommended'],
    notes: 'WordPress is easy to start, but production sites need database backups, plugin hygiene, and update discipline.',
  },
  gitea: {
    image: 'gitea/gitea:1',
    port: 3000,
    volumes: ['/data'],
    env: ['USER_UID', 'USER_GID'],
    notes: 'Git hosting benefits from persistent storage and a clear backup/restore plan before teams depend on it.',
  },
  forgejo: {
    image: 'codeberg.org/forgejo/forgejo:10',
    port: 3000,
    volumes: ['/data'],
    notes: 'Treat repositories, issues, and uploaded assets as critical data and include them in backups.',
  },
  gotify: {
    image: 'gotify/server:2',
    port: 80,
    volumes: ['/app/data'],
  },
  ntfy: {
    image: 'binwiederhier/ntfy:v2',
    port: 80,
    volumes: ['/var/cache/ntfy', '/etc/ntfy'],
  },
  vaultwarden: {
    image: 'vaultwarden/server:1',
    port: 80,
    volumes: ['/data'],
    env: ['DOMAIN', 'ADMIN_TOKEN'],
    notes: 'Because this stores password-manager data, require HTTPS, strong admin credentials, and verified backups before inviting users.',
  },
  'adguard-home': {
    image: 'adguard/adguardhome:latest',
    port: 3000,
    volumes: ['/opt/adguardhome/work', '/opt/adguardhome/conf'],
    notes: 'DNS services may need additional port exposure beyond the web UI depending on your network design.',
  },
  'it-tools': {
    image: 'corentinth/it-tools:latest',
    port: 80,
    notes: 'Mostly stateless, so it is a good first catalog deployment to validate routing and HTTPS.',
  },
  cyberchef: {
    image: 'mpepping/cyberchef:latest',
    port: 8000,
    notes: 'Mostly stateless and useful as a private utility page for internal teams.',
  },
  excalidraw: {
    image: 'excalidraw/excalidraw:latest',
    port: 80,
    notes: 'A stateless whiteboard is a good candidate for a custom domain and simple HTTPS validation.',
  },
  'stirling-pdf': {
    image: 'frooodle/s-pdf:latest',
    port: 8080,
    volumes: ['/configs', '/customFiles', '/logs'],
    notes: 'Useful for keeping PDF operations private instead of uploading documents to third-party tools.',
  },
  n8n: {
    image: 'n8nio/n8n:latest',
    port: 5678,
    volumes: ['/home/node/.n8n'],
    env: ['N8N_HOST', 'N8N_PROTOCOL', 'WEBHOOK_URL'],
    notes: 'Webhook URLs should match the public HTTPS domain or external triggers may fail.',
  },
  umami: {
    image: 'ghcr.io/umami-software/umami:postgresql-latest',
    port: 3000,
    addons: ['Postgres'],
    env: ['DATABASE_URL', 'APP_SECRET'],
    notes: 'Analytics data lives in Postgres, so database backups matter more than container replacement.',
  },
  jellyfin: {
    image: 'jellyfin/jellyfin:latest',
    port: 8096,
    volumes: ['/config', '/cache', '/media'],
    notes: 'Media libraries can be large. Plan storage and backup strategy separately from the control-plane backup.',
  },
};

const stacks = [
  ['nextjs', 'Next.js', 'Node.js applications with build output and a start command'],
  ['nodejs', 'Node.js', 'JavaScript services, workers, APIs, and full-stack apps'],
  ['express', 'Express', 'Node.js APIs that listen on the provided PORT value'],
  ['react', 'React', 'static or single-page apps served behind automatic HTTPS'],
  ['vue', 'Vue', 'frontend apps built into static assets'],
  ['nuxt', 'Nuxt', 'Vue full-stack apps with server rendering'],
  ['sveltekit', 'SvelteKit', 'full-stack Svelte apps with adapter-aware builds'],
  ['fastapi', 'FastAPI', 'Python APIs with ASGI servers and environment variables'],
  ['django', 'Django', 'Python web apps with migrations, static assets, and databases'],
  ['flask', 'Flask', 'small Python APIs and web apps'],
  ['rails', 'Ruby on Rails', 'Ruby web applications with database migrations'],
  ['laravel', 'Laravel', 'PHP applications with queues, env vars, and databases'],
  ['go', 'Go', 'compiled HTTP services and APIs'],
  ['rust', 'Rust', 'compiled web services and APIs'],
  ['static-site', 'static sites', 'HTML, CSS, and JavaScript sites with HTTPS'],
  ['dockerfile', 'Dockerfile apps', 'custom container builds when Nixpacks is not enough'],
  ['custom-docker-image', 'custom Docker images', 'prebuilt images launched with env vars and volumes'],
] as const;

const features = [
  ['git-deployments', 'Git deployments', 'Deploy from Git repositories and rebuild from a branch when code changes.'],
  ['automatic-https', 'Automatic HTTPS', 'Issue and renew Let\'s Encrypt certificates through Caddy routing.'],
  ['custom-domains', 'Custom domains', 'Attach real domains to apps running on your own VPS.'],
  ['zero-downtime-deploys', 'Zero-downtime deploys', 'Start a new container, health-check it, then switch traffic.'],
  ['rollbacks', 'Rollbacks', 'Return to a previous successful deploy from the deployment history.'],
  ['managed-postgres', 'Managed Postgres', 'Create Postgres containers and inject connection details into apps.'],
  ['managed-redis', 'Managed Redis', 'Attach Redis services for queues, cache, and session storage.'],
  ['managed-mysql', 'Managed MySQL', 'Run MySQL-backed applications on the same private server network.'],
  ['live-logs', 'Live logs', 'Stream container logs in the dashboard without opening SSH.'],
  ['browser-terminal', 'Browser terminal', 'Use an in-browser shell for host and app operations.'],
  ['scheduled-jobs', 'Scheduled jobs', 'Run cron-style commands inside an application container.'],
  ['persistent-volumes', 'Persistent volumes', 'Keep application data across redeploys with Docker volumes.'],
  ['webhooks', 'Webhooks', 'Trigger auto-deploys from Git push events with per-app validation.'],
  ['deploy-notifications', 'Deploy notifications', 'Send Slack or webhook alerts when deployments succeed or fail.'],
  ['server-backups', 'Server backups', 'Snapshot control-plane data, logs, and configuration.'],
  ['database-explorer', 'Database Explorer', 'Inspect and edit database tables from the dashboard.'],
] as const;

const integrations = [
  ['github', 'GitHub', 'clone repositories, read branches, and receive push webhooks'],
  ['docker', 'Docker', 'run isolated containers for apps, databases, and catalog templates'],
  ['caddy', 'Caddy', 'route domains and automate HTTPS certificates'],
  ['nixpacks', 'Nixpacks', 'detect app frameworks and produce runnable images'],
  ['cloudflare', 'Cloudflare', 'manage DNS records for custom domains'],
  ['slack', 'Slack', 'send deployment notifications to team channels'],
  ['postgres', 'Postgres', 'provide relational databases for hosted apps'],
  ['redis', 'Redis', 'support cache, queues, and session-heavy workloads'],
  ['mysql', 'MySQL', 'run MySQL-backed CMS and business applications'],
  ['lets-encrypt', 'Let\'s Encrypt', 'issue free TLS certificates through Caddy'],
] as const;

const useCases = [
  ['self-hosted-paas', 'self-hosted PaaS', 'replace hosted deployment platforms with a control plane on your own server'],
  ['deploy-apps-on-vps', 'deploy apps on a VPS', 'turn a plain Linux server into a Git-based app host'],
  ['host-side-projects', 'host side projects', 'ship experiments without per-app platform fees'],
  ['agency-client-app-hosting', 'agency client app hosting', 'host client apps while keeping infrastructure ownership clear'],
  ['internal-tools-hosting', 'internal tools hosting', 'run dashboards, APIs, and automation tools privately'],
  ['home-lab-app-hosting', 'homelab app hosting', 'deploy private apps on a home server or small VPS'],
  ['open-source-app-hosting', 'open-source app hosting', 'launch catalog apps with domains, volumes, and backups'],
  ['ai-agent-app-hosting', 'AI agent app hosting', 'deploy agent frontends, APIs, and background jobs'],
  ['private-cloud-app-platform', 'private cloud app platform', 'keep apps, secrets, and runtime data on controlled infrastructure'],
  ['low-cost-heroku-replacement', 'low-cost Heroku replacement', 'cut recurring hosting bills for small applications'],
  ['solo-founder-hosting', 'solo founder hosting', 'run product experiments and MVPs on one practical server'],
  ['developer-team-platform', 'developer team platform', 'give small teams a repeatable deployment workflow'],
  ['database-backed-apps', 'database-backed app hosting', 'pair applications with Postgres, Redis, or MySQL containers'],
  ['secure-client-portals', 'secure client portals', 'host private dashboards and portals with HTTPS and backups'],
] as const;

const glossary = [
  ['paas', 'PaaS', 'Platform as a Service software that builds, runs, and manages applications.'],
  ['self-hosted-paas', 'self-hosted PaaS', 'A PaaS you install on infrastructure you control.'],
  ['reverse-proxy', 'reverse proxy', 'A server that receives web traffic and forwards it to the right app.'],
  ['caddy', 'Caddy', 'A web server often used for automatic HTTPS and reverse proxying.'],
  ['nixpacks', 'Nixpacks', 'A build system that detects app frameworks and creates runnable images.'],
  ['docker-container', 'Docker container', 'An isolated runtime unit for an application and its dependencies.'],
  ['zero-downtime-deployment', 'zero-downtime deployment', 'A release process that avoids serving downtime during deploys.'],
  ['blue-green-deployment', 'blue-green deployment', 'A release pattern that switches traffic from one environment to another.'],
  ['webhook-deployment', 'webhook deployment', 'A deployment triggered by an HTTP event, often from Git pushes.'],
  ['custom-domain', 'custom domain', 'A domain name you attach to a deployed application.'],
  ['lets-encrypt', 'Let\'s Encrypt', 'A certificate authority that provides free TLS certificates.'],
  ['vps', 'VPS', 'A virtual private server rented from a hosting provider.'],
  ['gitops', 'GitOps', 'Using Git state and events to drive deployment operations.'],
  ['environment-variable', 'environment variable', 'A configuration value supplied to an app at runtime.'],
  ['persistent-volume', 'persistent volume', 'Storage that survives container replacement and redeploys.'],
  ['health-check', 'health check', 'A request used to confirm an app is ready for traffic.'],
  ['rollback', 'rollback', 'Returning an application to a previous working deployment.'],
  ['buildpack', 'buildpack', 'A tool that detects source code and builds a runnable app image.'],
  ['control-plane', 'control plane', 'The service that coordinates deployment, routing, databases, and configuration.'],
  ['managed-database', 'managed database', 'A database provisioned and connected through the platform workflow.'],
  ['dockerfile', 'Dockerfile', 'A file that describes how to build a Docker image.'],
  ['ssl-certificate', 'SSL certificate', 'A certificate used to secure HTTPS traffic.'],
  ['tls', 'TLS', 'The protocol used to encrypt HTTPS connections.'],
  ['cron-job', 'cron job', 'A scheduled command that runs at specific times.'],
  ['container-log', 'container log', 'Output written by a running container.'],
  ['domain-routing', 'domain routing', 'Mapping incoming domains to the correct application container.'],
  ['git-branch', 'Git branch', 'A named line of source code history used for deployment.'],
  ['private-repository', 'private repository', 'A Git repository requiring authentication to clone.'],
  ['secret-encryption', 'secret encryption', 'Protecting sensitive values before storing them.'],
  ['docker-network', 'Docker network', 'A private network containers use to communicate.'],
  ['app-catalog', 'app catalog', 'A curated list of preconfigured applications that can be deployed quickly.'],
  ['self-hosting', 'self-hosting', 'Running software on infrastructure you administer.'],
  ['serverless', 'serverless', 'A managed compute model where infrastructure operations are abstracted away.'],
  ['edge-deployment', 'edge deployment', 'Running application code close to users across regions.'],
  ['container-orchestration', 'container orchestration', 'Coordinating container scheduling, networking, and lifecycle.'],
  ['deployment-platform', 'deployment platform', 'Software that turns source code or images into running applications.'],
] as const;

const fixes = [
  ['docker-app-wont-start', 'Docker app will not start', 'check logs, start commands, env vars, and container ports'],
  ['port-environment-variable', 'PORT environment variable issues', 'make the app listen on the platform-provided PORT value'],
  ['lets-encrypt-certificate-failed', 'Let\'s Encrypt certificate failed', 'verify DNS, ports, and domain routing before retrying'],
  ['github-webhook-not-working', 'GitHub webhook not working', 'confirm webhook URL, branch, delivery status, and secret validation'],
  ['private-repo-clone-failed', 'private repository clone failed', 'check token permissions and saved Git credentials'],
  ['docker-container-out-of-memory', 'Docker container out of memory', 'inspect resource usage and tune app limits or server size'],
  ['vps-disk-full-docker', 'VPS disk full from Docker', 'prune old images, review logs, and move persistent data carefully'],
  ['nextjs-deployment-failed', 'Next.js deployment failed', 'review build command, Node version, and start command'],
  ['postgres-connection-refused', 'Postgres connection refused', 'check database container status and injected connection variables'],
  ['caddy-domain-routing', 'Caddy domain routing problems', 'verify Caddy config, app health, DNS, and ports'],
  ['nixpacks-build-failed', 'Nixpacks build failed', 'inspect framework detection, lockfiles, and build scripts'],
  ['app-health-check-failed', 'app health check failed', 'confirm the app responds after startup before traffic switches'],
  ['redis-connection-failed', 'Redis connection failed', 'check service status, network, and environment variables'],
  ['mysql-connection-failed', 'MySQL connection failed', 'verify credentials, host values, and database readiness'],
  ['custom-domain-not-resolving', 'custom domain not resolving', 'confirm DNS records point to the server IP'],
  ['deployment-rollback-needed', 'deployment rollback needed', 'use deployment history to restore the last working release'],
  ['logs-not-streaming', 'logs not streaming', 'check app status, websocket access, and dashboard API reachability'],
  ['admin-token-lost', 'admin token lost', 'reprint the token on the server and store it securely'],
  ['dashboard-cannot-reach-api', 'dashboard cannot reach API', 'check API URL, CORS origin, proxy settings, and network access'],
  ['cron-job-not-running', 'scheduled job not running', 'verify cron expression, app container state, and command path'],
] as const;

const bestLists = [
  ['self-hosted-paas', 'Best self-hosted PaaS tools', 'open-source and VPS-based platforms for deploying applications'],
  ['heroku-alternatives', 'Best Heroku alternatives', 'hosted and self-hosted options for replacing Heroku workflows'],
  ['open-source-paas', 'Best open-source PaaS platforms', 'deployment platforms with inspectable source code'],
  ['vps-control-panels-for-developers', 'Best VPS control panels for developers', 'tools focused on app deployment rather than shared hosting'],
  ['self-hosted-app-platforms', 'Best self-hosted app platforms', 'platforms for hosting apps, services, and databases'],
  ['docker-deployment-tools', 'Best Docker deployment tools', 'ways to run Docker apps without hand-managing every release'],
  ['coolify-alternatives', 'Best Coolify alternatives', 'self-hosted and hosted tools with similar deployment goals'],
  ['dokku-alternatives', 'Best Dokku alternatives', 'dashboard and Git-based alternatives to CLI-first deployments'],
  ['render-alternatives', 'Best Render alternatives', 'managed and self-hosted deployment platforms'],
  ['vercel-alternatives', 'Best Vercel alternatives', 'frontend, full-stack, and self-hosted deployment options'],
] as const;

const deploymentTemplates = [
  { slug: 'nextjs-postgres', name: 'Next.js + Postgres', description: 'Full-stack Next.js app with PostgreSQL database and automatic HTTPS', stack: ['Next.js', 'Postgres', 'Docker', 'Nixpacks'], effort: '5 minutes', useCase: 'SaaS apps, dashboards, content sites' },
  { slug: 'fastapi-redis', name: 'FastAPI + Redis', description: 'Python API with Redis cache, background jobs, and uvicorn server', stack: ['FastAPI', 'Redis', 'Docker', 'Nixpacks'], effort: '5 minutes', useCase: 'APIs, microservices, automation backends' },
  { slug: 'nodejs-mongodb', name: 'Node.js + MongoDB', description: 'Express or NestJS app with MongoDB for document-based data', stack: ['Node.js', 'MongoDB', 'Docker', 'Nixpacks'], effort: '8 minutes', useCase: 'Real-time apps, CMS backends, APIs' },
  { slug: 'rails-postgres', name: 'Ruby on Rails + Postgres', description: 'Rails application with PostgreSQL, migrations, and ActiveRecord', stack: ['Ruby on Rails', 'Postgres', 'Docker', 'Nixpacks'], effort: '8 minutes', useCase: 'Marketplaces, SaaS, internal tools' },
  { slug: 'laravel-mysql', name: 'Laravel + MySQL', description: 'PHP Laravel app with MySQL database and artisan queues', stack: ['Laravel', 'MySQL', 'Docker', 'Nixpacks'], effort: '8 minutes', useCase: 'Web apps, portals, e-commerce backends' },
  { slug: 'static-site-https', name: 'Static Site + HTTPS', description: 'JAMstack site deployed with automatic HTTPS and custom domain', stack: ['HTML/CSS/JS', 'Caddy', 'Docker'], effort: '3 minutes', useCase: 'Landing pages, docs, blogs, portfolios' },
  { slug: 'docker-compose-stack', name: 'Docker Compose Stack', description: 'Multi-service deployment using docker-compose with persistent volumes', stack: ['Docker Compose', 'Caddy', 'VPS'], effort: '10 minutes', useCase: 'Complex apps with multiple services' },
  { slug: 'custom-docker-image', name: 'Custom Docker Image', description: 'Deploy a pre-built Docker image with environment variables and volumes', stack: ['Docker', 'Custom Image', 'Caddy'], effort: '5 minutes', useCase: 'Legacy apps, pre-built services, AI/ML APIs' },
] as const;

const deploymentExamples = [
  { slug: 'nextjs-blog-with-postgres', name: 'Next.js Blog with Postgres', description: 'A production-ready Next.js blog with PostgreSQL, Prisma ORM, and Tailwind CSS deployed on a VPS with automatic HTTPS.', tags: ['Next.js', 'Postgres', 'Prisma', 'Blog'], complexity: 'Beginner' },
  { slug: 'fastapi-microservice-with-redis', name: 'FastAPI Microservice with Redis', description: 'A Python microservice using FastAPI and Redis for caching and background task queuing with uvicorn server.', tags: ['FastAPI', 'Redis', 'Microservice', 'Python'], complexity: 'Intermediate' },
  { slug: 'nodejs-realtime-chat', name: 'Node.js Realtime Chat', description: 'A Socket.io-based realtime chat application with MongoDB for message persistence and Express backend.', tags: ['Node.js', 'Socket.io', 'MongoDB', 'Realtime'], complexity: 'Intermediate' },
  { slug: 'rails-ecommerce-marketplace', name: 'Rails E-commerce Marketplace', description: 'A multi-vendor marketplace built with Ruby on Rails, PostgreSQL, and Stripe integration for payments.', tags: ['Rails', 'Postgres', 'Stripe', 'Marketplace'], complexity: 'Advanced' },
  { slug: 'laravel-cms-with-mysql', name: 'Laravel CMS with MySQL', description: 'A content management system built with Laravel, MySQL, and Filament admin panel for content editing.', tags: ['Laravel', 'MySQL', 'CMS', 'Filament'], complexity: 'Intermediate' },
  { slug: 'static-portfolio-site', name: 'Static Portfolio Site', description: 'A fast, SEO-optimized portfolio website deployed as static files with automatic HTTPS and custom domain.', tags: ['HTML/CSS', 'Static', 'Portfolio', 'Landing'], complexity: 'Beginner' },
  { slug: 'docker-wordpress-with-mysql', name: 'Docker WordPress with MySQL', description: 'A WordPress site running in Docker with MySQL database, persistent volumes, and automated backups.', tags: ['WordPress', 'MySQL', 'Docker', 'CMS'], complexity: 'Beginner' },
  { slug: 'multi-service-docker-compose', name: 'Multi-service Docker Compose', description: 'A complex application with frontend, backend API, database, and cache service orchestrated via Docker Compose.', tags: ['Docker Compose', 'Multi-service', 'Architecture', 'Full-stack'], complexity: 'Advanced' },
] as const;

function href(family: SeoFamily, slug: string) {
  return `${familyPath[family]}/${slug}`;
}

function altPage(c: (typeof competitors)[number]): SeoPage {
  const whenBetterFitTitle =
    c.slug === 'heroku'
      ? 'When to switch from Heroku dynos'
      : c.slug === 'coolify'
        ? 'When Better-PaaS fits instead of Coolify'
        : c.slug === 'vercel'
          ? 'When self-hosting beats Vercel'
          : c.slug === 'kubernetes'
            ? 'When a single-server PaaS is enough'
            : `When ${appName} is a better fit than ${c.name}`;

  return {
    family: 'alternatives',
    slug: c.slug,
    title: `${c.name} Alternative for Self-Hosted Deployments | ${appName}`,
    h1: `${c.name} alternative for self-hosted app deployment`,
    description: `Compare ${c.name} with ${appName} when you want Git-based deployments, automatic HTTPS, databases, and server ownership on your own VPS.`,
    eyebrow: 'Alternative',
    intent: `${c.name} alternative, self-hosted PaaS, open-source deployment platform`,
    summary: `${c.name} is strong for ${c.angle}. ${appName} is for developers who want a lighter self-hosted platform: push code from Git, run apps as Docker containers, route traffic through Caddy, and keep apps, secrets, and data on infrastructure they control.`,
    primaryKeyword: `${c.name} alternative`,
    secondaryKeywords: [`self-hosted ${c.name} alternative`, `open source ${c.name} alternative`, `${c.name} vs ${appName}`],
    sections: [
      {
        title: whenBetterFitTitle,
        body: `${appName} fits teams that want the Heroku-style workflow without handing the runtime to a hosted provider. It is especially useful for small products, internal tools, homelab services, and client apps that should stay on a VPS or private server.`,
        bullets: ['Git-based deploys', 'Docker container runtime', 'Automatic HTTPS through Caddy', 'Postgres, Redis, and MySQL support', 'No per-seat platform pricing'],
      },
      {
        title: `When ${c.name} may still win`,
        body: `Choose ${c.name} if ${c.choose}. A good comparison page should be honest: hosted platforms and larger orchestration systems can be better when you need managed global infrastructure, enterprise support, or deep ecosystem integrations.`,
      },
      {
        title: c.slug === 'heroku' ? 'Moving from Heroku dynos' : c.slug === 'vercel' ? 'Migrating from Vercel' : `Migration path from ${c.name}`,
        body: `Most teams start by installing ${appName} on a VPS, connecting the same Git repository, setting environment variables, adding a database if needed, then pointing a custom domain once the app is healthy.`,
        bullets: ['Install Better-PaaS on a Linux VPS', 'Connect the repository and branch', 'Copy environment variables', 'Deploy and inspect logs', 'Switch DNS after validation'],
      },
    ],
    faqs: [
      { question: `Is ${appName} a drop-in replacement for ${c.name}?`, answer: `Not always. ${appName} is self-hosted, so it replaces the deployment workflow more than the managed infrastructure contract. You own the server and the maintenance choices.` },
      { question: `Does ${appName} support custom domains and HTTPS?`, answer: 'Yes. Better-PaaS uses Caddy to route domains and automate HTTPS certificates when DNS points to your server.' },
    ],
    related: ['/alternatives', '/compare', '/deploy/nextjs', '/features/automatic-https', quickstart],
    schemaType: 'SoftwareApplication',
    datePublished: launchDate,
    dateModified: lastUpdated,
    lastReviewed: lastUpdated,
  };
}

function comparePage(left: string, right: (typeof competitors)[number]): SeoPage {
  const slug = `${left.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-vs-${right.slug}`;
  const decisionTitle =
    right.slug === 'heroku'
      ? 'Heroku dynos vs your own VPS'
      : right.slug === 'kubernetes'
        ? 'Single server vs cluster orchestration'
        : right.slug === 'docker-compose'
          ? 'Dashboard vs manual YAML'
          : 'Decision summary';
  const featureTitle =
    right.slug === 'heroku'
      ? 'Platform add-ons vs self-hosted services'
      : right.slug === 'vercel'
        ? 'Edge network vs single-server hosting'
        : right.slug === 'coolify'
          ? 'Control plane comparison'
          : 'Feature comparison';

  const comparisonTable: ComparisonRow[] = [
    {
      criterion: 'Hosting model',
      appName: 'Self-hosted on your VPS',
      competitor: right.slug.includes('kubernetes') || right.slug === 'docker-compose' ? 'Self-managed orchestration' : 'Hosted platform',
      winner: null,
    },
    {
      criterion: 'Server ownership',
      appName: 'You own the server and data',
      competitor: 'Provider manages infrastructure',
      winner: 'app',
    },
    {
      criterion: 'Pricing predictability',
      appName: 'Flat VPS cost, no per-app fees',
      competitor: right.slug === 'heroku' ? 'Per-dyno and add-on pricing' : right.slug === 'vercel' ? 'Usage-based with limits' : right.slug === 'kubernetes' ? 'Cluster + operator costs' : 'Usage or seat-based billing',
      winner: 'app',
    },
    {
      criterion: 'Setup complexity',
      appName: 'Install control plane, then dashboard deploys',
      competitor: right.slug === 'heroku' ? 'Push to Git, dyno starts' : right.slug === 'kubernetes' ? 'Cluster setup, YAML manifests' : right.slug === 'docker-compose' ? 'SSH + docker-compose up' : 'Web UI or CLI connected to account',
      winner: 'competitor',
    },
    {
      criterion: 'Custom domains & HTTPS',
      appName: 'Automatic via Caddy',
      competitor: right.slug === 'heroku' ? 'Available with paid dynos' : right.slug === 'vercel' ? 'Automatic, edge-optimized' : 'Manual or add-on dependent',
      winner: 'tie',
    },
    {
      criterion: 'Database management',
      appName: 'One-click Postgres, Redis, MySQL containers',
      competitor: right.slug === 'heroku' ? 'Heroku Postgres add-ons' : right.slug === 'kubernetes' ? 'StatefulSets or external DB' : right.slug === 'docker-compose' ? 'Manual container linking' : 'Managed or self-hosted options',
      winner: 'tie',
    },
    {
      criterion: 'Rollback & logs',
      appName: 'Built-in rollback, live logs in dashboard',
      competitor: right.slug === 'heroku' ? 'Release history, Heroku logs' : 'Varies by tooling',
      winner: 'tie',
    },
    {
      criterion: 'Multi-region / scaling',
      appName: 'Single server focused',
      competitor: right.slug === 'heroku' || right.slug === 'vercel' ? 'Built-in global distribution' : right.slug === 'kubernetes' ? 'Native multi-node scheduling' : 'Manual server scaling',
      winner: 'competitor',
    },
  ];

  return {
    family: 'compare',
    slug,
    title: `${appName} vs ${right.name}: Which Deployment Platform Should You Use?`,
    h1: `${appName} vs ${right.name}`,
    description: `Compare ${appName} and ${right.name} across hosting model, deployment workflow, databases, HTTPS, pricing, and server ownership.`,
    eyebrow: 'Comparison',
    intent: `${appName} vs ${right.name}, ${right.name} comparison`,
    summary: `${appName} and ${right.name} solve related deployment problems, but they make different tradeoffs. ${appName} emphasizes self-hosting, server ownership, Docker containers, and a simple dashboard. ${right.name} is known for ${right.angle}.`,
    primaryKeyword: `${appName} vs ${right.name}`,
    secondaryKeywords: [`${right.name} comparison`, `${right.name} alternative`, 'self-hosted PaaS comparison'],
    sections: [
      {
        title: decisionTitle,
        body: `Pick ${appName} when ownership, predictable server cost, and a lightweight self-hosted control plane matter. Pick ${right.name} when ${right.choose}.`,
      },
      {
        title: featureTitle,
        body: `${appName} gives you Git deploys, custom domains, automatic HTTPS, rollbacks, logs, scheduled jobs, backups, and one-click databases on a server you control. The key question is whether you want to operate that server or pay a platform to abstract it away.`,
        bullets: ['Hosting model', 'Deployment workflow', 'Database handling', 'Rollback and logs', 'Maintenance responsibility'],
      },
      {
        title: right.slug === 'heroku' ? 'Pricing: dyno cost vs VPS cost' : 'Cost and control',
        body: `A self-hosted platform can be dramatically cheaper for many small apps because the main cost is the VPS. The tradeoff is operational responsibility: updates, server resources, backups, and security hygiene remain your job.`,
      },
    ],
    faqs: [
      { question: `Is ${appName} cheaper than ${right.name}?`, answer: 'It can be for small apps because you pay for your own server instead of per-service or usage-based platform layers. Actual cost depends on server size and maintenance time.' },
      { question: `Can I migrate from ${right.name} to ${appName}?`, answer: 'Usually yes if your app can run from Git or a Docker image and you can recreate environment variables, databases, and domains.' },
    ],
    related: [href('alternatives', right.slug), '/compare', '/features/git-deployments', '/features/rollbacks', quickstart],
    schemaType: 'TechArticle',
    datePublished: launchDate,
    dateModified: lastUpdated,
    lastReviewed: lastUpdated,
    comparisonTable,
  };
}

function deployAppPage(app: (typeof appCatalog)[number]): SeoPage {
  const [slug, name, purpose, category, note] = app;
  return {
    family: 'deploy',
    slug,
    title: `Deploy ${name} on Your VPS with HTTPS | ${appName}`,
    h1: `Deploy ${name} on your own VPS`,
    description: `Use ${appName} to deploy ${name} with Docker containers, persistent storage, custom domains, automatic HTTPS, logs, and backups.`,
    eyebrow: `${category} App`,
    intent: `deploy ${name} on VPS, self-host ${name}, ${name} Docker hosting`,
    summary: `${name} is useful for ${purpose}. ${appName} gives it a practical home on your own server with a one-click app workflow, domain routing, HTTPS, logs, and persistent storage habits.`,
    primaryKeyword: `deploy ${name} on VPS`,
    secondaryKeywords: [`self-host ${name}`, `${name} Docker deploy`, `${name} HTTPS VPS`],
    sections: [
      { title: `Why host ${name} with ${appName}`, body: `Better-PaaS is designed for apps like ${name}: small services that need reliable routing, a domain, persistent data, and quick redeploys without manually editing reverse proxy files.` },
      { title: 'Deployment checklist', body: `Before going live, decide the domain, persistent volume, backup cadence, and any environment variables ${name} needs. For ${name}, pay special attention to ${note}.`, bullets: ['Choose the app catalog template or Docker image', 'Add required environment variables', 'Attach a persistent volume if data must survive redeploys', 'Deploy and inspect logs', 'Add a custom domain after the app is healthy'] },
      { title: 'Operations after launch', body: `Watch logs during the first deploy, confirm storage survives a redeploy, and include the app data in server backups. If the service exposes an admin area, use a strong password and restrict access where appropriate.` },
    ],
    faqs: [
      { question: `Can ${name} run with automatic HTTPS?`, answer: 'Yes. Add a domain in Better-PaaS after DNS points to the server and Caddy can issue a certificate.' },
      { question: `Does ${name} need persistent storage?`, answer: `Most ${category.toLowerCase()} apps need some persistent storage or database plan. Treat app data and config as something to back up.` },
    ],
    related: ['/catalog', '/deploy', '/features/persistent-volumes', '/features/automatic-https', '/docs/guides/app-catalog'],
    schemaType: 'HowTo',
    datePublished: launchDate,
    dateModified: lastUpdated,
    lastReviewed: lastUpdated,
  };
}

function deployStackPage(stack: (typeof stacks)[number]): SeoPage {
  const [slug, name, detail] = stack;
  return {
    family: 'deploy',
    slug,
    title: `Deploy ${name} Apps on a VPS | ${appName}`,
    h1: `Deploy ${name} apps on your own VPS`,
    description: `Deploy ${name} applications from Git with Better-PaaS, Nixpacks, Docker containers, automatic HTTPS, logs, and rollback support.`,
    eyebrow: 'Framework Deploy',
    intent: `deploy ${name} on VPS, self-host ${name}, ${name} Docker deployment`,
    summary: `${appName} can deploy ${name} projects from a Git repository or Docker image. The platform builds the app, runs it in a container, routes traffic through Caddy, and gives you logs, env vars, domains, databases, and rollbacks from the dashboard.`,
    primaryKeyword: `deploy ${name} on VPS`,
    secondaryKeywords: [`self-host ${name}`, `${name} Docker deploy`, `${name} automatic HTTPS`],
    sections: [
      { title: 'What Better-PaaS expects', body: `${name} projects should have a clear build and start path. For this stack, the common shape is ${detail}. If Nixpacks does not detect the project correctly, use explicit build/start commands or a Dockerfile.` },
      { title: 'Deployment steps', body: `Connect the repository, choose the branch, set environment variables, attach any database, deploy, then verify the app responds on the platform-provided port. Better-PaaS will handle container lifecycle and HTTPS routing after the app is healthy.`, bullets: ['Connect Git repository', 'Set build and runtime variables', 'Add Postgres, Redis, or MySQL if needed', 'Deploy and inspect logs', 'Add domain and verify HTTPS'] },
      { title: 'Common mistakes', body: `The most common issue is hard-coding a port instead of listening on the provided PORT variable. Build failures usually come from missing lockfiles, missing scripts, or framework detection that needs a custom Dockerfile.` },
    ],
    faqs: [
      { question: `Can Better-PaaS deploy ${name} from Git?`, answer: 'Yes, when the repository can be built by Nixpacks or by a Dockerfile you provide.' },
      { question: `Can ${name} apps use databases?`, answer: 'Yes. Better-PaaS can provision Postgres, Redis, and MySQL containers and inject connection variables into apps.' },
    ],
    related: ['/deploy', deployGuide, '/features/git-deployments', '/features/automatic-https', '/fix/port-environment-variable'],
    schemaType: 'HowTo',
    datePublished: launchDate,
    dateModified: lastUpdated,
    lastReviewed: lastUpdated,
  };
}

function featurePage(feature: (typeof features)[number]): SeoPage {
  const [slug, name, detail] = feature;
  return {
    family: 'features',
    slug,
    title: `${name} for Self-Hosted Apps | ${appName}`,
    h1: `${name} in Better-PaaS`,
    description: `${detail} Learn how this Better-PaaS feature helps you deploy and manage applications on your own server.`,
    eyebrow: 'Feature',
    intent: `${name} self-hosted PaaS, ${name} Docker deployment`,
    summary: `${name} is part of the Better-PaaS workflow for turning a VPS into a practical app platform. It reduces manual server work while keeping infrastructure, runtime data, and credentials under your control.`,
    primaryKeyword: `${name} self-hosted PaaS`,
    secondaryKeywords: [`${name} VPS`, `${name} Docker apps`, `${appName} ${name}`],
    sections: [
      { title: 'What it does', body: detail },
      { title: 'Why it matters', body: `Small teams often lose time on repeated server tasks: editing proxy configs, watching logs over SSH, managing env vars, and recovering from bad deploys. ${name} gives that workflow a predictable place in the dashboard.` },
      { title: 'How to use it well', body: 'Keep the setup simple, test with a small app first, and verify the operational path before relying on it for production workloads.', bullets: ['Start with one app', 'Check logs after each deployment', 'Document environment variables', 'Create backups for stateful services'] },
    ],
    faqs: [
      { question: `Does ${name} require Kubernetes?`, answer: 'No. Better-PaaS is designed around Docker containers, Caddy routing, and a lightweight Go control plane.' },
      { question: `Is ${name} available for every app?`, answer: 'Most features apply broadly, but stateful apps, custom Docker images, and unusual networking setups may need extra configuration.' },
    ],
    related: ['/features', '/platform', deployGuide, '/deploy/nextjs', quickstart],
    schemaType: 'TechArticle',
    datePublished: launchDate,
    dateModified: lastUpdated,
    lastReviewed: lastUpdated,
  };
}

function integrationPage(integration: (typeof integrations)[number]): SeoPage {
  const [slug, name, detail] = integration;
  return {
    family: 'integrations',
    slug,
    title: `${name} Integration for Self-Hosted Deployments | ${appName}`,
    h1: `${name} and Better-PaaS`,
    description: `How Better-PaaS works with ${name} to ${detail} in a self-hosted deployment workflow.`,
    eyebrow: 'Integration',
    intent: `${name} Better-PaaS integration, ${name} self-hosted deployment`,
    summary: `${name} helps Better-PaaS ${detail}. The integration keeps the platform workflow practical without hiding the underlying infrastructure from you.`,
    primaryKeyword: `${name} Better-PaaS integration`,
    secondaryKeywords: [`${name} self-hosted PaaS`, `${name} Docker deployment`, `${name} VPS apps`],
    sections: [
      { title: 'Role in the workflow', body: `${name} is used to ${detail}. It supports the broader Better-PaaS goal: deploy from source or image, run in containers, route traffic securely, and keep operations understandable.` },
      { title: 'Setup considerations', body: `Configuration depends on the integration. Always verify credentials, network access, DNS, and app health before switching production traffic.`, bullets: ['Confirm credentials and permissions', 'Check environment variables', 'Inspect logs after setup', 'Document any external dependency'] },
      { title: 'Operational guidance', body: `Treat integrations as part of your deployment system. Rotate secrets when needed, back up stateful services, and keep the server updated.` },
    ],
    faqs: [
      { question: `Is ${name} required for Better-PaaS?`, answer: 'Some integrations are core platform dependencies, while others are optional workflow integrations. The setup guide for each feature explains when it matters.' },
      { question: `Can I use ${name} with custom Docker images?`, answer: 'Usually yes when the app image exposes the right port and accepts configuration through environment variables.' },
    ],
    related: ['/integrations', '/docs/guides/integrations', '/features/git-deployments', '/features/automatic-https', quickstart],
    schemaType: 'TechArticle',
    datePublished: launchDate,
    dateModified: lastUpdated,
    lastReviewed: lastUpdated,
  };
}

function useCasePage(useCase: (typeof useCases)[number]): SeoPage {
  const [slug, name, detail] = useCase;
  return {
    family: 'use-cases',
    slug,
    title: `${name} with ${appName}`,
    h1: `${name} with Better-PaaS`,
    description: `Use Better-PaaS to ${detail} with Git deploys, Docker containers, automatic HTTPS, databases, logs, and backups.`,
    eyebrow: 'Use Case',
    intent: `${name}, self-hosted app platform, deploy apps on VPS`,
    summary: `${name} is a strong fit for Better-PaaS because the platform makes one server feel like a practical app platform. You keep control of infrastructure while getting a dashboard for deploys, logs, domains, databases, and rollbacks.`,
    primaryKeyword: name,
    secondaryKeywords: [`${name} VPS`, `${name} Docker`, `${name} self hosted`],
    sections: [
      { title: 'Who this is for', body: `This use case fits developers and teams that want to ${detail}, without building a deployment platform from scratch or paying for every small service separately.` },
      { title: 'Recommended setup', body: 'Start with a small VPS, install Better-PaaS, connect Git, deploy one app, add a domain, then add databases and backups once the workflow is proven.', bullets: ['One control-plane server', 'Git repositories for app source', 'Custom domains through DNS', 'Backups for control-plane and app data'] },
      { title: 'Risks to manage', body: 'Self-hosting gives control, but it also means you own patching, server sizing, backups, and incident response. Keep production workloads boring and documented.' },
    ],
    faqs: [
      { question: `Is Better-PaaS good for ${name}?`, answer: 'Yes when you want simple self-hosted deployments and are comfortable owning the server.' },
      { question: 'How many apps can one server run?', answer: 'As many as the CPU, memory, disk, and network capacity can reasonably support. Start small and monitor resource usage.' },
    ],
    related: ['/use-cases', '/pricing', '/features/server-backups', '/features/live-logs', quickstart],
    schemaType: 'TechArticle',
    datePublished: launchDate,
    dateModified: lastUpdated,
    lastReviewed: lastUpdated,
  };
}

function glossaryPage(item: (typeof glossary)[number]): SeoPage {
  const [slug, name, definition] = item;
  return {
    family: 'glossary',
    slug,
    title: `What Is ${name}? | ${appName} Glossary`,
    h1: `What is ${name}?`,
    description: `${definition} Learn what ${name} means in self-hosted deployment and Better-PaaS workflows.`,
    eyebrow: 'Glossary',
    intent: `what is ${name}, ${name} definition`,
    summary: definition,
    primaryKeyword: `what is ${name}`,
    secondaryKeywords: [`${name} meaning`, `${name} deployment`, `${name} self hosting`],
    sections: [
      { title: 'Plain-English definition', body: definition },
      { title: 'Why developers care', body: `${name} matters because deployment platforms are built from small operational concepts. Understanding the term makes it easier to debug apps, choose tools, and operate a server safely.` },
      { title: `How ${appName} uses the concept`, body: `Better-PaaS uses practical deployment primitives so you can deploy apps without memorizing every low-level command. When this concept appears in the dashboard or docs, it is tied to running real apps on your own infrastructure.` },
    ],
    faqs: [
      { question: `Is ${name} only relevant to Better-PaaS?`, answer: 'No. The term is common across developer platforms, cloud hosting, Docker, and self-hosting.' },
      { question: `Do I need to understand ${name} before using Better-PaaS?`, answer: 'Usually not deeply. Better-PaaS handles many details, but knowing the basics helps when debugging.' },
    ],
    related: ['/glossary', '/docs', '/features/git-deployments', '/deploy', quickstart],
    schemaType: 'DefinedTerm',
    datePublished: launchDate,
    dateModified: lastUpdated,
    lastReviewed: lastUpdated,
  };
}

function fixPage(problem: (typeof fixes)[number]): SeoPage {
  const [slug, name, detail] = problem;
  return {
    family: 'fix',
    slug,
    title: `How to Fix ${name} | ${appName}`,
    h1: `How to fix ${name}`,
    description: `Troubleshoot ${name} by checking ${detail} in a Docker, VPS, or Better-PaaS deployment workflow.`,
    eyebrow: 'Troubleshooting',
    intent: `fix ${name}, ${name} Docker VPS`,
    summary: `When ${name}, slow down and isolate the failure: build, runtime, networking, DNS, credentials, or resources. Better-PaaS gives you logs, deployment history, server tools, and configuration screens to work through the problem systematically.`,
    primaryKeyword: `fix ${name}`,
    secondaryKeywords: [`${name} Docker`, `${name} VPS`, `${name} Better-PaaS`],
    sections: [
      { title: 'Start here', body: `First, ${detail}. Then check the most recent deployment logs and confirm whether the app failed during build, startup, health check, or routing.` },
      { title: 'Step-by-step checks', body: 'Work from the app outward: source code, build output, runtime command, env vars, container health, router, DNS, then external services.', bullets: ['Read the latest logs', 'Confirm the app listens on the expected port', 'Verify required environment variables', 'Check database or service containers', 'Retry after fixing one variable at a time'] },
      { title: 'Prevent it next time', body: 'Keep build scripts explicit, document env vars, set backups for stateful apps, and verify a staging deployment before switching a production domain.' },
    ],
    faqs: [
      { question: `Can Better-PaaS show logs for ${name}?`, answer: 'Yes. Better-PaaS streams container logs in the dashboard and stores logs on disk for troubleshooting.' },
      { question: 'Should I redeploy immediately?', answer: 'Only after changing one likely cause. Repeated redeploys without reading logs usually hide the real issue.' },
    ],
    related: ['/fix', '/docs/troubleshooting', '/features/live-logs', '/features/rollbacks', deployGuide],
    schemaType: 'HowTo',
    datePublished: launchDate,
    dateModified: lastUpdated,
    lastReviewed: lastUpdated,
  };
}

function templatePage(tpl: (typeof deploymentTemplates)[number]): SeoPage {
  return {
    family: 'templates',
    slug: tpl.slug,
    title: `${tpl.name} Deployment Template | ${appName}`,
    h1: `${tpl.name} deployment template`,
    description: `${tpl.description}. Deploy this stack on your own VPS with Git, Docker, automatic HTTPS, and persistent storage.`,
    eyebrow: 'Template',
    intent: `${tpl.name} deployment template, deploy ${tpl.name} on VPS`,
    summary: `${tpl.description}. This template is pre-configured for ${appName}: push your code, add environment variables, attach the required database, and go live with automatic HTTPS. Most teams can deploy this stack in ${tpl.effort}.`,
    primaryKeyword: `${tpl.name} deployment template`,
    secondaryKeywords: [`deploy ${tpl.name}`, `${tpl.name} VPS`, `${tpl.name} self-hosted`],
    sections: [
      {
        title: 'What this template includes',
        body: `This template packages ${tpl.stack.join(', ')} into a repeatable deployment. Better-PaaS handles the build, containerization, routing, and HTTPS so you can focus on the application logic.`,
        bullets: tpl.stack.map((s) => `${s} pre-configured`),
      },
      {
        title: 'Best for',
        body: `Use this template when you want to ${tpl.useCase.toLowerCase()} without spending time on server setup, reverse proxy configuration, or manual Docker orchestration.`,
      },
      {
        title: 'Deploy in ' + tpl.effort,
        body: `Connect your repository, choose this template or let Nixpacks auto-detect, set environment variables, attach the database service, and deploy. Better-PaaS issues HTTPS certificates automatically once DNS points to your server.`,
        bullets: ['Connect Git repository', 'Set build and runtime variables', 'Add required database or cache service', 'Deploy and inspect logs', 'Add domain and verify HTTPS'],
      },
    ],
    faqs: [
      { question: `Can I customize the ${tpl.name} template?`, answer: 'Yes. The template is a starting point. You can modify environment variables, add volumes, change the build command, or switch to a custom Dockerfile at any time.' },
      { question: `Is this template suitable for production?`, answer: `Yes when you add backups, monitoring, and proper resource sizing. Start with a small VPS and scale the server as traffic grows.` },
    ],
    related: ['/deploy', '/catalog', '/features/git-deployments', '/features/automatic-https', quickstart],
    schemaType: 'HowTo',
    datePublished: launchDate,
    dateModified: lastUpdated,
    lastReviewed: lastUpdated,
  };
}

function examplePage(ex: (typeof deploymentExamples)[number]): SeoPage {
  return {
    family: 'examples',
    slug: ex.slug,
    title: `${ex.name} — Deployment Example | ${appName}`,
    h1: `${ex.name}: deployment example`,
    description: `${ex.description} See how to deploy this stack on your own VPS with Better-PaaS.`,
    eyebrow: 'Example',
    intent: `${ex.name} deployment example, ${ex.tags.join(' ')} example`,
    summary: `${ex.description} This example walks through the complete deployment: repository setup, environment variables, database configuration, domain routing, and production considerations.`,
    primaryKeyword: `${ex.name} deployment example`,
    secondaryKeywords: [...ex.tags.map((t) => `${t} example`), `${ex.name} VPS`, `${ex.name} tutorial`],
    sections: [
      {
        title: 'What this example covers',
        body: `This example demonstrates deploying ${ex.name} on Better-PaaS. It includes step-by-step configuration, common pitfalls, and production recommendations. Complexity level: ${ex.complexity}.`,
        bullets: ex.tags.map((tag) => `${tag} configuration`),
      },
      {
        title: 'Prerequisites',
        body: `Before starting, ensure you have a VPS with Docker installed, a Git repository with your application code, and a domain name you want to use. This example assumes ${ex.complexity.toLowerCase()} familiarity with deployment concepts.`,
      },
      {
        title: 'Deployment steps',
        body: `Follow these steps to deploy ${ex.name} on your Better-PaaS instance. The process typically takes 10-30 minutes depending on your familiarity with the stack.`,
        bullets: ['Connect your Git repository', 'Configure environment variables', 'Add required database or cache service', 'Deploy and verify health checks', 'Configure custom domain and HTTPS'],
      },
    ],
    faqs: [
      { question: `Is this example suitable for beginners?`, answer: `This example is rated ${ex.complexity.toLowerCase()}. Beginners can follow along but may need to reference additional documentation for specific technologies.` },
      { question: `Can I modify this example for my use case?`, answer: `Absolutely. This example is a starting point. Adapt the configuration, environment variables, and services to match your specific requirements.` },
    ],
    related: ['/templates', '/deploy', '/features/git-deployments', '/features/automatic-https', quickstart],
    schemaType: 'HowTo',
    datePublished: launchDate,
    dateModified: lastUpdated,
    lastReviewed: lastUpdated,
  };
}

function bestPage(item: (typeof bestLists)[number]): SeoPage {
  const [slug, name, detail] = item;
  return {
    family: 'best',
    slug,
    title: `${name} | ${appName}`,
    h1: name,
    description: `A practical guide to ${detail}, including where Better-PaaS fits and when another tool may be better.`,
    eyebrow: 'Best Tools',
    intent: `${name}, best deployment tools, self-hosted PaaS tools`,
    summary: `The best tool depends on whether you want managed hosting, self-hosted control, Kubernetes-scale orchestration, or a simple app dashboard on one VPS. Better-PaaS belongs in the lightweight self-hosted category.`,
    primaryKeyword: name,
    secondaryKeywords: ['self-hosted deployment tools', 'Heroku alternatives', 'Docker deployment platform'],
    sections: [
      { title: 'How to choose', body: `For ${detail}, judge tools by hosting model, maintenance burden, deployment workflow, database support, rollback path, pricing, and how much infrastructure control you need.` },
      { title: `Where ${appName} fits`, body: `${appName} is a good fit when you want Git deploys, Docker containers, automatic HTTPS, databases, logs, and backups on infrastructure you own. It is not trying to replace multi-node Kubernetes or a fully managed cloud platform.` },
      { title: 'Evaluation checklist', body: 'Use this checklist before committing to a platform.', bullets: ['Can it run your stack?', 'Can it attach your databases?', 'Can you debug logs easily?', 'Can you roll back safely?', 'Do you understand the real monthly cost?'] },
    ],
    faqs: [
      { question: `Is Better-PaaS one of the ${name.toLowerCase()}?`, answer: 'It is a strong option when your priority is self-hosting on a VPS with a clean deployment dashboard.' },
      { question: 'Should every team self-host?', answer: 'No. Self-hosting is best for teams that value control and can handle basic server operations.' },
    ],
    related: ['/best', '/alternatives/heroku', '/alternatives/coolify', '/compare/better-paas-vs-coolify', quickstart],
    schemaType: 'ItemList',
    datePublished: launchDate,
    dateModified: lastUpdated,
    lastReviewed: lastUpdated,
  };
}

const rawSeoPages: SeoPage[] = [
  ...competitors.map(altPage),
  ...competitors.slice(0, 14).map((c) => comparePage(appName, c)),
  ...appCatalog.map(deployAppPage),
  ...stacks.map(deployStackPage),
  ...useCases.map(useCasePage),
  ...features.map(featurePage),
  ...integrations.map(integrationPage),
  ...glossary.map(glossaryPage),
  ...fixes.map(fixPage),
  ...bestLists.map(bestPage),
  ...deploymentTemplates.map(templatePage),
  ...deploymentExamples.map(examplePage),
];

function enrichForIndexing(page: SeoPage): SeoPage {
  const key = `${page.family}/${page.slug}`;
  const additions = [
    ...universalDepthSections(page),
    ...familyDepthSections(page),
    ...(priorityDepthSections[key] ?? []),
  ];
  const faqs = [
    ...page.faqs,
    ...familyDepthFaqs(page),
    ...(priorityDepthFaqs[key] ?? []),
  ];

  return {
    ...page,
    summary: `${page.summary} This page is written as a practical reference, not just a keyword landing page: it covers search intent, setup considerations, operational tradeoffs, and the next internal docs to read before deploying.`,
    sections: dedupeSections([...page.sections, ...additions]),
    faqs: dedupeFaqs(faqs),
  };
}

function universalDepthSections(page: SeoPage): SeoSection[] {
  return [
    {
      title: 'How this connects to the Better-PaaS workflow',
      body: `This page is part of a broader deployment workflow: install the control plane, connect a Git repository or choose a catalog image, configure environment variables, deploy the container, inspect logs, attach a custom domain, and add backups for stateful data. That sequence matters because most hosting decisions are not isolated. A platform choice affects how you debug failed builds, rotate secrets, recover from bad deploys, and keep apps running after the first launch.`,
    },
    {
      title: 'Practical next step',
      body: `If you are using this page to make a decision, turn it into a small test. Deploy one non-critical app, add a temporary domain, force one redeploy, read the logs, and confirm you understand where data is stored. A short trial reveals more than a feature checklist because it tests the full path from source or image to a live HTTPS endpoint.`,
    },
  ];
}

function dedupeSections(sections: SeoSection[]) {
  const seen = new Set<string>();
  return sections.filter((section) => {
    const key = section.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeFaqs(faqs: SeoFAQ[]) {
  const seen = new Set<string>();
  return faqs.filter((faq) => {
    const key = faq.question.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function familyDepthSections(page: SeoPage): SeoSection[] {
  switch (page.family) {
    case 'alternatives':
      return alternativeDepth(page);
    case 'compare':
      return comparisonDepth(page);
    case 'deploy':
      return deployDepth(page);
    case 'use-cases':
      return useCaseDepth(page);
    case 'features':
      return featureDepth(page);
    case 'integrations':
      return integrationDepth(page);
    case 'glossary':
      return glossaryDepth(page);
    case 'fix':
      return fixDepth(page);
    case 'best':
      return bestDepth(page);
    case 'templates':
      return templateDepth(page);
    case 'examples':
      return exampleDepth(page);
    default:
      return [];
  }
}

function alternativeDepth(page: SeoPage): SeoSection[] {
  return [
    {
      title: 'Quick decision guide',
      body: `Use this page when you are evaluating ${page.primaryKeyword} because you want a deployment workflow that is closer to Heroku than raw SSH, but still runs on infrastructure you control. The strongest reason to choose ${appName} is not novelty; it is the combination of Git deploys, Docker isolation, automatic HTTPS, database add-ons, logs, and rollbacks without moving the workload to a hosted platform account.`,
      bullets: [
        'Choose Better-PaaS when server ownership and predictable VPS cost matter.',
        'Choose a hosted platform when you prefer someone else to operate the runtime.',
        'Choose Kubernetes-class tooling only when one server is no longer enough.',
        'Choose manual Docker Compose when you want YAML control more than a product workflow.',
      ],
    },
    {
      title: 'What to compare before switching',
      body: `A real migration decision should compare more than feature names. Check how each platform handles private repositories, secret storage, health checks, rollback history, HTTPS certificates, database persistence, deploy logs, and failure recovery. Also compare what happens after the first successful deploy: who patches the server, who backs up the database, who notices disk pressure, and who owns incident response.`,
      bullets: [
        'Runtime ownership: hosted account, VPS, private cloud, or cluster.',
        'State handling: database add-ons, volumes, backups, and restore path.',
        'Release safety: health checks, rollback, logs, and failed deploy visibility.',
        'Cost model: seat pricing, usage-based billing, platform markup, or raw server cost.',
      ],
    },
    {
      title: 'Best-fit workloads',
      body: `${appName} is strongest for small to medium web apps, APIs, internal tools, automation services, dashboards, side projects, and one-click open-source apps. It is less appropriate for workloads that require multi-region active-active hosting, advanced autoscaling, complex service mesh behavior, or a large operations team already standardized on Kubernetes.`,
    },
  ];
}

function comparisonDepth(page: SeoPage): SeoSection[] {
  return [
    {
      title: 'Comparison criteria',
      body: `The useful way to read this comparison is by deployment model. ${appName} runs as a self-hosted control plane on your server. Competitors may be hosted platforms, cluster tools, or manual Docker workflows. That means feature parity is not the only question; the real question is which operating model you want to live with every week.`,
      bullets: [
        'Who owns the server and runtime?',
        'How are build failures and runtime failures surfaced?',
        'Can you restore from a bad deploy quickly?',
        'Can your database and file storage be backed up independently?',
        'Does the pricing still make sense after adding multiple small apps?',
      ],
    },
    {
      title: 'Operational tradeoffs',
      body: `A hosted platform can be easier because fewer infrastructure decisions land on your desk. A self-hosted platform can be better when you care about data location, predictable cost, and avoiding platform lock-in. ${appName} intentionally sits between raw server administration and full cloud abstraction: it gives you an app dashboard while preserving access to Docker, Caddy, server logs, and environment configuration.`,
    },
    {
      title: 'Migration checklist',
      body: `Before migrating, list every app dependency and verify it has a place in the new workflow. The common migration path is to deploy a non-production copy first, compare behavior, then move DNS only after logs, health checks, background jobs, file storage, and database connections are confirmed.`,
      bullets: [
        'Export current environment variables and secrets.',
        'Identify database engines and connection strings.',
        'Check framework build/start commands.',
        'Deploy a staging copy and inspect logs.',
        'Move the custom domain after the new app is healthy.',
      ],
    },
  ];
}

function deployDepth(page: SeoPage): SeoSection[] {
  const details = catalogOperationalDetails[page.slug];
  const operational = details
    ? [
        {
          title: 'Better-PaaS catalog settings',
          body: `For the one-click catalog flow, Better-PaaS treats this as a prebuilt image deployment. The catalog configuration uses image ${details.image}, listens on container port ${details.port}${details.healthPath ? `, and probes ${details.healthPath} for health checks` : ''}. These details matter because the platform can only switch traffic safely after the container starts and responds as expected.`,
          bullets: [
            `Docker image: ${details.image}`,
            `Container port: ${details.port}`,
            details.healthPath ? `Health path: ${details.healthPath}` : 'Health check: TCP or default app response',
            details.volumes?.length ? `Persistent paths: ${details.volumes.join(', ')}` : 'Persistence: treat as stateless unless you add storage',
            details.env?.length ? `Important env vars: ${details.env.join(', ')}` : 'Environment variables: optional or app-specific',
            details.addons?.length ? `Required add-ons: ${details.addons.join(', ')}` : 'Required add-ons: none for the basic starter',
          ],
        },
        {
          title: 'Production notes',
          body: details.notes ?? `For production use, confirm the container starts after redeploy, verify the public domain, and add backups for any data directory. Even simple catalog apps become important once a team depends on them.`,
        },
      ]
    : [];

  return [
    ...operational,
    {
      title: 'Pre-launch checklist',
      body: `A deploy page should answer what a developer does before exposing the app publicly. For ${page.primaryKeyword}, the basics are: confirm the app listens on the expected port, keep secrets in environment variables, attach persistent storage for stateful data, test a redeploy, and add a domain only after the app is healthy.`,
      bullets: [
        'Confirm build or image startup succeeds.',
        'Inspect live logs for startup warnings.',
        'Set required environment variables before first production deploy.',
        'Attach Postgres, Redis, MySQL, or volumes when the app stores data.',
        'Verify HTTPS after DNS points at the server.',
      ],
    },
    {
      title: 'What makes this different from manual Docker',
      body: `Manual Docker can run the same app, but you still need to manage routing, TLS certificates, release history, log access, and rollback behavior. Better-PaaS wraps those repeat tasks into the deployment workflow so the app can be maintained from a dashboard while still running as a normal Docker container on your VPS.`,
    },
    {
      title: 'Common failure modes',
      body: `Most deployment failures come from one of four places: the app does not listen on the expected port, a required env var is missing, persistent storage was not mounted, or the custom domain points somewhere else. Better-PaaS helps narrow this down through logs, health checks, and deployment history.`,
      bullets: [
        'Port mismatch or hard-coded localhost binding.',
        'Missing secret, database URL, or public URL.',
        'State lost because a required volume was not mounted.',
        'DNS has not propagated to the Better-PaaS server.',
      ],
    },
  ];
}

function useCaseDepth(page: SeoPage): SeoSection[] {
  return [
    {
      title: 'Recommended architecture',
      body: `A practical ${page.primaryKeyword} setup starts with one well-sized VPS, Better-PaaS as the control plane, Git repositories for source deploys, Docker images for catalog apps, Caddy for routing, and a backup habit for control-plane data plus application state. This is intentionally simpler than a cluster and more repeatable than hand-maintained SSH scripts.`,
      bullets: [
        'One primary server for the control plane and workloads.',
        'Git repository deploys for custom apps.',
        'Catalog or image deploys for common open-source services.',
        'Custom domains routed through Caddy with HTTPS.',
        'Backups for databases, volumes, logs, and configuration.',
      ],
    },
    {
      title: 'When this use case is ready for production',
      body: `Do not judge readiness by the first successful deploy alone. A production-ready setup should have a tested rollback, a backup and restore plan, documented env vars, known server capacity, and a clear owner for updates. If the app is client-facing or revenue-critical, run a staging deploy before moving DNS.`,
    },
    {
      title: 'Growth path',
      body: `Many teams begin with one server and a few apps. As traffic grows, you can separate databases, move heavy workloads to dedicated servers, add monitoring, or graduate specific workloads to a managed platform. The value of Better-PaaS is that the early workflow stays understandable while you learn which services actually need more infrastructure.`,
    },
  ];
}

function featureDepth(page: SeoPage): SeoSection[] {
  return [
    {
      title: 'How this feature affects indexable deployment content',
      body: `${page.h1} is not only a product feature; it changes the practical advice on deployment pages. For Google and for developers, the page needs to explain what the feature does, what assumptions it makes, what can go wrong, and which docs help users solve the next problem.`,
    },
    {
      title: 'Configuration questions to answer',
      body: `Before relying on ${page.primaryKeyword}, answer the operational questions that usually create support issues. These are the details that make a feature page useful rather than promotional.`,
      bullets: [
        'What input does the user need to provide?',
        'What default does Better-PaaS choose?',
        'What failure state appears in logs or the dashboard?',
        'What related guide should the user read next?',
      ],
    },
    {
      title: 'Related workflows',
      body: `This feature usually connects to app deployment, environment variables, logs, routing, rollback behavior, and server maintenance. Treat it as one part of a release workflow instead of an isolated checkbox.`,
    },
  ];
}

function integrationDepth(page: SeoPage): SeoSection[] {
  return [
    {
      title: 'Integration checklist',
      body: `A good ${page.primaryKeyword} setup should be easy to verify. Check credentials, network access, app health, logs, and the failure path before depending on the integration in production.`,
      bullets: [
        'Use least-privilege credentials where possible.',
        'Store secrets as environment variables or encrypted platform values.',
        'Confirm the integration still works after redeploy.',
        'Document who owns token rotation and troubleshooting.',
      ],
    },
    {
      title: 'Security considerations',
      body: `Integrations often introduce the highest-risk values in a deployment: Git tokens, webhooks, database URLs, notification endpoints, or DNS credentials. Better-PaaS redacts secret env vars in API responses, but you should still rotate tokens, avoid over-broad scopes, and keep dashboard access limited.`,
    },
    {
      title: 'Debug path',
      body: `When the integration fails, check the external service first, then Better-PaaS configuration, then container logs. For example, a webhook issue might be caused by the Git provider delivery status, the wrong branch, a stale secret, or an unreachable dashboard URL.`,
    },
  ];
}

function glossaryDepth(page: SeoPage): SeoSection[] {
  return [
    {
      title: 'Example in a deployment workflow',
      body: `In a Better-PaaS workflow, ${page.primaryKeyword.replace(/^what is /, '')} appears when a developer connects a repository, deploys a container, attaches a domain, configures secrets, or debugs an app that did not start correctly. The term is useful because it describes a concrete part of getting code live on a server.`,
    },
    {
      title: 'Common confusion',
      body: `People often mix this term with adjacent deployment concepts. The safest way to understand it is to ask what layer it belongs to: source code, build step, container runtime, routing, storage, security, or operations. That mental model makes troubleshooting much faster.`,
    },
    {
      title: 'Related terms to learn next',
      body: 'Read the related glossary and feature pages when the term appears in an error message, dashboard field, or deployment guide.',
      bullets: ['Docker container', 'environment variable', 'reverse proxy', 'custom domain', 'rollback'],
    },
    {
      title: 'Why this term shows up during debugging',
      body: `Deployment problems usually become easier once you can name the layer that failed. If the issue involves ${page.primaryKeyword.replace(/^what is /, '')}, look for the part of the workflow where source code becomes a build, a build becomes a container, a container becomes a routed service, or a routed service becomes a public HTTPS app. That vocabulary helps you search logs, docs, and support threads with more precision.`,
    },
  ];
}

function fixDepth(page: SeoPage): SeoSection[] {
  return [
    {
      title: 'How to isolate the layer',
      body: `For ${page.primaryKeyword}, separate the problem into layers. If the build never finishes, inspect repository and dependency output. If the container starts but traffic fails, inspect port binding, health checks, and Caddy routing. If the app works locally but not on the public domain, inspect DNS, HTTPS, and environment-specific URLs.`,
      bullets: [
        'Build layer: dependencies, lockfiles, build scripts, framework detection.',
        'Runtime layer: start command, port, env vars, file permissions.',
        'Network layer: container port, health check, reverse proxy, DNS.',
        'State layer: database connection, volume path, migrations, secrets.',
      ],
    },
    {
      title: 'Evidence to collect before changing settings',
      body: `Before editing multiple settings, capture the current failure evidence. Read the latest deployment log, note the exact error, confirm whether the old deployment still works, and identify the last change. This makes the fix faster and prevents accidental regressions.`,
    },
    {
      title: 'Escalation path',
      body: `If the issue persists, try a minimal test app on the same server. If the test app deploys, the problem is likely app-specific. If the test app fails too, inspect server resources, Docker state, Caddy routing, firewall rules, and dashboard API reachability.`,
    },
    {
      title: 'What a good fix looks like',
      body: `A good fix should be narrow and repeatable. Change one cause, redeploy once, and compare the new log output with the old log output. If the problem involves credentials, rotate only the affected secret. If it involves storage, verify the volume path before deleting or recreating containers. If it involves DNS or HTTPS, wait for DNS propagation and confirm the server can receive traffic on ports 80 and 443.`,
    },
  ];
}

function bestDepth(page: SeoPage): SeoSection[] {
  return [
    {
      title: 'Shortlist categories',
      body: `Most lists of ${page.primaryKeyword} are confusing because they compare unlike tools. Separate them into hosted PaaS, self-hosted PaaS, Docker management UIs, Kubernetes platforms, and traditional hosting control panels. Better-PaaS belongs in the self-hosted PaaS category.`,
      bullets: [
        'Hosted PaaS: easiest operations, less server control.',
        'Self-hosted PaaS: more control, more responsibility.',
        'Docker management UI: container control, less app workflow.',
        'Kubernetes platform: powerful, heavier operational model.',
        'Traditional hosting panel: broad hosting admin, less Git-native deployment.',
      ],
    },
    {
      title: 'Ranking criteria',
      body: `A useful tool list should rank by workflow fit rather than brand recognition. For small teams, the most important criteria are deploy speed, rollback safety, HTTPS setup, database support, log visibility, backup story, and whether the monthly cost stays predictable as apps multiply.`,
    },
    {
      title: 'Who should pick Better-PaaS',
      body: `Pick Better-PaaS if you want one server to host several apps with a Git-based workflow, automatic domains, simple database add-ons, and a dashboard. Skip it if you want a fully managed cloud, if your company already mandates Kubernetes, or if you need multi-region autoscaling on day one.`,
    },
  ];
}

function templateDepth(page: SeoPage): SeoSection[] {
  return [
    {
      title: 'Why use a template',
      body: `Templates remove the guesswork from deployment. Instead of configuring Docker, Caddy, and databases manually, you start with a proven stack that Better-PaaS understands. This reduces the time from repository to live app and lowers the chance of misconfiguration.`,
      bullets: ['Pre-configured build and start commands', 'Known-working database pairings', 'Tested volume and environment variable setup', 'HTTPS and domain routing included'],
    },
    {
      title: 'When to move beyond the template',
      body: `A template is a starting point, not a ceiling. Once your app grows, you may need to add services, tune resource limits, split databases to dedicated servers, or customize the Dockerfile. Better-PaaS supports all of these without locking you into the template.`,
    },
    {
      title: 'Production readiness checklist',
      body: `Before depending on this template for production traffic, verify that backups, monitoring, and rollback behavior are tested. A template gets you live quickly; production readiness requires operational habits.`,
      bullets: ['Test a redeploy and confirm zero-downtime behavior', 'Set up database backups', 'Document environment variables and secrets', 'Verify log streaming and health checks', 'Plan server scaling before traffic spikes'],
    },
  ];
}

function exampleDepth(page: SeoPage): SeoSection[] {
  return [
    {
      title: 'What makes this example useful',
      body: `Real-world examples show how Better-PaaS handles the messy details: environment variables, database connections, volume mounts, custom domains, and HTTPS. This example is based on the actual deployment workflow, not a theoretical setup.`,
      bullets: ['Concrete deployment steps', 'Known-working configuration', 'Common pitfalls and how to avoid them', 'Production recommendations'],
    },
    {
      title: 'How to adapt this example',
      body: `Every app is different, but the deployment pattern is often similar. Use this example as a starting point, then adjust environment variables, resource limits, and domain settings to match your specific requirements.`,
    },
    {
      title: 'Production considerations',
      body: `Before relying on this example for production, verify backups, health checks, log monitoring, and a rollback plan. Examples get you live quickly; production readiness requires operational discipline.`,
      bullets: ['Set up automated backups', 'Configure health check endpoints', 'Monitor logs and resource usage', 'Document environment variables', 'Test rollback behavior'],
    },
  ];
}

const priorityDepthSections: Record<string, SeoSection[]> = {
  'alternatives/heroku': [
    {
      title: 'Heroku migration notes',
      body: 'The closest Better-PaaS mental model to Heroku is: Git repository in, containerized app out, domain routed after health checks. The differences are operational. Heroku owns dynos and add-ons; Better-PaaS runs on your VPS, so you own server size, Docker cleanup, backups, and updates.',
      bullets: ['Map Heroku config vars to Better-PaaS env vars.', 'Replace add-ons with Postgres, Redis, MySQL, or external services.', 'Check that the app listens on PORT.', 'Move DNS only after logs and health checks look clean.'],
    },
  ],
  'alternatives/coolify': [
    {
      title: 'Coolify alternative angle',
      body: 'Coolify and Better-PaaS are both self-hosted deployment tools, so this page should not pretend the difference is hosted vs self-hosted. The main evaluation areas are interface preference, resource footprint, app catalog coverage, update process, and how much of the workflow you want the platform to automate.',
    },
  ],
  'deploy/nextjs': [
    {
      title: 'Next.js-specific checks',
      body: 'For Next.js, confirm the repository has a package manager lockfile, a working build script, and a start script suitable for production. If the app uses image optimization, API routes, or server rendering, test the production build locally or in staging before moving the public domain.',
      bullets: ['Use npm, pnpm, or yarn consistently.', 'Set NEXT_PUBLIC_* variables at build time when needed.', 'Confirm the app binds to the platform PORT.', 'Review server-only env vars separately from browser-exposed variables.'],
    },
  ],
  'deploy/n8n': [
    {
      title: 'n8n webhook and domain notes',
      body: 'n8n is especially sensitive to its public URL because external webhooks need to call back into the instance. Set N8N_HOST, N8N_PROTOCOL, and WEBHOOK_URL to match the HTTPS domain once DNS and Caddy routing are working.',
    },
  ],
  'deploy/wordpress': [
    {
      title: 'WordPress production notes',
      body: 'For WordPress, the deploy itself is only the beginning. The index-worthy advice is operational: use a real database plan, back up wp-content and the database, avoid untrusted plugins, and test updates before applying them to a client or production site.',
    },
  ],
  'fix/port-environment-variable': [
    {
      title: 'What PORT means in Better-PaaS',
      body: 'Better-PaaS routes traffic to the container port the platform expects. Apps that hard-code 3000, 5000, or localhost can look healthy locally and fail in production. Read PORT from the environment and bind to 0.0.0.0 when the framework requires an explicit host.',
    },
  ],
};

function familyDepthFaqs(page: SeoPage): SeoFAQ[] {
  return [
    {
      question: `Is this ${page.eyebrow.toLowerCase()} guidance enough for production?`,
      answer: `Use it as a practical starting point, then verify the production details for your app: domains, secrets, storage, database backups, server capacity, logs, rollback behavior, and update ownership.`,
    },
    {
      question: 'What should I read next?',
      answer: `Start with the related links on this page, especially the Better-PaaS quickstart and the most relevant deployment or troubleshooting guide. Search intent pages work best when they lead to a real next action.`,
    },
  ];
}

const priorityDepthFaqs: Record<string, SeoFAQ[]> = {
  'alternatives/heroku': [
    {
      question: 'Can Better-PaaS replace Heroku config vars?',
      answer: 'Yes. Better-PaaS supports environment variables and redacted secrets, but you need to recreate them explicitly during migration.',
    },
  ],
  'deploy/n8n': [
    {
      question: 'Why do n8n webhooks fail after deployment?',
      answer: 'The public webhook URL often does not match the actual HTTPS domain. Set N8N_HOST, N8N_PROTOCOL, and WEBHOOK_URL after the custom domain is working.',
    },
  ],
  'deploy/wordpress': [
    {
      question: 'Is one-container WordPress enough for production?',
      answer: 'It can work for small sites, but production WordPress should have database backups, persistent wp-content storage, plugin update discipline, and a tested restore path.',
    },
  ],
};

export const seoPages: SeoPage[] = rawSeoPages.map(enrichForIndexing);

export function getSeoPage(family: SeoFamily, slug: string) {
  return seoPages.find((page) => page.family === family && page.slug === slug);
}

export function getSeoPagesByFamily(family: SeoFamily) {
  return seoPages.filter((page) => page.family === family);
}

export function getSeoHub(family: SeoFamily) {
  return seoHubs.find((hub) => hub.family === family);
}

export function getSeoUrl(page: SeoPage) {
  return href(page.family, page.slug);
}

export function seoPageToMarkdown(page: SeoPage) {
  const sections = page.sections
    .map((section) => {
      const bullets = section.bullets?.length ? `\n\n${section.bullets.map((bullet) => `- ${bullet}`).join('\n')}` : '';
      return `## ${section.title}\n\n${section.body}${bullets}`;
    })
    .join('\n\n');
  const faqs = page.faqs
    .map((faq) => `### ${faq.question}\n\n${faq.answer}`)
    .join('\n\n');

  return `# ${page.h1} (${getSeoUrl(page)})\n\n${page.description}\n\n${page.summary}\n\n${sections}\n\n## FAQ\n\n${faqs}`;
}
