package main

import (
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"
	"strings"
	"time"
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

// appHostIP returns the public-ish host IP used for the default sslip.io URL.
// The default route is served by this control-plane Caddy, even when the app
// container itself runs on a remote target server.
func appHostIP(_ string) string {
	if os.Getenv("RUNNING_IN_DOCKER") == "true" {
		return "127.0.0.1"
	}
	return getLocalIP()
}

func defaultAppURL(appID, serverID string) string {
	return fmt.Sprintf("http://%s.%s.sslip.io", appID, appHostIP(serverID))
}

func getBackendPort() string {
	addr := listenAddr()
	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		return addr[idx+1:]
	}
	return "8080"
}

func getFrontendPort() string {
	if p := strings.TrimSpace(os.Getenv("FRONTEND_PORT")); p != "" {
		return p
	}
	if p := strings.TrimSpace(os.Getenv("PORT")); p != "" {
		return p
	}
	return "3000"
}

func getPaasDomain() string {
	if domain := strings.TrimSpace(os.Getenv("PAAS_DOMAIN")); domain != "" {
		return domain
	}
	return strings.TrimSpace(dbGetMeta("paas_domain"))
}

// rebuildCaddyfile regenerates the Caddyfile from the current app list.
// It must be called whenever apps are added, removed, or change status.
//
// Each app gets:
//   - an http:// sslip.io wildcard-style host (always, no TLS needed)
//   - one TLS site block per custom domain, which triggers Caddy's automatic
//     HTTPS (Let's Encrypt) for that hostname.
func rebuildCaddyfile() {
	appsLock.Lock()
	defer appsLock.Unlock()

	var sb strings.Builder
	sb.WriteString("# Auto-generated Caddyfile - DO NOT EDIT\n\n")
	sb.WriteString("{\n\tadmin 127.0.0.1:2019\n")
	if email := strings.TrimSpace(os.Getenv("ACME_EMAIL")); email != "" {
		sb.WriteString(fmt.Sprintf("\temail %s\n", email))
	}
	sb.WriteString("}\n\n")

	// Custom PAAS_DOMAIN routing
	if paasDomain := getPaasDomain(); paasDomain != "" {
		backendPort := getBackendPort()
		frontendPort := getFrontendPort()
		sb.WriteString(fmt.Sprintf("%s {\n", paasDomain))
		sb.WriteString("\thandle /api/* {\n")
		sb.WriteString(fmt.Sprintf("\t\treverse_proxy localhost:%s\n", backendPort))
		sb.WriteString("\t}\n")
		sb.WriteString("\thandle /ws/* {\n")
		sb.WriteString(fmt.Sprintf("\t\treverse_proxy localhost:%s\n", backendPort))
		sb.WriteString("\t}\n")
		sb.WriteString("\thandle {\n")
		sb.WriteString(fmt.Sprintf("\t\treverse_proxy localhost:%s\n", frontendPort))
		sb.WriteString("\t}\n")
		sb.WriteString("}\n\n")
	}

	for _, app := range apps {

		if app.Status != "running" && app.Status != "building" {
			continue
		}

		localHost := "localhost"
		if os.Getenv("RUNNING_IN_DOCKER") == "true" {
			localHost = "host.docker.internal"
		}
		upstream := fmt.Sprintf("%s:%d", localHost, app.Port)
		if app.ServerID != "" && app.ServerID != "localhost" {
			srv, err := dbGetServer(app.ServerID)
			if err == nil && srv != nil && !srv.IsLocal {
				upstream = fmt.Sprintf("%s:%d", srv.IP, app.Port)
			}
		}

		// Default sslip.io host over plain HTTP.
		sb.WriteString(fmt.Sprintf("http://%s.%s.sslip.io {\n", app.ID, appHostIP(app.ServerID)))
		sb.WriteString(fmt.Sprintf("\treverse_proxy %s\n", upstream))
		sb.WriteString("}\n\n")

		// Custom domains: bare hostname → Caddy auto-provisions a TLS cert.
		for _, d := range app.Domains {
			d = strings.TrimSpace(d)
			if d == "" {
				continue
			}
			sb.WriteString(fmt.Sprintf("%s {\n", d))
			sb.WriteString(fmt.Sprintf("\treverse_proxy %s\n", upstream))
			sb.WriteString("}\n\n")
		}
	}

	if err := os.WriteFile("Caddyfile", []byte(sb.String()), 0644); err != nil {
		log.Printf("Error writing Caddyfile: %v", err)
	} else {
		log.Println("Caddyfile rebuilt successfully")
		if caddyRunning() {
			if err := reloadCaddy(); err != nil {
				log.Printf("⚠️ Error reloading Caddy: %v", err)
			} else {
				log.Println("Caddy reloaded successfully")
			}
		}
	}
}

// caddyAdminAddr is the loopback admin endpoint Caddy exposes (see the global
// block written by rebuildCaddyfile). Used to detect a running instance and to
// reload its config without spawning a second process.
const caddyAdminAddr = "127.0.0.1:2019"

// caddyRunning reports whether a Caddy admin endpoint is already responding,
// which means an instance is live (started by a previous server run, systemd,
// or a leftover dev relaunch).
func caddyRunning() bool {
	conn, err := net.DialTimeout("tcp", caddyAdminAddr, 500*time.Millisecond)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

// reloadCaddy asks an already-running Caddy to load the current Caddyfile via
// its admin API. `caddy reload` is a thin client over that API and is safe to
// call repeatedly. Returns an error if the reload fails.
func reloadCaddy() error {
	cmd := exec.Command("caddy", "reload", "--config", "Caddyfile", "--address", caddyAdminAddr)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("%v: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

// startCaddySubprocess ensures exactly one Caddy instance is serving the
// generated Caddyfile. If one is already running (detected via its admin port)
// it reloads that instance instead of starting a second one — starting a
// duplicate would race for ports :80/:2019 and, on platforms that allow the
// rebind, leave multiple instances fielding requests (some with a stale/empty
// config), which surfaces as blank pages on deployed apps.
func startCaddySubprocess() {
	if _, err := exec.LookPath("caddy"); err != nil {
		log.Println("⚠️  Caddy not found in PATH. Dynamic subdomain routing (sslip.io) will not work.")
		return
	}

	// If an instance is already up, just reload it with the current config
	// rather than spawning another that would fight for the same ports.
	if caddyRunning() {
		if err := reloadCaddy(); err != nil {
			log.Printf("⚠️  Caddy already running but reload failed: %v", err)
		} else {
			log.Println("Caddy already running — reloaded existing instance.")
		}
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
