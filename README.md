<p align="center">
  <a href="https://github.com/sumon-ohid/better-paas">
    <img width="80" height="80" alt="better-paas Logo" src="https://github.com/user-attachments/assets/dfa8a970-d387-4ac4-aa29-8441521ca979" />
  </a>
</p>



<h1 align="center">better-paas</h1>

<p align="left">
  Better-PaaS is an open source self-hostable lightweight Platform as a Service (PaaS)
  that simplifies the deployment and management of applications and databases.
  You only need an SSH connection. You can manage VPS, Bare Metal, Raspberry PIs, and anything else.
  It works with almost any frameworks and libraries.
  You can also create databases like sqlite, postgres and redis and attach to deployed app with a single click.
  You own the platform, No vendor lock-in. </br>
  Please read the docs: <a href="https://better-paas.com/docs/quickstart">Better-PaaS Docs Page</a>
</p>

<table align="center">
  <tr>
    <td><a href="https://discord.gg/9TP4xEs2"><img src="https://img.shields.io/badge/discord-chat-7289da?logo=discord&logoColor=white" alt="Discord" /></a></td>
    <td><a href="https://www.gnu.org/licenses/agpl-3.0"><img src="https://img.shields.io/badge/License-GNU%20AGPL%20v3-blue.svg" alt="License" /></a></td>
    <td><a href="https://golang.org"><img src="https://img.shields.io/badge/go-%3E%3D%201.25-blue.svg" alt="Go Version" /></a></td>
    <td><a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D%2018-green.svg" alt="Node Version" /></a></td>
  </tr>
</table>

---
## Deployment preview

https://github.com/user-attachments/assets/9f34c3ac-f373-459c-ab95-1952acc4905b


## Features

Beyond Git-based deploys, the control plane comes packed with features designed for simple self-hosting:

*   **Zero-Downtime Deploys & Rollbacks**: New containers start on a fresh port and are health-checked before Caddy switches traffic and retires the old container. Roll back to any prior successful deploy with a single click.
*   **One-Click Preset App Deployments**: Deploy popular applications and templates instantly with pre-configured settings.
*   **Automatic HTTPS & Custom Domains**: Add domains to an app and Caddy issues Let's Encrypt certificates automatically.
*   **Auto-Deploy on Git Push**: Set up webhook-based auto-deployment with secure per-app HMAC validation.
*   **Hardened Security**: SQLite database encryption (AES-256-GCM) at rest for git tokens, and escalating brute-force IP lockout protection.
*   **Managed Databases & Explorer**: Spin up Postgres, Redis, and MySQL containers on a shared network with auto-injected connection variables, and manage tables with an interactive, inline-editable Database Explorer.
*   **Per-App Metrics**: Live container CPU and memory usage statistics right in your dashboard.
*   **Scheduled Jobs (Cron)**: Run tasks (e.g. migrations or cleanups) inside an app's container on a cron schedule.
*   **Persistent Volumes**: Mount volumes (`name:/container/path`) to persist state across redeploys.
*   **Deploy Notifications**: Slack and generic webhook alerts on deployment success or failure.
*   **Runtime Log Streaming**: Captured container logs persist on disk and stream in real-time over WebSockets.
*   **On-Demand & Scheduled Backups**: Snapshot your SQLite database, logs, and configurations to download directly from the UI.
*   **Redacted Secrets**: Mark sensitive environment variables so they are redacted in API responses.

---

## 🚀 Quick Start

### 1. Installation

#### Single-Command Quick Install (Recommended)
Deploy to your Linux VPS (Ubuntu/Debian, CentOS/RHEL/Fedora/Rocky/Alma) or macOS host. This script automatically installs system dependencies (Go, Docker, Nixpacks, Caddy, Node.js, pnpm), clones/updates the repository, builds the binaries, and configures system services:

```bash
curl -fsSL https://raw.githubusercontent.com/sumon-ohid/better-paas/main/install.sh | sudo bash
```

If you are installing on a remote VPS with `ufw` enabled, open the dashboard,
API, and web traffic ports:

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

If your VPS provider has a separate cloud firewall, allow the same inbound TCP
ports there too.

The installer also grants the Caddy binary permission to bind ports `80` and
`443` without running the Better-PaaS backend as root. If app URLs fail and the
backend log says `bind: permission denied`, run:

```bash
sudo setcap 'cap_net_bind_service=+ep' "$(readlink -f "$(command -v caddy)")"
sudo systemctl restart better-paas-backend
```

> [!NOTE]
> On macOS and Linux, the installer requires root privileges to configure Caddy/Docker and install packages:
> `curl -fsSL https://raw.githubusercontent.com/sumon-ohid/better-paas/main/install.sh | sudo bash`
>
> If you are using a fork of this repository, you can override the target repository URL by setting the `BETTER_PAAS_REPO_URL` variable:
> `curl -fsSL https://raw.githubusercontent.com/username/better-paas/main/install.sh | BETTER_PAAS_REPO_URL=https://github.com/username/better-paas.git sudo bash`

#### Local Installation
If you already have a checked-out copy of the repository:
```bash
bash install.sh
```

#### Manual Build
If you prefer to build the components manually:

**Backend:**
```bash
cd backend
go build -o server .
./server
```

**Frontend:**
```bash
cd frontend
pnpm install
pnpm build
pnpm start
```

#### Docker Compose (Alternative / Recommended for Containers)
If you prefer to run `better-paas` inside Docker, you can build and run it using the included Docker Compose setup:
```bash
docker compose up -d
```

---

### 2. First-Time Login

