# Testing Agent Access & Audit Logs Locally

This guide walks you through testing every part of the agent token system on a local Better-PaaS instance.

---

## 0. Prerequisites

- Better-PaaS backend built: `cd backend && go build -o server .`
- Server running on `localhost:8080`
- `curl` installed (or any HTTP client like Postman/Insomnia)

## 1. Start the Server and Get Your Admin Token

```bash
cd ~/better-paas/backend
./server
```

In a separate terminal, get the admin token:

```bash
# Option A: from the CLI
./server token

# Option B: from the file
cat data/admin_token.txt
```

Save it as a shell variable for the rest of this guide:

```bash
export ADMIN_TOKEN="YOUR_ADMIN_TOKEN_HERE"
```

---

## 2. Verify the Admin Token Works

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/api/apps
```

You should get a `200` with a JSON array (empty `[]` if no apps yet).

---

## 3. Create Agent Tokens

### 3a. Create a read-write agent (full deploy access)

```bash
curl -X POST http://localhost:8080/api/agents/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Deploy Bot",
    "scopes": ["apps:read", "apps:write", "deploy:trigger", "logs:read", "metrics:read"]
  }'
```

**Expected response:**

```json
{
  "id": "abc123...",
  "name": "Deploy Bot",
  "scopes": ["apps:read", "apps:write", ...],
  "createdAt": "2026-07-02T...",
  "token": "bpagt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..."
}
```

Copy the `token` value immediately - it is shown **only once**.

Save it:

```bash
export RW_AGENT="bpagt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..."
```

### 3b. Create a read-only agent

```bash
curl -X POST http://localhost:8080/api/agents/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Monitoring Bot",
    "scopes": ["apps:read", "logs:read", "metrics:read"]
  }'
```

Save token:

```bash
export RO_AGENT="bpagt_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy..."
```

---

## 4. Test Agent Authentication

### 4a. Read-only agent can list apps

```bash
curl -H "Authorization: Bearer $RO_AGENT" http://localhost:8080/api/apps
```

Expected: `200 OK` with JSON array.

### 4b. Read-only agent CANNOT deploy apps

```bash
curl -X POST http://localhost:8080/api/deploy \
  -H "Authorization: Bearer $RO_AGENT" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-app", "gitRepo": "https://github.com/test/test", "branch": "main"}'
```

Expected:

```json
{ "error": "Forbidden: missing scope deploy:trigger" }
```

HTTP status: `403 Forbidden`.

### 4c. Read-write agent CAN deploy apps

```bash
curl -X POST http://localhost:8080/api/deploy \
  -H "Authorization: Bearer $RW_AGENT" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-app", "gitRepo": "https://github.com/test/test", "branch": "main"}'
```

Expected: `200 OK` with app JSON including `status: "building"`.

---

## 5. Test Admin-Only Endpoints

Agent tokens should be rejected from sensitive endpoints like agent management and audit logs.

### 5a. Agent token cannot list agents

```bash
curl -H "Authorization: Bearer $RW_AGENT" http://localhost:8080/api/agents
```

Expected:

```json
{ "error": "Forbidden: admin token required" }
```

HTTP status: `403 Forbidden`.

### 5b. Agent token cannot view audit logs

```bash
curl -H "Authorization: Bearer $RW_AGENT" http://localhost:8080/api/audit-logs
```

Expected: same `403` error.

### 5c. Admin token CAN view audit logs

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8080/api/audit-logs?limit=10
```

Expected: `200 OK` with JSON array of audit entries.

---

## 6. Verify Audit Logging

### 6a. Deploy via agent and check the log

If you haven't already, deploy an app via the read-write agent (step 4c). Then:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/api/audit-logs?limit=5
```

Look for an entry like:

```json
{
  "id": "x9y8z7w6v5",
  "actorType": "agent",
  "actorId": "abc123...",
  "action": "app:deploy",
  "resourceType": "app",
  "outcome": "success",
  "createdAt": "2026-07-02T15:10:00Z"
}
```

The `"actorType": "agent"` and `"actorId"` matching the agent ID proves the audit system tracks agent actions separately from the admin.

### 6b. Do an admin action and verify it

```bash
curl -X POST http://localhost:8080/api/addons/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-db", "type": "redis"}'
```

Now check audit logs:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/api/audit-logs?limit=5
```

Should include an entry with `"actorType": "admin"` and `"action": "addon:create"`.

---

## 7. Test Token Rotation

### 7a. Rotate the read-only agent

```bash
curl -X POST http://localhost:8080/api/agents/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "<ro_agent_id>"}'
```

You'll receive a new `token`. The old `$RO_AGENT` should now fail immediately:

```bash
curl -H "Authorization: Bearer $RO_AGENT" http://localhost:8080/api/apps
```

Expected:

```json
{ "error": "Unauthorized" }
```

HTTP status: `401 Unauthorized`.

The new token should work:

```bash
export RO_AGENT_NEW="bpagt_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz..."
curl -H "Authorization: Bearer $RO_AGENT_NEW" http://localhost:8080/api/apps
```

Expected: `200 OK`.

---

## 8. Test Token Deletion

### 8a. Delete the read-write agent

```bash
curl -X POST http://localhost:8080/api/agents/delete \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "<rw_agent_id>"}'
```

Expected:

```json
{ "status": "deleted" }
```

### 8b. Verify the deleted token no longer works

```bash
curl -H "Authorization: Bearer $RW_AGENT" http://localhost:8080/api/apps
```

Expected:

```json
{ "error": "Unauthorized" }
```

---

## 9. Verify the New GET Endpoints

### 9a. Get single app (GET /api/apps/get)

