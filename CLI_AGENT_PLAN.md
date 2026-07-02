# Better-PaaS CLI Agent Integration Plan

## Overview

This document describes how Better-PaaS is managed and monitored from **local CLI-based AI coding tools** — Claude Code, OpenAI Codex, OpenCode, Cursor, Aider, and any other MCP-compatible assistant. The goal is for a developer to work inside their project directory and control their entire PaaS lifecycle without leaving the terminal.

> **Workflow**:  `git push` → open terminal → ask Codex "deploy my-api to staging" → check logs → ask Claude Code "why is the build failing?" → fix code → ask "redeploy"

---

## 1. The Universal Interface: MCP

All modern CLI AI tools speak **Model Context Protocol (MCP)**. Better-PaaS exposes itself as an MCP server, which means **one implementation works everywhere**.

### 1.1 MCP Server Architecture

```
┌──────────────────┐      stdio/SSE       ┌─────────────────┐      HTTP/JSON      ┌──────────────┐
│   Claude Code    │ ◄──────────────────► │  paas-mcp bin   │ ◄─────────────────► │  Better-PaaS │
│   or Codex       │                      │  (local bridge) │                     │   Backend    │
└──────────────────┘                      └─────────────────┘                     └──────────────┘
                                                │
                                                │ reads
                                                ▼
                                        ┌─────────────────┐
                                        │ ~/.paas/config  │
                                        │ (token, url)    │
                                        └─────────────────┘
```

**Two transport modes:**

| Mode | Use Case | How It Works |
|------|----------|--------------|
| **`stdio`** | Local/CLI tools (Claude Code, Codex, Cursor, etc.) | Tool spawns `better-paas mcp` as a subprocess. Binary reads `PAAS_API_URL` + `PAAS_TOKEN` from env or `~/.paas/config`, proxies stdio↔HTTP. |
| **`sse`** | Remote / web-based tools | Connect directly to `https://paas.example.com/mcp/sse` with Bearer token. |

### 1.2 The Bridge Binary: `paas-mcp`

A lightweight Go binary distributed alongside Better-PaaS (or installable via `go install github.com/sumon-ohid/better-paas/cmd/paas-mcp`).

```bash
# Installation
go install github.com/sumon-ohid/better-paas/cmd/paas-mcp@latest

# Or via Homebrew (future)
brew install better-paas/tap/paas-mcp
```

**What the binary does:**
1. Reads config from `~/.paas/config.json`
2. Starts MCP server over `stdio`
3. Accepts MCP protocol messages from the AI tool
4. Calls Better-PaaS REST API with agent token auth
5. Returns structured results to the AI tool

---

## 2. Authentication & Environment Context

### 2.1 Configuration File: `~/.paas/config.json`

Each developer has a local config mapping **environment names** to PaaS instances:

```json
{
  "version": 1,
  "default": "staging",
  "environments": {
    "local": {
      "url": "http://localhost:8080",
      "token": "bp_live_xxxxxxxxxxxx",
      "insecure": true
    },
    "staging": {
      "url": "https://paas-staging.mycompany.com",
      "token": "bp_live_xxxxxxxxxxxx",
      "project": "myapp-staging"
    },
    "production": {
      "url": "https://paas.mycompany.com",
      "token": "bp_live_xxxxxxxxxxxx",
      "project": "myapp-prod",
      "confirm_destructive": true
    }
  },
  "projects": {
    "~/dev/myapp": {
      "default_env": "staging",
      "app_name": "myapp-api",
      "repo": "https://github.com/mycompany/myapp"
    }
  }
}
```

**Fields explained:**
- `default`: Which env to use when the user doesn't specify
- `environments[].token`: An agent token generated from the PaaS dashboard (Settings → API Access)
- `environments[].project`: Default project name for that environment
- `environments[].confirm_destructive`: Forces the AI to ask before deletes/prod changes
- `projects`: Maps local directories to PaaS context (auto-detected by `git remote`)

### 2.2 Environment Detection

The `paas-mcp` binary automatically resolves the current context:

```
1. What directory am I in?  →  ~/dev/myapp
2. Is there a git remote?   →  origin = github.com/mycompany/myapp
3. Match to config?         →  "~/dev/myapp" in projects map
4. Which env to target?     →  user says "staging" or default from config
5. What's the app name?     →  "myapp-api" from config, or auto-guessed from repo
```

This means the developer never has to type IDs — the tool knows the context.

### 2.3 Login Flow

