package main

import (
	"flag"
	"fmt"
	"os"
	"strings"
)

func runConnect(args []string) int {
	url, flagArgs := splitConnectArgs(args)

	fs := flag.NewFlagSet("connect", flag.ExitOnError)
	legacyFlag := fs.Bool("legacy", false, "Use terminal admin-token flow instead of browser")
	uiFlag := fs.String("ui", "", "Override dashboard URL (rare; discovery usually finds it)")
	adminTokenFlag := fs.String("admin-token", "", "Admin token for legacy mode")
	profileFlag := fs.String("profile", "", "Scope profile for legacy mode")
	nameFlag := fs.String("name", "", "Agent name for legacy mode")
	_ = fs.Parse(flagArgs)

	if url == "" {
		var err error
		url, err = promptLine("PaaS URL", "http://localhost:8080")
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			return 1
		}
	}

	apiURL, uiURL, err := resolveConnectTargets(url, *uiFlag)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return 1
	}

	if strings.EqualFold(apiURL, uiURL) {
		fmt.Printf("Connecting to %s …\n", apiURL)
	} else {
		fmt.Println("Connecting…")
		fmt.Printf("  Dashboard: %s\n", uiURL)
		fmt.Printf("  API:       %s\n", apiURL)
	}

	useLegacy := *legacyFlag || *adminTokenFlag != "" || os.Getenv("PAAS_ADMIN_TOKEN") != ""
	if useLegacy {
		return runLegacyConnect(apiURL, *adminTokenFlag, *profileFlag, *nameFlag)
	}

	return runBrowserConnect(apiURL, uiURL)
}

func runLegacyConnect(apiURL, adminTokenFlag, profileFlag, nameFlag string) int {
	adminToken := strings.TrimSpace(adminTokenFlag)
	if adminToken == "" {
		if env := strings.TrimSpace(os.Getenv("PAAS_ADMIN_TOKEN")); env != "" {
			adminToken = env
		}
	}
	if adminToken == "" {
		fmt.Println("Paste your admin token (from ./server token on the VPS). It is not saved.")
		var err error
		adminToken, err = readSecret("Admin token: ")
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			return 1
		}
		adminToken = strings.TrimSpace(adminToken)
	}
	if adminToken == "" {
		fmt.Fprintln(os.Stderr, "error: admin token is required")
		return 1
	}

	admin := newClient(apiURL, adminToken)
	if err := admin.VerifyToken(); err != nil {
		fmt.Fprintf(os.Stderr, "error: admin token rejected: %v\n", err)
		return 1
	}

	profileName := strings.TrimSpace(profileFlag)
	if profileName == "" {
		var err error
		profileName, err = chooseProfile("deployer")
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			return 1
		}
	}
	p, ok := profileByName(profileName)
	if !ok {
		fmt.Fprintf(os.Stderr, "error: unknown profile %q\n", profileName)
		return 1
	}

	agentName := strings.TrimSpace(nameFlag)
	if agentName == "" {
		defaultName, _ := os.Hostname()
		if defaultName == "" {
			defaultName = "CLI"
		}
		var err error
		agentName, err = promptLine("Agent name", defaultName+" CLI")
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			return 1
		}
	}

	fmt.Printf("Creating agent %q with profile %q …\n", agentName, profileName)
	created, err := admin.CreateAgent(agentName, p.Scopes)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: failed to create agent: %v\n", err)
		return 1
	}
	if created.Token == "" {
		fmt.Fprintln(os.Stderr, "error: server did not return an agent token")
		return 1
	}

	cfg := Config{
		URL:     apiURL,
		Token:   created.Token,
		Profile: profileName,
		Name:    agentName,
		AgentID: created.ID,
	}
	if err := saveConfig(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "error: failed to save config: %v\n", err)
		return 1
	}

	path, _ := configPath()
	fmt.Println()
	fmt.Println("Connected successfully.")
	fmt.Printf("  URL:     %s\n", apiURL)
	fmt.Printf("  Profile: %s (%s)\n", profileName, p.Description)
	fmt.Printf("  Agent:   %s\n", agentName)
	fmt.Printf("  Config:  %s\n", path)
	fmt.Println()
	fmt.Println("Try: paas status")
	return 0
}
