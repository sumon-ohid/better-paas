package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Custom domains + Cloudflare DNS integration
// ---------------------------------------------------------------------------
//
// Custom domains are stored on each App (App.Domains). rebuildCaddyfile turns
// each one into a TLS site block, so Caddy automatically provisions a
// Let's Encrypt certificate the first time the hostname resolves to this box.
//
// For domains whose DNS is hosted on Cloudflare, the operator can connect a
// Cloudflare API token (Settings → Cloudflare) and then create the required
// A record straight from the dashboard, pointing the hostname at this server's
// public IP. The record is created "DNS only" (un-proxied) so Caddy keeps full
// control of TLS via the HTTP-01 challenge.

// ── Server public IP detection ──────────────────────────────────────────────

var (
	publicIPLock  sync.Mutex
	publicIPCache string
)

// getPublicIP returns the server's public IPv4 address (best-effort, cached).
// It falls back to the first non-loopback local address when the lookup fails
// (e.g. no outbound connectivity), which is still useful on a flat network.
func getPublicIP() string {
	publicIPLock.Lock()
	defer publicIPLock.Unlock()
	if publicIPCache != "" {
		return publicIPCache
	}

	client := &http.Client{Timeout: 5 * time.Second}
	for _, u := range []string{"https://api.ipify.org", "https://ifconfig.me/ip", "https://icanhazip.com"} {
		resp, err := client.Get(u)
		if err != nil {
			continue
		}
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 64))
		resp.Body.Close()
		ip := strings.TrimSpace(string(b))
		if net.ParseIP(ip) != nil {
			publicIPCache = ip
			return ip
		}
	}
	return getLocalIP()
}

// GET /api/server/info — connection details the dashboard needs to render DNS
// setup instructions for custom domains.
func handleServerInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jsonOK(w, map[string]string{
		"publicIp": getPublicIP(),
		"localIp":  getLocalIP(),
	})
}

// ── Cloudflare API token store ────────────────────────────────────────────────

var (
	cloudflareTokenLock sync.RWMutex
	cloudflareToken     string
	cloudflareLoaded    bool
)

// getCloudflareToken returns the stored Cloudflare API token, loading and
// decrypting it from the meta table on first use.
func getCloudflareToken() string {
	cloudflareTokenLock.RLock()
	if cloudflareLoaded {
		t := cloudflareToken
		cloudflareTokenLock.RUnlock()
		return t
	}
	cloudflareTokenLock.RUnlock()

	cloudflareTokenLock.Lock()
	defer cloudflareTokenLock.Unlock()
	if !cloudflareLoaded {
		cloudflareToken = decryptSecret(dbGetMeta("cloudflare_token"))
		cloudflareLoaded = true
	}
	return cloudflareToken
}

func setCloudflareToken(t string) error {
	cloudflareTokenLock.Lock()
	cloudflareToken = t
	cloudflareLoaded = true
	cloudflareTokenLock.Unlock()
	return dbSetSecretMeta("cloudflare_token", t)
}

// ── Domain management endpoints ───────────────────────────────────────────────

