# Better-PaaS Agent-First Roadmap

## Vision
Transform Better-PaaS from a dashboard-centric PaaS into an **agent-first platform** where an AI agent is a first-class operator with the same (and greater) capabilities as a human using the UI. The agent can observe, reason, and act on the entire platform surface: deploying apps, debugging failures, managing databases, scaling resources, and maintaining infrastructure — autonomously or collaboratively.

> **Principle**: *Anything possible from the UI must be possible via the agent. Anything possible via the agent should be observable in the UI.*

---

## Phase 1: Foundation — Agent Identity & API Surface

### 1.1 Agent Authentication & Authorization
**Goal**: Give agents their own identity, separate from the single admin token.

| Task | Description | Files to Touch |
|------|-------------|----------------|
| Agent Token Model | Create a new `Agent` entity: `id`, `name`, `tokenHash`, `scopes[]`, `createdAt`, `lastUsedAt`, `metadata`. | `backend/internal/paas/models.go`, `backend/internal/paas/db.go` |
| Scope-Based Auth | Define scopes: `apps:read`, `apps:write`, `apps:delete`, `addons:manage`, `servers:manage`, `deploy:trigger`, `logs:read`, `metrics:read`, `system:manage`, `agent:admin`. | `backend/internal/paas/auth.go` |
| Middleware | Replace the single `httpAuthOK` check with scope-aware middleware: `requireScope("apps:write")`. Allow admin token to bypass all scopes (backward compat). | `backend/internal/paas/http_middleware.go` |
| CRUD Endpoints | `POST /api/agents` (create), `GET /api/agents`, `DELETE /api/agents/:id`, `POST /api/agents/:id/rotate` (rotate token). Only admin token can manage agents. | `backend/internal/paas/routes.go`, new file |
| UI Management | Add an "API / Agent Access" page in settings to create, name, scope, and revoke agent tokens. | `frontend/app/settings/agents/page.tsx` (or similar) |

### 1.2 Unified API for Machines
**Goal**: Ensure every UI operation has a clean, documented, machine-callable REST endpoint.

| Task | Description |
|------|-------------|
| Audit All Handlers | Walk every handler in `routes.go` and ensure it accepts/returns JSON, has proper HTTP status codes, and accepts agent tokens. |
| Missing GET Endpoints | Add `GET /api/apps/:id` (single app detail), `GET /api/addons/:id`, `GET /api/cron/:id`, `GET /api/servers/:id`. Currently many are missing. |
| Consistent Error Format | Standardize all errors to: `{ "error": "...", "code": "APP_NOT_FOUND", "details": {} }`. |
| Pagination | Add `?limit=` and `?offset=` to list endpoints (`/api/apps`, `/api/projects`, `/api/deployments/history`). |
| OpenAPI Spec | Generate an `openapi.yaml` from route definitions. This becomes the agent's "menu" of capabilities. | New: `backend/api/openapi.yaml` |

### 1.3 Structured Logging & Audit Trail
**Goal**: Every agent action is traceable.

| Task | Description | Files |
|------|-------------|-------|
| Audit Log Table | Schema: `id`, `actor_type` ("user"|"agent"), `actor_id`, `action`, `resource_type`, `resource_id`, `payload_summary`, `outcome`, `created_at`. | `backend/internal/paas/db.go` |
| Audit Middleware | Wrap every mutating handler to auto-log the action. | `backend/internal/paas/http_middleware.go` |
| Agent Attribution | Ensure agent ID is threaded through to the audit log when an agent token is used. |
| API | `GET /api/audit-logs?actor_type=agent&limit=50` for UI visibility. | `backend/internal/paas/routes.go` |

---

## Phase 2: Agent Capabilities — From Observation to Action

### 2.1 Comprehensive Read-Only Agent Tools
**Goal**: Agent can fully observe the platform state before acting.

