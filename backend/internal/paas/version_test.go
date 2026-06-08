package paas

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseSemver(t *testing.T) {
	cases := []struct {
		in                  string
		major, minor, patch int
		valid               bool
	}{
		{"v1.2.3", 1, 2, 3, true},
		{"1.2.3", 1, 2, 3, true},
		{"v2.0", 2, 0, 0, true},
		{"3", 3, 0, 0, true},
		{"v1.4.0-rc1", 1, 4, 0, true},
		{"1.2.3+build9", 1, 2, 3, true},
		{"dev", 0, 0, 0, false},
		{"", 0, 0, 0, false},
		{"vX.Y", 0, 0, 0, false},
	}
	for _, c := range cases {
		got := parseSemver(c.in)
		if got.valid != c.valid {
			t.Errorf("parseSemver(%q).valid=%v want %v", c.in, got.valid, c.valid)
			continue
		}
		if c.valid && (got.major != c.major || got.minor != c.minor || got.patch != c.patch) {
			t.Errorf("parseSemver(%q)=%d.%d.%d want %d.%d.%d", c.in,
				got.major, got.minor, got.patch, c.major, c.minor, c.patch)
		}
	}
}

func TestIsNewer(t *testing.T) {
	cases := []struct {
		current, candidate string
		want               bool
	}{
		{"v1.0.0", "v1.0.1", true},
		{"v1.0.0", "v1.1.0", true},
		{"v1.0.0", "v2.0.0", true},
		{"v1.2.0", "v1.2.0", false},
		{"v1.2.0", "v1.1.9", false},
		{"v2.0.0", "v1.9.9", false},
		{"dev", "v0.0.1", true},   // dev is always older than a real release
		{"dev", "garbage", false}, // ...unless the candidate isn't a version
		{"v1.0.0", "not-a-tag", false},
		{"1.0.0", "1.0.0", false},
	}
	for _, c := range cases {
		if got := isNewer(c.current, c.candidate); got != c.want {
			t.Errorf("isNewer(%q,%q)=%v want %v", c.current, c.candidate, got, c.want)
		}
	}
}

func TestShellSafe(t *testing.T) {
	// Metacharacters that could break out of the generated script are stripped.
	dangerous := "v1.0.0; rm -rf /`whoami`$(id)|cat>x"
	got := shellSafe(dangerous)
	for _, bad := range []string{";", "`", "$", "|", ">", "(", "\n"} {
		// note: ( and ) are not stripped (not in the set), so only check the set
		_ = bad
	}
	for _, mustNotContain := range []string{"`", "$", ";", "|", ">", "<", "\n", "\"", "'", "\\", "&"} {
		if containsRune(got, mustNotContain) {
			t.Errorf("shellSafe left dangerous char %q in %q", mustNotContain, got)
		}
	}
}

func containsRune(s, sub string) bool {
	for _, r := range s {
		if string(r) == sub {
			return true
		}
	}
	return false
}

func TestParseRepoSlug(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"git@github.com:owner/repo.git", "owner/repo"},
		{"git@github.com:owner/repo", "owner/repo"},
		{"https://github.com/owner/repo.git", "owner/repo"},
		{"https://github.com/owner/repo", "owner/repo"},
		{"https://gitlab.com/group/sub/repo.git", "group/sub"}, // first two segments
		{"https://github.com/owner/repo/", "owner/repo"},
		{"", ""},
		{"not-a-url", ""},
		{"https://github.com/owner", ""}, // missing repo
	}
	for _, c := range cases {
		if got := parseRepoSlug(c.in); got != c.want {
			t.Errorf("parseRepoSlug(%q)=%q want %q", c.in, got, c.want)
		}
	}
}

func TestParseGitHubRepoSlug(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"git@github.com:owner/repo.git", "owner/repo"},
		{"https://github.com/owner/repo.git", "owner/repo"},
		{"https://token@github.com/owner/repo", "owner/repo"},
		{"github.com/owner/repo", "owner/repo"},
		{"https://gitlab.com/group/sub/repo.git", ""},
		{"https://github.com/owner", ""},
	}
	for _, c := range cases {
		if got := parseGitHubRepoSlug(c.in); got != c.want {
			t.Errorf("parseGitHubRepoSlug(%q)=%q want %q", c.in, got, c.want)
		}
	}
}

func TestLocalHealthURL(t *testing.T) {
	t.Setenv("LISTEN_ADDR", "")
	if got := localHealthURL(); got != "http://127.0.0.1:8080/api/health" {
		t.Errorf("default health URL = %q", got)
	}
	t.Setenv("LISTEN_ADDR", "127.0.0.1:9999")
	if got := localHealthURL(); got != "http://127.0.0.1:9999/api/health" {
		t.Errorf("custom port health URL = %q", got)
	}
}

func TestUpdateScriptPreservesFrontendBuildOnRollback(t *testing.T) {
	tmp := t.TempDir()
	oldWd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := os.Chdir(oldWd); err != nil {
			t.Fatalf("restore cwd: %v", err)
		}
	})

	repo := filepath.Join(tmp, "repo")
	for _, dir := range []string{
		filepath.Join(repo, ".git"),
		filepath.Join(repo, "backend", "data"),
		filepath.Join(repo, "frontend"),
	} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Chdir(filepath.Join(repo, "backend")); err != nil {
		t.Fatal(err)
	}

	scriptPath, err := writeUpdateScript("v9.9.9")
	if err != nil {
		t.Fatal(err)
	}
	script, err := os.ReadFile(scriptPath)
	if err != nil {
		t.Fatal(err)
	}
	got := string(script)
	for _, want := range []string{
		`FRONTEND_PREV_BUILD="$FRONTEND/.next.pre-update"`,
		"prepare_frontend_build",
		"restore_frontend_build",
		"discard_previous_frontend_build",
		`mv ".next" "$FRONTEND_PREV_BUILD"`,
		`mv "$FRONTEND_PREV_BUILD" ".next"`,
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("generated update script missing %q", want)
		}
	}
}
