package main

import (
	"fmt"
	"os"
	"text/tabwriter"
)

func runStatus() int {
	cfg, err := loadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return 1
	}

	client := newClient(cfg.URL, cfg.Token)

	apps, err := client.ListApps()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return 1
	}

	fmt.Printf("Better-PaaS  %s\n", cfg.URL)
	fmt.Printf("Agent        %s (%s)\n", cfg.Name, cfg.Profile)
	fmt.Println()

	if len(apps) == 0 {
		fmt.Println("No apps deployed yet.")
		return 0
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "NAME\tSTATUS\tID\tURL")
	for _, a := range apps {
		url := a.URL
		if len(url) > 48 {
			url = url[:45] + "..."
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", a.Name, a.Status, a.ID, url)
	}
	_ = w.Flush()

	projects, err := client.ListProjects()
	if err == nil && len(projects) > 0 {
		fmt.Printf("\nProjects: %d\n", len(projects))
	}
	return 0
}

func runDisconnect() int {
	if err := removeConfig(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return 1
	}
	fmt.Println("Disconnected. Local config removed.")
	return 0
}