| Capability | Endpoints / Notes |
|------------|-----------------|
| **Apps** | `GET /api/apps`, `GET /api/apps/:id`, `GET /api/apps/:id/runtime-logs`, `GET /api/metrics/apps` |
| **Projects** | `GET /api/projects`, `GET /api/projects/:id` |
| **Servers** | `GET /api/servers`, `GET /api/server/info` |
| **Addons** | `GET /api/addons`, `GET /api/addons/:id` |
| **Deployments** | `GET /api/deployments/history?appId=` |
| **Cron** | `GET /api/cron` |
| **Backups** | `GET /api/backups` |
| **Notifications** | `GET /api/notifications` |
| **Git** | `GET /api/git/repos`, `POST /api/git/branches` |
| **Catalog** | `GET /api/catalog` |
| **System** | `GET /api/system/version`, `GET /api/health`, `GET /api/analytics/overview` |

### 2.2 Actionable Agent Tools
**Goal**: Agent can perform any mutating UI action.

| Domain | Actions (all already exist, need agent-scope gating) |
|--------|-----------------------------------------------------|
| **App Lifecycle** | `POST /api/deploy` (create), `POST /api/apps/update`, `POST /api/apps/stop`, `POST /api/apps/start`, `POST /api/apps/delete`, `POST /api/apps/redeploy`, `POST /api/apps/rollback`, `POST /api/apps/rename` |
| **Domains** | `POST /api/apps/domains/add`, `POST /api/apps/domains/remove` |
| **Projects** | `POST /api/projects/create`, `POST /api/projects/rename`, `POST /api/projects/delete` |
| **Addons** | `POST /api/addons/create`, `POST /api/addons/delete`, `POST /api/addons/attach`, `POST /api/addons/detach` |
| **Database Ops** | `POST /api/addons/db/query`, `POST /api/addons/db/row/insert`, etc. |
| **Cron** | `POST /api/cron/create`, `POST /api/cron/update`, `POST /api/cron/delete`, `POST /api/cron/run` |
| **Backups** | `POST /api/backups/create`, `POST /api/backups/restore`, `POST /api/backups/delete` |
| **Servers** | `POST /api/servers/create`, `POST /api/servers/delete`, `POST /api/servers/test` |
| **System** | `POST /api/docker/prune`, `POST /api/system/update/apply` |
| **Notifications** | `POST /api/notifications/save`, `POST /api/notifications/test` |
| **Git Config** | `POST /api/git/token/save`, `POST /api/git/token/delete` |
| **Vulnerabilities** | `POST /api/apps/vulnerabilities/scan`, `POST /api/apps/vulnerabilities/fix` |

### 2.3 Long-Running Operation Feedback
**Goal**: Agent can track the progress of async operations (deployments, builds, backups).

| Task | Description | Files |
|------|-------------|-------|
| Job Queue Table | `Job { ID, Type, Status, Payload, Result, Progress%, CreatedAt, UpdatedAt }` | `backend/internal/paas/db.go` |
| Async Wrapper | Wrap deployment, backup, prune, update-apply in a unified job runner. | New: `backend/internal/paas/jobs.go` |
| Polling API | `GET /api/jobs/:id` returns job status and result. | `backend/internal/paas/routes.go` |
| Streaming API | `GET /api/jobs/:id/stream` — SSE stream of progress events (for agents who prefer streaming over WS). | New |

---

## Phase 3: Agent Interface & Protocols

### 3.1 Native MCP (Model Context Protocol) Server
**Goal**: Standardize agent interaction using the industry-standard MCP protocol so any MCP client (Claude Desktop, Cursor, etc.) can operate the PaaS.

| Task | Description |
|------|-------------|
| MCP Server | Implement an `mcp` package that exposes Tools, Resources, and Prompts. Use the official MCP Go SDK or implement the stdio/sse transport. |
| **Tools** | Map every API action to an MCP tool with JSON schema: `deploy_app`, `stop_app`, `get_app_logs`, `run_sql`, `create_addon`, etc. |
| **Resources** | Expose live platform state as resources: `paas://apps`, `paas://app/{id}`, `paas://server/{id}/metrics`. |
| **Prompts** | Built-in prompts: `@paas/debug-app`, `@paas/deploy-from-repo`, `@paas/scale-resources`. |
| Transport | Support `stdio` (for local CLI usage) and `SSE` (for remote agent connections). |
| Files | New: `backend/internal/mcp/server.go`, `backend/internal/mcp/tools.go`, `backend/internal/mcp/resources.go` |

### 3.2 Agent Chat UI in Dashboard
**Goal**: The frontend gets a first-class agent chat panel where users can converse with the platform.

