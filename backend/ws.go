package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:     checkWSOrigin,
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
}

// checkWSOrigin restricts WebSocket upgrades to the configured dashboard
// origin(s) when DASHBOARD_ORIGIN is set. When unset, any origin is allowed at
// the handshake level — the per-connection token check (wsAuthOK) is the
// primary defense against cross-site WebSocket hijacking.
func checkWSOrigin(r *http.Request) bool {
	allowed := parseAllowedOrigins(os.Getenv("DASHBOARD_ORIGIN"))
	if len(allowed) == 0 {
		return true
	}
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true // non-browser client (e.g. CLI)
	}
	return originAllowed(origin, allowed)
}

// wsSend sends a JSON-encoded log message over the WebSocket.
func wsSend(conn *websocket.Conn, message string) error {
	msg := map[string]string{
		"message":   message,
		"timestamp": time.Now().Format(time.RFC3339),
	}
	data, _ := json.Marshal(msg)
	return conn.WriteMessage(websocket.TextMessage, data)
}

// ---------------------------------------------------------------------------
// /ws/logs — build log streaming
// ---------------------------------------------------------------------------

func handleLogsWS(w http.ResponseWriter, r *http.Request) {
	if !wsAuthOK(r) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	appID := r.URL.Query().Get("appId")
	log.Printf("[WS/logs] Connect for appId=%q", appID)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS/logs] Upgrade failed: %v", err)
		return
	}
	defer func() {
		log.Printf("[WS/logs] Disconnect for appId=%q", appID)
		conn.Close()
	}()

	// Fall back to most recently deployed app
	if appID == "" {
		appsLock.Lock()
		if len(apps) > 0 {
			appID = apps[len(apps)-1].ID
		}
		appsLock.Unlock()
	}

	if appID == "" {
		wsSend(conn, "No apps deployed yet.")
		return
	}

	// Replay existing logs from the deployment's log file.
	dep, err := dbGetLatestDeployment(appID)
	if err == nil && dep != nil && dep.LogFile != "" {
		lines, _ := readLogFile(dep.LogFile)
		for _, line := range lines {
			if err := wsSend(conn, line); err != nil {
				return
			}
		}
	}

	// Register subscriber and capture any live log lines.
	clientChan := make(chan string, 256)

	subscribersLock.Lock()
	if subscribers[appID] == nil {
		subscribers[appID] = make(map[chan string]bool)
	}
	subscribers[appID][clientChan] = true
	subscribersLock.Unlock()

	defer func() {
		subscribersLock.Lock()
		delete(subscribers[appID], clientChan)
		subscribersLock.Unlock()
	}()

	// Disconnect detection goroutine
	closed := make(chan struct{})
	go func() {
		defer close(closed)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	// Stream live logs
	for {
		select {
		case line, ok := <-clientChan:
			if !ok {
				return
			}
			if err := wsSend(conn, line); err != nil {
				return
			}
		case <-closed:
			return
		}
	}
}

// ---------------------------------------------------------------------------
// /ws/runtime-logs — Docker container log streaming
// ---------------------------------------------------------------------------

func handleRuntimeLogsWS(w http.ResponseWriter, r *http.Request) {
	if !wsAuthOK(r) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	appID := r.URL.Query().Get("appId")
	log.Printf("[WS/runtime-logs] Connect for appId=%q", appID)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS/runtime-logs] Upgrade failed: %v", err)
		return
	}
	defer func() {
		log.Printf("[WS/runtime-logs] Disconnect for appId=%q", appID)
		conn.Close()
	}()

	// Find the target app
	var containerName, currentStatus string
	appsLock.Lock()
	for _, a := range apps {
		if a.ID == appID {
			containerName = a.Name
			currentStatus = a.Status
			break
		}
	}
	appsLock.Unlock()

	if containerName == "" {
		wsSend(conn, fmt.Sprintf("App %q not found.", appID))
		return
	}

	// If still building, wait for it to finish
	if currentStatus == "building" {
		wsSend(conn, "App is currently building. Runtime logs will start once the container is up…")
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
	waitLoop:
		for range ticker.C {
			appsLock.Lock()
			for _, a := range apps {
				if a.ID == appID {
					currentStatus = a.Status
					break
				}
			}
			appsLock.Unlock()
			if currentStatus != "building" {
				break waitLoop
			}
		}
	}

	if currentStatus != "running" && currentStatus != "stopped" && currentStatus != "failed" {
		wsSend(conn, fmt.Sprintf("App is in state %q — no runtime logs available.", currentStatus))
		return
	}

	// Tail docker logs
	cmd := exec.Command("docker", "logs", "--tail", "200", "-f", containerName)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		wsSend(conn, fmt.Sprintf("Failed to open log stream: %v", err))
		return
	}
	cmd.Stderr = cmd.Stdout

	if err := cmd.Start(); err != nil {
		wsSend(conn, fmt.Sprintf("Failed to start docker logs: %v", err))
		return
	}
	defer func() {
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
		cmd.Wait()
	}()

	// Kill docker process on client disconnect
	go func() {
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				if cmd.Process != nil {
					cmd.Process.Kill()
				}
				return
			}
		}
	}()

	reader := bufio.NewReader(stdout)
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			break
		}
		if sendErr := wsSend(conn, strings.TrimSuffix(line, "\n")); sendErr != nil {
			break
		}
	}
}

// ---------------------------------------------------------------------------
// /ws/stats — server metrics streaming
// ---------------------------------------------------------------------------

func handleStatsWS(w http.ResponseWriter, r *http.Request) {
	if !wsAuthOK(r) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	// Disconnect detection
	go func() {
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				conn.Close()
				return
			}
		}
	}()

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		appsLock.Lock()
		activeCount := 0
		for _, a := range apps {
			if a.Status == "running" {
				activeCount++
			}
		}
		appsLock.Unlock()

		stats := ServerStats{
			CPUUsage:    10.0 + rand.Float64()*15.0,
			MemoryUsage: 35.0 + rand.Float64()*10.0,
			DiskUsage:   getHostDiskUsage(),
			ActiveApps:  activeCount,
			Timestamp:   time.Now(),
		}

		data, _ := json.Marshal(stats)
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			break
		}
	}
}

// getHostDiskUsage returns approximate disk usage % using df.
func getHostDiskUsage() float64 {
	cmd := exec.Command("df", "-h", "/")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}

	lines := strings.Split(string(out), "\n")
	if len(lines) < 2 {
		return 0
	}

	fields := strings.Fields(lines[1])
	if len(fields) < 5 {
		return 0
	}

	pctStr := strings.TrimSuffix(fields[4], "%")
	var pct float64
	fmt.Sscanf(pctStr, "%f", &pct)
	return pct
}

