# Testing Agent Access with AI Coding Tools (Cursor, Claude Code, Codex)

You have scoped agent tokens. Now let's connect them to actual AI coding assistants so they can manage your PaaS infrastructure.

---

## What Works Today vs. Coming Soon

| Approach | Status | How it works |
|----------|--------|--------------|
| **Cursor Agent + terminal** | Ready now | AI runs `curl` commands in your terminal using the agent token |
| **Claude Code + terminal** | Ready now | Same as Cursor — Claude runs shell commands with your token |
| **`.cursorrules` context** | Ready now | Teach Cursor about your Better-PaaS API so it suggests correct commands |
| **MCP bridge (`paas-mcp`)** | Coming next | Native "chat with your infrastructure" — no terminal commands needed |

This guide covers what works **right now**.

---

## Prerequisites

1. Better-PaaS backend running locally or on your VPS
2. An **agent token** created (see [Agent Access guide](/docs/AGENT_ACCESS.md))
3. Cursor, Claude Code, or another AI tool with **agent/terminal access**

---

## Method 1: Cursor Agent Mode (Recommended — Works Today)

Cursor's Agent mode can run terminal commands on your behalf. You give it the agent token via environment variable, then ask it to manage your infrastructure in plain English.

### Step 1: Set up the environment

In your terminal (or `.zshrc` / `.bashrc` for persistence):

```bash
export PAAS_API_URL="http://localhost:8080"
export PAAS_TOKEN="bpagt_your_agent_token_here"
```

For a remote VPS:

```bash
export PAAS_API_URL="https://paas.yourdomain.com"
export PAAS_TOKEN="bpagt_your_agent_token_here"
```

### Step 2: Tell Cursor about it

Open Cursor's composer/agent chat and give it context. Paste this once per session (or save it in `.cursorrules` — see Method 2):

```
I have a Better-PaaS instance running at PAAS_API_URL with an agent token in PAAS_TOKEN.

You can interact with it via curl. Key endpoints:
- GET /api/apps — list apps
- GET /api/apps/get?id=<id> — get app details
- POST /api/deploy — deploy a new app
- POST /api/apps/redeploy — redeploy existing app
- POST /api/apps/stop — stop app
- POST /api/apps/start — start app
- GET /api/apps/runtime-logs?id=<id>&lines=100 — read logs
- GET /api/metrics/apps — get resource metrics
- GET /api/addons — list databases
- POST /api/addons/create — create database
- GET /api/audit-logs?limit=50 — view audit trail

Always use the PAAS_TOKEN in the Authorization: Bearer header.
Always show me the exact curl command before running it.
```

### Step 3: Ask it to do things

Here are real prompts you can try:

#### Deploy an app

```
Deploy my repo https://github.com/me/my-api to Better-PaaS.
Name it "my-api" and deploy the main branch.
```

Cursor will think, then run:

```bash
curl -X POST "$PAAS_API_URL/api/deploy" \
  -H "Authorization: Bearer $PAAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-api","gitRepo":"https://github.com/me/my-api","branch":"main"}'
```

#### Check on a deployment

```
Is my-api done building? Show me its status and the last 30 lines of logs.
```

Cursor will:
1. `GET /api/apps` to find the app ID
2. `GET /api/apps/get?id=<id>` for details
3. `GET /api/apps/runtime-logs?id=<id>&lines=30` for logs

#### Debug a failed app

```
My app "my-api" is failing. Check the logs, metrics, and suggest a fix.
```

Cursor will:
1. Read logs to find the error
2. Check metrics to see if it's out of memory
3. Suggest upgrading memory or fixing the error
4. If you say "do it", it runs `POST /api/apps/update` with new memory limits

#### Manage databases

```
Create a postgres database called "users-db" and attach it to my-api.
```

Cursor will:
1. `POST /api/addons/create` with `{"name": "users-db", "type": "postgres"}`
2. `POST /api/addons/attach` with the addon ID and app ID

#### Infrastructure overview

```
Give me a health report for all my infrastructure.
```

Cursor will:
1. `GET /api/apps` — list all apps with status
2. `GET /api/metrics/apps` — CPU/memory for each
3. `GET /api/addons` — database health
4. Synthesize it into a readable report

---

## Method 2: Cursor Rules (Persistent Context)

Create a `.cursorrules` file in your project root so Cursor always knows about your PaaS:

