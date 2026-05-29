package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// ---------------------------------------------------------------------------
// Deploy notifications
// ---------------------------------------------------------------------------
//
// On every finished deployment we optionally POST to a Slack incoming webhook
// and/or a generic JSON endpoint. Configuration lives in the meta table so it
// survives restarts and is editable from the dashboard. Delivery is
// best-effort: notification failures never affect the deployment outcome.

const notifyConfigKey = "notify_config"

// getNotificationConfig loads the stored notification settings.
func getNotificationConfig() NotificationConfig {
	raw := dbGetMeta(notifyConfigKey)
	cfg := NotificationConfig{OnSuccess: true, OnFailure: true}
	if raw != "" {
		_ = json.Unmarshal([]byte(raw), &cfg)
	}
	return cfg
}

// saveNotificationConfig persists notification settings.
func saveNotificationConfig(cfg NotificationConfig) error {
	data, _ := json.Marshal(cfg)
	return dbSetMeta(notifyConfigKey, string(data))
}

// notifyDeploy dispatches notifications for a finished deployment, respecting
// the configured on-success / on-failure toggles.
func notifyDeploy(app App, dep DeploymentRecord) {
	cfg := getNotificationConfig()
	success := dep.Status == "success"
	if success && !cfg.OnSuccess {
		return
	}
	if !success && !cfg.OnFailure {
		return
	}

	emoji := "✅"
	verb := "succeeded"
	if !success {
		emoji = "❌"
		verb = "failed"
	}
	text := fmt.Sprintf("%s Deploy %s for *%s* (%s) in %s", emoji, verb, app.Name, dep.Trigger, dep.Duration)

	if cfg.SlackWebhookURL != "" {
		postJSON(cfg.SlackWebhookURL, map[string]string{"text": text})
	}
	if cfg.GenericURL != "" {
		postJSON(cfg.GenericURL, map[string]interface{}{
			"app":      app.Name,
			"appId":    app.ID,
			"status":   dep.Status,
			"trigger":  dep.Trigger,
			"duration": dep.Duration,
			"commit":   dep.Commit,
			"url":      app.URL,
			"text":     text,
		})
	}
}

// postJSON sends a best-effort JSON POST and logs (but swallows) failures.
func postJSON(url string, payload interface{}) {
	body, err := json.Marshal(payload)
	if err != nil {
		return
	}
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("[notify] POST %s failed: %v", url, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		log.Printf("[notify] POST %s returned %d", url, resp.StatusCode)
	}
}