```bash
# Interactive login — generates an agent token and saves config
paas-mcp login https://paas.mycompany.com
# → prompts for admin token (one-time)
# → creates scoped agent token
# → saves to ~/.paas/config.json

# Switch environment
paas-mcp env use production

# Show current context
paas-mcp status
# → Environment: staging (https://paas-staging.mycompany.com)
# → Project: myapp-staging
# → App: myapp-api
# → Server: localhost
```

---

## 3. MCP Tools Exposed

The MCP server exposes **Tools**, **Resources**, and **Prompts** that any AI client can use.

### 3.1 Tools (Actions)

| Tool Name | Description | Arguments |
|-----------|-------------|-----------|
| `paas_list_apps` | List all apps in the current project | `env?`, `project?` |
| `paas_get_app` | Get detailed app info, status, URLs | `app` (name or ID) |
| `paas_deploy` | Deploy current repo or a specified repo | `app?`, `branch?`, `env?` |
| `paas_redeploy` | Redeploy an existing app | `app` |
| `paas_rollback` | Rollback to previous deployment | `app`, `deployment_id?` |
| `paas_stop_app` | Stop an app | `app` |
| `paas_start_app` | Start a stopped app | `app` |
| `paas_delete_app` | Delete an app (requires confirmation) | `app`, `force?` |
| `paas_update_app` | Update env vars, commands, resources | `app`, `env_vars?`, `memory?`, `cpus?` |
| `paas_get_logs` | Get runtime logs | `app`, `lines?` (default 100), `follow?` |
| `paas_get_build_logs` | Get build/deployment logs | `app`, `deployment_id?` |
| `paas_get_metrics` | Get CPU/memory metrics | `app` |
| `paas_list_addons` | List databases, caches | `env?` |
| `paas_create_addon` | Create a Postgres/Redis/MySQL addon | `name`, `type`, `env?` |
| `paas_attach_addon` | Attach addon to app | `app`, `addon` |
| `paas_db_query` | Run SQL query (for supported addons) | `addon`, `query` |
| `paas_list_servers` | List target servers | `env?` |
| `paas_server_info` | Get server metrics and status | `server?` |
| `paas_run_cron` | Trigger a cron job manually | `cron_id` |
| `paas_create_backup` | Create a backup | `app?` |
| `paas_list_backups` | List available backups | `app?` |
| `paas_system_status` | Overall platform health | `env?` |
| `paas_exec` | Execute a command inside app container | `app`, `command` |
| `paas_scan_vulns` | Scan app for vulnerabilities | `app` |
| `paas_add_domain` | Add custom domain | `app`, `domain` |
| `paas_prune_docker` | Prune unused Docker images/containers | `env?` |

### 3.2 Resources (State)

Resources are read-only snapshots of platform state, accessed via URI:

```
paas://apps                    → JSON list of all apps
paas://app/myapp-api           → Full app detail + current status
paas://app/myapp-api/logs      → Recent runtime logs
paas://app/myapp-api/metrics   → Current CPU/memory
paas://app/myapp-api/domains   → Custom domains
paas://addons                  → All addons
paas://servers                 → All servers
paas://server/localhost        → Server status + resource usage
paas://deployments/myapp-api   → Deployment history
paas://cron                    → All cron jobs
paas://backups                 → Backup list
paas://system/health           → Platform health summary
```

**Usage in Claude Code / Codex:**
>
> "Check the logs for myapp-api"
> → AI reads `paas://app/myapp-api/logs`
>
> "What's using the most memory?"
> → AI reads `paas://apps` and `paas://server/localhost/metrics`

### 3.3 Prompts (Workflow Templates)

Built-in prompt templates the AI can use for complex workflows:

| Prompt | Description |
|--------|-------------|
| `@paas/deploy-current` | "Deploy the current git repo to Better-PaaS. Auto-detect framework, suggest config, deploy to default env." |
| `@paas/debug-app` | "This app is failing. Check logs, metrics, recent deployments, and suggest a fix." |
| `@paas/migrate-db` | "Create a backup, run a database migration, verify the result." |
| `@paas/security-check` | "Scan all apps for vulnerabilities, report findings, suggest fixes." |
| `@paas/health-report` | "Generate a full platform health report: apps, servers, resources, recent errors." |
| `@paas/setup-new-project` | "Configure this repo for Better-PaaS: detect framework, generate config, create app + addon." |

---

## 4. Per-Tool Configuration

### 4.1 Claude Code (Anthropic)

