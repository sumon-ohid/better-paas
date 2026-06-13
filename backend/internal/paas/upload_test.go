package paas

import "testing"

func TestSafeUploadPath(t *testing.T) {
	base := t.TempDir()
	got, err := safeUploadPath(base, "src/index.js")
	if err != nil {
		t.Fatalf("safeUploadPath returned error: %v", err)
	}
	wantSuffix := "src/index.js"
	if !stringsHasSuffix(got, wantSuffix) {
		t.Fatalf("safeUploadPath = %q, want suffix %q", got, wantSuffix)
	}

	if _, err := safeUploadPath(base, "../etc/passwd"); err == nil {
		t.Fatal("expected path traversal to be rejected")
	}
}

func stringsHasSuffix(s, suffix string) bool {
	return len(s) >= len(suffix) && s[len(s)-len(suffix):] == suffix
}

func TestCommonUploadRootPrefix(t *testing.T) {
	got := commonUploadRootPrefix([]string{"my-app/package.json", "my-app/src/index.js"})
	if got != "my-app" {
		t.Fatalf("commonUploadRootPrefix = %q, want my-app", got)
	}
	if commonUploadRootPrefix([]string{"a/x", "b/y"}) != "" {
		t.Fatal("expected empty prefix for mixed roots")
	}
}
