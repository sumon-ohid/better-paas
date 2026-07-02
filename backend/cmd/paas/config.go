package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const configVersion = 1

type Config struct {
	Version int    `json:"version"`
	URL     string `json:"url"`
	Token   string `json:"token"`
	Profile string `json:"profile"`
	Name    string `json:"name"`
	AgentID string `json:"agentId,omitempty"`
}

func configPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".paas", "config.json"), nil
}

func loadConfig() (Config, error) {
	path, err := configPath()
	if err != nil {
		return Config{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Config{}, fmt.Errorf("not connected — run: paas connect <url>")
		}
		return Config{}, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return Config{}, fmt.Errorf("invalid config at %s: %w", path, err)
	}
	if cfg.URL == "" || cfg.Token == "" {
		return Config{}, fmt.Errorf("config at %s is incomplete — run: paas connect <url>", path)
	}
	return cfg, nil
}

func saveConfig(cfg Config) error {
	path, err := configPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	cfg.Version = configVersion
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(path, data, 0600)
}

func removeConfig() error {
	path, err := configPath()
	if err != nil {
		return err
	}
	err = os.Remove(path)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}
