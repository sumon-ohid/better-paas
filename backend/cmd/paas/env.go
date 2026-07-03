package main

import (
	"encoding/json"
	"fmt"
	"os"
)

func runEnv(args []string) int {
	jsonOut := len(args) > 0 && (args[0] == "--json" || args[0] == "-json")

	cfg, err := loadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return 1
	}

	if jsonOut {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		_ = enc.Encode(map[string]string{
			"url":   cfg.URL,
			"token": cfg.Token,
		})
		return 0
	}

	// Shell-friendly exports (use: eval "$(paas env)")
	fmt.Printf("export PAAS_URL=%q\n", cfg.URL)
	fmt.Printf("export PAAS_API_URL=%q\n", cfg.URL)
	fmt.Printf("export PAAS_TOKEN=%q\n", cfg.Token)
	return 0
}
