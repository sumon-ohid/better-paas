package paas

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestConnectAgentExchangeRoundTrip(t *testing.T) {
	state := "state123456789012345678901234567890"
	code := "secret-code-value"
	storeConnectSession(state, connectPending{
		code:      code,
		token:     "bpagt_roundtrip",
		agentID:   "a1",
		name:      "CLI",
		profile:   "observer",
		expiresAt: time.Now().Add(5 * time.Minute),
	})

	body, _ := json.Marshal(map[string]string{"state": state, "code": code})
	req := httptest.NewRequest(http.MethodPost, "/api/connect/agent/exchange", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleConnectAgentExchange(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", w.Code, w.Body.String())
	}
	var out map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if out["token"] != "bpagt_roundtrip" {
		t.Fatalf("token = %v", out["token"])
	}

	req2 := httptest.NewRequest(http.MethodPost, "/api/connect/agent/exchange", bytes.NewReader(body))
	w2 := httptest.NewRecorder()
	handleConnectAgentExchange(w2, req2)
	if w2.Code != http.StatusUnauthorized {
		t.Fatalf("expected second exchange to fail, got %d", w2.Code)
	}
}

func TestValidConnectState(t *testing.T) {
	if !validConnectState("abc123def456ghi789jkl012mno345") {
		t.Fatal("expected valid state")
	}
	if validConnectState("short") {
		t.Fatal("expected invalid short state")
	}
}
