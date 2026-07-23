package paas

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/pem"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

// generateEd25519KeyPair creates a new Ed25519 SSH key pair.
// Returns (privateKeyPEM, publicKeyOpenSSH, error).
func generateEd25519KeyPair() (string, string, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", "", fmt.Errorf("generate Ed25519 key: %w", err)
	}

	// Encode private key as OpenSSH PEM format.
	privPEM, err := ssh.MarshalPrivateKey(priv, "better-paas")
	if err != nil {
		return "", "", fmt.Errorf("marshal private key: %w", err)
	}
	privKeyPEM := string(pem.EncodeToMemory(privPEM))

	// Encode public key in OpenSSH authorized_keys format.
	sshPub, err := ssh.NewPublicKey(pub)
	if err != nil {
		return "", "", fmt.Errorf("create SSH public key: %w", err)
	}
	pubKeyStr := strings.TrimSpace(string(ssh.MarshalAuthorizedKey(sshPub))) + " better-paas"

	return privKeyPEM, pubKeyStr, nil
}

// ---------------------------------------------------------------------------
// GET /api/servers
// ---------------------------------------------------------------------------

func handleServersList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	servers, err := dbLoadServers()
	if err != nil {
		jsonError(w, "Failed to load servers", http.StatusInternalServerError)
		return
	}

	result := make([]Server, len(servers))
	for i, s := range servers {
		result[i] = s.Public()
	}
	jsonOK(w, result)
}

// ---------------------------------------------------------------------------
// POST /api/servers/create
// ---------------------------------------------------------------------------

func handleServerCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		IP          string `json:"ip"`
		Port        int    `json:"port"`
		SSHUser     string `json:"sshUser"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Validation.
	req.Name = strings.TrimSpace(req.Name)
	req.IP = strings.TrimSpace(req.IP)
	req.SSHUser = strings.TrimSpace(req.SSHUser)
	if req.Name == "" {
		jsonError(w, "name is required", http.StatusBadRequest)
		return
	}
	if !isValidIP(req.IP) {
		jsonError(w, "invalid ip address or hostname", http.StatusBadRequest)
		return
	}
	if req.Port == 0 {
		req.Port = 22
	}
	if !isValidPort(req.Port) {
		jsonError(w, "port must be between 1 and 65535", http.StatusBadRequest)
		return
	}
	if req.SSHUser == "" {
		req.SSHUser = "root"
	}

	// Generate Ed25519 key pair - private key stored encrypted, public key
	// shown to the user so they can paste it into ~/.ssh/authorized_keys.
	privKeyPEM, pubKeyStr, err := generateEd25519KeyPair()
	if err != nil {
		log.Printf("[servers] failed to generate key pair: %v", err)
		jsonError(w, "Failed to generate SSH key pair", http.StatusInternalServerError)
		return
	}

	server := Server{
		ID:          generateRandomID(),
		Name:        req.Name,
		Description: req.Description,
		IP:          req.IP,
		Port:        req.Port,
		SSHUser:     req.SSHUser,
		SSHKey:      privKeyPEM,
		IsLocal:     false,
		Status:      "unknown",
		CreatedAt:   time.Now(),
	}

	if err := dbSaveServer(server); err != nil {
		log.Printf("[servers] failed to save server: %v", err)
		jsonError(w, "Failed to save server", http.StatusInternalServerError)
		return
	}

	// Return public view + the public key (user needs to copy it to the remote).
	response := server.Public()
	response.PublicKey = pubKeyStr
	jsonOK(w, response)
}

// ---------------------------------------------------------------------------
// POST /api/servers/delete
// ---------------------------------------------------------------------------

func handleServerDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	if req.ID == "" {
		jsonError(w, "id is required", http.StatusBadRequest)
		return
	}
	if req.ID == "localhost" {
		jsonError(w, "cannot delete the localhost server", http.StatusBadRequest)
		return
	}

	server, err := dbGetServer(req.ID)
	if err != nil || server == nil {
		jsonError(w, "Server not found", http.StatusNotFound)
		return
	}
	if server.IsLocal {
		jsonError(w, "cannot delete a local server", http.StatusBadRequest)
		return
	}

	// Reject if apps are still assigned to this server.
	count, err := dbCountAppsOnServer(req.ID)
	if err != nil {
		jsonError(w, "Failed to check apps on server", http.StatusInternalServerError)
		return
	}
	if count > 0 {
		jsonError(w, fmt.Sprintf("cannot delete server: %d app(s) are still deployed on it", count), http.StatusConflict)
		return
	}

	if err := dbDeleteServer(req.ID); err != nil {
		log.Printf("[servers] failed to delete server %s: %v", req.ID, err)
		jsonError(w, "Failed to delete server", http.StatusInternalServerError)
		return
	}

	CloseCachedSSHClient(req.ID)

	jsonOK(w, map[string]string{"status": "deleted"})
}

// ---------------------------------------------------------------------------
// POST /api/servers/update
// ---------------------------------------------------------------------------

func handleServerUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	if req.ID == "" {
		jsonError(w, "id is required", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		jsonError(w, "name is required", http.StatusBadRequest)
		return
	}

	server, err := dbGetServer(req.ID)
	if err != nil || server == nil {
		jsonError(w, "Server not found", http.StatusNotFound)
		return
	}

	if err := dbUpdateServer(req.ID, req.Name, req.Description); err != nil {
		log.Printf("[servers] failed to update server %s: %v", req.ID, err)
		jsonError(w, "Failed to update server", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"status": "updated"})
}

// ---------------------------------------------------------------------------
// POST /api/servers/test
// ---------------------------------------------------------------------------

func handleServerTest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}

	if req.ID == "" {
		jsonError(w, "id is required", http.StatusBadRequest)
		return
	}

	server, err := dbGetServer(req.ID)
	if err != nil || server == nil {
		jsonError(w, "Server not found", http.StatusNotFound)
		return
	}

	var dockerVersion string
	var testErr error

	if server.IsLocal {
		dockerVersion, testErr = localConnectivityCheck()
	} else {
		if server.SSHKey == "" {
			jsonError(w, "server has no SSH key - please recreate it", http.StatusBadRequest)
			return
		}
		dockerVersion, testErr = sshDialTest(server)
	}

	status := "connected"
	errMsg := ""
	if testErr != nil {
		status = "error"
		errMsg = testErr.Error()
	}

	// Persist updated status.
	if err := dbUpdateServerStatus(req.ID, status); err != nil {
		log.Printf("[servers] failed to update server status: %v", err)
	}

	type response struct {
		Status        string `json:"status"`
		DockerVersion string `json:"dockerVersion,omitempty"`
		Error         string `json:"error,omitempty"`
	}
	jsonOK(w, response{Status: status, DockerVersion: dockerVersion, Error: errMsg})
}

// ---------------------------------------------------------------------------
// GET /api/servers/keys/public
// ---------------------------------------------------------------------------

func handleServerPublicKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		jsonError(w, "id query param required", http.StatusBadRequest)
		return
	}

	server, err := dbGetServer(id)
	if err != nil || server == nil {
		jsonError(w, "Server not found", http.StatusNotFound)
		return
	}
	if server.IsLocal || server.SSHKey == "" {
		jsonOK(w, map[string]string{"publicKey": ""})
		return
	}

	// Derive the public key from the stored private key.
	signer, err := ssh.ParsePrivateKey([]byte(server.SSHKey))
	if err != nil {
		jsonError(w, "Failed to parse stored key", http.StatusInternalServerError)
		return
	}
	pubKey := strings.TrimSpace(string(ssh.MarshalAuthorizedKey(signer.PublicKey()))) + " better-paas"
	jsonOK(w, map[string]string{"publicKey": pubKey})
}