| Task | Description | Files |
|------|-------------|-------|
| Chat Backend | `POST /api/agent/chat` — accepts messages, maintains conversation context, calls tools via internal dispatch, returns responses. Optionally proxy to an external LLM. | New: `backend/internal/agent/chat.go` |
| Conversation Store | SQLite table: `Conversation { ID, Title, MessagesJSON, CreatedAt }`. | `backend/internal/paas/db.go` |
| Chat UI Component | A slide-over or dedicated `/agent` page with message history, tool-call visualization, and markdown rendering. | New: `frontend/app/agent/page.tsx`, `frontend/components/agent-chat.tsx` |
| Tool Call Visualization | Show the agent's thought process: "I will check the logs for app `xyz` → [call get_logs] → Found error: ... → [call restart_app]". | Frontend component |

### 3.3 Agent Memory & Context
**Goal**: Agent remembers previous interactions and platform state across sessions.

| Task | Description |
|------|-------------|
| Conversation History | Store full message + tool call + result history per conversation. |
| Platform State Snapshot | Before a complex operation, the agent can snapshot app state and restore on failure. |
| User Preferences | Store user preferences (default build command, preferred regions, notification settings) that the agent respects. |

---

## Phase 4: Agent-First UI & Workflows

### 4.1 Copilot-Everywhere
**Goal**: Every page in the dashboard has an agent copilot button that understands the current context.

| Page | Agent Context |
|------|-------------|
| App Detail | "This app is failing health checks. Diagnose?" |
| Deployment Logs | "The build failed at step 3. What's wrong?" |
| Database Explorer | "Show me tables with >10k rows" / "Run migration script X" |
| Server List | "Which servers are underutilized?" |
| Settings | "Help me configure auto-deploy and Slack notifications" |

### 4.2 Agent-Initiated Workflows
**Goal**: Agent can propose and execute multi-step workflows.

| Workflow | Steps |
|----------|-------|
| **Zero-to-Prod Deploy** | 1. Detect framework from repo → 2. Suggest build/start commands → 3. Create app → 4. Monitor build → 5. Verify health → 6. Report URL |
| **Auto-Remediation** | 1. Detect app crash from logs → 2. Check disk/memory → 3. Restart app → 4. Notify user if still failing → 5. Offer rollback |
| **Database Migration** | 1. Create backup → 2. Attach addon → 3. Run migration in container → 4. Verify schema → 5. Report result |
| **Security Patch** | 1. Scan vulnerabilities → 2. Identify fixable CVEs → 3. Trigger base-image rebuild → 4. Verify scan clean |

### 4.3 Agent-Generated Configuration
**Goal**: Agent can write and validate config that the UI then renders.

| Feature | Description |
|---------|-------------|
| Dockerfile Generation | User describes app → Agent generates `Dockerfile` + `docker-compose.yml` → User can edit in UI before deploy. |
| Env Var Suggestions | Agent reads repo README/code and suggests required env vars. |
| Compose File Import | Paste a `docker-compose.yml` → Agent validates and converts to Better-PaaS app configuration. |

---

## Phase 5: Reliability & Safety

### 5.1 Agent Sandbox & Guardrails
**Goal**: Prevent agents from doing dangerous things accidentally.

| Guardrail | Implementation |
|-----------|----------------|
| **Destructive Confirmation** | Deleting apps, servers, or restoring backups requires an explicit `confirm: true` flag. Agents must ask user confirmation unless explicitly configured as "autonomous." |
| **Resource Limits** | Agent-scoped rate limits: max 10 deploys/hour, max 5 server creations/day. |
| **Read-Only Mode** | Agent tokens can be created with zero write scopes for observability-only use. |
| **Dry Run** | Tool calls support `?dryRun=true` → returns what *would* happen without executing. |
| **Undo / Rollback** | Every mutation is captured in the audit log with a before/after snapshot. A `POST /api/rollback/:auditId` can reverse supported changes. |

### 5.2 Agent Observability
**Goal**: Users can see exactly what the agent did and why.

| Feature | Implementation |
|---------|----------------|
| **Agent Activity Feed** | A new dashboard page showing all agent actions with metadata: tool called, arguments, result, duration. |
| **Cost / Token Tracking** | If using external LLMs, track token usage per conversation. |
| **Agent Performance** | Success/failure rate per tool over time. |

