package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// ---------------------------------------------------------------------------
// At-rest encryption for stored secrets (deploy tokens, GitHub token)
// ---------------------------------------------------------------------------
//
// Deploy/GitHub tokens are credentials to third-party repos, so we never want
// them sitting in the SQLite file as cleartext. Every secret column is wrapped
// with AES-256-GCM before it is written and unwrapped on read.
//
// Key sourcing, in priority order:
//
//   1. BETTER_PAAS_SECRET_KEY — a 32-byte key (hex or base64). Supply this from
//      a secrets manager / systemd credential in production so the key never
//      touches the data directory.
//   2. data/secret.key — auto-generated on first run (mode 0600) for zero-config
//      self-hosting.
//
// Threat model: the on-disk key protects against leaked DB *copies* (backups,
// an accidental commit, a snapshot) — the secret.key file is separate and
// gitignored. It does NOT protect against an attacker who already has full read
// access to the data directory (they get both the DB and the key). For that,
// supply BETTER_PAAS_SECRET_KEY out-of-band. This tradeoff is documented in the
// README security notes.
//
// Stored format:  "enc:v1:" + base64(nonce || ciphertext)
// Values without the prefix are treated as legacy cleartext and returned as-is,
// so existing databases keep working and are transparently upgraded on the next
// write.

const secretEnvelopePrefix = "enc:v1:"

var (
	secretAEAD     cipher.AEAD
	secretKeyOnce  sync.Once
	secretKeyError error
)

// initSecretKey loads or provisions the encryption key and initializes the
// AES-GCM cipher. It must run before any secret is read from or written to the
// DB (i.e. before initDB's loadStateFromDB). Fatal on unrecoverable errors —
// continuing would mean silently mishandling credentials.
func initSecretKey() {
	secretKeyOnce.Do(func() {
		key, err := loadOrCreateSecretKey()
		if err != nil {
			secretKeyError = err
			log.Fatalf("[crypto] failed to initialize secret key: %v", err)
			return
		}
		block, err := aes.NewCipher(key)
		if err != nil {
			secretKeyError = err
			log.Fatalf("[crypto] failed to create cipher: %v", err)
			return
		}
		aead, err := cipher.NewGCM(block)
		if err != nil {
			secretKeyError = err
			log.Fatalf("[crypto] failed to create GCM: %v", err)
			return
		}
		secretAEAD = aead
	})
}

// loadOrCreateSecretKey returns a 32-byte key from the environment or the
// data/secret.key file, generating and persisting one if neither exists.
func loadOrCreateSecretKey() ([]byte, error) {
	if env := strings.TrimSpace(os.Getenv("BETTER_PAAS_SECRET_KEY")); env != "" {
		key, err := decodeKey(env)
		if err != nil {
			return nil, fmt.Errorf("BETTER_PAAS_SECRET_KEY: %w", err)
		}
		log.Println("[crypto] Using encryption key from BETTER_PAAS_SECRET_KEY.")
		return key, nil
	}

	path := filepath.Join("data", "secret.key")
	if data, err := os.ReadFile(path); err == nil {
		key, err := decodeKey(strings.TrimSpace(string(data)))
		if err != nil {
			return nil, fmt.Errorf("%s: %w", path, err)
		}
		return key, nil
	} else if !os.IsNotExist(err) {
		return nil, err
	}

	// First run: generate a fresh key and persist it owner-only.
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, fmt.Errorf("generate key: %w", err)
	}
	encoded := hex.EncodeToString(key)
	if err := os.WriteFile(path, []byte(encoded+"\n"), 0600); err != nil {
		return nil, fmt.Errorf("write %s: %w", path, err)
	}
	log.Printf("[crypto] Generated new encryption key at %s (mode 0600).", path)
	return key, nil
}

// decodeKey accepts a 32-byte key encoded as hex (64 chars) or base64.
func decodeKey(s string) ([]byte, error) {
	if len(s) == 64 {
		if b, err := hex.DecodeString(s); err == nil {
			return b, nil
		}
	}
	if b, err := base64.StdEncoding.DecodeString(s); err == nil && len(b) == 32 {
		return b, nil
	}
	if b, err := base64.RawStdEncoding.DecodeString(s); err == nil && len(b) == 32 {
		return b, nil
	}
	return nil, errors.New("key must be 32 bytes encoded as hex or base64")
}

// encryptSecret wraps plaintext for storage. Empty input stays empty (an absent
// token is not a secret). The result carries the versioned envelope prefix.
func encryptSecret(plaintext string) string {
	if plaintext == "" {
		return ""
	}
	if secretAEAD == nil {
		// Should never happen: initSecretKey runs at startup. Fail loud rather
		// than persisting cleartext.
		log.Printf("[crypto] WARNING: cipher not initialized; refusing to store secret in cleartext")
		return ""
	}
	nonce := make([]byte, secretAEAD.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		log.Printf("[crypto] failed to generate nonce: %v", err)
		return ""
	}
	ct := secretAEAD.Seal(nonce, nonce, []byte(plaintext), nil)
	return secretEnvelopePrefix + base64.StdEncoding.EncodeToString(ct)
}

// decryptSecret reverses encryptSecret. Values without the envelope prefix are
// assumed to be legacy cleartext and returned unchanged.
func decryptSecret(stored string) string {
	if stored == "" {
		return ""
	}
	if !strings.HasPrefix(stored, secretEnvelopePrefix) {
		return stored // legacy cleartext
	}
	if secretAEAD == nil {
		log.Printf("[crypto] WARNING: cipher not initialized; cannot decrypt secret")
		return ""
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(stored, secretEnvelopePrefix))
	if err != nil {
		log.Printf("[crypto] failed to base64-decode secret: %v", err)
		return ""
	}
	ns := secretAEAD.NonceSize()
	if len(raw) < ns {
		log.Printf("[crypto] stored secret too short")
		return ""
	}
	nonce, ct := raw[:ns], raw[ns:]
	pt, err := secretAEAD.Open(nil, nonce, ct, nil)
	if err != nil {
		log.Printf("[crypto] failed to decrypt secret (wrong key?): %v", err)
		return ""
	}
	return string(pt)
}
