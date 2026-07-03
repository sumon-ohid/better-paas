package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestResolveConnectTargetsFromDashboardManifest(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/health" {
			json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
			return
		}
		http.NotFound(w, r)
	}))
	defer api.Close()

	var dashboard *httptest.Server
	dashboard = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/.well-known/better-paas.json" {
			http.NotFound(w, r)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{
			"apiUrl": api.URL,
			"uiUrl":  dashboard.URL,
		})
	}))
	defer dashboard.Close()

	gotAPI, gotUI, err := resolveConnectTargets(dashboard.URL, "")
	if err != nil {
		t.Fatal(err)
	}
	if gotAPI != api.URL {
		t.Fatalf("apiURL = %q want %q", gotAPI, api.URL)
	}
	if gotUI != dashboard.URL {
		t.Fatalf("uiURL = %q want %q", gotUI, dashboard.URL)
	}
}

func TestResolveConnectTargetsFromAPIHealth(t *testing.T) {
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/health":
			json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
		case "/.well-known/better-paas.json":
			json.NewEncoder(w).Encode(map[string]string{
				"apiUrl": srv.URL,
				"uiUrl":  "http://dashboard.test",
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	gotAPI, gotUI, err := resolveConnectTargets(srv.URL, "")
	if err != nil {
		t.Fatal(err)
	}
	if gotAPI != srv.URL {
		t.Fatalf("apiURL = %q", gotAPI)
	}
	if gotUI != "http://dashboard.test" {
		t.Fatalf("uiURL = %q", gotUI)
	}
}

func TestResolveConnectTargetsSameOriginFallback(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/health" {
			json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
			return
		}
		http.NotFound(w, r)
	}))
	defer srv.Close()

	gotAPI, gotUI, err := resolveConnectTargets(srv.URL, "")
	if err != nil {
		t.Fatal(err)
	}
	if gotAPI != srv.URL || gotUI != srv.URL {
		t.Fatalf("got api=%q ui=%q want %q", gotAPI, gotUI, srv.URL)
	}
}

func TestDeriveUIURLLocalhostDev(t *testing.T) {
	got := deriveUIURL("http://localhost:8080", "")
	if got != "http://localhost:3000" {
		t.Fatalf("uiURL = %q", got)
	}
}

func TestDeriveUIURLProduction(t *testing.T) {
	got := deriveUIURL("https://paas.better-paas.com", "")
	if got != "https://paas.better-paas.com" {
		t.Fatalf("uiURL = %q", got)
	}
}
