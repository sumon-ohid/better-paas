package paas

import (
	"bytes"
	"fmt"
	"net"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
)

// Executor abstracts running commands and manipulating files on a target server.
// LocalExecutor uses the local OS. SSHExecutor tunnels over SSH to a remote host.
type Executor interface {
	// RunCommand runs a command and returns its combined stdout+stderr output.
	RunCommand(cmd string, args ...string) (string, error)
	// WriteFile writes content to a file at the given path.
	WriteFile(path string, content []byte, mode os.FileMode) error
	// ReadFile reads and returns the contents of a file.
	ReadFile(path string) ([]byte, error)
	// DeleteFile removes a file.
	DeleteFile(path string) error
}

// ---------------------------------------------------------------------------
// LocalExecutor — uses os/exec and os package; zero overhead.
// ---------------------------------------------------------------------------

// LocalExecutor runs commands on the local machine.
type LocalExecutor struct{}

func (l *LocalExecutor) RunCommand(cmd string, args ...string) (string, error) {
	out, err := exec.Command(cmd, args...).CombinedOutput()
	return string(out), err
}

func (l *LocalExecutor) WriteFile(path string, content []byte, mode os.FileMode) error {
	return os.WriteFile(path, content, mode)
}

func (l *LocalExecutor) ReadFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}

func (l *LocalExecutor) DeleteFile(path string) error {
	return os.Remove(path)
}

// ---------------------------------------------------------------------------
// SSHExecutor — tunnels commands to a remote server over SSH.
// ---------------------------------------------------------------------------

// SSHExecutor runs commands on a remote server via an SSH connection.
type SSHExecutor struct {
	serverID string
	client   *ssh.Client
	unpooled bool
}

var (
	sshClientsMu sync.Mutex
	sshClients   = make(map[string]*ssh.Client)
)

