package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

func runBrowserConnect(apiURL, uiURL string) int {
	state, err := randomState()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return 1
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: failed to start local callback server: %v\n", err)
		return 1
	}
	defer listener.Close()

	port := listener.Addr().(*net.TCPAddr).Port
	resultCh := make(chan browserConnectResult, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		code := strings.TrimSpace(r.URL.Query().Get("code"))
		gotState := strings.TrimSpace(r.URL.Query().Get("state"))
		if code == "" || gotState == "" {
			http.Error(w, "missing code or state", http.StatusBadRequest)
			return
		}
		if gotState != state {
			http.Error(w, "state mismatch", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Better-PaaS</title></head><body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0a;color:#fafafa"><div style="text-align:center"><h1>Connected</h1><p>You can close this tab and return to your terminal.</p></div></body></html>`)
		resultCh <- browserConnectResult{code: code, state: gotState}
	})

	server := &http.Server{Handler: mux}
	go func() {
		_ = server.Serve(listener)
	}()
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
	}()

	uiURL = strings.TrimRight(strings.TrimSpace(uiURL), "/")
	connectURL := fmt.Sprintf("%s/connect/agent?state=%s&port=%d", uiURL, state, port)

	fmt.Println("Opening browser to authorize the CLI…")
	fmt.Printf("If the browser does not open, visit:\n  %s\n\n", connectURL)
	if err := openBrowser(connectURL); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not open browser: %v\n", err)
	}

	fmt.Println("Waiting for authorization in the browser…")

	select {
	case res := <-resultCh:
		client := newClient(apiURL, "")
		exchanged, err := client.ExchangeConnect(res.state, res.code)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: exchange failed: %v\n", err)
			return 1
		}
		url := strings.TrimRight(apiURL, "/")
		if exchanged.URL != "" {
			url = strings.TrimRight(exchanged.URL, "/")
		}
		cfg := Config{
			URL:     url,
			Token:   exchanged.Token,
			Profile: exchanged.Profile,
			Name:    exchanged.Name,
			AgentID: exchanged.AgentID,
		}
		if err := saveConfig(cfg); err != nil {
			fmt.Fprintf(os.Stderr, "error: failed to save config: %v\n", err)
			return 1
		}
		path, _ := configPath()
		fmt.Println()
		fmt.Println("Connected successfully.")
		fmt.Printf("  URL:     %s\n", cfg.URL)
		fmt.Printf("  Profile: %s\n", cfg.Profile)
		fmt.Printf("  Agent:   %s\n", cfg.Name)
		fmt.Printf("  Config:  %s\n", path)
		fmt.Println()
		fmt.Println("Try: paas status")
		return 0
	case <-time.After(5 * time.Minute):
		fmt.Fprintln(os.Stderr, "error: timed out waiting for browser authorization (5m)")
		return 1
	}
}

type browserConnectResult struct {
	code  string
	state string
}

func randomState() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func deriveUIURL(apiURL, uiFlag string) string {
	if u := strings.TrimSpace(uiFlag); u != "" {
		return strings.TrimRight(u, "/")
	}
	if u := strings.TrimSpace(os.Getenv("PAAS_UI_URL")); u != "" {
		return strings.TrimRight(u, "/")
	}
	apiURL = strings.TrimRight(strings.TrimSpace(apiURL), "/")
	// Local dev: API on :8080 → dashboard on :3000
	if strings.Contains(apiURL, ":8080") &&
		(strings.Contains(apiURL, "localhost") || strings.Contains(apiURL, "127.0.0.1")) {
		return strings.Replace(apiURL, ":8080", ":3000", 1)
	}
	// Production / reverse-proxy: dashboard and API share the same origin
	return apiURL
}

func openBrowser(url string) error {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("open", url).Run()
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Run()
	default:
		if path, err := exec.LookPath("xdg-open"); err == nil {
			return exec.Command(path, url).Run()
		}
		return fmt.Errorf("xdg-open not found")
	}
}
