# light-paas

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

| Variable           | Default   | Purpose                                                   |
| ------------------ | --------- | --------------------------------------------------------- |
| `ADMIN_TOKEN`      | generated | Admin bearer token. Overrides the auto-generated value.   |
| `LISTEN_ADDR`      | `:8080`   | API listen address. Use `127.0.0.1:8080` behind a proxy.  |
| `DASHBOARD_ORIGIN` | reflected | Comma-separated allowed origins for CORS / WS.            |

Frontend (see `frontend/.env.example`):

| Variable              | Default                       | Purpose                          |
| --------------------- | ----------------------------- | -------------------------------- |
| `NEXT_PUBLIC_API_URL` | same host, port 8080          | Explicit backend API base URL.   |

## Security notes

- The API binds to all interfaces by default so the dashboard works from a
  remote browser. Because every route requires the admin token, this is safe;
  for extra hardening put it behind a reverse proxy and set `LISTEN_ADDR` to
  loopback.
- `backend/data/` (SQLite DB, admin token, logs) is created `0700` and is
  gitignored. Never commit it — it contains secrets.
