package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os/exec"
	"sync"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
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
	var containerName, status string
	appsLock.Lock()
	for _, a := range apps {
		if a.ID == appID {
			containerName = a.containerName()
			status = a.Status
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
	shell := pickContainerShell(containerName)
	if shell == "" {
		wsSendTerminal(conn, "No shell (/bin/bash or /bin/sh) found in the container image.\r\n")
		return
	}

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
		// Shell exited (e.g. the user typed `exit`): close the socket so the
		// client reflects the ended session.
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
}

// wsSendTerminal writes a plain status string as a binary frame so the xterm.js
// client renders it like any other terminal output.
func wsSendTerminal(conn *websocket.Conn, message string) {
	conn.WriteMessage(websocket.BinaryMessage, []byte(message))
}

// pickContainerShell returns the first shell from terminalShellCandidates that
// can actually run inside the container, or "" if none can. Running the shell
// with `-c true` both proves it exists and that it's executable.
func pickContainerShell(containerName string) string {
	for _, sh := range terminalShellCandidates {
		check := exec.Command("docker", "exec", containerName, sh, "-c", "true")
		if err := check.Run(); err == nil {
			return sh
		}
	}
	return ""
}
