package paas

import (
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func TestDbSaveAgentPersistsRotatedTokenHash(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })

	schema := `
CREATE TABLE agents (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	scopes TEXT NOT NULL,
	created_at DATETIME NOT NULL,
	last_used_at DATETIME
);`
	if _, err := db.Exec(schema); err != nil {
		t.Fatal(err)
	}

	prevDB := sqliteDB
	sqliteDB = db
	t.Cleanup(func() { sqliteDB = prevDB })

	created := time.Now()
	agent := Agent{
		ID:        "agent-1",
		Name:      "test-agent",
		TokenHash: "hash-old",
		Scopes:    []string{ScopeAppsRead},
		CreatedAt: created,
	}
	if err := dbSaveAgent(agent); err != nil {
		t.Fatal(err)
	}

	agent.TokenHash = "hash-new"
	agent.LastUsedAt = time.Time{}
	if err := dbSaveAgent(agent); err != nil {
		t.Fatal(err)
	}

	var storedHash string
	if err := db.QueryRow(`SELECT token_hash FROM agents WHERE id = ?`, agent.ID).Scan(&storedHash); err != nil {
		t.Fatal(err)
	}
	if storedHash != "hash-new" {
		t.Fatalf("stored hash = %q, want hash-new", storedHash)
	}

	// Ensure old hash is gone from the unique index.
	if _, err := db.Exec(`INSERT INTO agents (id, name, token_hash, scopes, created_at) VALUES ('agent-2', 'other', 'hash-old', '[]', ?)`, created); err != nil {
		t.Fatalf("expected old hash to be reusable after rotation: %v", err)
	}
}