```bash
cat > ~/.cursorrules << 'RULES'
# Better-PaaS Agent Context

I have a Better-PaaS instance — a self-hosted PaaS for deploying apps and databases.

## Environment
- API URL: from env var PAAS_API_URL (default: http://localhost:8080)
- Auth token: from env var PAAS_TOKEN (scoped agent token)

## Authentication
Every API request needs:
Authorization: Bearer $PAAS_TOKEN

## Common Commands

### List apps
curl -s -H "Authorization: Bearer $PAAS_TOKEN" "$PAAS_API_URL/api/apps" | jq

### Get app details
curl -s -H "Authorization: Bearer $PAAS_TOKEN" "$PAAS_API_URL/api/apps/get?id=<APP_ID>" | jq

### Deploy app
curl -s -X POST "$PAAS_API_URL/api/deploy" \
  -H "Authorization: Bearer $PAAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"<NAME>","gitRepo":"<REPO>","branch":"main"}' | jq

### Redeploy app
curl -s -X POST "$PAAS_API_URL/api/apps/redeploy" \
  -H "Authorization: Bearer $PAAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"<APP_ID>"}' | jq

### Read logs
curl -s -H "Authorization: Bearer $PAAS_TOKEN" \
  "$PAAS_API_URL/api/apps/runtime-logs?id=<APP_ID>&lines=50" | jq '.logs'

### Get metrics
curl -s -H "Authorization: Bearer $PAAS_TOKEN" "$PAAS_API_URL/api/metrics/apps" | jq

### Create database
curl -s -X POST "$PAAS_API_URL/api/addons/create" \
  -H "Authorization: Bearer $PAAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"<NAME>","type":"postgres"}' | jq

## Rules
1. Always show the curl command before running it.
2. Never run destructive commands (delete, prune) without explicit confirmation.
3. If PAAS_TOKEN is missing, remind the user to set it.
4. Prefer `jq` for formatting JSON responses.
RULES
```

Now every Cursor chat in any project knows how to talk to your PaaS.

---

## Method 3: Claude Code (Terminal-Based AI)

Claude Code runs in your terminal, so it naturally has access to your environment variables.

### Setup

```bash
# Install Claude Code if you haven't
pip install anthropic-claude-code

# Set your token
export PAAS_API_URL="http://localhost:8080"
export PAAS_TOKEN="bpagt_your_token"

# Start Claude Code in your project directory
claude
```

### Example session

```
> list my apps on Better-PaaS
[Claude runs curl -H "Authorization: Bearer $PAAS_TOKEN" ...]

> deploy this repo to Better-PaaS as "web-app"
[Claude detects git remote, runs POST /api/deploy with repo URL and branch]

> why is web-app failing? check logs and metrics
[Claude reads logs, interprets the error, checks memory usage]

> scale web-app to 1GB RAM and restart it
[Claude runs POST /api/apps/update with memory="1g", then POST /api/apps/stop/start]
```

Claude Code is particularly good at this because:
- It's already in your terminal where the env vars are set
- It remembers context across turns
- It can chain multiple API calls for complex workflows

---

## Method 4: VS Code + GitHub Copilot Chat

Copilot Chat can also run terminal commands in VS Code:

1. Open Copilot Chat (Cmd+Shift+I)
2. Switch to "Agent" mode if available
3. Give it the same context as Method 1

However, Copilot's terminal access is more limited than Cursor or Claude Code. You may need to paste commands manually.

---

## Safety Guardrails

When testing with AI agents, keep these in mind:

### 1. Use a read-only or limited-scope agent first

```bash
# Create an agent that CANNOT delete or deploy
curl -X POST http://localhost:8080/api/agents/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AI Assistant - Safe Mode",
    "scopes": ["apps:read", "logs:read", "metrics:read"]
  }'
```

Test with this first. The AI can observe but not modify anything.

### 2. Require confirmation for destructive actions

Add this to your `.cursorrules`:

```
## DESTRUCTIVE ACTION POLICY
Before running any of these commands, you MUST ask for explicit confirmation:
- POST /api/apps/delete
- POST /api/addons/delete
- POST /api/servers/delete
- POST /api/backups/restore
- POST /api/docker/prune
- POST /api/system/update/apply
```

### 3. Monitor what the AI does

