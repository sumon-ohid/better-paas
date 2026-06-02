package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type cloudServerCreateRequest struct {
	Provider    string `json:"provider"`
	Token       string `json:"token"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Region      string `json:"region"`
	Size        string `json:"size"`
	Image       string `json:"image"`
	SSHUser     string `json:"sshUser"`
}

type cloudCreateResult struct {
	Provider   string
	ProviderID string
	IP         string
	SSHUser    string
}

func handleCloudServerCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req cloudServerCreateRequest
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
		return
	}

	req.Provider = strings.ToLower(strings.TrimSpace(req.Provider))
	req.Token = strings.TrimSpace(req.Token)
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	req.Region = strings.TrimSpace(req.Region)
	req.Size = strings.TrimSpace(req.Size)
	req.Image = strings.TrimSpace(req.Image)
	req.SSHUser = strings.TrimSpace(req.SSHUser)

	if req.Provider == "" {
		jsonError(w, "provider is required", http.StatusBadRequest)
		return
	}
	if req.Token == "" {
		jsonError(w, "api token is required", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		jsonError(w, "name is required", http.StatusBadRequest)
		return
	}

	privKeyPEM, pubKeyStr, err := generateEd25519KeyPair()
	if err != nil {
		log.Printf("[cloud-servers] failed to generate key pair: %v", err)
		jsonError(w, "Failed to generate SSH key pair", http.StatusInternalServerError)
		return
	}

	result, err := createCloudServer(req, pubKeyStr)
	if err != nil {
		log.Printf("[cloud-servers] provision failed provider=%s: %v", req.Provider, err)
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	if !isValidIP(result.IP) {
		jsonError(w, "cloud provider did not return a public IP address yet", http.StatusBadGateway)
		return
	}
	if result.SSHUser == "" {
		result.SSHUser = "root"
	}

	description := req.Description
	if description == "" {
		description = fmt.Sprintf("%s %s, %s", cloudProviderLabel(result.Provider), req.Size, req.Region)
	}

	server := Server{
		ID:          generateRandomID(),
		Name:        req.Name,
		Description: description,
		IP:          result.IP,
		Port:        22,
		SSHUser:     result.SSHUser,
		SSHKey:      privKeyPEM,
		IsLocal:     false,
		Status:      "unknown",
		CreatedAt:   time.Now(),
	}

	if err := dbSaveServer(server); err != nil {
		log.Printf("[cloud-servers] failed to save server: %v", err)
		jsonError(w, "Failed to save server", http.StatusInternalServerError)
		return
	}

	response := server.Public()
	response.PublicKey = pubKeyStr
	jsonOK(w, response)
}

func createCloudServer(req cloudServerCreateRequest, publicKey string) (cloudCreateResult, error) {
	switch req.Provider {
	case "hetzner":
		return createHetznerServer(req, publicKey)
	case "digitalocean":
		return createDigitalOceanDroplet(req, publicKey)
	case "vultr":
		return createVultrInstance(req, publicKey)
	default:
		return cloudCreateResult{}, fmt.Errorf("unsupported provider: %s", req.Provider)
	}
}

func cloudProviderLabel(provider string) string {
	switch provider {
	case "hetzner":
		return "Hetzner"
	case "digitalocean":
		return "DigitalOcean"
	case "vultr":
		return "Vultr"
	default:
		return "Cloud"
	}
}

func cloudInitUserData(publicKey, sshUser string) string {
	if strings.TrimSpace(sshUser) == "" {
		sshUser = "root"
	}
	userBlock := "users:\n  - default\n"
	if sshUser != "root" {
		userBlock = fmt.Sprintf(`users:
  - default
  - name: %s
    groups: sudo, docker
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
    ssh_authorized_keys:
      - %s
`, sshUser, publicKey)
	}
	return fmt.Sprintf(`#cloud-config
package_update: true
package_upgrade: false
ssh_pwauth: false
%s
runcmd:
  - mkdir -p /root/.ssh
  - grep -qxF '%s' /root/.ssh/authorized_keys || echo '%s' >> /root/.ssh/authorized_keys
  - chmod 700 /root/.ssh
  - chmod 600 /root/.ssh/authorized_keys
  - curl -fsSL https://get.docker.com | sh
  - systemctl enable --now docker
  - touch /opt/better-paas-ready
`, userBlock, publicKey, publicKey)
}

func cloudAPIRequest(client *http.Client, method, url, token string, body any, out any) error {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(b)
	}

	httpReq, err := http.NewRequest(method, url, reader)
	if err != nil {
		return err
	}
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+token)

	resp, err := client.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("provider api returned %s: %s", resp.Status, strings.TrimSpace(string(data)))
	}
	if out == nil {
		return nil
	}
	if len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, out)
}

func createHetznerServer(req cloudServerCreateRequest, publicKey string) (cloudCreateResult, error) {
	if req.Region == "" {
		req.Region = "fsn1"
	}
	if req.Size == "" {
		req.Size = "cx22"
	}
	if req.Image == "" {
		req.Image = "ubuntu-24.04"
	}
	if req.SSHUser == "" {
		req.SSHUser = "root"
	}

	client := &http.Client{Timeout: 45 * time.Second}
	keyName := "better-paas-" + generateRandomID()
	var keyResp struct {
		SSHKey struct {
			ID int `json:"id"`
		} `json:"ssh_key"`
	}
	if err := cloudAPIRequest(client, http.MethodPost, "https://api.hetzner.cloud/v1/ssh_keys", req.Token, map[string]any{
		"name":       keyName,
		"public_key": publicKey,
	}, &keyResp); err != nil {
		return cloudCreateResult{}, fmt.Errorf("create Hetzner SSH key: %w", err)
	}

	var serverResp struct {
		Server struct {
			ID        int `json:"id"`
			PublicNet struct {
				IPv4 struct {
					IP string `json:"ip"`
				} `json:"ipv4"`
			} `json:"public_net"`
		} `json:"server"`
	}
	err := cloudAPIRequest(client, http.MethodPost, "https://api.hetzner.cloud/v1/servers", req.Token, map[string]any{
		"name":               req.Name,
		"server_type":        req.Size,
		"image":              req.Image,
		"location":           req.Region,
		"ssh_keys":           []int{keyResp.SSHKey.ID},
		"user_data":          cloudInitUserData(publicKey, req.SSHUser),
		"start_after_create": true,
	}, &serverResp)
	if err != nil {
		return cloudCreateResult{}, fmt.Errorf("create Hetzner server: %w", err)
	}

	return cloudCreateResult{
		Provider:   "hetzner",
		ProviderID: strconv.Itoa(serverResp.Server.ID),
		IP:         serverResp.Server.PublicNet.IPv4.IP,
		SSHUser:    req.SSHUser,
	}, nil
}

func createDigitalOceanDroplet(req cloudServerCreateRequest, publicKey string) (cloudCreateResult, error) {
	if req.Region == "" {
		req.Region = "nyc3"
	}
	if req.Size == "" {
		req.Size = "s-1vcpu-1gb"
	}
	if req.Image == "" {
		req.Image = "ubuntu-24-04-x64"
	}
	if req.SSHUser == "" {
		req.SSHUser = "root"
	}

	client := &http.Client{Timeout: 45 * time.Second}
	keyName := "better-paas-" + generateRandomID()
	var keyResp struct {
		SSHKey struct {
			ID int `json:"id"`
		} `json:"ssh_key"`
	}
	if err := cloudAPIRequest(client, http.MethodPost, "https://api.digitalocean.com/v2/account/keys", req.Token, map[string]any{
		"name":       keyName,
		"public_key": publicKey,
	}, &keyResp); err != nil {
		return cloudCreateResult{}, fmt.Errorf("create DigitalOcean SSH key: %w", err)
	}

	var dropletResp struct {
		Droplet struct {
			ID       int `json:"id"`
			Networks struct {
				V4 []struct {
					IPAddress string `json:"ip_address"`
					Type      string `json:"type"`
				} `json:"v4"`
			} `json:"networks"`
		} `json:"droplet"`
	}
	err := cloudAPIRequest(client, http.MethodPost, "https://api.digitalocean.com/v2/droplets", req.Token, map[string]any{
		"name":       req.Name,
		"region":     req.Region,
		"size":       req.Size,
		"image":      req.Image,
		"ssh_keys":   []int{keyResp.SSHKey.ID},
		"user_data":  cloudInitUserData(publicKey, req.SSHUser),
		"monitoring": true,
		"ipv6":       true,
		"tags":       []string{"better-paas"},
	}, &dropletResp)
	if err != nil {
		return cloudCreateResult{}, fmt.Errorf("create DigitalOcean droplet: %w", err)
	}

	ip := publicIPv4FromDigitalOcean(dropletResp.Droplet.Networks.V4)
	if ip == "" {
		ip = pollDigitalOceanDropletIP(client, req.Token, dropletResp.Droplet.ID)
	}

	return cloudCreateResult{
		Provider:   "digitalocean",
		ProviderID: strconv.Itoa(dropletResp.Droplet.ID),
		IP:         ip,
		SSHUser:    req.SSHUser,
	}, nil
}

func publicIPv4FromDigitalOcean(entries []struct {
	IPAddress string `json:"ip_address"`
	Type      string `json:"type"`
}) string {
	for _, item := range entries {
		if item.Type == "public" && item.IPAddress != "" {
			return item.IPAddress
		}
	}
	return ""
}

func pollDigitalOceanDropletIP(client *http.Client, token string, id int) string {
	for i := 0; i < 20; i++ {
		time.Sleep(3 * time.Second)
		var resp struct {
			Droplet struct {
				Networks struct {
					V4 []struct {
						IPAddress string `json:"ip_address"`
						Type      string `json:"type"`
					} `json:"v4"`
				} `json:"networks"`
			} `json:"droplet"`
		}
		err := cloudAPIRequest(client, http.MethodGet, fmt.Sprintf("https://api.digitalocean.com/v2/droplets/%d", id), token, nil, &resp)
		if err != nil {
			continue
		}
		if ip := publicIPv4FromDigitalOcean(resp.Droplet.Networks.V4); ip != "" {
			return ip
		}
	}
	return ""
}

func createVultrInstance(req cloudServerCreateRequest, publicKey string) (cloudCreateResult, error) {
	if req.Region == "" {
		req.Region = "ewr"
	}
	if req.Size == "" {
		req.Size = "vc2-1c-1gb"
	}
	if req.Image == "" {
		req.Image = "2284"
	}
	if req.SSHUser == "" {
		req.SSHUser = "root"
	}

	osID, err := strconv.Atoi(req.Image)
	if err != nil {
		return cloudCreateResult{}, fmt.Errorf("Vultr image must be a numeric OS ID")
	}

	client := &http.Client{Timeout: 45 * time.Second}
	keyName := "better-paas-" + generateRandomID()
	var keyResp struct {
		SSHKey struct {
			ID string `json:"id"`
		} `json:"ssh_key"`
	}
	if err := cloudAPIRequest(client, http.MethodPost, "https://api.vultr.com/v2/ssh-keys", req.Token, map[string]any{
		"name":    keyName,
		"ssh_key": publicKey,
	}, &keyResp); err != nil {
		return cloudCreateResult{}, fmt.Errorf("create Vultr SSH key: %w", err)
	}

	var instanceResp struct {
		Instance struct {
			ID     string `json:"id"`
			MainIP string `json:"main_ip"`
		} `json:"instance"`
	}
	err = cloudAPIRequest(client, http.MethodPost, "https://api.vultr.com/v2/instances", req.Token, map[string]any{
		"region":    req.Region,
		"plan":      req.Size,
		"os_id":     osID,
		"label":     req.Name,
		"hostname":  req.Name,
		"sshkey_id": []string{keyResp.SSHKey.ID},
		"user_data": cloudInitUserData(publicKey, req.SSHUser),
	}, &instanceResp)
	if err != nil {
		return cloudCreateResult{}, fmt.Errorf("create Vultr instance: %w", err)
	}

	ip := instanceResp.Instance.MainIP
	if ip == "" || ip == "0.0.0.0" {
		ip = pollVultrInstanceIP(client, req.Token, instanceResp.Instance.ID)
	}

	return cloudCreateResult{
		Provider:   "vultr",
		ProviderID: instanceResp.Instance.ID,
		IP:         ip,
		SSHUser:    req.SSHUser,
	}, nil
}

func pollVultrInstanceIP(client *http.Client, token, id string) string {
	for i := 0; i < 20; i++ {
		time.Sleep(3 * time.Second)
		var resp struct {
			Instance struct {
				MainIP string `json:"main_ip"`
			} `json:"instance"`
		}
		err := cloudAPIRequest(client, http.MethodGet, "https://api.vultr.com/v2/instances/"+id, token, nil, &resp)
		if err != nil {
			continue
		}
		if resp.Instance.MainIP != "" && resp.Instance.MainIP != "0.0.0.0" {
			return resp.Instance.MainIP
		}
	}
	return ""
}
