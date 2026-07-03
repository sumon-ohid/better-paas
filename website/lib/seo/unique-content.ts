import { appName } from '@/lib/shared';
import type { SeoFAQ, SeoPage, SeoSection } from '@/lib/seo/content';

type UniqueBundle = { sections: SeoSection[]; faqs: SeoFAQ[] };

const glossaryUnique: Record<
  string,
  { example: string; mistake: string; inProduct: string; extraFaq?: SeoFAQ }
> = {
  paas: {
    example:
      'A team pushes a Rails API to Git; the PaaS builds a container, attaches Postgres, routes api.example.com over HTTPS, and streams logs - without SSHing to edit nginx configs.',
    mistake: 'Treating PaaS as "no ops." You still own patching, backups, capacity planning, and incident response on self-hosted PaaS.',
    inProduct: 'Better-PaaS installs as a control plane on your VPS. Apps deploy as Docker containers; Caddy terminates TLS and routes hostnames to the right container.',
  },
  'self-hosted-paas': {
    example:
      'An agency runs Better-PaaS on a Hetzner CX22 (~€4/mo) and hosts eight client apps with separate domains, env vars, and database containers on one machine.',
    mistake: 'Assuming self-hosted means air-gapped. Most workflows still need Git, DNS, outbound HTTPS for Let\'s Encrypt, and backup storage.',
    inProduct: 'The dashboard, API, and agent run on your server. Git credentials, database data, and container filesystems never leave infrastructure you control.',
  },
  'reverse-proxy': {
    example:
      'Requests to app.example.com hit Caddy on port 443; Caddy forwards to container port 3000 where Next.js listens, while blog.example.com routes to a different container.',
    mistake: 'Pointing DNS at the app container port directly (3000) instead of the proxy (80/443), which breaks HTTPS automation.',
    inProduct: 'Caddy is the default reverse proxy. When you attach a domain in the dashboard, routing and certificate issuance are configured for that app.',
  },
  caddy: {
    example:
      'After DNS for staging.example.com points to your VPS, Caddy requests a Let\'s Encrypt certificate and begins proxying traffic once the upstream app passes health checks.',
    mistake: 'Blocking ports 80/443 on the firewall while expecting automatic HTTPS - ACME HTTP-01 validation needs inbound port 80.',
    inProduct: 'Better-PaaS manages Caddy site blocks per app. You add domains in the UI; certificate renewal is handled by Caddy without manual certbot cron jobs.',
  },
  nixpacks: {
    example:
      'A repo with package.json and a start script is detected as Node.js; Nixpacks produces an image with the correct Node version and runs npm run build && npm start.',
    mistake: 'Missing lockfiles (package-lock.json, pnpm-lock.yaml) causing non-reproducible builds between deploys.',
    inProduct: 'Git deploys use Nixpacks by default. If detection fails, override build/start commands or supply a Dockerfile in the repository.',
  },
  'docker-container': {
    example:
      'Your FastAPI app runs inside an isolated filesystem with only port 8000 exposed; a redeploy replaces the container image while a mounted volume keeps uploaded files.',
    mistake: 'Writing persistent data inside the container layer instead of a Docker volume - data is lost on redeploy.',
    inProduct: 'Every Better-PaaS app is a container. Catalog apps use pinned images; Git apps use images built by Nixpacks or your Dockerfile.',
  },
  'zero-downtime-deployment': {
    example:
      'Better-PaaS starts the new container, waits for the health check to pass, then switches Caddy routing before stopping the old container.',
    mistake: 'Running database migrations that break the still-serving old version during a rolling deploy.',
    inProduct: 'Enabled for apps with working health checks. If health never passes, traffic stays on the previous release and the deploy is marked failed.',
  },
  'blue-green-deployment': {
    example:
      'Blue runs v1.2 in production; green builds v1.3 on the same server. Traffic flips to green only after smoke tests succeed.',
    mistake: 'Sharing one database schema between blue and green without backward-compatible migrations.',
    inProduct: 'Better-PaaS uses a simpler model: new container + health gate + traffic switch. For true dual environments, run separate apps or servers.',
  },
  'webhook-deployment': {
    example:
      'A push to main on GitHub triggers a POST to your Better-PaaS webhook URL; the platform pulls the commit and starts a new build.',
    mistake: 'Exposing the webhook URL without validating signatures or branch filters, allowing unintended deploys.',
    inProduct: 'Each app can register a Git webhook. Verify delivery in GitHub\'s webhook log if auto-deploy stops firing.',
  },
  'custom-domain': {
    example:
      'Create an A record for app.example.com → 203.0.113.10, add the domain in Better-PaaS, wait for DNS propagation, then confirm HTTPS is active.',
    mistake: 'Adding the domain in the dashboard before DNS points at the server, causing repeated Let\'s Encrypt failures.',
    inProduct: 'Domains are per-app in the dashboard. Caddy obtains certificates once DNS resolves to your server and the app is healthy.',
  },
  'lets-encrypt': {
    example:
      'Let\'s Encrypt issues a free 90-day certificate for your domain; Caddy renews it automatically before expiry.',
    mistake: 'Hitting rate limits by deleting and re-adding the same domain dozens of times in one day during testing.',
    inProduct: 'Certificates are managed through Caddy. Check DNS, ports 80/443, and app health if issuance fails.',
  },
  vps: {
    example:
      'A 2 vCPU / 4 GB RAM VPS from Hetzner, DigitalOcean, or Linode runs Better-PaaS plus several small web apps for under $10–20/month.',
    mistake: 'Choosing the smallest disk (20 GB) and filling it with Docker images, logs, and database files within weeks.',
    inProduct: 'Better-PaaS targets single-server deployments first. Monitor disk with df -h and prune unused images periodically.',
  },
  gitops: {
    example:
      'Production always tracks the main branch; a merge triggers webhook deploy. Rollback means redeploying a previous Git commit from history.',
    mistake: 'Editing production env vars only on the server without documenting them - the next Git deploy won\'t include those changes.',
    inProduct: 'Connect a repo and branch per app. Env vars live in the platform database; document them alongside your repository README.',
  },
  'environment-variable': {
    example:
      'DATABASE_URL=postgres://user:pass@db:5432/app is injected at container start so the app connects to the Postgres add-on without hard-coding credentials.',
    mistake: 'Committing .env files to Git. Use platform env vars and keep secrets out of version control.',
    inProduct: 'Set env vars in the app settings. Secret values are redacted in API responses but available to the container at runtime.',
  },
  'persistent-volume': {
    example:
      'Uptime Kuma stores monitor state in /app/data mounted from a Docker volume so redeploys do not wipe monitor history.',
    mistake: 'Assuming docker compose down -v is safe - it deletes named volumes and application data.',
    inProduct: 'Catalog apps declare volume paths. For Git apps, attach volumes in settings before relying on the app for production data.',
  },
  'health-check': {
    example:
      'Better-PaaS polls GET /health every few seconds; when it returns 200, traffic routes to the new container during a deploy.',
    mistake: 'Health endpoint requires authentication or returns 404, so deploys never complete and traffic never switches.',
    inProduct: 'Configure health check path and port per app. A failing health check blocks zero-downtime routing.',
  },
  rollback: {
    example:
      'Deploy v2 breaks login; open deployment history, roll back to v1 image, and restore service in under a minute without re-running a full build.',
    mistake: 'Rolling back code without rolling back incompatible database migrations.',
    inProduct: 'Previous images are retained in deployment history. Rollback redeploys a known-good container tag.',
  },
  buildpack: {
    example:
      'Heroku buildpacks compile Ruby apps with bundler; Nixpacks plays a similar role in Better-PaaS by detecting language and installing dependencies.',
    mistake: 'Relying on buildpack magic when the app needs native libraries not included in the default image.',
    inProduct: 'Nixpacks replaces classic buildpacks for Git deploys. Use a custom Dockerfile when you need full control of the build environment.',
  },
  'control-plane': {
    example:
      'The Better-PaaS API stores app definitions, env vars, and deployment records while agents on the server execute docker pull, run, and Caddy updates.',
    mistake: 'Backing up only application containers but not control-plane data - you lose deploy history and configuration.',
    inProduct: 'Back up /var/lib/better-paas (paths vary by install) alongside application databases and volumes.',
  },
  'managed-database': {
    example:
      'Click "Add Postgres" in the dashboard; Better-PaaS runs a Postgres container on the private Docker network and injects DATABASE_URL into your app.',
    mistake: 'Exposing the database port publicly on 5432 instead of keeping it on the internal network.',
    inProduct: 'Postgres, Redis, and MySQL run as sibling containers. Connection strings are injected as environment variables.',
  },
  dockerfile: {
    example:
      'A multi-stage Dockerfile builds a Go binary in stage one and copies only the binary into a distroless runtime image for smaller attack surface.',
    mistake: 'COPY . . before installing dependencies, busting Docker layer cache and slowing every deploy.',
    inProduct: 'Set deploy type to Dockerfile when Nixpacks cannot detect your stack or you need custom system packages.',
  },
  'ssl-certificate': {
    example:
      'Browsers show a padlock for https://app.example.com because a valid certificate chains to a public CA trusted by operating systems.',
    mistake: 'Using self-signed certificates in production without distributing your CA to clients.',
    inProduct: 'Public certificates come from Let\'s Encrypt via Caddy. No manual certificate upload is required for standard domains.',
  },
  tls: {
    example:
      'TLS 1.3 encrypts HTTP between the user and Caddy; HTTP/2 multiplexing reduces latency for asset-heavy pages.',
    mistake: 'Terminating TLS at a CDN while also terminating at Caddy with mismatched SSL modes, causing redirect loops.',
    inProduct: 'Caddy negotiates TLS automatically. Ensure Cloudflare or other proxies use "Full (strict)" when orange-clouding DNS.',
  },
  'cron-job': {
    example:
      'A nightly 02:00 UTC job runs bundle exec rake reports:send inside the Rails container without a separate scheduler VM.',
    mistake: 'Scheduling long jobs every minute, overlapping runs and exhausting database connections.',
    inProduct: 'Cron jobs are per-app in the dashboard. Commands run inside the app container with its env vars and filesystem.',
  },
  'container-log': {
    example:
      'A failed Stripe webhook shows payment_intent.succeeded followed by PG::ConnectionBad in container stdout - visible in the live logs panel.',
    mistake: 'Logging secrets or full credit card numbers, which then persist in log files on disk.',
    inProduct: 'Logs stream in the dashboard and are stored on the server. Use structured logging and redact sensitive fields.',
  },
  'domain-routing': {
    example:
      'api.example.com → API container, www.example.com → marketing static site, both on one VPS with separate Caddy site blocks.',
    mistake: 'Two apps claiming the same hostname in the dashboard, causing unpredictable routing.',
    inProduct: 'Each domain attachment is tied to one app. Wildcard domains depend on Caddy configuration and DNS setup.',
  },
  'git-branch': {
    example:
      'Connect repo my-saas, deploy branch main for production and branch staging for preview, each with different DATABASE_URL values.',
    mistake: 'Deleting a branch that is still configured as the deploy target, causing webhook failures.',
    inProduct: 'Branch is set per app in Git settings. Webhooks typically fire only for the configured branch.',
  },
  'private-repository': {
    example:
      'Better-PaaS clones github.com/acme/internal-api using a fine-grained PAT with Contents: Read on that repository only.',
    mistake: 'Using a personal PAT tied to one employee who leaves the company - clones break when the token is revoked.',
    inProduct: 'Store Git credentials in platform settings. Use organization machine users or deploy keys with minimal scope.',
  },
  'secret-encryption': {
    example:
      'API_KEY is stored encrypted in the control-plane database and decrypted only when starting the container, never returned in full via the API.',
    mistake: 'Putting secrets in docker-compose.yml committed to Git instead of platform secret storage.',
    inProduct: 'Mark env vars as secret in the UI. They are redacted in API JSON responses.',
  },
  'docker-network': {
    example:
      'App container talks to postgres:5432 on the internal bridge network; only Caddy publishes ports 80/443 to the internet.',
    mistake: 'Hard-coding localhost for database host inside a container - localhost refers to the app container itself, not Postgres.',
    inProduct: 'Add-ons receive stable hostnames on the Docker network. Use injected connection URLs rather than localhost.',
  },
  'app-catalog': {
    example:
      'Deploy Uptime Kuma from the catalog in two clicks: image, port, and volume paths are pre-filled; you add a domain and env vars.',
    mistake: 'Treating catalog defaults as production-hardened without backups, strong passwords, or resource limits.',
    inProduct: 'Catalog entries map to Docker images with known ports and volumes. See /catalog for the full list.',
  },
  'self-hosting': {
    example:
      'Run n8n, Vaultwarden, and an internal admin panel on a VPS you pay for directly instead of SaaS subscriptions per tool.',
    mistake: 'Underestimating time for OS updates, Docker cleanup, TLS renewal failures, and 3 AM disk-full pages.',
    inProduct: 'Better-PaaS reduces repetitive deploy tasks but does not replace server administration entirely.',
  },
  serverless: {
    example:
      'AWS Lambda runs a function per request with millisecond billing; no server to patch, but cold starts and vendor limits apply.',
    mistake: 'Choosing serverless for long-running WebSocket servers or stateful background workers with strict latency needs.',
    inProduct: 'Better-PaaS is container-based, not serverless. Long-running processes, cron, and WebSockets fit naturally.',
  },
  'edge-deployment': {
    example:
      'Vercel serves static assets from 40+ PoPs so Tokyo users hit a nearby edge node instead of your origin in Virginia.',
    mistake: 'Expecting edge deployment from a single VPS in one region - you need a CDN or multi-region platform for that.',
    inProduct: 'Better-PaaS is single-region by default. Put Cloudflare in front for caching and DDoS protection if needed.',
  },
  'container-orchestration': {
    example:
      'Kubernetes schedules 50 microservices across six nodes with auto-healing, HPA, and service mesh sidecars.',
    mistake: 'Adopting Kubernetes for three monolith apps on one server - operational cost exceeds benefit.',
    inProduct: 'Better-PaaS orchestrates containers on one server (or a few agents). Graduate to K8s when multi-node scheduling is required.',
  },
  'deployment-platform': {
    example:
      'Developers git push; the platform builds, runs health checks, routes HTTPS, and shows logs - whether hosted (Heroku) or self-hosted (Better-PaaS).',
    mistake: 'Confusing a deployment platform with a CDN or database - you still need to provision data stores and assets appropriately.',
    inProduct: 'Better-PaaS covers build/deploy/route/observability on your VPS. You bring the server and own the data.',
  },
};

