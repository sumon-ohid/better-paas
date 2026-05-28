package main

import (
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"
	"strings"
)

// getLocalIP returns the server's first non-loopback IPv4 address.
func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "127.0.0.1"
	}
	for _, address := range addrs {
		if ipnet, ok := address.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}
	return "127.0.0.1"
}

// rebuildCaddyfile regenerates the Caddyfile from the current app list.
// It must be called whenever apps are added, removed, or change status.
func rebuildCaddyfile() {
	appsLock.Lock()
	defer appsLock.Unlock()

	var sb strings.Builder
	sb.WriteString("# Auto-generated Caddyfile - DO NOT EDIT\n\n")
	sb.WriteString("{\n\tadmin 127.0.0.1:2019\n}\n\n")

	ip := getLocalIP()

	for _, app := range apps {
		if app.Status == "running" || app.Status == "building" {
			sb.WriteString(fmt.Sprintf("http://%s.%s.sslip.io {\n", app.ID, ip))
			sb.WriteString(fmt.Sprintf("\treverse_proxy localhost:%d\n", app.Port))
			sb.WriteString("}\n\n")
		}
	}

	if err := os.WriteFile("Caddyfile", []byte(sb.String()), 0644); err != nil {
		log.Printf("Error writing Caddyfile: %v", err)
	} else {
		log.Println("Caddyfile rebuilt successfully")
	}
}

// startCaddySubprocess starts caddy as a background process if it is in PATH.
func startCaddySubprocess() {
	if _, err := exec.LookPath("caddy"); err != nil {
		log.Println("⚠️  Caddy not found in PATH. Dynamic subdomain routing (sslip.io) will not work.")
		return
	}

	log.Println("Caddy detected — launching reverse proxy...")
	caddyCmd := exec.Command("caddy", "run", "--config", "Caddyfile", "--watch")
	caddyCmd.Stdout = os.Stdout
	caddyCmd.Stderr = os.Stderr

	go func() {
		if err := caddyCmd.Run(); err != nil {
			log.Printf("Caddy proxy stopped: %v", err)
		}
	}()
}
