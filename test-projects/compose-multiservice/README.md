# compose-multiservice

A multi-service Docker Compose project for testing the platform's **Compose**
build method end-to-end. It deliberately includes all four kinds of service so
you can verify classification, routing, grouping, terminals, and lifecycle.

## Services

| Service  | Build       | Web-facing? | Why                                                        |
|----------|-------------|-------------|------------------------------------------------------------|
| `web`    | `./web`     | yes         | nginx static site; publishes a port → gets its own subdomain |
| `api`    | `./api`     | yes         | Node HTTP service; publishes a port → gets its own subdomain |
| `worker` | `./worker`  | no          | No published port → a service row with no URL              |
| `db`     | `postgres`  | no          | Recognized datastore → no URL, host port suppressed        |

The `api` service connects to `db` by its compose service name (`db:5432`) to
prove service-name DNS and the shared project network work. Hit the `api`
subdomain root and check the `db.status` field — it should be `reachable`.

## What to expect after deploying

Choose **Compose** as the build method in the deploy wizard (it appears once a
compose file is detected). After deploy you should see **four app rows** grouped
together:

- `web` and `api` each have their own `*.sslip.io` URL.
- `worker` and `db` appear as rows with no URL.
- Each row has its own runtime logs and terminal (open a terminal on `worker`
  to poke around, or on `db` to run `psql`).
- **Redeploy** on any row rebuilds the whole project; **Delete** on any row
  removes the entire group. `db`'s named volume (`pgdata`) is preserved across
  redeploys.

## Health paths

- `web`: `/health.html`
- `api`: `/health`

## Local sanity check (optional)

```bash
docker compose up --build
# web  → http://localhost:8080
# api  → http://localhost:3001  (JSON, includes db.status)
```

On the platform the published ports above are ignored — the platform assigns
real host ports and routes its subdomains to them.