```bash
# Add to Claude Code config
claude config add mcpServers.paas "$(which paas-mcp)"

# Or manually edit ~/.claude/settings.json
```

`~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "better-paas": {
      "command": "paas-mcp",
      "args": [],
      "env": {
        "PAAS_ENV": "staging"
      }
    }
  }
}
```

**Usage:**
```
$ claude
> Deploy my current project to staging
[Claude will use paas_deploy with auto-detected repo]

> Why is myapp-api down?
[Claude reads app status, then logs, then metrics]

> Scale myapp-api to 2GB RAM
[Claude calls paas_update_app with memory="2g"]

> Run psql SELECT * FROM users LIMIT 5 on the db
[Claude calls paas_db_query]
```

### 4.2 OpenAI Codex

```bash
# Codex reads MCP config from ~/.codex/config.json
codex config set mcp.better-paas.command "paas-mcp"
```

`~/.codex/config.json`:
```json
{
  "mcpServers": {
    "better-paas": {
      "command": "paas-mcp",
      "env": {
        "PAAS_API_URL": "https://paas-staging.mycompany.com",
        "PAAS_TOKEN": "bp_live_xxx"
      }
    }
  }
}
```

**Usage:**
```
$ codex
> redeploy myapp-api
> show me the last 50 lines of logs for myapp-api
> create a postgres addon called user-db and attach it to myapp-api
```

### 4.3 OpenCode

OpenCode has its own skill/plugin system. We provide either:
1. **MCP bridge** (same as above)
2. **Native skill** (if OpenCode supports custom skills with direct API calls)

```bash
# With MCP (universal)
opencode mcp add better-paas --command "paas-mcp"
```

### 4.4 Cursor

Cursor supports MCP servers via its UI or config:

```bash
# ~/.cursor/mcp.json
{
  "mcpServers": {
    "better-paas": {
      "command": "paas-mcp",
      "args": [],
      "env": {
        "PAAS_ENV": "staging"
      }
    }
  }
}
```

### 4.5 Aider

Aider supports MCP as of recent versions:

```bash
aider --mcp-server "better-paas:paas-mcp"
```

---

## 5. Natural Language Workflows

Here is what the developer experience looks like in practice:

### 5.1 Deploy from Code Editor

```
# Developer is in ~/dev/myapp, just pushed to git
$ claude

> deploy this to staging
  → paas-mcp detects: repo=github.com/me/myapp, env=staging
  → calls GET /api/apps?name=myapp
  → app exists? → calls POST /api/apps/redeploy
  → app missing? → calls POST /api/deploy with detected framework
  → streams build logs back
  → reports: "Deployed! Live at https://myapp-staging.paas.dev"

> deploy a new app called myapp-v2 from this branch feature/auth
  → POST /api/deploy { name: "myapp-v2", gitRepo: "...", branch: "feature/auth" }
```

### 5.2 Debug a Production Issue

```
> myapp-api is returning 500s on /checkout
  → GET /api/apps?name=myapp-api
  → GET /api/apps/runtime-logs?id=<id>&lines=200
  → GET /api/metrics/apps (filter for myapp-api)
  → AI analysis:
     "I see PostgreSQL connection pool exhausted errors starting at 14:32.
      Memory usage is at 92%. I recommend scaling memory or restarting.
      Should I restart the app?"

> yes restart it
  → POST /api/apps/stop → POST /api/apps/start
  → monitor until health checks pass
```

### 5.3 Database Operations

```
> connect to the user-db and add a created_at column to orders
  → finds addon named "user-db" attached to myapp-api
  → POST /api/addons/db/query { query: "ALTER TABLE orders ADD COLUMN created_at timestamptz" }
  → returns result

> backup the database before the migration
  → POST /api/backups/create
  → waits for completion via job status
  → "Backup created: backup_20250702_120000.zip (14MB)"
```

### 5.4 Infrastructure Overview

```
> show me a health report for all my infrastructure
  → GET /api/apps, /api/servers, /api/addons, /api/metrics/apps
  → AI synthesizes:
     "Platform Health Report:
      — 5 apps running, 1 stopped (myapp-worker, intentionally stopped)
      — Server localhost: CPU 34%, Memory 61%, Disk 42%
      — 2 addons healthy (postgres-primary, redis-cache)
      — 1 deployment failure in last 24h (myapp-api at 09:15, build timeout)
      — No active vulnerability alerts"

> which apps can I optimize?
  → AI analyzes metrics:
     "myapp-worker is at 2% CPU but allocated 1GB. Consider reducing to 512MB.
      myapp-api spikes to 95% CPU during deploy. Consider adding CPU limit or scaling."
```

