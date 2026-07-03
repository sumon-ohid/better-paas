package main

import (
	"fmt"
	"strings"
)

func loadConnectedClient() (*Client, Config, error) {
	cfg, err := loadConfig()
	if err != nil {
		return nil, Config{}, err
	}
	return newClient(cfg.URL, cfg.Token), cfg, nil
}

func resolveAppID(c *Client, nameOrID string) (string, error) {
	nameOrID = strings.TrimSpace(nameOrID)
	if nameOrID == "" {
		return "", fmt.Errorf("app name or id is required")
	}
	apps, err := c.ListApps()
	if err != nil {
		return "", err
	}
	for _, a := range apps {
		if a.ID == nameOrID || strings.EqualFold(a.Name, nameOrID) {
			return a.ID, nil
		}
	}
	return "", fmt.Errorf("app %q not found", nameOrID)
}
