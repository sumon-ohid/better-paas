package main

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
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
	cmd       *exec.Cmd
	sshClient *ssh.Client
	session   *ssh.Session
	done      chan struct{}
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

	var serverID string
	appsLock.Lock()
	for _, a := range apps {
		if a.ID == appID {
			serverID = a.ServerID
			break
		}
	}
	appsLock.Unlock()

	var stdout io.Reader
	var err error

	isLocal := serverID == "" || serverID == "localhost"

	if isLocal {
		cmd := exec.Command("docker", "logs", "-f", "--tail", "0", containerName)
		c.cmd = cmd
		stdout, err = cmd.StdoutPipe()
		if err != nil {
			log.Printf("[runtimelog] %s: pipe error: %v", appID, err)
			return
		}
		cmd.Stderr = cmd.Stdout
		if err := cmd.Start(); err != nil {
			log.Printf("[runtimelog] %s: start error: %v", appID, err)
			return
		}
	} else {
		server, err := dbGetServer(serverID)
		if err != nil || server == nil {
			log.Printf("[runtimelog] %s: failed to load server %s: %v", appID, serverID, err)
			return
		}
		signer, err := ssh.ParsePrivateKey([]byte(server.SSHKey))
		if err != nil {
			log.Printf("[runtimelog] %s: parse private key failed: %v", appID, err)
			return
		}
		cfg := &ssh.ClientConfig{
			User:            server.SSHUser,
			Auth:            []ssh.AuthMethod{ssh.PublicKeys(signer)},
			HostKeyCallback: pinnedHostKeyCallback(server),
			Timeout:         15 * time.Second,
		}
		addr := fmt.Sprintf("%s:%d", server.IP, server.Port)
		client, err := ssh.Dial("tcp", addr, cfg)
		if err != nil {
			log.Printf("[runtimelog] %s: ssh dial failed: %v", appID, err)
			return
		}
		c.sshClient = client

		session, err := client.NewSession()
		if err != nil {
			log.Printf("[runtimelog] %s: ssh session failed: %v", appID, err)
			client.Close()
			return
		}
		c.session = session

		stdout, err = session.StdoutPipe()
		if err != nil {
			log.Printf("[runtimelog] %s: ssh stdout pipe failed: %v", appID, err)
			session.Close()
			client.Close()
			return
		}
		session.Stderr = session.Stdout

		cmdStr := fmt.Sprintf("docker logs -f --tail 0 %s", shellQuote(containerName))
		if err := session.Start(cmdStr); err != nil {
			log.Printf("[runtimelog] %s: ssh start command failed: %v", appID, err)
			session.Close()
			client.Close()
			return
		}
	}

	path := runtimeLogPath(appID)
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		select {
		case <-c.done:
			if isLocal && c.cmd != nil {
				_ = c.cmd.Process.Kill()
				_ = c.cmd.Wait()
			} else {
				if c.session != nil {
					_ = c.session.Close()
				}
				if c.sshClient != nil {
					_ = c.sshClient.Close()
				}
			}
			return
		default:
		}
		line := fmt.Sprintf("[%s] %s", time.Now().Format(time.RFC3339), scanner.Text())
		appendRuntimeLine(path, line)
	}

	if isLocal && c.cmd != nil {
		_ = c.cmd.Wait()
	} else {
		if c.session != nil {
			_ = c.session.Wait()
		}
	}
}

func (c *logCapturer) stop() {
	select {
	case <-c.done:
	default:
		close(c.done)
	}
	if c.cmd != nil && c.cmd.Process != nil {
		_ = c.cmd.Process.Kill()
	}
	if c.session != nil {
		_ = c.session.Close()
	}
	if c.sshClient != nil {
		_ = c.sshClient.Close()
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
