package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSaveAndLoadConfig(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	cfg := Config{
		URL:     "http://localhost:8080",
		Token:   "bpagt_test",
		Profile: "deployer",
		Name:    "test CLI",
		AgentID: "agent123",
	}
	if err := saveConfig(cfg); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(home, ".paas", "config.json")
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0600 {
		t.Fatalf("config mode = %o, want 0600", info.Mode().Perm())
	}

	loaded, err := loadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if loaded.URL != cfg.URL || loaded.Token != cfg.Token || loaded.Profile != cfg.Profile {
		t.Fatalf("loaded config mismatch: %+v", loaded)
	}
}

func TestProfileByName(t *testing.T) {
	p, ok := profileByName("deployer")
	if !ok {
		t.Fatal("expected deployer profile")
	}
	if len(p.Scopes) < 5 {
		t.Fatalf("deployer scopes too few: %v", p.Scopes)
	}
}