---

## Phase 6: Advanced Agent Capabilities

### 6.1 Terminal & Shell Access via Agent
**Goal**: Agent can execute shell commands inside app containers or on the host (with restrictions).

| Feature | Implementation |
|---------|----------------|
| **Container Exec** | `POST /api/apps/:id/exec` — runs a command in the container, returns stdout/stderr. Scopable: `apps:exec`. |
| **Host Exec** | `POST /api/server/exec` — runs on host. Requires `system:exec` scope (not granted by default). |
| **Streaming Output** | SSE stream for long-running commands. |

### 6.2 GitOps Agent
**Goal**: Agent understands your repo and can manage lifecycle from Git.

| Feature | Implementation |
|---------|----------------|
| **Repo Analysis** | Read `package.json`, `go.mod`, `Dockerfile`, `README.md` to auto-configure builds. |
| **PR-Based Deploy** | Deploy preview environments per PR. |
| **Commit-Driven Actions** | Detect `[deploy]`, `[migrate]`, `[rollback]` in commit messages and act. |

### 6.3 Multi-Server Agent Orchestration
**Goal**: Agent can manage apps across multiple servers intelligently.

| Feature | Implementation |
|---------|----------------|
| **Placement Advisor** | Suggest which server to deploy on based on CPU, memory, disk. |
| **Cross-Server Migration** | Move an app from Server A to Server B with zero downtime (blue/green). |
| **Global Status** | `GET /api/agent/overview` — synthesized health report across all infrastructure. |

---

## Implementation Order (Recommended)

### Sprint 1–2: Foundation
1. Agent token model + scoped auth
2. Audit logging for all mutations
3. Add missing GET endpoints (`/api/apps/:id`, `/api/addons/:id`, etc.)
4. Standardize error responses

### Sprint 3–4: Agent API & MCP
5. Build MCP server with core tools (app CRUD, logs, metrics)
6. Job queue for async operations
7. OpenAPI spec generation

### Sprint 5–6: Frontend Agent Experience
8. Agent chat UI in dashboard (`/agent` page)
9. Conversation persistence
10. Copilot button on key pages (app detail, logs)

### Sprint 7–8: Agent Workflows & Safety
11. Multi-step workflow engine (deploy, remediate, migration)
12. Dry-run mode for all mutations
13. Agent activity feed / observability page
14. Destructive-action confirmation flow

### Sprint 9+: Advanced
15. Container exec via API
16. GitOps integration (repo analysis, preview deploys)
17. Multi-server orchestration advisor
18. Custom agent prompts and training

---

## Success Metrics
- [ ] **API Parity**: 100% of UI actions callable via agent token
- [ ] **MCP Coverage**: All major tools exposed via MCP
- [ ] **Observability**: Every agent action visible in audit log within 1 second
- [ ] **Autonomy**: Agent can deploy a new app from a GitHub URL end-to-end without human intervention
- [ ] **Safety**: Zero unconfirmed destructive actions by default-agent configuration
- [ ] **UX**: User can open chat and type "Deploy my Node app from github.com/me/app" and it works

---

## Files to Create (Summary)

```
backend/internal/paas/
  agents.go          # Agent CRUD + token management
  audit.go           # Audit logging middleware + queries
  jobs.go            # Async job queue runner
  app_get.go         # GET /api/apps/:id (and similar missing endpoints)
  errors.go          # Standardized error wrapper

backend/internal/agent/
  chat.go            # Agent chat endpoint + orchestration
  dispatcher.go      # Internal tool dispatcher (used by both MCP and chat)
  memory.go          # Conversation context management

backend/internal/mcp/
  server.go          # MCP server initialization
  tools.go           # Tool schema definitions
  resources.go       # Resource URI handlers
  prompts.go         # Built-in prompt templates

frontend/app/agent/
  page.tsx           # Agent chat page
  layout.tsx

frontend/components/
  agent-chat.tsx     # Chat interface component
  agent-tool-call.tsx # Tool call visualization
  agent-activity.tsx # Activity feed component

openapi.yaml         # Generated / maintained API spec
```

---

*This plan is designed to be implemented incrementally. Each phase adds standalone value while building toward the agent-first vision.*