After an AI session, check the audit log:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/api/audit-logs?limit=20" | jq
```

You should see entries like:

```json
{
  "actorType": "agent",
  "actorId": "a1b2c3d4e5",
  "action": "app:deploy",
  "outcome": "success"
}
```

This proves the AI used the agent token and the action was logged.

### 4. Rotate tokens after heavy testing

If you've been experimenting:

```bash
curl -X POST http://localhost:8080/api/agents/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "<agent_id>"}'
```

---

## Example: Full Cursor Session

Here's what a real interaction looks like:

**You:**
```
I have a Next.js app in this repo. Deploy it to my Better-PaaS as "docs-site".
```

**Cursor thinks:**
```
1. User wants to deploy current repo.
2. Git remote is origin = https://github.com/me/docs-site
3. Need to call POST /api/deploy with name="docs-site", gitRepo, branch="main"
4. Environment variables: PAAS_API_URL and PAAS_TOKEN are set
```

**Cursor says:**
```
I'll deploy your Next.js app as "docs-site". The command I'll run is:

curl -X POST "$PAAS_API_URL/api/deploy" \
  -H "Authorization: Bearer $PAAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "docs-site",
    "gitRepo": "https://github.com/me/docs-site",
    "branch": "main"
  }'

Proceed? [Yes/No]
```

**You:** `Yes`

**Cursor runs it and shows:**
```json
{
  "id": "abc123def4",
  "name": "docs-site",
  "status": "building",
  "url": "http://abc123def4.192.168.1.10.sslip.io"
}
```

**You:**
```
Is it done? Show me the status.
```

**Cursor:**
```
Status: building. Checking again... Now running! Live at:
http://abc123def4.192.168.1.10.sslip.io
```

**You:**
```
Show me the last 20 lines of logs.
```

**Cursor runs:**
```bash
curl -s -H "Authorization: Bearer $PAAS_TOKEN" \
  "$PAAS_API_URL/api/apps/runtime-logs?id=abc123def4&lines=20" | jq '.logs'
```

And shows you the formatted logs.

---

## Troubleshooting AI Integration

### "The AI says it doesn't know about Better-PaaS"
- Make sure you gave it the context block from Method 1
- Or create the `.cursorrules` file from Method 2

### "The AI tries to use the wrong API URL"
- Your `PAAS_API_URL` env var isn't set in the terminal where the AI runs
- Set it in `.zshrc` or `.bashrc` so it's always available

### "The AI gets 403 Forbidden"
- The agent token doesn't have the right scope for that action
- Check which scope is missing and create a new agent with broader permissions
- Or switch to the admin token for that specific command

### "The AI gets 401 Unauthorized"
- The agent token was deleted or rotated
- Create a new agent token

### "The AI can't parse JSON responses"
- Make sure `jq` is installed: `brew install jq` or `apt install jq`
- Or tell the AI to use Python: `python3 -m json.tool`

---

## What's Next: MCP Bridge

Right now the AI uses **terminal commands** to talk to Better-PaaS. The next step is the **`paas-mcp` bridge** — a lightweight binary that speaks the Model Context Protocol.

With MCP, the interaction becomes natural language **without** curl:

```
> deploy my current project to staging
✅ Done. Live at https://my-app.paas.dev

> why is the build failing?
❌ Error: out of memory during npm install. Current limit: 512MB. Recommend 1GB.

> increase memory to 1GB and redeploy
✅ Redeployed. Build successful.
```

No terminal commands. No JSON. Just conversation.

This is documented in the agent-first roadmap and will be implemented as the next phase.

---

## Quick Reference Card

Keep this handy:

| Env Var | What to set |
|---------|-------------|
| `PAAS_API_URL` | `http://localhost:8080` (local) or your VPS URL |
| `PAAS_TOKEN` | Your `bpagt_...` agent token |

| Say this to the AI | What it will do |
|--------------------|-----------------|
| "List my apps" | `GET /api/apps` |
| "Deploy [repo] as [name]" | `POST /api/deploy` |
| "Show logs for [name]" | `GET /api/apps/runtime-logs` |
| "Check metrics" | `GET /api/metrics/apps` |
| "Create a postgres DB called [name]" | `POST /api/addons/create` |
| "Attach [db] to [app]" | `POST /api/addons/attach` |
| "Restart [app]" | `POST /api/apps/stop` + `start` |
| "Show audit trail" | `GET /api/audit-logs` |
