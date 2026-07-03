<p align="center">
  <a href="https://github.com/sumon-ohid/better-paas">
    <img width="80" height="80" alt="Better-PaaS logo" src="https://github.com/user-attachments/assets/dfa8a970-d387-4ac4-aa29-8441521ca979" />
  </a>
</p>

<h1 align="center">Better-PaaS</h1>

<p align="center">
  <strong>Agent-first, self-hosted PaaS.</strong> Deploy from Git on infrastructure you own.<br />
  Manage apps from the dashboard, terminal, or AI tools - without sharing your admin password.
</p>

<p align="center">
  <a href="https://better-paas.com/docs/quickstart">Documentation</a> ·
  <a href="https://better-paas.com/demo">Live demo</a> ·
  <a href="https://better-paas.com/docs/guides/paas-cli">CLI guide</a> ·
  <a href="https://discord.gg/9TP4xEs2">Discord</a>
</p>

<p align="center">
  <a href="https://www.gnu.org/licenses/agpl-3.0"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg" alt="License: AGPL-3.0" /></a>
  <a href="https://golang.org"><img src="https://img.shields.io/badge/go-%3E%3D%201.25-blue.svg" alt="Go >= 1.25" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D%2018-green.svg" alt="Node >= 18" /></a>
</p>

---

## Why Better-PaaS

Most PaaS products assume a human clicking through a dashboard. Better-PaaS is built for a different workflow: **you run the control plane on your VPS**, and **agents and scripts connect with scoped tokens** that can only do what you allow.

| You get | What it means |
| --- | --- |
| **Self-hosted control plane** | Git push deploy, HTTPS, databases, rollbacks - on your server, not a vendor bill |
| **Scoped agent tokens** | Separate credentials for Cursor, Claude Code, CI, and scripts - revocable and audited |
| **`paas connect`** | Browser authorization; your admin token never saved on your laptop |
| **MCP integration** | `paas setup` registers tools so your editor can list apps, deploy, and read logs |
| **No lock-in** | Open source (AGPL-3.0). Your code, your data, your VPS |

---

## Quick start

### 1. Install the control plane (server)

On a Linux VPS or macOS host:

```bash
curl -fsSL https://raw.githubusercontent.com/sumon-ohid/better-paas/main/install.sh | sudo bash
```

If `ufw` is enabled, open the dashboard, API, and web ports:

```bash
sudo ufw allow 3000/tcp   # dashboard
sudo ufw allow 8080/tcp   # API
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

**Alternative:** run with Docker Compose from a clone:

```bash
git clone https://github.com/sumon-ohid/better-paas.git
cd better-paas
docker compose up -d
```

Full install options: [Quickstart](https://better-paas.com/docs/quickstart)

### 2. Sign in to the dashboard

1. Get the admin token (first boot only):
   - **Script install:** `cat backend/data/admin_token.txt` or check installer output
   - **Docker:** `docker logs better-paas` or `docker exec -it better-paas /app/server token`
2. Open the dashboard (default `http://YOUR_SERVER:3000`)
3. Paste the token on the sign-in screen

### 3. Connect from your laptop

Install the CLI (Go 1.22+ required; no repo clone needed):

```bash
go install github.com/sumon-ohid/better-paas/backend/cmd/paas@latest
export PATH="$PATH:$(go env GOPATH)/bin"
```

Authorize via browser (use your **dashboard URL**):

```bash
# Production - same URL you open in the browser
paas connect https://paas.example.com

# Local dev
paas connect http://localhost:8080
```

Sign in with your admin token, pick a **permission profile**, and approve. A scoped `bpagt_…` token is saved to `~/.paas/config.json` (mode `0600`).

Verify:

```bash
paas status
```

### 4. Wire up AI tools (optional)

```bash
paas setup
```

Restart **Cursor** or **Claude Code**, then use the example prompts below.

