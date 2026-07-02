package paas

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWellKnownManifest(t *testing.T) {
	t.Setenv("PAAS_UI_URL", "https://paas.example.com")

	srv := httptest.NewServer(http.HandlerFunc(handleWellKnown))
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/.well-known/better-paas.json")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}

	var out map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out["apiUrl"] != srv.URL {
		t.Fatalf("apiUrl = %q want %q", out["apiUrl"], srv.URL)
	}
	if out["uiUrl"] != "https://paas.example.com" {
		t.Fatalf("uiUrl = %q", out["uiUrl"])
	}
}

func TestWellKnownPublicPath(t *testing.T) {
	if !publicPaths["/.well-known/better-paas.json"] {
		t.Fatal("expected well-known path to be public")
	}
}
