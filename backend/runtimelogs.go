package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Runtime log persistence
// ---------------------------------------------------------------------------
//
// The /ws/runtime-logs stream tails `docker logs -f` live, but that history is
// lost when a container restarts or the browser disconnects. Here we run one
// background capturer per app that appends container stdout/stderr to a
// size-capped file (data/runtime-logs/<appID>.log), so logs survive restarts
// and can be searched/downloaded later.

const (
	runtimeLogDir      = "data/runtime-logs"
	maxRuntimeLogBytes = 10 << 20 // rotate at 10 MiB
)

type logCapturer struct {
	cmd  *exec.Cmd
	done chan struct{}
}

var (
	capturersLock sync.Mutex
	capturers     = map[string]*logCapturer{} // appID → active capturer
)

// runtimeLogPath returns the on-disk path for an app's persisted runtime logs.
func runtimeLogPath(appID string) string {
	return filepath.Join(runtimeLogDir, appID+".log")
}

// startRuntimeLogCapture begins (or restarts) persistent log capture for an app.
func startRuntimeLogCapture(appID, containerName string) {
	if appID == "" || containerName == "" {
		return
	}
	capturersLock.Lock()
	if existing, ok := capturers[appID]; ok {
		// Stop the previous capturer (container may have changed on redeploy).
		existing.stop()
		delete(capturers, appID)
	}
	c := &logCapturer{done: make(chan struct{})}
	capturers[appID] = c
	capturersLock.Unlock()

	os.MkdirAll(runtimeLogDir, 0755)

	go c.run(appID, containerName)
}

func (c *logCapturer) run(appID, containerName string) {
	defer func() {
		capturersLock.Lock()
		if capturers[appID] == c {
			delete(capturers, appID)
		}
		capturersLock.Unlock()
	}()

	// --since 1s avoids re-ingesting the whole history we may already have.
	cmd := exec.Command("docker", "logs", "-f", "--tail", "0", containerName)
	c.cmd = cmd
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("[runtimelog] %s: pipe error: %v", appID, err)
		return
	}
	cmd.Stderr = cmd.Stdout
	if err := cmd.Start(); err != nil {
		log.Printf("[runtimelog] %s: start error: %v", appID, err)
		return
	}

	path := runtimeLogPath(appID)
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		select {
		case <-c.done:
			cmd.Process.Kill()
			cmd.Wait()
			return
		default:
		}
		line := fmt.Sprintf("[%s] %s", time.Now().Format(time.RFC3339), scanner.Text())
		appendRuntimeLine(path, line)
	}
	cmd.Wait()
}

func (c *logCapturer) stop() {
	select {
	case <-c.done:
	default:
		close(c.done)
	}
	if c.cmd != nil && c.cmd.Process != nil {
		c.cmd.Process.Kill()
	}
}

// appendRuntimeLine appends a line, rotating the file once it exceeds the cap.
func appendRuntimeLine(path, line string) {
	if fi, err := os.Stat(path); err == nil && fi.Size() > maxRuntimeLogBytes {
		// Simple rotation: keep one ".1" generation.
		os.Rename(path, path+".1")
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	f.WriteString(line + "\n")
}

// readRuntimeLog returns up to the last `maxLines` persisted runtime log lines.
func readRuntimeLog(appID string, maxLines int) ([]string, error) {
	lines, err := readLogFile(runtimeLogPath(appID))
	if err != nil {
		return nil, err
	}
	if maxLines > 0 && len(lines) > maxLines {
		lines = lines[len(lines)-maxLines:]
	}
	return lines, nil
}

// stopRuntimeLogCapture stops capturing for an app (used on delete/stop).
func stopRuntimeLogCapture(appID string) {
	capturersLock.Lock()
	if c, ok := capturers[appID]; ok {
		c.stop()
		delete(capturers, appID)
	}
	capturersLock.Unlock()
}

// startAllRuntimeLogCaptures begins capture for every running app at boot.
func startAllRuntimeLogCaptures() {
	appsLock.Lock()
	running := make([]App, 0, len(apps))
	for _, a := range apps {
		if a.Status == "running" {
			running = append(running, a)
		}
	}
	appsLock.Unlock()
	for _, a := range running {
		startRuntimeLogCapture(a.ID, a.containerName())
	}
}
