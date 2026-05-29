package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// Cron expression matching
// ---------------------------------------------------------------------------

func TestCronMatches(t *testing.T) {
	// Reference time: 2025-01-06 (Monday) 02:30.
	ref := time.Date(2025, 1, 6, 2, 30, 0, 0, time.UTC)

	cases := []struct {
		expr string
		want bool
	}{
		{"* * * * *", true},
		{"30 2 * * *", true},     // exact minute+hour
		{"30 2 6 1 1", true},     // full match (Mon=1, Jan=1, day 6)
		{"0 2 * * *", false},     // wrong minute
		{"30 3 * * *", false},    // wrong hour
		{"*/15 * * * *", true},   // 30 is divisible by 15
		{"*/7 * * * *", false},   // 30 not divisible by 7
		{"0,30 * * * *", true},   // list contains 30
		{"15,45 * * * *", false}, // list excludes 30
		{"30 0-5 * * *", true},   // hour range includes 2
		{"30 5-10 * * *", false}, // hour range excludes 2
		{"30 2 * * 1-5", true},   // weekday range includes Mon
		{"30 2 * * 6-7", false},  // weekday range excludes Mon
	}
	for _, c := range cases {
		if got := cronMatches(c.expr, ref); got != c.want {
			t.Errorf("cronMatches(%q) = %v, want %v", c.expr, got, c.want)
		}
	}
}

func TestCronMatchesInvalid(t *testing.T) {
	ref := time.Now()
	for _, expr := range []string{"", "* * *", "a b c d e", "* * * * * *"} {
		if cronMatches(expr, ref) {
			t.Errorf("cronMatches(%q) = true, want false for malformed expr", expr)
		}
	}
}

func TestValidCronExpr(t *testing.T) {
	if !validCronExpr("0 * * * *") {
		t.Error("expected '0 * * * *' to be valid")
	}
	if validCronExpr("0 * * *") {
		t.Error("expected 4-field expr to be invalid")
	}
}

// ---------------------------------------------------------------------------
// GitHub webhook signature verification
// ---------------------------------------------------------------------------

func sign(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyGitHubSignature(t *testing.T) {
	secret := "supersecret"
	body := []byte(`{"ref":"refs/heads/main"}`)

	good := sign(secret, body)
	if !verifyGitHubSignature(good, body, secret) {
		t.Error("valid signature rejected")
	}
	if verifyGitHubSignature(good, body, "wrong-secret") {
		t.Error("signature accepted under wrong secret")
	}
	if verifyGitHubSignature(sign(secret, []byte("tampered")), body, secret) {
		t.Error("signature accepted for tampered body")
	}
	if verifyGitHubSignature("", body, secret) {
		t.Error("empty signature accepted")
	}
	if verifyGitHubSignature("sha256=zzzz", body, secret) {
		t.Error("malformed hex signature accepted")
	}
	if verifyGitHubSignature("md5=abcd", body, secret) {
		t.Error("non-sha256 prefix accepted")
	}
}

// ---------------------------------------------------------------------------
// Resource limit & domain validation
// ---------------------------------------------------------------------------

func TestValidateResourceLimits(t *testing.T) {
	valid := [][2]string{
		{"", ""}, {"512m", ""}, {"1g", "1"}, {"256m", "0.5"}, {"2048b", "2"}, {"1024k", ""},
	}
	for _, c := range valid {
		if err := validateResourceLimits(c[0], c[1]); err != nil {
			t.Errorf("validateResourceLimits(%q,%q) unexpected error: %v", c[0], c[1], err)
		}
	}
	invalid := [][2]string{
		{"512mb", ""}, {"abc", ""}, {"", "-1"}, {"", "0"}, {"", "999"}, {"", "x"},
	}
	for _, c := range invalid {
		if err := validateResourceLimits(c[0], c[1]); err == nil {
			t.Errorf("validateResourceLimits(%q,%q) expected error, got nil", c[0], c[1])
		}
	}
}

func TestValidateDomains(t *testing.T) {
	if err := validateDomains([]string{"app.example.com", "www.example.com", ""}); err != nil {
		t.Errorf("unexpected error for valid domains: %v", err)
	}
	for _, bad := range []string{"not a domain", "no-tld", "-bad.com", "a..b.com"} {
		if err := validateDomains([]string{bad}); err == nil {
			t.Errorf("expected error for invalid domain %q", bad)
		}
	}
}

// ---------------------------------------------------------------------------
// mergeEnvVars secret masking
// ---------------------------------------------------------------------------

func TestMergeEnvVars(t *testing.T) {
	existing := map[string]string{"SECRET": "real-value", "PUBLIC": "old"}
	incoming := map[string]string{"SECRET": "***", "PUBLIC": "new", "NEW": "x"}
	out := mergeEnvVars(existing, incoming, []string{"SECRET"})

	if out["SECRET"] != "real-value" {
		t.Errorf("masked secret should keep stored value, got %q", out["SECRET"])
	}
	if out["PUBLIC"] != "new" {
		t.Errorf("non-secret should update, got %q", out["PUBLIC"])
	}
	if out["NEW"] != "x" {
		t.Errorf("new key should be added, got %q", out["NEW"])
	}

	// A "***" value for a non-secret key is taken literally (not preserved).
	out2 := mergeEnvVars(existing, map[string]string{"PUBLIC": "***"}, nil)
	if out2["PUBLIC"] != "***" {
		t.Errorf("non-secret '***' should pass through, got %q", out2["PUBLIC"])
	}
}

// ---------------------------------------------------------------------------
// App.Public redaction
// ---------------------------------------------------------------------------

func TestAppPublicRedaction(t *testing.T) {
	app := App{
		GitToken:      "ghp_realtoken",
		WebhookSecret: "whsecret",
		EnvVars:       map[string]string{"API_KEY": "sk-123", "DEBUG": "true"},
		SecretKeys:    []string{"API_KEY"},
	}
	pub := app.Public()
	if pub.GitToken != "***" {
		t.Errorf("git token not redacted: %q", pub.GitToken)
	}
	if pub.WebhookSecret != "***" {
		t.Errorf("webhook secret not redacted: %q", pub.WebhookSecret)
	}
	if pub.EnvVars["API_KEY"] != "***" {
		t.Errorf("secret env var not redacted: %q", pub.EnvVars["API_KEY"])
	}
	if pub.EnvVars["DEBUG"] != "true" {
		t.Errorf("non-secret env var should not be redacted: %q", pub.EnvVars["DEBUG"])
	}
	// Original must be untouched.
	if app.GitToken != "ghp_realtoken" || app.EnvVars["API_KEY"] != "sk-123" {
		t.Error("Public() mutated the original app")
	}
}

// ---------------------------------------------------------------------------
// docker size parsing (per-app metrics)
// ---------------------------------------------------------------------------

func TestToMB(t *testing.T) {
	cases := []struct {
		in   string
		want float64
	}{
		{"1MiB", 1},
		{"1024kB", 1.024},
		{"1GiB", 1024},
		{"1GB", 1000},
		{"512B", 512.0 / (1024 * 1024)},
	}
	for _, c := range cases {
		got := toMB(c.in)
		if diff := got - c.want; diff > 0.01 || diff < -0.01 {
			t.Errorf("toMB(%q) = %f, want %f", c.in, got, c.want)
		}
	}
}
