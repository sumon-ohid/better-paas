package paas

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// TestWriteUpdateScriptSyntax renders the updater script and checks it is
// valid bash (bash -n), guarding against template/quoting regressions.
func TestWriteUpdateScriptSyntax(t *testing.T) {
	tmp := t.TempDir()
	oldWd, _ := os.Getwd()
	if err := os.Chdir(tmp); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(oldWd)
	if err := os.MkdirAll(filepath.Join(tmp, "data"), 0700); err != nil {
		t.Fatal(err)
	}

	path, err := writeUpdateScript("v1.2.3")
	if err != nil {
		t.Fatalf("writeUpdateScript: %v", err)
	}
	out, err := exec.Command("bash", "-n", path).CombinedOutput()
	if err != nil {
		t.Fatalf("bash -n failed: %v\n%s", err, out)
	}
}
