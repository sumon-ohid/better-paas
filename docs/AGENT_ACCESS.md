# Better-PaaS Agent Access & Audit Logs

Better-PaaS now supports **scoped agent tokens** — machine-to-machine credentials that let AI coding assistants, CI pipelines, and automation tools manage your platform without sharing your admin password.

Every action taken by an agent is recorded in an **audit log**, so you always know who (or what) did what.

---

## What Are Agent Tokens?

Your dashboard login uses a single admin token. Agent tokens are **separate, scoped credentials** designed for machines:

- **Scoped**: Each token can be limited to specific abilities (e.g. "read logs only" or "deploy apps but not delete them").
- **Revocable**: Delete a token instantly if it's compromised — without rotating your admin password.
- **Auditable**: Every agent action appears in the audit log with the agent's name.
- **Free**: No per-seat pricing. Create as many agents as you need.

**Typical uses:**
- Claude Code or Codex managing deployments from your terminal
- GitHub Actions auto-deploying on push
- A monitoring script checking app health
- A team member who needs read-only access to logs

---

## Creating Your First Agent Token

Agent tokens can only be created by the admin. There is no UI page yet — use `curl` or any HTTP client.

### 1. Get your admin token

```bash
# If running natively:
cat backend/data/admin_token.txt

# Or from the backend binary:
./server token
```

### 2. Create an agent token

```bash
ADMIN_TOKEN="your-admin-token-here"

# Create a full-access agent for your local AI tool
curl -X POST http://localhost:8080/api/agents/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Claude Code - Local Dev",
    "scopes": [
      "apps:read", "apps:write", "apps:delete",
      "addons:manage", "deploy:trigger",
      "logs:read", "metrics:read",
      "cron:manage", "backups:manage",
      "notifications:manage"
    ]
  }'
```

**Response:**
```json
{
  "id": "a1b2c3d4e5",
  "name": "Claude Code - Local Dev",
  "scopes": ["apps:read", "apps:write", ...],
  "createdAt": "2026-07-02T14:32:00Z",
  "token": "bpagt_ac7f83b2...91f4"
}
```

> **Copy the `token` value immediately.** It is shown **only once** and cannot be retrieved later. If you lose it, rotate the agent to get a new one.

### 3. Save it for your tool

```bash
# Example for Claude Code / Codex / OpenCode
export PAAS_TOKEN="bpagt_ac7f83b2...91f4"
export PAAS_URL="http://localhost:8080"
```

---

## Scope Reference

When creating an agent, choose only the scopes it needs. This is the **principle of least privilege**.

| Scope | What it allows | Example use |
|-------|---------------|-------------|
| `apps:read` | List apps, view details, read runtime logs, view metrics | Monitoring dashboards, log tailing |
| `apps:write` | Deploy, redeploy, stop, start, update, rollback apps | CI/CD pipelines, AI deploy assistants |
| `apps:delete` | Delete apps (destructive) | Cleanup scripts |
| `addons:manage` | Create, delete, attach, detach databases & caches | Dev environment setup |
| `servers:manage` | Add or remove target servers | Infrastructure automation |
| `deploy:trigger` | Create new deployments from Git or upload | GitHub Actions, chat-based deploy |
| `logs:read` | Read app logs and build logs | Debugging assistants |
| `metrics:read` | Read CPU, memory, and disk metrics | Monitoring tools |
| `system:manage` | Docker prune, system updates, domain config | Maintenance automation |
| `cron:manage` | Create, update, delete, and run scheduled jobs | Job schedulers |
| `backups:manage` | Create, restore, and delete backups | Disaster recovery scripts |
| `notifications:manage` | Configure Slack/webhook notifications | Alert setup |
| `agent:admin` | Create, delete, and rotate agent tokens | Rare — effectively admin lite |

### Recommended Scope Sets

**For an AI coding assistant (Claude Code, Codex):**
```json
["apps:read", "apps:write", "logs:read", "metrics:read", "deploy:trigger", "addons:manage"]
```

**For a read-only monitoring script:**
```json
["apps:read", "logs:read", "metrics:read"]
```

**For CI/CD auto-deploy:**
```json
["apps:read", "apps:write", "deploy:trigger", "logs:read"]
```

---

## Managing Agents

### List all agents

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/api/agents
```

**Response:**
```json
[
  {
    "id": "a1b2c3d4e5",
    "name": "Claude Code - Local Dev",
    "scopes": ["apps:read", "apps:write", ...],
    "createdAt": "2026-07-02T14:32:00Z",
    "lastUsedAt": "2026-07-02T15:10:00Z"
  }
]
```

> **Note:** The raw token is never returned again. You only see metadata.

### Rotate an agent token (if lost or compromised)

```bash
curl -X POST http://localhost:8080/api/agents/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "a1b2c3d4e5"}'
```

You will receive a new `token` in the response. The old token stops working immediately.

### Delete an agent token

```bash
curl -X POST http://localhost:8080/api/agents/delete \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "a1b2c3d4e5"}'
```

---

## Using an Agent Token

Agent tokens are used exactly like your admin token — in the `Authorization: Bearer` header.

```bash
AGENT_TOKEN="bpagt_ac7f83b2...91f4"