// POST /api/apps/domains/add — attach a custom domain to an app.
func handleDomainAdd(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID     string `json:"id"`
		Domain string `json:"domain"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	domain := strings.ToLower(strings.TrimSpace(req.Domain))
	domain = strings.TrimSuffix(domain, ".")
	if domain == "" {
		jsonError(w, "Domain is required", http.StatusBadRequest)
		return
	}
	if err := validateDomains([]string{domain}); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	appsLock.Lock()
	// Reject a domain that is already routed to another app — duplicate site
	// blocks would make the generated Caddyfile ambiguous.
	for i := range apps {
		for _, d := range apps[i].Domains {
			if strings.EqualFold(d, domain) {
				owner := apps[i].Name
				appsLock.Unlock()
				jsonError(w, fmt.Sprintf("Domain already attached to %q", owner), http.StatusConflict)
				return
			}
		}
	}

	var updated *App
	for i := range apps {
		if apps[i].ID == req.ID {
			apps[i].Domains = append(apps[i].Domains, domain)
			clone := apps[i]
			updated = &clone
			break
		}
	}
	appsLock.Unlock()

	if updated == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}

	if err := dbSaveApp(*updated); err != nil {
		log.Printf("[db] failed to save app after domain add: %v", err)
	}
	rebuildCaddyfile()
	jsonOK(w, updated.Public())
}

// POST /api/apps/domains/remove — detach a custom domain from an app.
func handleDomainRemove(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID     string `json:"id"`
		Domain string `json:"domain"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	domain := strings.ToLower(strings.TrimSpace(req.Domain))
	domain = strings.TrimSuffix(domain, ".")

	appsLock.Lock()
	var updated *App
	for i := range apps {
		if apps[i].ID == req.ID {
			kept := apps[i].Domains[:0]
			for _, d := range apps[i].Domains {
				if !strings.EqualFold(strings.TrimSpace(d), domain) {
					kept = append(kept, d)
				}
			}
			apps[i].Domains = kept
			clone := apps[i]
			updated = &clone
			break
		}
	}
	appsLock.Unlock()

	if updated == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}

	if err := dbSaveApp(*updated); err != nil {
		log.Printf("[db] failed to save app after domain remove: %v", err)
	}
	rebuildCaddyfile()
	jsonOK(w, updated.Public())
}

// ── Cloudflare endpoints ──────────────────────────────────────────────────────

// GET /api/cloudflare/status — report whether a Cloudflare token is connected.
func handleCloudflareStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jsonOK(w, map[string]interface{}{
		"connected": getCloudflareToken() != "",
	})
}

// POST /api/cloudflare/token/save — store (and verify) a Cloudflare API token.
func handleCloudflareTokenSet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Token string `json:"token"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	token := strings.TrimSpace(req.Token)
	if token == "" {
		jsonError(w, "Token is required", http.StatusBadRequest)
		return
	}

	// Verify the token against Cloudflare before persisting it, so the user
	// gets immediate feedback instead of a later DNS failure.
	if err := cfVerifyToken(token); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := setCloudflareToken(token); err != nil {
		log.Printf("[cloudflare] failed to save token: %v", err)
		jsonError(w, "Failed to save token", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "saved"})
}

// DELETE /api/cloudflare/token/delete — forget the stored Cloudflare token.
func handleCloudflareTokenDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := setCloudflareToken(""); err != nil {
		log.Printf("[cloudflare] failed to clear token: %v", err)
		jsonError(w, "Failed to clear token", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "deleted"})
}

// POST /api/cloudflare/dns — create/update the A record for a domain so it
// points at this server. Requires a connected Cloudflare token whose account
// manages the domain's zone.
func handleCloudflareDNS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := getCloudflareToken()
	if token == "" {
		jsonError(w, "Cloudflare is not connected", http.StatusBadRequest)
		return
	}

	var req struct {
		Domain string `json:"domain"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	domain := strings.ToLower(strings.TrimSpace(req.Domain))
	domain = strings.TrimSuffix(domain, ".")
	if err := validateDomains([]string{domain}); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	zone, err := cfFindZone(token, domain)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	ip := getPublicIP()
	action, err := cfUpsertARecord(token, zone.ID, domain, ip)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}

	jsonOK(w, map[string]interface{}{
		"status":  action, // "created" | "updated"
		"domain":  domain,
		"ip":      ip,
		"zone":    zone.Name,
		"proxied": false,
	})
}

// ---------------------------------------------------------------------------
// Cloudflare API client (minimal)
// ---------------------------------------------------------------------------

const cloudflareAPI = "https://api.cloudflare.com/client/v4"

type cfError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type cfZone struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type cfDNSRecord struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Name    string `json:"name"`
	Content string `json:"content"`
	Proxied bool   `json:"proxied"`
	TTL     int    `json:"ttl"`
}

// cfDo performs an authenticated Cloudflare API request and decodes the
// envelope into out (whose Result field is caller-defined).
func cfDo(token, method, path string, body interface{}, out interface{}) error {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(b)
	}

	httpReq, err := http.NewRequest(method, cloudflareAPI+path, reader)
	if err != nil {
		return err
	}
	httpReq.Header.Set("Authorization", "Bearer "+token)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("could not reach Cloudflare API")
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("unexpected Cloudflare response (HTTP %d)", resp.StatusCode)
	}
	return nil
}