Details: [PaaS CLI guide](https://better-paas.com/docs/guides/paas-cli) · [Agent access](https://better-paas.com/docs/guides/agent-access)

---

## Example prompts

Copy these into Cursor, Claude Code, or any MCP-connected assistant after `paas connect` and `paas setup`. Replace app names, repos, and branches with yours.

**Requires Deployer profile** for deploy/redeploy prompts. **Observer** is enough for read-only prompts.

### Check status and inventory

```
What's my Better-PaaS connection status? Summarize how many apps are running.
```

```
List all apps on my Better-PaaS instance with their status and URLs.
```

```
List my Better-PaaS projects and what's deployed in each.
```

```
Show me full details for the app named "my-api" - status, URL, git repo, and last deploy.
```

### Deploy new apps

```
Deploy https://github.com/me/my-nextjs-app as "storefront" on the main branch.
```

```
Deploy my FastAPI repo https://github.com/me/api-service as "api" using the production branch.
```

```
I have a Node app at https://github.com/acme/worker - deploy it as "background-worker" from main.
```

### Redeploy and ship changes

```
Redeploy the app "my-api" - I just pushed fixes to Git.
```

```
Rebuild and redeploy "storefront" so it picks up the latest commit on main.
```

```
Which apps are deployed? Redeploy any that are in a failed or stopped state.
```

### Debug with logs

```
Show the last 100 lines of logs for "my-api".
```

```
The app "storefront" is returning 500 errors - pull the recent logs and summarize what's failing.
```

```
Compare status across all apps and show logs for anything not running.
```

### End-to-end workflows

```
List my apps, then redeploy "my-api" and show me the logs afterward to confirm it started cleanly.
```

```
Deploy https://github.com/me/demo-app as "demo" from main, then check its status and tail the logs.
```

```
I'm debugging a production issue on "storefront": get app details, fetch the last 200 log lines, and tell me if the container is healthy.
```

### Tips

- Use the **app name** you chose at deploy time (or the name shown in `paas status`), not only the Git repo name.
- If the assistant can't find MCP tools, run `paas setup` again and restart your editor.
- For destructive actions (delete app, manage databases), use the dashboard or REST API until those MCP tools ship - see the [CLI roadmap](https://better-paas.com/docs/guides/paas-cli#mcp-tools-coming-soon).

---

## CLI commands

| Command | Purpose |
| --- | --- |
| `paas connect <url>` | Browser authorization; saves credentials locally |
| `paas setup` | Write MCP config for Cursor and Claude Code |
| `paas status` | Connection info and deployed apps |
| `paas env` | Print `PAAS_API_URL` / `PAAS_TOKEN` for shell scripts |
| `paas disconnect` | Remove local credentials |
| `paas version` | CLI version |
| `paas help` | Command reference |

**Shell agents (no MCP):**

```bash
eval "$(paas env)"
# use PAAS_API_URL and PAAS_TOKEN with curl or your scripts
```

---

## Permission profiles

When you authorize the CLI, choose the least privilege that fits the job:

| Profile | Best for | Can do | Cannot do |
| --- | --- | --- | --- |
| **Observer** | Monitoring, read-only assistants | List apps, read logs and metrics | Deploy, stop, delete, manage addons |
| **Deployer** | Cursor, Claude Code, local CI | Observer + deploy, redeploy, stop/start | Delete apps, addons, backups, servers |
| **Operator** | Full local automation | Deployer + addons, cron, backups, servers | Create/delete agents, audit logs |

Default in the browser: **Deployer** - enough for AI-assisted deploys without full admin access.

---

## MCP tools

After `paas connect` and `paas setup`, your editor can call:

| Tool | Description |
| --- | --- |
| `paas_status` | Connection info and app summary |
| `paas_list_apps` | List deployed apps |
| `paas_list_projects` | List multi-service projects |
| `paas_get_app` | App details by name or ID |
| `paas_get_logs` | Runtime logs |
| `paas_deploy` | Deploy from a Git repository |
| `paas_redeploy` | Rebuild an existing app |

Available actions depend on your connect profile. See [AI agents guide](https://better-paas.com/docs/guides/ai-agents) for the REST API and custom automation.

---

## Platform features

Beyond agent access, the control plane includes:

- **Git-based deploys** - Nixpacks builds; webhook auto-deploy with HMAC validation
- **Zero-downtime deploys and rollbacks** - health checks before traffic switch
- **Automatic HTTPS** - Caddy + Let's Encrypt for custom domains
- **Managed databases** - Postgres, Redis, MySQL on a private Docker network
- **App catalog** - one-click templates for common self-hosted apps
- **Cron jobs, volumes, backups** - scheduled tasks, persistent mounts, on-demand snapshots
- **Database explorer, metrics, log streaming** - operate from the dashboard
- **Audit logs** - every agent action recorded with scope and timestamp

---

## See it in action

https://github.com/user-attachments/assets/9f34c3ac-f373-459c-ab95-1952acc4905b

Try the interactive demo without installing: [better-paas.com/demo](https://better-paas.com/demo)

---

## Configuration

### Backend (`backend/.env.example`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `ADMIN_TOKEN` | generated | Admin bearer token |
| `LISTEN_ADDR` | `:8080` | API listen address |
| `DASHBOARD_ORIGIN` | same hostname | CORS / WebSocket origins for the dashboard |
| `PAAS_UI_URL` | unset | Public dashboard URL (used in connect manifest) |
| `BETTER_PAAS_SECRET_KEY` | generated | AES-256-GCM key for secrets at rest |
| `TRUST_PROXY` | `false` | Honor `X-Forwarded-For` behind a reverse proxy |
| `ACME_EMAIL` | unset | Let's Encrypt registration email |

### Frontend (`frontend/.env.example`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | same host, port 8080 | Backend API URL (required when API and dashboard differ) |
| `NEXT_PUBLIC_PAAS_UI_URL` | unset | Public dashboard URL for the well-known manifest |

When the dashboard and API are on different hosts, set `NEXT_PUBLIC_API_URL` at **frontend build time** and redeploy so `paas connect` discovers the API correctly.

---

## Security

- **Admin token** - required for privileged API access; stored in session storage in the browser, not on your laptop when using `paas connect`
- **Agent tokens** - scoped, revocable, audited; prefer these for AI tools and CI
- **Encryption at rest** - git and deploy tokens encrypted with AES-256-GCM
- **Brute-force protection** - escalating lockout on failed login attempts
- **Data isolation** - SQLite database and secrets live in `backend/data/` (gitignored, `0700`)

Hardening details: [Security docs](https://better-paas.com/docs/security)

---

## Updates

One-click updates from **Settings → Software Updates** (source installs). Releases are tag-triggered:

```bash
git tag v1.3.0
git push origin v1.3.0
```

See [Updates](https://better-paas.com/docs/updates) for the in-app updater behavior.

---

## Uninstall

```bash
sudo bash uninstall.sh
```

---

## Development

**Backend:**

```bash
cd backend && go build -o server . && ./server
```

**Frontend:**

```bash
cd frontend && pnpm install && pnpm build && pnpm start
```

**CLI (from clone):**

```bash
cd backend/cmd/paas && go install .
```

---

## License

[GNU AGPL v3](LICENSE)

---

## Star History

<a href="https://www.star-history.com/?type=date&repos=sumon-ohid%2Fbetter-paas">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=sumon-ohid/better-paas&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=sumon-ohid/better-paas&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=sumon-ohid/better-paas&type=date&legend=top-left" />
 </picture>
</a>
