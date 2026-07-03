package main

import (
	"fmt"
	"os"
)

const cliVersion = "0.1.0"

func main() {
	if len(os.Args) < 2 {
		printUsage(os.Stdout)
		os.Exit(0)
	}

	var code int
	switch os.Args[1] {
	case "connect":
		code = runConnect(os.Args[2:])
	case "status":
		code = runStatus()
	case "disconnect":
		code = runDisconnect()
	case "env":
		code = runEnv(os.Args[2:])
	case "setup":
		code = runSetup()
	case "mcp":
		code = runMCP()
	case "help", "-h", "--help":
		printUsage(os.Stdout)
	case "version", "-v", "--version":
		fmt.Println(cliVersion)
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n", os.Args[1])
		printUsage(os.Stderr)
		code = 2
	}
	os.Exit(code)
}

func printUsage(w *os.File) {
	fmt.Fprintf(w, `paas — Better-PaaS local CLI for AI agents and automation

Usage:
  paas connect <url>    Link this machine via browser authorization
  paas setup            Configure Cursor / Claude Code MCP (run after connect)
  paas status           Show apps on the connected instance
  paas env              Print shell exports (eval "$(paas env)")
  paas mcp              MCP server for AI tools (used by setup, not run manually)
  paas disconnect       Remove local credentials
  paas version          Print version
  paas help             Show this help

Examples:
  paas connect https://paas.better-paas.com
  paas setup
  paas status

AI tools (Cursor, Claude Code, Codex):
  1. paas connect <dashboard-url>
  2. paas setup
  3. Restart your editor — then ask: "list my apps", "redeploy X", "show logs"

Setup:
  1. Install:  go install github.com/sumon-ohid/better-paas/backend/cmd/paas@latest
  2. Connect:  paas connect <your-dashboard-url>
  3. AI:       paas setup

Use your dashboard URL (the one you open in the browser). The CLI discovers
the API automatically. Browser flow saves a scoped agent token to
~/.paas/config.json (mode 0600). Use --legacy for terminal admin-token setup.
`)
}