1.   **Get Admin Token**: On first boot, the Go backend generates a secure admin bearer token and writes it to a file.
     *   **Native / Script install**: The token is printed to your console and saved to `backend/data/admin_token.txt`.
     *   **Docker install**: On first boot, get it from container logs via `docker logs better-paas`. After that, run the CLI command inside the container via `docker exec -it better-paas /app/server token`, or read it from your host machine via `cat data/admin_token.txt`.
2.   **Access Dashboard**: Open the Next.js dashboard in your browser (typically `http://localhost:3000` or your server's IP address).
3.   **Authenticate**: Paste the token into the sign-in screen. API requests use `Authorization: Bearer <token>`. Browser WebSocket sessions first mint a short-lived ticket from the authenticated API, then connect with that one-use ticket.

---

### 3. Uninstalling

To cleanly stop control plane services and optionally clean up deployed apps/projects:

```bash
bash uninstall.sh
```

> [!NOTE]
> On Linux, run the uninstaller with root privileges:
> `sudo bash uninstall.sh`

---

## ⚙️ Configuration

### Backend Options
Backend configuration is managed via environment variables (see `backend/.env.example`):

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `ADMIN_TOKEN` | generated | Admin bearer token. Overrides the auto-generated value. |
| `LISTEN_ADDR` | `:8080` | API listen address. Use `127.0.0.1:8080` behind a proxy. |
| `DASHBOARD_ORIGIN` | same hostname | Comma-separated allowed origins for CORS / WS when the dashboard is served from a different hostname. |
| `SHOW_ADMIN_TOKEN_ON_STARTUP` | `false` | Print the admin token on every startup. First run always prints it. |
| `BETTER_PAAS_SECRET_KEY`| generated | 32-byte key (hex or base64) for at-rest secret encryption. |
| `TRUST_PROXY` | `false` | Honor `X-Forwarded-For`/`X-Real-IP` (set when behind a proxy). |
| `ACME_EMAIL` | unset | Email for Let's Encrypt registration (custom-domain HTTPS). |
| `BACKUP_INTERVAL_HOURS` | `0` | If >0, auto-snapshot `data/` every N hours (keeps last 10). |
| `UPDATE_REPO` | from remote | `owner/repo` slug the updater checks for new releases. |

### Frontend Options
Frontend configuration (see `frontend/.env.example`):

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | same host, port 8080 | Explicit backend API base URL. |

To pin or rotate the admin token at any time, define `ADMIN_TOKEN` in your system environment.

---

## 🔒 Security Hardening

*   **API Exposure**: The backend API binds to all interfaces by default to accommodate remote browsers. Because every privileged request requires the admin token, this is secure. For maximum isolation, you can place it behind a local reverse proxy and set `LISTEN_ADDR` to `127.0.0.1:8080`.
*   **Origin Checks**: CORS and WebSocket upgrades allow `DASHBOARD_ORIGIN` when configured. Without it, Better-PaaS allows the same hostname on any port, which supports the default `:3000` dashboard talking to the `:8080` API without reflecting arbitrary origins.
*   **Gitignored Secrets**: The SQLite database, keys, and logs are kept in `backend/data/` (created with `0700` permissions) and are excluded from git.
*   **Admin Token Handling**: Existing admin tokens are not printed on every startup. Use `./server token` to retrieve the token, or set `SHOW_ADMIN_TOKEN_ON_STARTUP=true` if your deployment process depends on startup logs. The dashboard stores the token in browser session storage rather than persistent local storage.
*   **Brute-Force Protection**: Repeated failed login attempts from an IP trigger an escalating lockout window (`HTTP 429` with `Retry-After`). Set `TRUST_PROXY=true` behind proxies to track the real client IP.
*   **At-Rest Encryption**: Deploy tokens (`gitToken`) and GitHub tokens are encrypted with `AES-256-GCM` before database insertion. The key is read from `BETTER_PAAS_SECRET_KEY` or generated locally in `backend/data/secret.key` (with `0600` permissions). Supply `BETTER_PAAS_SECRET_KEY` out-of-band (e.g. systemd credentials) to protect against an attacker who gains file-level access to the host.

---

## 🔄 Releases & Updates

The control plane can update itself to the latest release with one click from **Settings → Software Updates**.

### How Releases are Cut
Releases are **tag-triggered** and do not run on every commit. Pushing a tag matching `v*` triggers the GitHub Actions workflow (`.github/workflows/release.yml`):

```bash
git tag v1.3.0
git push origin v1.3.0   # builds and publishes the release
```

Each release cross-compiles the Go backend for `linux/amd64`, `linux/arm64`, `darwin/amd64`, and `darwin/arm64`, embeds the version tag via `-ldflags "-X paas/internal/paas.version=<tag>"`, and attaches the compiled binaries along with a `SHA256SUMS` verification manifest to the GitHub Release.

### How the In-App Updater Works
1.  **Version Checking**: The current running version is baked into the server binary. Updates check the GitHub Releases API for the repository slug defined in `UPDATE_REPO` (resolved from environment, database, or git remote origin).
2.  **Backup & Download**: When triggering "Update now" (available for source-build/git-checkout installations), the server takes a backup snapshot of your `data/` folder.
3.  **Self-Healing Compilation**: A detached helper script pulls the new tag, rebuilds the backend and frontend from source, and replaces the running binary on success (backing up the old binary as `server.bak`).
4.  **Health Check & Fallback**: The helper restarts the service and queries `/api/health`. If the health check fails, it automatically rolls back by restoring the previous Go binary and Git ref, then restarting to prevent service downtime.
5.  **Data Isolation**: SQLite schema changes are handled via additive migrations on next boot, ensuring update processes do not corrupt user database tables.

> [!NOTE]
> One-click updates build from source on the host and require the Go, Node, and pnpm toolchains. Support for pre-built binary distributions is a planned addition.