### 5.5 Multi-Environment Promotion

```
> promote myapp-api from staging to production after checking tests pass
  → GET /api/apps?name=myapp-api (staging)
  → GET /api/apps/runtime-logs (verify no recent errors)
  → GET staging app config
  → POST /api/deploy (production env with same config)
  → "Production deployed. Run smoke tests?"

> yes run smoke tests
  → paas_exec { app: "myapp-api", command: "npm run test:smoke" }
```

---

## 6. Project-Aware Context

When the MCP server starts from a project directory, it automatically interprets the developer's intent based on the local codebase:

### 6.1 Auto-Detection at Startup

```go
func resolveContext() ProjectContext {
    cwd, _ := os.Getwd()
    
    // Check git remote
    remote := execGit("remote", "get-url", "origin")
    branch := execGit("branch", "--show-current")
    
    // Match to config
    if project, ok := config.Projects[cwd]; ok {
        return project
    }
    
    // Auto-create from git remote
    return ProjectContext{
        Repo:       remote,
        Branch:     branch,
        AppName:    guessAppName(remote),     // myapp from github.com/me/myapp
        Framework:  detectFramework(cwd),     // node, go, python, ruby, etc.
        HasDocker:  fileExists("Dockerfile"),
        HasCompose: fileExists("docker-compose.yml"),
    }
}
```

### 6.2 Framework Detection

The MCP server detects the project type to suggest build/start commands:

| Files Detected | Framework | Suggested Build | Suggested Start |
|----------------|-----------|-----------------|-----------------|
| `package.json` + Next.js | `nextjs` | `npm run build` | `npm start` |
| `package.json` + Express | `node` | `npm install` | `node server.js` |
| `go.mod` | `go` | `go build` | `./server` |
| `requirements.txt` + Flask | `flask` | `pip install` | `flask run` |
| `composer.json` | `php` | `composer install` | `php -S localhost:8080` |
| `Cargo.toml` | `rust` | `cargo build --release` | `./target/release/app` |
| `Gemfile` | `ruby` | `bundle install` | `bundle exec ruby app.rb` |
| `Dockerfile` | `docker` | `docker build` | (from Dockerfile) |

### 6.3 Context in Every Tool Call

All tools implicitly use the resolved context unless overridden:

```json
// When developer types "deploy", the tool auto-fills:
{
  "gitRepo": "https://github.com/me/myapp",
  "branch": "feature/auth",
  "name": "myapp-api",
  "buildCommand": "npm run build",
  "startCommand": "npm start",
  "env": "staging"
}
```

---

## 7. Security & Safety in CLI Context

### 7.1 Scoped Agent Tokens

Tokens generated for CLI tools are scoped and revocable:

```bash
# In dashboard: Settings → API Access → New Agent Token
Name: "Claude Code - Staging"
Scopes: ["apps:read", "apps:write", "logs:read", "addons:read"]
Environments: ["staging"]
Rate Limit: 60 req/min
```

### 7.2 Destructive Action Confirmation

For production or any environment with `confirm_destructive: true`:

```
> delete myapp-api
  The AI will NOT call paas_delete_app(force=true).
  Instead, it returns:
  "This will permanently delete myapp-api including all data.
   Type 'confirm delete myapp-api' to proceed."

> confirm delete myapp-api
  → Action confirmed, proceeds with deletion.
```

### 7.3 Dry Run Mode

Every tool supports `dry_run` for safe exploration:

```
> prune docker images (dry run)
  → GET /api/docker/prune?dryRun=true
  → "Would remove 3 images, freeing 1.2GB. Run without dry_run to execute."
```

### 7.4 Audit Trail

All CLI agent actions are logged in the PaaS audit log and viewable in the dashboard:

| Time | Actor | Action | Resource | Outcome |
|------|-------|--------|----------|---------|
| 14:32:01 | agent:claude-staging | app:redeploy | myapp-api | success |
| 14:35:12 | agent:claude-staging | app:exec | myapp-api | success (npm test) |
| 14:40:00 | agent:codex-prod | db:query | user-db | success |

---

## 8. Implementation Architecture

### 8.1 New Components

