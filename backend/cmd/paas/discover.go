package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type connectManifest struct {
	APIURL string `json:"apiUrl"`
	UIURL  string `json:"uiUrl"`
}

func fetchConnectManifest(baseURL string, client *http.Client) (*connectManifest, error) {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		return nil, fmt.Errorf("empty URL")
	}
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}

	req, err := http.NewRequest(http.MethodGet, baseURL+"/.well-known/better-paas.json", nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var m connectManifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	m.APIURL = strings.TrimRight(strings.TrimSpace(m.APIURL), "/")
	m.UIURL = strings.TrimRight(strings.TrimSpace(m.UIURL), "/")
	if m.APIURL == "" {
		return nil, fmt.Errorf("manifest missing apiUrl")
	}
	return &m, nil
}

func apiHealthy(baseURL string, client *http.Client) bool {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		return false
	}
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	resp, err := client.Get(baseURL + "/api/health")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// resolveConnectTargets accepts a dashboard URL, API URL, or either - and returns
// both endpoints needed for browser authorization.
func resolveConnectTargets(input, uiOverride string) (apiURL, uiURL string, err error) {
	input = strings.TrimRight(strings.TrimSpace(input), "/")
	if input == "" {
		return "", "", fmt.Errorf("URL is required")
	}
	client := &http.Client{Timeout: 15 * time.Second}

	if m, err := fetchConnectManifest(input, client); err == nil {
		apiURL = m.APIURL
		uiURL = m.UIURL
		if uiURL == "" && !strings.EqualFold(input, apiURL) {
			uiURL = input
		}
	}

	if apiURL == "" && apiHealthy(input, client) {
		apiURL = input
		uiURL = input
		if m, err := fetchConnectManifest(input, client); err == nil {
			if m.APIURL != "" {
				apiURL = m.APIURL
			}
			if m.UIURL != "" {
				uiURL = m.UIURL
			}
		}
	}

	if apiURL == "" {
		return "", "", fmt.Errorf(
			"could not reach PaaS at %s - use your dashboard URL (e.g. https://paas.example.com) and ensure it is running",
			input,
		)
	}

	if uiURL == "" {
		uiURL = deriveUIURL(apiURL, "")
	}

	if override := strings.TrimRight(strings.TrimSpace(uiOverride), "/"); override != "" {
		uiURL = override
	}

	if !apiHealthy(apiURL, client) {
		return "", "", fmt.Errorf("PaaS API at %s is not reachable", apiURL)
	}

	return apiURL, uiURL, nil
}
