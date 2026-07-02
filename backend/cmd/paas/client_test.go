package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientCreateAgent(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/agents/create" || r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}
		var req createAgentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if req.Name == "" {
			http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
			return
		}
		json.NewEncoder(w).Encode(createAgentResponse{
			ID:     "a1",
			Name:   req.Name,
			Scopes: req.Scopes,
			Token:  "bpagt_secret",
		})
	}))
	defer srv.Close()

	c := newClient(srv.URL, "admin-token")
	out, err := c.CreateAgent("My CLI", []string{scopeAppsRead})
	if err != nil {
		t.Fatal(err)
	}
	if out.Token != "bpagt_secret" {
		t.Fatalf("token = %q", out.Token)
	}
}

func TestClientListApps(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/apps" {
			http.NotFound(w, r)
			return
		}
		if got := r.Header.Get("Authorization"); got != "Bearer bpagt_x" {
			t.Fatalf("auth header = %q", got)
		}
		json.NewEncoder(w).Encode([]App{{ID: "1", Name: "web", Status: "running"}})
	}))
	defer srv.Close()

	apps, err := newClient(srv.URL, "bpagt_x").ListApps()
	if err != nil {
		t.Fatal(err)
	}
	if len(apps) != 1 || apps[0].Name != "web" {
		t.Fatalf("apps = %+v", apps)
	}
}
