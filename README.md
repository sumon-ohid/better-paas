# better-paas

A self-hosted PaaS: a Go control plane that builds Git repos with Nixpacks,
runs them as Docker containers, and routes them through Caddy. A Next.js
dashboard drives it all.

## Build

Backend (multi-file package, build the whole directory — not just main.go):

```bash
cd backend
go build -o server .
./server
```

Frontend:

```bash
cd frontend
pnpm install
pnpm build
pnpm start
```

Or run the one-shot installer: `bash install.sh`.

## Authentication

The control plane is protected by a single admin bearer token.

- On first run the backend generates a secure token, prints it to the logs,
  and writes it to `backend/data/admin_token.txt`.
- Open the dashboard and paste the token into the sign-in screen.
- Every API and WebSocket request must carry it (`Authorization: Bearer <token>`
  for HTTP, `?token=<token>` for WebSockets).

To pin or rotate the token, set `ADMIN_TOKEN` in the backend environment.

## Configuration

Backend (see `backend/.env.example`):

| Variable                | Default   | Purpose                                                   |
| ----------------------- | --------- | --------------------------------------------------------- |
| `ADMIN_TOKEN`           | generated | Admin bearer token. Overrides the auto-generated value.   |
| `LISTEN_ADDR`           | `:8080`   | API listen address. Use `127.0.0.1:8080` behind a proxy.  |
| `DASHBOARD_ORIGIN`      | reflected | Comma-separated allowed origins for CORS / WS.            |
| `BETTER_PAAS_SECRET_KEY`| generated | 32-byte key (hex or base64) for at-rest secret encryption.|
| `TRUST_PROXY`           | `false`   | Honor `X-Forwarded-For`/`X-Real-IP` (set when behind a proxy). |
| `ACME_EMAIL`            | unset     | Email for Let's Encrypt registration (custom-domain HTTPS).|
| `BACKUP_INTERVAL_HOURS` | `0`       | If >0, auto-snapshot `data/` every N hours (keeps last 10).|

## Features

Beyond Git-based deploys, the control plane supports:

- **Auto-deploy on git push** — each app exposes a GitHub webhook
  (`/api/webhooks/github/<appID>`) authenticated by a per-app HMAC secret. Push
  to the configured branch and the app redeploys. Set it up from an app's
  "Modify Config" tab and toggle "Auto-deploy on git push".
- **Automatic HTTPS + custom domains** — add domains to an app and Caddy issues
  Let's Encrypt certificates automatically. Point the domain's DNS at this
  server first, then set `ACME_EMAIL` for expiry notices.
- **Zero-downtime deploys + rollback** — each build is tagged
  `name:<deployID>`. New containers start on a fresh port and are health-checked
  before Caddy switches traffic and the old container is retired. Roll back to
  any prior successful deploy from the deployment history.
- **Resource limits** — set per-app memory (`512m`, `1g`) and CPU (`0.5`, `2`)
  caps, enforced via `docker run --memory/--cpus`.
- **Persistent volumes** — declare `name:/container/path` volumes that survive
  redeploys for stateful apps.
- **Managed databases** — one-click Postgres, Redis, and MySQL containers on a
  shared internal network. Attach one to an app to inject connection env vars.
- **Per-app metrics** — live CPU/memory per container (via `docker stats`) in
  the app drawer, in addition to host-level metrics.
- **Scheduled jobs (cron)** — run commands inside an app's container on a cron
  schedule (e.g. migrations, cleanup).
- **Deploy notifications** — Slack and/or generic webhook notifications on
  deploy success/failure (configure in Settings).
- **Runtime log persistence** — container stdout/stderr is captured to disk so
  logs survive restarts, with live streaming over WebSocket.
- **Backups** — snapshot the `data/` directory (DB, tokens, logs) on demand or
  on a schedule, and download the archive from the dashboard.
- **Secret env vars** — mark env var keys as secret so their values are redacted
  in API responses (mirroring how deploy tokens are handled).

Frontend (see `frontend/.env.example`):

| Variable              | Default                       | Purpose                          |
| --------------------- | ----------------------------- | -------------------------------- |
| `NEXT_PUBLIC_API_URL` | same host, port 8080          | Explicit backend API base URL.   |

## Security notes

- The API binds to all interfaces by default so the dashboard works from a
  remote browser. Because every route requires the admin token, this is safe;
  for extra hardening put it behind a reverse proxy and set `LISTEN_ADDR` to
  loopback.
- `backend/data/` (SQLite DB, admin token, encryption key, logs) is created
  `0700` and is gitignored. Never commit it — it contains secrets.
- **Brute-force protection:** repeated bad admin tokens from an IP trigger an
  escalating lockout (HTTP `429` with `Retry-After`), so guessing the 256-bit
  token is infeasible. Behind a reverse proxy, set `TRUST_PROXY=true` so the
  lockout keys on the real client IP rather than the proxy's.
- **At-rest encryption:** deploy tokens (per-app `gitToken`) and the GitHub
  token are encrypted with AES-256-GCM before being written to SQLite. The key
  comes from `BETTER_PAAS_SECRET_KEY` or, if unset, is generated on first run at
  `backend/data/secret.key` (mode `0600`). This protects leaked DB copies
  (backups, snapshots, an accidental commit). It does **not** protect against an
  attacker who can already read the whole data directory, since the key lives
  there too — for that, supply `BETTER_PAAS_SECRET_KEY` out-of-band (secrets
  manager, systemd credential) and keep it off the host. Existing cleartext
  values are read transparently and upgraded to ciphertext on the next write.