const competitorUnique: Record<string, UniqueBundle> = {
  heroku: {
    sections: [
      {
        title: 'Heroku pricing vs a single VPS (2025–2026)',
        body: 'Heroku Eco dynos start around $5/month per app but sleep after inactivity; Standard-1X dynos are roughly $25/month before add-ons. Heroku Postgres mini add-ons add another ~$5–15/month. A $12–24/month VPS running Better-PaaS can host multiple apps with flat cost, though you spend time on server maintenance.',
        bullets: [
          'Map Heroku config vars → Better-PaaS environment variables one-to-one.',
          'Replace Heroku Postgres with a Postgres add-on container on the same VPS or an external managed DB.',
          'Ensure the app reads process.env.PORT - Heroku and Better-PaaS both inject dynamic ports.',
          'Schedule DNS cutover only after staging deploy logs are clean.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Does Better-PaaS support Heroku-style buildpacks?',
        answer:
          'Git deploys use Nixpacks for automatic builds, which covers most Node, Python, Ruby, and PHP stacks. Legacy buildpack-specific behavior may need a Dockerfile.',
      },
    ],
  },
  coolify: {
    sections: [
      {
        title: 'Coolify vs Better-PaaS: what actually differs',
        body: 'Both are self-hosted control planes on your VPS. Coolify ships a broader service catalog and multi-server stories; Better-PaaS focuses on a lighter Go control plane, Git + catalog deploys, and Caddy-first HTTPS. Compare on: RAM footprint, UI workflow, backup story, and how you prefer to manage updates.',
        bullets: [
          'Try both on a staging VPS with the same test app (e.g. a Next.js API).',
          'Measure idle RAM and disk after installing each control plane.',
          'Check how each handles webhook deploys and rollback.',
          'Decide whether you need Coolify\'s extra integrations or Better-PaaS simplicity.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I run Better-PaaS on the same server as Coolify?',
        answer:
          'Not recommended - both manage Docker and reverse proxies. Pick one control plane per server to avoid port and routing conflicts.',
      },
    ],
  },
  dokku: {
    sections: [
      {
        title: 'Dokku CLI vs Better-PaaS dashboard',
        body: 'Dokku is git-push-to-deploy over SSH with a minimal footprint - excellent for terminal-first operators. Better-PaaS adds a web dashboard, catalog apps, multi-user workflows, and integrated log streaming for teams that do not want SSH for every operation.',
      },
    ],
    faqs: [],
  },
  vercel: {
    sections: [
      {
        title: 'When Vercel wins vs self-hosted Next.js',
        body: 'Vercel optimizes edge middleware, ISR, and global static delivery. Better-PaaS runs a Node server in one region - better for full-stack apps with long-lived connections, private databases, and predictable flat VPS pricing, not for global edge caching out of the box.',
      },
    ],
    faqs: [
      {
        question: 'Can Better-PaaS replace Vercel for Next.js?',
        answer:
          'Yes for standard Node server deployments. Features tightly coupled to Vercel Edge Runtime or Vercel KV may need architectural changes.',
      },
    ],
  },
  kubernetes: {
    sections: [
      {
        title: 'Single-server PaaS vs Kubernetes threshold',
        body: 'Kubernetes pays off with multiple nodes, team SRE capacity, and complex service topology. Better-PaaS fits when one or two VPS instances host under ~20 services and you want Heroku-like UX without etcd, CNI, and cluster upgrades.',
      },
    ],
    faqs: [],
  },
  render: {
    sections: [
      {
        title: 'Render vs self-hosted flat pricing',
        body: 'Render charges per service with usage-based compute. A $24/month VPS with Better-PaaS often hosts 5–10 small services for the same price, but you handle OS updates, Docker pruning, and on-call for the machine itself.',
      },
    ],
    faqs: [],
  },
  railway: {
    sections: [
      {
        title: 'Railway credits vs owned infrastructure',
        body: 'Railway optimizes for fast project spin-up and usage billing. Better-PaaS suits teams that already have a VPS contract or compliance requirement to keep runtime on known hardware.',
      },
    ],
    faqs: [],
  },
  'fly-io': {
    sections: [
      {
        title: 'Fly.io regions vs one VPS',
        body: 'Fly.io places VMs close to users in many regions. Better-PaaS targets one primary server - add Cloudflare CDN in front if static assets need geographic caching.',
      },
    ],
    faqs: [],
  },
  netlify: {
    sections: [
      {
        title: 'Jamstack hosting vs full-stack containers',
        body: 'Netlify excels at static sites and serverless functions at the edge. Better-PaaS runs long-lived Node/Python/Ruby processes with attached databases - a better fit for traditional APIs and admin panels.',
      },
    ],
    faqs: [],
  },
  caprover: {
    sections: [
      {
        title: 'CapRover one-click apps vs Better-PaaS catalog',
        body: 'Both offer dashboard deploys and one-click templates. Compare Captain CLI workflows, community app definitions, SSL handling, and which UI your team prefers for day-two operations like log tailing and rollbacks.',
      },
    ],
    faqs: [],
  },
  'digitalocean-app-platform': {
    sections: [
      {
        title: 'DO App Platform vs DO Droplet + Better-PaaS',
        body: 'App Platform is managed PaaS on DigitalOcean infrastructure. Running Better-PaaS on a Droplet in the same region gives you more control per dollar at the cost of patching the VM and managing backups yourself.',
      },
    ],
    faqs: [],
  },
  'docker-compose': {
    sections: [
      {
        title: 'Compose files vs platform workflow',
        body: 'Docker Compose is excellent for reproducible multi-container dev environments. Better-PaaS adds Git webhooks, per-app HTTPS domains, deployment history, and a UI for teammates who do not edit YAML daily.',
      },
    ],
    faqs: [],
  },
  'aws-elastic-beanstalk': {
    sections: [
      {
        title: 'Elastic Beanstalk abstraction vs a single VPS',
        body: 'Beanstalk integrates with RDS, ALB, and IAM in AWS accounts. Better-PaaS is intentionally smaller: one server, Docker, Caddy - ideal when AWS complexity and bill unpredictability outweigh elasticity needs.',
      },
    ],
    faqs: [],
  },
};

const fixUnique: Record<string, UniqueBundle> = {
  'port-environment-variable': {
    sections: [
      {
        title: 'Fix PORT binding in common frameworks',
        body: 'Better-PaaS sets PORT at runtime. Bind to 0.0.0.0, not 127.0.0.1, so the reverse proxy can reach the process inside the container.',
        bullets: [
          'Node/Express: const port = process.env.PORT || 3000; app.listen(port, "0.0.0.0")',
          'Python/Uvicorn: uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}',
          'Rails: ensure Puma binds 0.0.0.0 per platform docs',
          'After changing code, redeploy and confirm listening in logs',
        ],
      },
    ],
    faqs: [],
  },
  'lets-encrypt-certificate-failed': {
    sections: [
      {
        title: 'Let\'s Encrypt failure checklist',
        body: 'ACME failures are almost always DNS, firewall, or routing - not the app framework.',
        bullets: [
          'dig +short yourdomain.com must return your VPS IP',
          'Ports 80 and 443 open in cloud firewall and ufw',
          'No other process bound to port 80 on the host',
          'Domain added in Better-PaaS only after DNS propagates',
          'Check Caddy logs on the server for specific ACME error text',
        ],
      },
    ],
    faqs: [],
  },
  'github-webhook-not-working': {
    sections: [
      {
        title: 'GitHub webhook delivery debugging',
        body: 'Open GitHub → Repository → Settings → Webhooks → Recent Deliveries. A 404 or connection refused means URL or firewall; 401/403 means secret mismatch.',
        bullets: [
          'Webhook URL must be reachable from the public internet',
          'Branch filter must match your configured deploy branch',
          'Rotate webhook secret in both GitHub and Better-PaaS if unsure',
          'Test with a manual "Redeliver" on a recent push event',
        ],
      },
    ],
    faqs: [],
  },
  'nextjs-deployment-failed': {
    sections: [
      {
        title: 'Next.js build failures on VPS deploys',
        body: 'Production builds need more memory than dev. A 1 GB VPS may OOM during next build on large apps.',
        bullets: [
          'Ensure package-lock.json or pnpm-lock.yaml is committed',
          'Set "build": "next build" and "start": "next start" in package.json',
          'Move NEXT_PUBLIC_* vars to env before build if required at compile time',
          'Upgrade VPS RAM temporarily or build in CI and deploy Dockerfile if builds keep failing',
        ],
      },
    ],
    faqs: [],
  },
  'nixpacks-build-failed': {
    sections: [
      {
        title: 'When Nixpacks mis-detects your stack',
        body: 'Read the build log from the top - detection errors show which language provider failed. Monorepos and custom tooling often need explicit config.',
        bullets: [
          'Add nixpacks.toml or set custom build command in app settings',
          'Switch to Dockerfile deploy for non-standard layouts',
          'Pin Node/Python version via .node-version or runtime.txt equivalents',
          'Confirm the repo root connected to Better-PaaS contains the app manifest',
        ],
      },
    ],
    faqs: [],
  },
};

const stackUnique: Record<string, UniqueBundle> = {
  nextjs: {
    sections: [
      {
        title: 'Next.js production settings on Better-PaaS',
        body: 'Use next start after next build. App Router projects need Node 18+. Set NODE_ENV=production.',
        bullets: [
          'Lockfile required for reproducible Nixpacks builds',
          'Use standalone output + Dockerfile if image size matters',
          'Separate server secrets from NEXT_PUBLIC_* client vars',
          'Health check path: / or /api/health',
        ],
      },
    ],
    faqs: [],
  },
  fastapi: {
    sections: [
      {
        title: 'FastAPI + Uvicorn deploy notes',
        body: 'Entry point is typically uvicorn main:app. Worker count should stay low on small VPS instances (1–2 workers).',
        bullets: [
          'requirements.txt or pyproject.toml must be present',
          'Bind 0.0.0.0 and read PORT from environment',
          'Attach Redis if using background tasks with Celery/RQ',
        ],
      },
    ],
    faqs: [],
  },
  rails: {
    sections: [
      {
        title: 'Rails on Docker/Nixpacks',
        body: 'Run rails db:migrate in release phase or manually after first deploy. Asset precompilation needs SECRET_KEY_BASE set.',
        bullets: [
          'Add Postgres add-on before first migrate',
          'Set RAILS_ENV=production and SECRET_KEY_BASE',
          'Use bundle exec puma as start command if auto-detection fails',
        ],
      },
    ],
    faqs: [],
  },
  nodejs: {
    sections: [
      {
        title: 'Node.js service deploy',
        body: 'Ensure package.json defines "start" for production. Nixpacks detects Node from lockfiles; without them builds may pick inconsistent dependency versions.',
        bullets: ['Commit package-lock.json, pnpm-lock.yaml, or yarn.lock', 'Listen on process.env.PORT', 'Set NODE_ENV=production'],
      },
    ],
    faqs: [],
  },
  django: {
    sections: [
      {
        title: 'Django collectstatic and migrations',
        body: 'Run python manage.py migrate after first deploy. Static files may need whitenoise or an external CDN depending on your settings module.',
        bullets: ['Set DJANGO_SETTINGS_MODULE and SECRET_KEY', 'Attach Postgres for production', 'Configure ALLOWED_HOSTS with your domain'],
      },
    ],
    faqs: [],
  },
  laravel: {
    sections: [
      {
        title: 'Laravel queue and scheduler notes',
        body: 'Long-running queue workers may need a separate process or cron entry. Default Nixpacks deploy runs php-fpm + nginx or artisan serve depending on detection.',
        bullets: ['Set APP_KEY and database env vars', 'Run migrations before switching DNS', 'Configure QUEUE_CONNECTION if using jobs'],
      },
    ],
    faqs: [],
  },
  express: {
    sections: [
      {
        title: 'Express API on PORT',
        body: 'Minimal Express apps often hard-code port 3000. Read PORT from the environment and bind 0.0.0.0 for container networking.',
      },
    ],
    faqs: [],
  },
};

function glossaryEnrichment(page: SeoPage): UniqueBundle {
  const data = glossaryUnique[page.slug];
  if (!data) {
    return { sections: [], faqs: [] };
  }
  const term = page.h1.replace(/^what is /i, '').replace(/\?$/, '');
  return {
    sections: [
      {
        title: 'Real-world example',
        body: data.example,
      },
      {
        title: 'Common mistake',
        body: data.mistake,
      },
      {
        title: `${appName} in practice`,
        body: data.inProduct,
      },
    ],
    faqs: data.extraFaq ? [data.extraFaq] : [],
  };
}

function alternativeEnrichment(page: SeoPage): UniqueBundle {
  const slug = page.slug;
  const bundle = competitorUnique[slug];
  if (bundle) return bundle;
  return {
    sections: [
      {
        title: `Migration snapshot for ${page.primaryKeyword}`,
        body: `Teams switch from ${slug.replace(/-/g, ' ')} when flat VPS pricing beats per-app platform fees or when data residency requires self-hosting. Run a parallel deploy: recreate env vars, provision databases, validate HTTPS on a staging subdomain, then move production DNS.`,
      },
    ],
    faqs: [],
  };
}

function compareEnrichment(page: SeoPage): UniqueBundle {
  const competitorSlug = page.slug.split('-vs-').pop() ?? '';
  const base = competitorUnique[competitorSlug];
  if (base) {
    return {
      sections: [
        {
          title: 'Bottom line for this comparison',
          body: `Choose ${appName} if you want Git deploys and Docker isolation on a VPS you control. Revisit ${competitorSlug.replace(/-/g, ' ')} if managed infrastructure or specialized features (edge, multi-region, enterprise support) outweigh server ownership.`,
        },
        ...base.sections,
      ],
      faqs: base.faqs,
    };
  }
  return { sections: [], faqs: [] };
}

function deployEnrichment(page: SeoPage): UniqueBundle {
  const stack = stackUnique[page.slug];
  if (stack) return stack;
  return { sections: [], faqs: [] };
}

function fixEnrichment(page: SeoPage): UniqueBundle {
  return fixUnique[page.slug] ?? { sections: [], faqs: [] };
}

function useCaseEnrichment(page: SeoPage): UniqueBundle {
  const scenarios: Record<string, string> = {
    'self-hosted-paas': 'Install on a 2 vCPU VPS, deploy a sample API and Postgres, document backup restore, then migrate your first production app.',
    'low-cost-heroku-replacement': 'Inventory Heroku add-on monthly cost, provision a $12–24 VPS, migrate the smallest app first to validate PORT and DATABASE_URL.',
    'agency-client-app-hosting': 'Use separate env var groups per client app on one server; give each client a subdomain until custom domains are approved.',
    'home-lab-app-hosting': 'Start with catalog apps (Uptime Kuma, Vaultwarden) on a NUC or old desktop with dynamic DNS if you lack a static IP.',
    'ai-agent-app-hosting': 'Deploy agent API (FastAPI/Node) with Redis for job queue; keep LLM API keys in secret env vars, never in Git.',
  };
  const walkthrough = scenarios[page.slug];
  if (!walkthrough) return { sections: [], faqs: [] };
  return {
    sections: [
      {
        title: 'Step-by-step walkthrough',
        body: walkthrough,
      },
    ],
    faqs: [],
  };
}

function featureEnrichment(page: SeoPage): UniqueBundle {
  const tips: Record<string, string> = {
    'git-deployments': 'Connect GitHub with a token scoped to required repos only. Enable webhooks after the first manual deploy succeeds.',
    'automatic-https': 'Verify DNS before adding domains. Use Cloudflare DNS-only (grey cloud) during initial certificate issuance if redirects conflict.',
    'managed-postgres': 'Run pg_dump nightly to object storage; test restore on a staging database quarterly.',
    'webhooks': 'Use a shared secret and restrict branches to main or release/* to prevent accidental production deploys.',
    'server-backups': 'Back up control-plane data, not just app containers - you need deployment history and env configuration.',
  };
  const tip = tips[page.slug];
  if (!tip) return { sections: [], faqs: [] };
  return {
    sections: [{ title: 'Operator tip', body: tip }],
    faqs: [],
  };
}

function integrationEnrichment(page: SeoPage): UniqueBundle {
  const tips: Record<string, string> = {
    github: 'Use fine-grained PATs or GitHub App credentials with repository-scoped access. Rotate tokens on offboarding.',
    cloudflare: 'API token needs Zone.DNS Edit on the zones you manage. Use proxied vs DNS-only deliberately for ACME.',
    nixpacks: 'Pin versions via config when production stability matters more than bleeding-edge runtimes.',
    caddy: 'Caddy config is managed by the platform - avoid hand-editing Caddyfiles on the host unless you understand override risks.',
  };
  const tip = tips[page.slug];
  if (!tip) return { sections: [], faqs: [] };
  return {
    sections: [{ title: 'Integration setup tip', body: tip }],
    faqs: [],
  };
}

export function getUniqueEnrichment(page: SeoPage): UniqueBundle {
  switch (page.family) {
    case 'glossary':
      return glossaryEnrichment(page);
    case 'alternatives':
      return alternativeEnrichment(page);
    case 'compare':
      return compareEnrichment(page);
    case 'deploy':
      return deployEnrichment(page);
    case 'fix':
      return fixEnrichment(page);
    case 'use-cases':
      return useCaseEnrichment(page);
    case 'features':
      return featureEnrichment(page);
    case 'integrations':
      return integrationEnrichment(page);
    default:
      return { sections: [], faqs: [] };
  }
}

/** Families with thin templated pages - submit to sitemap after unique enrichment. */
export const seoSitemapFamilies: Set<SeoPage['family']> = new Set([
  'alternatives',
  'compare',
  'deploy',
  'fix',
  'use-cases',
  'features',
  'integrations',
  'templates',
  'examples',
  'best',
  'glossary',
]);

export function seoSitemapPriority(page: SeoPage): number {
  if (page.family === 'alternatives' || page.family === 'compare') return 0.9;
  if (page.family === 'deploy' || page.family === 'fix') return 0.85;
  if (page.family === 'use-cases' || page.family === 'templates' || page.family === 'examples')
    return 0.75;
  if (page.family === 'glossary') return 0.55;
  return 0.7;
}
