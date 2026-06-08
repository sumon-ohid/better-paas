package paas

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"strings"
	"testing"
)

// withTestCipher installs a deterministic in-memory AES-GCM cipher for the
// duration of a test, restoring the previous one afterward.
func withTestCipher(t *testing.T) {
	t.Helper()
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatalf("rand: %v", err)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		t.Fatalf("cipher: %v", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatalf("gcm: %v", err)
	}
	prev := secretAEAD
	secretAEAD = aead
	t.Cleanup(func() { secretAEAD = prev })
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	withTestCipher(t)

	secrets := []string{"ghp_token123", "a", strings.Repeat("x", 5000), "p@ss/word:1#%"}
	for _, s := range secrets {
		enc := encryptSecret(s)
		if enc == s {
			t.Errorf("encryptSecret(%q) returned plaintext", s)
		}
		if !strings.HasPrefix(enc, secretEnvelopePrefix) {
			t.Errorf("encryptSecret(%q) missing envelope prefix: %q", s, enc)
		}
		if got := decryptSecret(enc); got != s {
			t.Errorf("round trip failed: got %q, want %q", got, s)
		}
	}
}

func TestEncryptEmptyStaysEmpty(t *testing.T) {
	withTestCipher(t)
	if got := encryptSecret(""); got != "" {
		t.Errorf("encryptSecret(\"\") = %q, want \"\"", got)
	}
	if got := decryptSecret(""); got != "" {
		t.Errorf("decryptSecret(\"\") = %q, want \"\"", got)
	}
}

func TestDecryptLegacyCleartextPassthrough(t *testing.T) {
	withTestCipher(t)
	// Values stored before encryption was introduced have no envelope prefix
	// and must be returned unchanged so existing databases keep working.
	legacy := "ghp_legacy_plaintext_token"
	if got := decryptSecret(legacy); got != legacy {
		t.Errorf("decryptSecret(legacy) = %q, want %q", got, legacy)
	}
}

func TestEncryptProducesDistinctCiphertexts(t *testing.T) {
	withTestCipher(t)
	// A random nonce per call means identical plaintext yields different
	// ciphertext, which prevents equality/leak analysis on the stored column.
	a := encryptSecret("same-secret")
	b := encryptSecret("same-secret")
	if a == b {
		t.Errorf("expected distinct ciphertexts for repeated encryption (nonce reuse?)")
	}
	if decryptSecret(a) != "same-secret" || decryptSecret(b) != "same-secret" {
		t.Errorf("both ciphertexts must decrypt to the original")
	}
}

func TestDecodeKey(t *testing.T) {
	// 64-char hex
	hexKey := strings.Repeat("ab", 32)
	if _, err := decodeKey(hexKey); err != nil {
		t.Errorf("decodeKey(hex) failed: %v", err)
	}
	// wrong length
	if _, err := decodeKey("tooshort"); err == nil {
		t.Errorf("decodeKey(short) should fail")
	}
}
