package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"
)

// ---------------------------------------------------------------------------
// /ws/terminal — interactive PTY shell access to a deployed container
// ---------------------------------------------------------------------------
//
// Allocates a real pseudo-terminal and runs `docker exec -it <container> sh`
// attached to it, then bridges the PTY to the browser over a WebSocket. Because
// a genuine TTY is allocated, programs inside the container behave exactly as
// they would in a normal terminal: colored output, line editing, tab
// completion, pagers (less), full-screen apps (vim, top), and job control all
// work. The frontend renders the stream with xterm.js.
//
// Wire protocol
//   client → server : JSON control frames
//       { "type": "input",  "data": "<keystrokes>" }
//       { "type": "resize", "cols": <n>, "rows": <n> }
//   server → client : raw PTY output as binary WebSocket frames
//
// Raw PTY bytes are sent as binary frames (not the JSON log envelope) so escape
// sequences and partial UTF-8 survive untouched for xterm.js.

// terminalShellCandidates are tried in order; the first shell present in the
// container image is used. Most images ship at least /bin/sh.
var terminalShellCandidates = []string{"/bin/bash", "/bin/sh", "sh"}

// terminalClientMsg is a control frame sent from the browser.
type terminalClientMsg struct {
	Type string `json:"type"`
	Data string `json:"data"`
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

func handleTerminalWS(w http.ResponseWriter, r *http.Request) {
	if !wsAuthOK(w, r) {
		return
	}
	appID := r.URL.Query().Get("appId")
	log.Printf("[WS/terminal] Connect for appId=%q", appID)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS/terminal] Upgrade failed: %v", err)
		return
	}
	defer func() {
		log.Printf("[WS/terminal] Disconnect for appId=%q", appID)
		conn.Close()
	}()

	// Resolve the target app + its currently running container.
	var containerName, status, serverID string
	appsLock.Lock()
	for _, a := range apps {
		if a.ID == appID {
			containerName = a.containerName()
			status = a.Status
			serverID = a.ServerID
			break
		}
	}
	appsLock.Unlock()

	if containerName == "" {
		wsSendTerminal(conn, "App not found.\r\n")
		return
	}
	if status != "running" {
		wsSendTerminal(conn, "Container is not running. Start the app to open a terminal.\r\n")
		return
	}

	// Pick a shell that exists in the image.
	shell := pickContainerShell(serverID, containerName)
	if shell == "" {
		wsSendTerminal(conn, "No shell (/bin/bash or /bin/sh) found in the container image.\r\n")
		return
	}

	isLocal := serverID == "" || serverID == "localhost"

	if isLocal {
		// `docker exec -it` allocates a TTY inside the container; creack/pty gives
		// us the host-side PTY master that the docker client attaches to.
		cmd := exec.Command("docker", "exec", "-it", containerName, shell)
		ptmx, err := pty.Start(cmd)
		if err != nil {
			wsSendTerminal(conn, "Failed to start terminal session: "+err.Error()+"\r\n")
			return
		}

		var once sync.Once
		cleanup := func() {
			once.Do(func() {
				ptmx.Close()
				if cmd.Process != nil {
					cmd.Process.Kill()
				}
				cmd.Wait()
			})
		}
		defer cleanup()

		// Pump PTY output → WebSocket (binary frames preserve escape sequences).
		go func() {
			buf := make([]byte, 8192)
			for {
				n, readErr := ptmx.Read(buf)
				if n > 0 {
					if err := conn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
						break
					}
				}
				if readErr != nil {
					break
				}
			}
			conn.Close()
		}()

		// Pump WebSocket control frames → PTY.
		for {
			mt, data, readErr := conn.ReadMessage()
			if readErr != nil {
				break
			}
			if mt != websocket.TextMessage {
				continue
			}
			var msg terminalClientMsg
			if err := json.Unmarshal(data, &msg); err != nil {
				continue
			}
			switch msg.Type {
			case "input":
				if _, err := ptmx.Write([]byte(msg.Data)); err != nil {
					cleanup()
					return
				}
			case "resize":
				if msg.Cols > 0 && msg.Rows > 0 {
					pty.Setsize(ptmx, &pty.Winsize{Cols: msg.Cols, Rows: msg.Rows})
				}
			}
		}
	} else {
		// Remote SSH Terminal
		server, err := dbGetServer(serverID)
		if err != nil || server == nil {
			wsSendTerminal(conn, "Failed to load server config.\r\n")
			return
		}
		signer, err := ssh.ParsePrivateKey([]byte(server.SSHKey))
		if err != nil {
			wsSendTerminal(conn, "Failed to parse SSH private key: "+err.Error()+"\r\n")
			return
		}
		cfg := &ssh.ClientConfig{
			User:            server.SSHUser,
			Auth:            []ssh.AuthMethod{ssh.PublicKeys(signer)},
			HostKeyCallback: ssh.InsecureIgnoreHostKey(),
			Timeout:         15 * time.Second,
		}
		addr := fmt.Sprintf("%s:%d", server.IP, server.Port)
		client, err := ssh.Dial("tcp", addr, cfg)
		if err != nil {
			wsSendTerminal(conn, "Failed to connect to remote server: "+err.Error()+"\r\n")
			return
		}
		defer client.Close()

		session, err := client.NewSession()
		if err != nil {
			wsSendTerminal(conn, "Failed to create SSH session: "+err.Error()+"\r\n")
			return
		}
		defer session.Close()

		modes := ssh.TerminalModes{
			ssh.ECHO:          1,
			ssh.TTY_OP_ISPEED: 14400,
			ssh.TTY_OP_OSPEED: 14400,
		}
		if err := session.RequestPty("xterm-256color", 40, 80, modes); err != nil {
			wsSendTerminal(conn, "Failed to request PTY: "+err.Error()+"\r\n")
			return
		}

		stdin, err := session.StdinPipe()
		if err != nil {
			wsSendTerminal(conn, "Failed to setup stdin pipe: "+err.Error()+"\r\n")
			return
		}
		stdout, err := session.StdoutPipe()
		if err != nil {
			wsSendTerminal(conn, "Failed to setup stdout pipe: "+err.Error()+"\r\n")
			return
		}
		stderr, err := session.StderrPipe()
		if err != nil {
			wsSendTerminal(conn, "Failed to setup stderr pipe: "+err.Error()+"\r\n")
			return
		}

		// Forward stdout and stderr to the WebSocket.
		go func() {
			buf := make([]byte, 8192)
			for {
				n, err := stdout.Read(buf)
				if n > 0 {
					if conn.WriteMessage(websocket.BinaryMessage, buf[:n]) != nil {
						break
					}
				}
				if err != nil {
					break
				}
			}
			conn.Close()
		}()

		go func() {
			buf := make([]byte, 8192)
			for {
				n, err := stderr.Read(buf)
				if n > 0 {
					if conn.WriteMessage(websocket.BinaryMessage, buf[:n]) != nil {
						break
					}
				}
				if err != nil {
					break
				}
			}
			conn.Close()
		}()

		cmdStr := fmt.Sprintf("docker exec -it %s %s", shellQuote(containerName), shellQuote(shell))
		if err := session.Start(cmdStr); err != nil {
			wsSendTerminal(conn, "Failed to start terminal: "+err.Error()+"\r\n")
			return
		}

		// Pump WebSocket control frames → PTY.
		for {
			mt, data, readErr := conn.ReadMessage()
			if readErr != nil {
				break
			}
			if mt != websocket.TextMessage {
				continue
			}
			var msg terminalClientMsg
			if err := json.Unmarshal(data, &msg); err != nil {
				continue
			}
			switch msg.Type {
			case "input":
				if _, err := stdin.Write([]byte(msg.Data)); err != nil {
					return
				}
			case "resize":
				if msg.Cols > 0 && msg.Rows > 0 {
					_ = session.WindowChange(int(msg.Rows), int(msg.Cols))
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------
// /ws/host-terminal — interactive PTY shell on the host (the server itself)
// ---------------------------------------------------------------------------
//
// Same wire protocol and rendering as /ws/terminal, but instead of exec'ing
// into a container it spawns a login shell directly on the host machine that
// Better-PaaS runs on. This gives the operator a full terminal to the server
// from the dashboard — inspect disk, tail system logs, run docker, etc.
//
// SECURITY: this grants shell access to the host with the same privileges as
// the Better-PaaS process. It is gated behind the same admin auth token as
// every other privileged endpoint (wsAuthOK), but operators should be aware
// that anyone who can reach this socket with a valid token has the keys to the
// machine.

// hostShellCandidates are tried in order; the first shell present on the host
// is used. Falls back to "sh" found on PATH.
var hostShellCandidates = []string{"/bin/bash", "/bin/zsh", "/bin/sh"}

func handleHostTerminalWS(w http.ResponseWriter, r *http.Request) {
	if !wsAuthOK(w, r) {
		return
	}
	serverId := r.URL.Query().Get("serverId")
	log.Printf("[WS/host-terminal] Connect for serverId=%q", serverId)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS/host-terminal] Upgrade failed: %v", err)
		return
	}
	defer func() {
		log.Printf("[WS/host-terminal] Disconnect for serverId=%q", serverId)
		conn.Close()
	}()

	isLocal := serverId == "" || serverId == "localhost"

	if isLocal {
		shell := pickHostShell()
		if shell == "" {
			wsSendTerminal(conn, "No shell (/bin/bash, /bin/zsh or /bin/sh) found on the host.\r\n")
			return
		}

		// Start the shell attached to a real PTY so interactive programs behave
		// just like a normal terminal session.
		cmd := exec.Command(shell)
		cmd.Env = append(os.Environ(), "TERM=xterm-256color")
		ptmx, err := pty.Start(cmd)
		if err != nil {
			wsSendTerminal(conn, "Failed to start terminal session: "+err.Error()+"\r\n")
			return
		}

		var once sync.Once
		cleanup := func() {
			once.Do(func() {
				ptmx.Close()
				if cmd.Process != nil {
					cmd.Process.Kill()
				}
				cmd.Wait()
			})
		}
		defer cleanup()

		// Pump PTY output → WebSocket (binary frames preserve escape sequences).
		go func() {
			buf := make([]byte, 8192)
			for {
				n, readErr := ptmx.Read(buf)
				if n > 0 {
					if err := conn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
						break
					}
				}
				if readErr != nil {
					break
				}
			}
			conn.Close()
		}()

		// Pump WebSocket control frames → PTY.
		for {
			mt, data, readErr := conn.ReadMessage()
			if readErr != nil {
				break
			}
			if mt != websocket.TextMessage {
				continue
			}
			var msg terminalClientMsg
			if err := json.Unmarshal(data, &msg); err != nil {
				continue
			}
			switch msg.Type {
			case "input":
				if _, err := ptmx.Write([]byte(msg.Data)); err != nil {
					cleanup()
					return
				}
			case "resize":
				if msg.Cols > 0 && msg.Rows > 0 {
					pty.Setsize(ptmx, &pty.Winsize{Cols: msg.Cols, Rows: msg.Rows})
				}
			}
		}
	} else {
		// Remote SSH host terminal
		server, err := dbGetServer(serverId)
		if err != nil || server == nil {
			wsSendTerminal(conn, "Failed to load server config.\r\n")
			return
		}
		signer, err := ssh.ParsePrivateKey([]byte(server.SSHKey))
		if err != nil {
			wsSendTerminal(conn, "Failed to parse SSH private key: "+err.Error()+"\r\n")
			return
		}
		cfg := &ssh.ClientConfig{
			User:            server.SSHUser,
			Auth:            []ssh.AuthMethod{ssh.PublicKeys(signer)},
			HostKeyCallback: ssh.InsecureIgnoreHostKey(),
			Timeout:         15 * time.Second,
		}
		addr := fmt.Sprintf("%s:%d", server.IP, server.Port)
		client, err := ssh.Dial("tcp", addr, cfg)
		if err != nil {
			wsSendTerminal(conn, "Failed to connect to remote server: "+err.Error()+"\r\n")
			return
		}
		defer client.Close()

		session, err := client.NewSession()
		if err != nil {
			wsSendTerminal(conn, "Failed to create SSH session: "+err.Error()+"\r\n")
			return
		}
		defer session.Close()

		modes := ssh.TerminalModes{
			ssh.ECHO:          1,
			ssh.TTY_OP_ISPEED: 14400,
			ssh.TTY_OP_OSPEED: 14400,
		}
		if err := session.RequestPty("xterm-256color", 40, 80, modes); err != nil {
			wsSendTerminal(conn, "Failed to request PTY: "+err.Error()+"\r\n")
			return
		}

		stdin, err := session.StdinPipe()
		if err != nil {
			wsSendTerminal(conn, "Failed to setup stdin pipe: "+err.Error()+"\r\n")
			return
		}
		stdout, err := session.StdoutPipe()
		if err != nil {
			wsSendTerminal(conn, "Failed to setup stdout pipe: "+err.Error()+"\r\n")
			return
		}
		stderr, err := session.StderrPipe()
		if err != nil {
			wsSendTerminal(conn, "Failed to setup stderr pipe: "+err.Error()+"\r\n")
			return
		}

		// Forward stdout and stderr to the WebSocket.
		go func() {
			buf := make([]byte, 8192)
			for {
				n, err := stdout.Read(buf)
				if n > 0 {
					if conn.WriteMessage(websocket.BinaryMessage, buf[:n]) != nil {
						break
					}
				}
				if err != nil {
					break
				}
			}
			conn.Close()
		}()

		go func() {
			buf := make([]byte, 8192)
			for {
				n, err := stderr.Read(buf)
				if n > 0 {
					if conn.WriteMessage(websocket.BinaryMessage, buf[:n]) != nil {
						break
					}
				}
				if err != nil {
					break
				}
			}
			conn.Close()
		}()

		// Start interactive shell
		if err := session.Shell(); err != nil {
			wsSendTerminal(conn, "Failed to start shell: "+err.Error()+"\r\n")
			return
		}

		// Pump WebSocket control frames → PTY.
		for {
			mt, data, readErr := conn.ReadMessage()
			if readErr != nil {
				break
			}
			if mt != websocket.TextMessage {
				continue
			}
			var msg terminalClientMsg
			if err := json.Unmarshal(data, &msg); err != nil {
				continue
			}
			switch msg.Type {
			case "input":
				if _, err := stdin.Write([]byte(msg.Data)); err != nil {
					return
				}
			case "resize":
				if msg.Cols > 0 && msg.Rows > 0 {
					_ = session.WindowChange(int(msg.Rows), int(msg.Cols))
				}
			}
		}
	}
}

// pickHostShell returns the first shell from hostShellCandidates that exists
// and is executable on the host, or "" if none can be found.
func pickHostShell() string {
	for _, sh := range hostShellCandidates {
		if info, err := os.Stat(sh); err == nil && !info.IsDir() {
			return sh
		}
	}
	// Last resort: resolve "sh" from PATH.
	if p, err := exec.LookPath("sh"); err == nil {
		return p
	}
	return ""
}

// wsSendTerminal writes a plain status string as a binary frame so the xterm.js
// client renders it like any other terminal output.
func wsSendTerminal(conn *websocket.Conn, message string) {
	conn.WriteMessage(websocket.BinaryMessage, []byte(message))
}

// pickContainerShell returns the first shell from terminalShellCandidates that
// can actually run inside the container, or "" if none can. Running the shell
// with `-c true` both proves it exists and that it's executable.
func pickContainerShell(serverID string, containerName string) string {
	exec, err := GetExecutorForServer(serverID)
	if err != nil {
		return ""
	}
	if sshExec, ok := exec.(*SSHExecutor); ok {
		defer sshExec.Close()
	}
	for _, sh := range terminalShellCandidates {
		_, err := exec.RunCommand("docker", "exec", containerName, sh, "-c", "true")
		if err == nil {
			return sh
		}
	}
	return ""
}