```
better-paas/
├── cmd/
│   └── paas-mcp/              # CLI binary distributed to developers
│       ├── main.go            # Entry point, transport selection
│       ├── config.go          # ~/.paas/config management
│       ├── context.go         # Project auto-detection
│       ├── mcp_server.go      # MCP protocol implementation
│       ├── tools.go           # Tool definitions & handlers
│       ├── resources.go       # Resource URI handlers
│       └── prompts.go         # Prompt templates
│
├── backend/
│   └── internal/
│       ├── mcp/               # (Optional) In-process MCP for SSE mode
│       │   └── server.go
│       └── paas/
│           ├── agents.go      # Agent token CRUD (from Phase 1)
│           ├── audit.go       # Audit logging (from Phase 1)
│           └── ...
│
└── docs/
    └── MCP_SETUP.md           # Setup guide for each tool
```

### 8.2 MCP Protocol Implementation

The `paas-mcp` binary implements the MCP protocol over stdio:

```go
// main.go — transport initialization
func main() {
    config := loadConfig()
    client := NewPaasClient(config)
    server := mcp.NewServer("better-paas", "1.0.0")
    
    // Register all tools, resources, prompts
    registerTools(server, client)
    registerResources(server, client)
    registerPrompts(server, client)
    
    // Start stdio server
    server.ServeStdio(os.Stdin, os.Stdout)
}
```

**Tool registration example:**
```go
server.RegisterTool(mcp.Tool{
    Name:        "paas_deploy",
    Description: "Deploy an app to Better-PaaS. Auto-detects repo/config from current directory.",
    InputSchema: jsonschema.Object{
        Properties: map[string]jsonschema.Schema{
            "name":     jsonschema.String{Description: "App name (auto-detected if not provided)"},
            "env":      jsonschema.String{Description: "Environment (staging/production/local)"},
            "branch":   jsonschema.String{Description: "Git branch to deploy"},
            "no_cache": jsonschema.Boolean{Description: "Skip build cache"},
        },
    },
    Handler: func(args map[string]interface{}) (mcp.ToolResult, error) {
        ctx := resolveContext()
        appName := firstNonEmpty(args["name"], ctx.AppName)
        env := firstNonEmpty(args["env"], config.DefaultEnv)
        
        result, err := client.Deploy(DeployRequest{
            Name:     appName,
            GitRepo:  ctx.Repo,
            Branch:   firstNonEmpty(args["branch"], ctx.Branch),
            Env:      env,
            NoCache:  args["no_cache"].(bool),
        })
        
        return mcp.ToolResult{Content: result}, err
    },
})
```

### 8.3 Resource Handler

```go
server.RegisterResource("paas://app/{name}/logs", func(uri string, params map[string]string) (mcp.Resource, error) {
    appName := params["name"]
    logs, err := client.GetLogs(appName, 100)
    if err != nil {
        return mcp.Resource{}, err
    }
    return mcp.Resource{
        URI:      uri,
        MimeType: "text/plain",
        Text:     strings.Join(logs, "\n"),
    }, nil
})
```

---

## 9. Quick Start: For Better-PaaS Users

### Step 1: Install the MCP Bridge
```bash
go install github.com/sumon-ohid/better-paas/cmd/paas-mcp@latest
```

### Step 2: Connect to Your PaaS
```bash
paas-mcp login https://paas.mycompany.com
# Enter your admin token (from PaaS dashboard)
# Select default environment
```

### Step 3: Configure Your AI Tool

**Claude Code:**
```bash
claude config add mcpServers.better-paas "$(which paas-mcp)"
```

**Codex:**
```bash
# Add to ~/.codex/config.json
codex config set mcp.better-paas.command "paas-mcp"
```

**Cursor:** Add to `~/.cursor/mcp.json` (see section 4.4).

### Step 4: Start Using

```bash
# From your project directory
cd ~/dev/myapp
claude

> deploy this to staging
> check logs
> scale to 2GB memory
> create a postgres database and connect it
```

---

## 10. Future Enhancements

| Feature | Description |
|---------|-------------|
| **Chat Mode** | `paas-mcp chat` — start an interactive shell for complex multi-turn operations |
| **GitHub Actions Integration** | GitHub Action that uses agent token to deploy on push |
| **Slack Bot** | Slack app using the same MCP tool definitions |
| **VS Code Extension** | GUI panel showing apps, logs, metrics alongside editor |
| **Multi-Cloud** | `paas-mcp` connects to multiple PaaS instances (work + personal) simultaneously |
| **Offline Cache** | Cache app configs locally for operations when PaaS is unreachable |

---

*This plan ensures Better-PaaS becomes a first-class citizen in the AI-assisted development workflow, accessible from any tool, any terminal, anywhere.*