# List apps (requires apps:read)
curl -H "Authorization: Bearer $AGENT_TOKEN" \
  http://localhost:8080/api/apps

# Get a specific app (requires apps:read)
curl -H "Authorization: Bearer $AGENT_TOKEN" \
  "http://localhost:8080/api/apps/get?id=abc123"

# Deploy an app (requires deploy:trigger + apps:write)
curl -X POST http://localhost:8080/api/deploy \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-api",
    "gitRepo": "https://github.com/me/my-api",
    "branch": "main"
  }'

# Read logs (requires logs:read)
curl -H "Authorization: Bearer $AGENT_TOKEN" \
  "http://localhost:8080/api/apps/runtime-logs?id=abc123&lines=50"
```

If the agent is missing a required scope, the API returns:
```json
{ "error": "Forbidden: missing scope apps:delete" }
```

---

## Audit Logs

Every mutating action (deploy, delete, start, stop, create addon, etc.) is recorded automatically. This includes actions by the admin token **and** all agent tokens.

### View recent audit logs

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/api/audit-logs?limit=20"
```

**Response:**
```json
[
  {
    "id": "x9y8z7w6v5",
    "actorType": "agent",
    "actorId": "a1b2c3d4e5",
    "action": "app:deploy",
    "resourceType": "app",
    "resourceId": "abc123",
    "outcome": "success",
    "ipAddress": "127.0.0.1",
    "createdAt": "2026-07-02T15:10:00Z"
  },
  {
    "id": "u4t3s2r1q0",
    "actorType": "admin",
    "actorId": "admin",
    "action": "addon:create",
    "resourceType": "addon",
    "outcome": "success",
    "createdAt": "2026-07-02T14:45:00Z"
  }
]
```

### What gets logged?

- **Actor**: `admin` for the main token, or the agent's ID for agent tokens
- **Action**: Human-readable like `app:deploy`, `app:stop`, `addon:attach`, `backup:create`
- **Resource**: What type of thing was affected (`app`, `addon`, `server`, `project`, etc.)
- **Outcome**: `success` (errors like 404/500 are still logged as `success` — the attempt was authenticated)
- **IP Address**: Where the request came from

### Limits

- Up to **500 entries** per request (`?limit=500`)
- Logs are stored in the same SQLite database as the rest of your platform data
- No automatic retention or pruning yet — future versions may add this

---

## New API Endpoints

These endpoints were added alongside the agent system:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/apps/get?id={id}` | Read | Get a single app's full details (with deployment commit info) |
| `GET /api/addons/get?id={id}` | Read | Get a single add-on's full details |
| `GET /api/agents` | Admin | List all agents |
| `POST /api/agents/create` | Admin | Create a new scoped agent |
| `POST /api/agents/delete` | Admin | Revoke an agent |
| `POST /api/agents/rotate` | Admin | Rotate an agent's token |
| `GET /api/audit-logs?limit=N` | Admin | View the audit trail |

All existing endpoints (`/api/apps`, `/api/deploy`, `/api/addons`, etc.) continue to work exactly as before. Admin tokens still have full access to everything.

---

## Security Best Practices

1. **Never share your admin token.** Create scoped agents for every tool and person.
2. **Use the minimum scopes.** An auto-deploy script doesn't need `apps:delete`.
3. **Rotate tokens regularly.** Especially for CI/CD agents that may leak into build logs.
4. **Monitor audit logs.** Check `/api/audit-logs` weekly to spot unexpected activity.
5. **Delete unused agents.** If you stop using Claude Code or retire a server, delete its agent token.

---

## Troubleshooting

### "Forbidden: admin token required"
You are using an agent token to access `/api/agents` or `/api/audit-logs`. These endpoints require the admin token.

### "Forbidden: missing scope X"
The agent token was created without the scope needed for this action. Create a new agent with broader scopes, or rotate the existing one with more scopes.

### "Unauthorized"
The token is wrong, expired, or the agent was deleted. Check `data/admin_token.txt` for the admin token, or create a fresh agent.

### Agent token not working immediately
Agent tokens are loaded into memory at server startup. If you created an agent while the server was running, it should be available immediately. If not, restart the server.

---

## Next Steps

With agent tokens in place, you can now connect Better-PaaS to:
- **Claude Code** or **OpenAI Codex** via an MCP bridge
- **GitHub Actions** for automatic deploys on push
- **Status page scripts** that poll `/api/apps` and `/api/metrics/apps`
- **Internal dashboards** that use read-only agent tokens

See the agent-first roadmap in the repository for plans around MCP (Model Context Protocol) support.