// getSSHClient retrieves an active SSH client from the cache or dials a new one.
func getSSHClient(server *Server) (*ssh.Client, error) {
	sshClientsMu.Lock()
	client, exists := sshClients[server.ID]
	sshClientsMu.Unlock()

	if exists {
		// Quick verify of connection health by opening a dummy session.
		session, err := client.NewSession()
		if err == nil {
			session.Close()
			return client, nil
		}
		// Connection is dead; close and evict it.
		client.Close()
		sshClientsMu.Lock()
		if sshClients[server.ID] == client {
			delete(sshClients, server.ID)
		}
		sshClientsMu.Unlock()
	}

	signer, err := ssh.ParsePrivateKey([]byte(server.SSHKey))
	if err != nil {
		return nil, fmt.Errorf("parse SSH private key: %w", err)
	}

	cfg := &ssh.ClientConfig{
		User:            server.SSHUser,
		Auth:            []ssh.AuthMethod{ssh.PublicKeys(signer)},
		HostKeyCallback: pinnedHostKeyCallback(server),
		Timeout:         5 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", server.IP, server.Port)
	client, err = ssh.Dial("tcp", addr, cfg)
	if err != nil {
		return nil, fmt.Errorf("SSH dial %s: %w", addr, err)
	}

	sshClientsMu.Lock()
	sshClients[server.ID] = client
	sshClientsMu.Unlock()

	return client, nil
}

// evictSSHClient closes and removes the cached SSH client for a server.
func evictSSHClient(serverID string) {
	sshClientsMu.Lock()
	if client, exists := sshClients[serverID]; exists {
		client.Close()
		delete(sshClients, serverID)
	}
	sshClientsMu.Unlock()
}

// CloseCachedSSHClient closes and removes the cached SSH client when a server is deleted.
func CloseCachedSSHClient(serverID string) {
	evictSSHClient(serverID)
}

// NewSSHExecutor dials the remote server and returns a ready SSHExecutor.
// The caller is responsible for calling Close() when done.
//
// Host keys are pinned on first successful connection and verified thereafter.
func NewSSHExecutor(server *Server) (*SSHExecutor, error) {
	signer, err := ssh.ParsePrivateKey([]byte(server.SSHKey))
	if err != nil {
		return nil, fmt.Errorf("parse SSH private key: %w", err)
	}

	cfg := &ssh.ClientConfig{
		User:            server.SSHUser,
		Auth:            []ssh.AuthMethod{ssh.PublicKeys(signer)},
		HostKeyCallback: pinnedHostKeyCallback(server),
		Timeout:         10 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", server.IP, server.Port)
	client, err := ssh.Dial("tcp", addr, cfg)
	if err != nil {
		return nil, fmt.Errorf("SSH dial %s: %w", addr, err)
	}
	return &SSHExecutor{client: client, unpooled: true}, nil
}

func pinnedHostKeyCallback(server *Server) ssh.HostKeyCallback {
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		fingerprint := ssh.FingerprintSHA256(key)
		if server.SSHHostKey == "" {
			if err := dbUpdateServerHostKey(server.ID, fingerprint); err != nil {
				return fmt.Errorf("store SSH host key fingerprint for %s: %w", server.ID, err)
			}
			server.SSHHostKey = fingerprint
			logHostKeyPinned(server.ID, fingerprint)
			return nil
		}
		if server.SSHHostKey != fingerprint {
			return fmt.Errorf("SSH host key mismatch for %s: expected %s, got %s", server.ID, server.SSHHostKey, fingerprint)
		}
		return nil
	}
}

func logHostKeyPinned(serverID, fingerprint string) {
	fmt.Fprintf(os.Stderr, "[ssh] pinned host key for server %s: %s\n", serverID, fingerprint)
}

// Close releases the underlying SSH connection.
func (s *SSHExecutor) Close() error {
	if s.unpooled && s.client != nil {
		return s.client.Close()
	}
	return nil
}

func (s *SSHExecutor) RunCommand(cmd string, args ...string) (string, error) {
	session, err := s.client.NewSession()
	if err != nil {
		if !s.unpooled {
			evictSSHClient(s.serverID)
		}
		return "", fmt.Errorf("new SSH session: %w", err)
	}
	defer session.Close()

	full := cmd
	if len(args) > 0 {
		// Shell-quote each argument to prevent injection.
		quoted := make([]string, len(args))
		for i, a := range args {
			quoted[i] = shellQuote(a)
		}
		full += " " + strings.Join(quoted, " ")
	}

	var buf bytes.Buffer
	session.Stdout = &buf
	session.Stderr = &buf
	err = session.Run(full)
	if err != nil && !s.unpooled && (strings.Contains(err.Error(), "closed") || strings.Contains(err.Error(), "EOF")) {
		evictSSHClient(s.serverID)
	}
	return buf.String(), err
}

func (s *SSHExecutor) WriteFile(path string, content []byte, mode os.FileMode) error {
	session, err := s.client.NewSession()
	if err != nil {
		if !s.unpooled {
			evictSSHClient(s.serverID)
		}
		return fmt.Errorf("new SSH session: %w", err)
	}
	defer session.Close()

	// Use `cat > file` piped via stdin — avoids needing SFTP subsystem.
	session.Stdin = bytes.NewReader(content)
	cmd := fmt.Sprintf("install -m %04o /dev/stdin %s", mode, shellQuote(path))
	if out, err := session.CombinedOutput(cmd); err != nil {
		if !s.unpooled && (strings.Contains(err.Error(), "closed") || strings.Contains(err.Error(), "EOF")) {
			evictSSHClient(s.serverID)
		}
		return fmt.Errorf("write file %s: %w — %s", path, err, out)
	}
	return nil
}

func (s *SSHExecutor) ReadFile(path string) ([]byte, error) {
	out, err := s.RunCommand("cat", path)
	if err != nil {
		return nil, fmt.Errorf("read file %s: %w", path, err)
	}
	return []byte(out), nil
}

func (s *SSHExecutor) DeleteFile(path string) error {
	_, err := s.RunCommand("rm", "-f", path)
	return err
}

// ---------------------------------------------------------------------------
// GetExecutorForServer returns the appropriate Executor for a server.
// ---------------------------------------------------------------------------

// GetExecutorForServer looks up the server from the database and returns the
// correct Executor implementation. Callers that receive an *SSHExecutor are
// responsible for calling Close() when done.
func GetExecutorForServer(serverID string) (Executor, error) {
	if serverID == "" || serverID == "localhost" {
		return &LocalExecutor{}, nil
	}

	server, err := dbGetServer(serverID)
	if err != nil {
		return nil, fmt.Errorf("get server %s: %w", serverID, err)
	}
	if server == nil {
		return nil, fmt.Errorf("server %s not found", serverID)
	}
	if server.IsLocal {
		return &LocalExecutor{}, nil
	}
	client, err := getSSHClient(server)
	if err != nil {
		return nil, err
	}
	return &SSHExecutor{serverID: server.ID, client: client}, nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// shellQuote wraps a string in single quotes, escaping any single quotes inside.
// This is safe for passing user-controlled strings to a remote shell.
func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

// sshDialTest is a lightweight connectivity check: dials, runs `docker info`,
// returns the Docker server version or an error.
func sshDialTest(server *Server) (dockerVersion string, err error) {
	exec, err := NewSSHExecutor(server)
	if err != nil {
		return "", err
	}
	defer exec.Close()

	out, err := exec.RunCommand("docker", "info", "--format", "{{.ServerVersion}}")
	if err != nil {
		return "", fmt.Errorf("docker not available on remote: %w — %s", err, strings.TrimSpace(out))
	}
	return strings.TrimSpace(out), nil
}

// localConnectivityCheck verifies localhost server status without SSH.
func localConnectivityCheck() (dockerVersion string, err error) {
	out, err := exec.Command("docker", "info", "--format", "{{.ServerVersion}}").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("docker not available: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

// isValidPort checks if a TCP port number is valid.
func isValidPort(port int) bool {
	return port > 0 && port <= 65535
}

// isValidIP checks if an IP address or hostname is syntactically valid.
func isValidIP(host string) bool {
	if net.ParseIP(host) != nil {
		return true
	}
	// Also allow hostnames (basic check: not empty, no spaces)
	return len(host) > 0 && !strings.Contains(host, " ")
}