If you deployed an app in step 4c, use its ID:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/api/apps/get?id=<app_id>"
```

Should return the full app object with `activeCommit` and `activeCommitMsg` fields populated.

### 9b. Get single addon (GET /api/addons/get)

If you created an addon in step 6b, use its ID:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/api/addons/get?id=<addon_id>"
```

Should return the addon object with `connEnv` values redacted (e.g. `"DATABASE_URL": "***"`).

---

## 10. Full Test Script (Copy & Run)

Save this as `test-agent.sh` and run it:

```bash
#!/usr/bin/env bash
set -e

API="http://localhost:8080"
ADMIN_TOKEN="YOUR_ADMIN_TOKEN_HERE"

echo "=== 1. List apps with admin ==="
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" $API/api/apps | head -c 200
echo ""

echo "=== 2. Create read-only agent ==="
RO_RESPONSE=$(curl -s -X POST $API/api/agents/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test RO", "scopes": ["apps:read"]}')
echo "$RO_RESPONSE" | head -c 200
RO_TOKEN=$(echo "$RO_RESPONSE" | grep -o '"token":"bpagt_[^"]*' | cut -d'"' -f4)
echo ""
echo "RO_TOKEN: ${RO_TOKEN:0:20}..."

echo "=== 3. RO agent lists apps ==="
curl -s -H "Authorization: Bearer $RO_TOKEN" $API/api/apps | head -c 100
echo ""

echo "=== 4. RO agent fails to deploy ==="
curl -s -X POST $API/api/deploy \
  -H "Authorization: Bearer $RO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"x","gitRepo":"https://github.com/t/t","branch":"main"}' | head -c 100
echo ""

echo "=== 5. RO agent fails to access audit logs ==="
curl -s -H "Authorization: Bearer $RO_TOKEN" $API/api/audit-logs | head -c 100
echo ""

echo "=== 6. Create read-write agent ==="
RW_RESPONSE=$(curl -s -X POST $API/api/agents/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test RW", "scopes": ["apps:read","apps:write","deploy:trigger","logs:read"]}')
RW_TOKEN=$(echo "$RW_RESPONSE" | grep -o '"token":"bpagt_[^"]*' | cut -d'"' -f4)
echo "RW_TOKEN: ${RW_TOKEN:0:20}..."

echo "=== 7. RW agent deploys app ==="
DEPLOY=$(curl -s -X POST $API/api/deploy \
  -H "Authorization: Bearer $RW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-agent-app","gitRepo":"https://github.com/test/test","branch":"main"}')
APP_ID=$(echo "$DEPLOY" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "Deployed app ID: $APP_ID"

echo "=== 8. Check audit logs (admin) ==="
sleep 1
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$API/api/audit-logs?limit=5" | head -c 300
echo ""

echo "=== 9. Get single app ==="
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$API/api/apps/get?id=$APP_ID" | head -c 200
echo ""

echo "=== 10. Delete agent ==="
AGENT_ID=$(echo "$RW_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
curl -s -X POST $API/api/agents/delete \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$AGENT_ID\"}"
echo ""

echo "=== 11. Deleted token fails ==="
curl -s -H "Authorization: Bearer $RW_TOKEN" $API/api/apps | head -c 100
echo ""

echo "=== All tests passed ==="
```

Run:

```bash
chmod +x test-agent.sh
./test-agent.sh
```

---

## Expected Results Summary

| Test | Token | Endpoint | Expected Status | Expected Body |
|------|-------|----------|----------------|---------------|
| Admin lists apps | Admin | `GET /api/apps` | 200 | `[]` or app array |
| Create agent | Admin | `POST /api/agents/create` | 200 | Agent JSON with `token` |
| RO agent lists apps | RO Agent | `GET /api/apps` | 200 | App array |
| RO agent deploys | RO Agent | `POST /api/deploy` | 403 | `missing scope deploy:trigger` |
| RW agent deploys | RW Agent | `POST /api/deploy` | 200 | App JSON |
| Agent accesses agents | Agent | `GET /api/agents` | 403 | `admin token required` |
| Agent accesses audit | Agent | `GET /api/audit-logs` | 403 | `admin token required` |
| Admin accesses audit | Admin | `GET /api/audit-logs` | 200 | Audit entries array |
| Get single app | Any valid | `GET /api/apps/get` | 200 | App detail JSON |
| Get single addon | Any valid | `GET /api/addons/get` | 200 | Addon detail JSON |
| Rotate token | Admin | `POST /api/agents/rotate` | 200 | New `token` |
| Old rotated token | Rotated | `GET /api/apps` | 401 | `Unauthorized` |
| Delete agent | Admin | `POST /api/agents/delete` | 200 | `{status:deleted}` |
| Deleted token | Deleted | `GET /api/apps` | 401 | `Unauthorized` |
| Invalid token | Fake | `GET /api/apps` | 401 | `Unauthorized` |

---

## Troubleshooting Tests

### "Unauthorized" on every request
- Make sure `ADMIN_TOKEN` is correct. Reprint with `./server token`.
- Make sure the server is running and listening on `:8080`.

### "Forbidden: admin token required" on everything
- You are using an agent token for an admin-only endpoint. That's the correct behavior - switch to the admin token.

### "Unauthorized" for a newly created agent
- Agent tokens are cached in memory on server start. The token should work immediately after creation. If not, restart `./server` - the cache is rebuilt on boot.

### Agent shows `"actorId": ""` in audit logs
- The `actorId` is the agent's ID, not the token. This is correct. It links the audit entry to the agent row.

### Audit log shows no entries
- Audit logging only captures `POST`, `PUT`, `PATCH`, and `DELETE` requests after successful authentication. `GET` requests are not logged. Make sure you performed a mutating action before checking logs.

### "connection refused"
- The server is not running. Start it with `./server` in another terminal.
