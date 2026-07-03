# Testing Agent Access with AI Coding Tools (Cursor, Claude Code, Codex)

Connect Better-PaaS to AI coding assistants so they can list apps, deploy, read
logs, and more — without sharing your admin token.

For the full published guide, see [PaaS CLI on better-paas.com](https://better-paas.com/docs/guides/paas-cli).

---

## What works today

| Approach | Status | How it works |
|----------|--------|--------------|
| **`paas connect` + `paas setup` (MCP)** | **Recommended** | CLI saves a scoped token; `paas setup` configures Cursor / Claude Code MCP |
| **Cursor / Claude Agent + `paas env`** | Ready | `eval "$(paas env)"` then AI runs curl with `$PAAS_API_URL` + `$PAAS_TOKEN` |
| **`.cursorrules` context** | Optional fallback | Teach Cursor about the REST API when MCP is unavailable |
| **Manual agent token + curl** | Advanced | Create token via API; export env vars yourself |

---

## Prerequisites

1. Better-PaaS backend and dashboard running (local or VPS)
2. **Go 1.22+** on your laptop
3. Cursor, Claude Code, or another MCP-capable AI tool

---

## Method 1: MCP via `paas setup` (Recommended)

### Step 1: Install and connect

```bash
go install github.com/sumon-ohid/better-paas/backend/cmd/paas@latest
export PATH="$PATH:$(go env GOPATH)/bin"

paas connect http://localhost:8080          # or https://paas.example.com
paas setup                                  # writes ~/.cursor/mcp.json, ~/.claude/settings.json
```

### Step 2: Restart your editor

MCP servers load on startup. Fully quit and reopen Cursor or Claude Code.

### Step 3: Ask in chat

| Prompt | MCP tool used |
|--------|----------------|
| "List my Better-PaaS apps" | `paas_list_apps` |
| "Show logs for better-paas" | `paas_get_logs` |
| "Redeploy better-paas" | `paas_redeploy` |
| "Deploy https://github.com/me/repo as my-api" | `paas_deploy` |
| "What's my PaaS status?" | `paas_status` |

No curl, no pasted API docs, no admin token on your laptop.

### MCP tools available today

`paas_status`, `paas_list_apps`, `paas_list_projects`, `paas_get_app`,
`paas_deploy`, `paas_redeploy`, `paas_get_logs`

More tools (addons, metrics, stop/delete, backups) are on the roadmap — see
[paas-cli.mdx](../website/content/docs/guides/paas-cli.mdx) on the website.

---

## Method 2: Terminal + `paas env` (fallback)

When MCP is not available or you want explicit curl:

```bash
paas connect http://localhost:8080
eval "$(paas env)"
```

Tell the AI to use `$PAAS_API_URL` and `$PAAS_TOKEN` with the endpoints in
[AI Agent API Guide](https://better-paas.com/docs/guides/ai-agents).

---

## Method 3: Cursor Rules (optional)

Create project or user rules so terminal-based agents know the API shape. See
the REST examples in [Agent Access](AGENT_ACCESS.md). Prefer Method 1 when
possible.

---

## Safety guardrails

### Use the right profile at connect time

| Profile | Good for |
|---------|----------|
| **Observer** | Read-only: list apps, logs, metrics |
| **Deployer** | AI deploy assistants (default) |
| **Operator** | Addons, cron, backups, servers |

### Monitor audit logs

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/api/audit-logs?limit=20" | jq
```

### Rotate after heavy testing

```bash
curl -X POST http://localhost:8080/api/agents/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "<agent_id>"}'
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| MCP tools don't appear | Run `paas setup`, restart editor, check Settings → MCP |
| `not connected` | Run `paas connect <url>` first |
| 403 Forbidden | Reconnect with a higher profile (Deployer / Operator) |
| 401 Unauthorized | Token revoked — run `paas connect` again |
| Editor uses wrong binary | Re-run `paas setup` after `go install` |

---

## Quick reference

```bash
paas connect <dashboard-url>
paas setup
paas status
eval "$(paas env)"          # shell fallback
paas disconnect
```

| Env var (from `paas env`) | Value |
|---------------------------|-------|
| `PAAS_API_URL` | API base URL from config |
| `PAAS_TOKEN` | Scoped `bpagt_…` agent token |