// cfVerifyToken checks that the token is valid and active.
func cfVerifyToken(token string) error {
	var out struct {
		Success bool      `json:"success"`
		Errors  []cfError `json:"errors"`
		Result  struct {
			Status string `json:"status"`
		} `json:"result"`
	}
	if err := cfDo(token, http.MethodGet, "/user/tokens/verify", nil, &out); err != nil {
		return err
	}
	if !out.Success {
		return fmt.Errorf("invalid Cloudflare token%s", cfErrSuffix(out.Errors))
	}
	if out.Result.Status != "active" {
		return fmt.Errorf("Cloudflare token is not active (status: %s)", out.Result.Status)
	}
	return nil
}

// cfFindZone returns the Cloudflare zone that manages domain, picking the
// longest matching zone name (so foo.bar.example.com resolves to example.com).
func cfFindZone(token, domain string) (cfZone, error) {
	var out struct {
		Success bool      `json:"success"`
		Errors  []cfError `json:"errors"`
		Result  []cfZone  `json:"result"`
	}
	if err := cfDo(token, http.MethodGet, "/zones?per_page=50&status=active", nil, &out); err != nil {
		return cfZone{}, err
	}
	if !out.Success {
		return cfZone{}, fmt.Errorf("could not list Cloudflare zones%s", cfErrSuffix(out.Errors))
	}

	var best cfZone
	for _, z := range out.Result {
		if domain == z.Name || strings.HasSuffix(domain, "."+z.Name) {
			if len(z.Name) > len(best.Name) {
				best = z
			}
		}
	}
	if best.ID == "" {
		return cfZone{}, fmt.Errorf("no Cloudflare zone found for %q — is this domain in the connected account?", domain)
	}
	return best, nil
}

// cfUpsertARecord creates or updates a DNS-only A record for name → ip and
// reports which action was taken.
func cfUpsertARecord(token, zoneID, name, ip string) (string, error) {
	// Look for an existing A record with this exact name.
	var list struct {
		Success bool          `json:"success"`
		Errors  []cfError     `json:"errors"`
		Result  []cfDNSRecord `json:"result"`
	}
	if err := cfDo(token, http.MethodGet,
		fmt.Sprintf("/zones/%s/dns_records?type=A&name=%s", zoneID, name), nil, &list); err != nil {
		return "", err
	}
	if !list.Success {
		return "", fmt.Errorf("could not read existing DNS records%s", cfErrSuffix(list.Errors))
	}

	payload := cfDNSRecord{
		Type:    "A",
		Name:    name,
		Content: ip,
		TTL:     1,     // 1 = automatic
		Proxied: false, // DNS only, so Caddy can issue its own TLS cert
	}

	var mut struct {
		Success bool      `json:"success"`
		Errors  []cfError `json:"errors"`
	}

	if len(list.Result) > 0 {
		recID := list.Result[0].ID
		if err := cfDo(token, http.MethodPut,
			fmt.Sprintf("/zones/%s/dns_records/%s", zoneID, recID), payload, &mut); err != nil {
			return "", err
		}
		if !mut.Success {
			return "", fmt.Errorf("Cloudflare rejected the DNS update%s", cfErrSuffix(mut.Errors))
		}
		return "updated", nil
	}

	if err := cfDo(token, http.MethodPost,
		fmt.Sprintf("/zones/%s/dns_records", zoneID), payload, &mut); err != nil {
		return "", err
	}
	if !mut.Success {
		return "", fmt.Errorf("Cloudflare rejected the DNS record%s", cfErrSuffix(mut.Errors))
	}
	return "created", nil
}

// cfErrSuffix renders the first Cloudflare error message for inclusion in a
// user-facing error, or "" when none is present.
func cfErrSuffix(errs []cfError) string {
	if len(errs) == 0 {
		return ""
	}
	return ": " + errs[0].Message
}
