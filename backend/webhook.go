package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// GitHub push webhooks → auto-deploy
// ---------------------------------------------------------------------------
//
// POST /api/webhooks/github/{appID}
//
// This endpoint is intentionally PUBLIC (GitHub can't send a bearer token), so
// it is authenticated by verifying the X-Hub-Signature-256 HMAC against the
// per-app webhook secret. When the pushed branch matches the app's configured
// branch and AutoDeploy is enabled, a redeploy is triggered.
//
// Configure on GitHub: repo → Settings → Webhooks → Payload URL =
//   https://<your-host>/api/webhooks/github/<appID>
// Content type: application/json, Secret: <app.WebhookSecret>.

// maxWebhookBody caps the GitHub payload (push events are small; this guards
// against abuse since the route is unauthenticated until the HMAC check).
const maxWebhookBody = 5 << 20 // 5 MiB

func handleGitHubWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	appID := strings.TrimPrefix(r.URL.Path, "/api/webhooks/github/")
	if appID == "" || strings.Contains(appID, "/") {
		jsonError(w, "Missing app id", http.StatusBadRequest)
		return
	}

	app := findApp(appID)
	if app == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, maxWebhookBody))
	if err != nil {
		jsonError(w, "Failed to read body", http.StatusBadRequest)
		return
	}

	// Verify HMAC signature.
	if app.WebhookSecret == "" {
		jsonError(w, "Webhook not configured for this app", http.StatusForbidden)
		return
	}
	if !verifyGitHubSignature(r.Header.Get("X-Hub-Signature-256"), body, app.WebhookSecret) {
		log.Printf("[webhook] invalid signature for app %s", appID)
		jsonError(w, "Invalid signature", http.StatusUnauthorized)
		return
	}

	event := r.Header.Get("X-GitHub-Event")
	if event == "ping" {
		jsonOK(w, map[string]string{"status": "pong"})
		return
	}
	if event != "push" {
		jsonOK(w, map[string]string{"status": "ignored", "reason": "not a push event"})
		return
	}

	// Parse the pushed ref to compare against the app's branch.
	var payload struct {
		Ref   string `json:"ref"` // e.g. "refs/heads/main"
		After string `json:"after"`
	}
	_ = json.Unmarshal(body, &payload)
	pushedBranch := strings.TrimPrefix(payload.Ref, "refs/heads/")

	if !app.AutoDeploy {
		jsonOK(w, map[string]string{"status": "ignored", "reason": "auto-deploy disabled"})
		return
	}
	branch := app.Branch
	if branch == "" {
		branch = "main"
	}
	if pushedBranch != "" && pushedBranch != branch {
		jsonOK(w, map[string]string{"status": "ignored", "reason": "branch " + pushedBranch + " != " + branch})
		return
	}

	log.Printf("[webhook] auto-deploying app %s on push to %s", appID, pushedBranch)
	triggerAutoDeploy(*app)
	jsonOK(w, map[string]string{"status": "deploying"})
}

// verifyGitHubSignature checks the sha256 HMAC of body against secret using a
// constant-time comparison. Header format: "sha256=<hex>".
func verifyGitHubSignature(header string, body []byte, secret string) bool {
	const prefix = "sha256="
	if !strings.HasPrefix(header, prefix) {
		return false
	}
	want, err := hex.DecodeString(strings.TrimPrefix(header, prefix))
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	got := mac.Sum(nil)
	return hmac.Equal(got, want)
}

// triggerAutoDeploy kicks off a redeploy for an app (used by webhooks).
func triggerAutoDeploy(app App) {
	appsLock.Lock()
	for i := range apps {
		if apps[i].ID == app.ID {
			apps[i].Status = "building"
			app = apps[i]
			break
		}
	}
	appsLock.Unlock()

	buildLogsLock.Lock()
	buildLogs[app.ID] = []string{}
	buildLogsLock.Unlock()

	_ = dbUpdateAppStatus(app.ID, "building")

	deployID := generateRandomID()
	logFile := filepath.Join("data", "logs", app.ID, deployID+".log")
	os.MkdirAll(filepath.Dir(logFile), 0755)
	dep := DeploymentRecord{
		ID:        deployID,
		AppID:     app.ID,
		AppName:   app.Name,
		Status:    "building",
		LogFile:   logFile,
		CreatedAt: time.Now(),
		Trigger:   "webhook",
	}
	_ = dbCreateDeployment(dep)
	rebuildCaddyfile()

	go runDeployment(app, normalizeGitURL(app.GitRepo), deployID, logFile, "webhook", "", false)
}
