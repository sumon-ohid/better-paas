package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

func runSetup() int {
	if _, err := loadConfig(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return 1
	}

	cmd, args := paasCommand()
	mcpEntry := map[string]any{
		"command": cmd,
		"args":    args,
	}

	home, err := os.UserHomeDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return 1
	}

	cursorPath := filepath.Join(home, ".cursor", "mcp.json")
	if err := mergeMCPConfig(cursorPath, mcpEntry); err != nil {
		fmt.Fprintf(os.Stderr, "error: cursor config: %v\n", err)
		return 1
	}
	fmt.Printf("✓ Cursor MCP config: %s\n", cursorPath)

	claudePath := filepath.Join(home, ".claude", "settings.json")
	if err := mergeMCPConfig(claudePath, mcpEntry); err != nil {
		fmt.Fprintf(os.Stderr, "warning: claude config: %v\n", err)
	} else {
		fmt.Printf("✓ Claude Code MCP config: %s\n", claudePath)
	}

	fmt.Println()
	fmt.Println("Next steps:")
	fmt.Println("  1. Restart Cursor or Claude Code (MCP loads on startup).")
	fmt.Println("  2. Ask in chat, e.g.:")
	fmt.Println(`       "List my Better-PaaS apps"`)
	fmt.Println(`       "Show logs for better-paas"`)
	fmt.Println(`       "Redeploy better-paas"`)
	fmt.Println()
	fmt.Println("Terminal fallback (no MCP):")
	fmt.Println(`  eval "$(paas env)"   # then ask the AI to use $PAAS_API_URL + $PAAS_TOKEN`)
	return 0
}

func paasCommand() (string, []string) {
	if exe, err := os.Executable(); err == nil {
		return exe, []string{"mcp"}
	}
	return "paas", []string{"mcp"}
}

func mergeMCPConfig(path string, serverEntry map[string]any) error {
	var root map[string]any
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &root)
	}
	if root == nil {
		root = map[string]any{}
	}

	servers, _ := root["mcpServers"].(map[string]any)
	if servers == nil {
		servers = map[string]any{}
	}
	servers["better-paas"] = serverEntry
	root["mcpServers"] = servers

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(path, data, 0644)
}
