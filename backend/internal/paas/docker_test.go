package paas

import (
	"net/url"
	"strings"
	"testing"
)

func TestNormalizeGitURL(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"empty", "", ""},
		{"bare host adds https", "github.com/acme/app", "https://github.com/acme/app"},
		{"https preserved", "https://github.com/acme/app", "https://github.com/acme/app"},
		{"http preserved", "http://example.com/repo", "http://example.com/repo"},
		{"git scheme preserved", "git@github.com:acme/app.git", "git@github.com:acme/app.git"},
		{"absolute path preserved", "/srv/repos/app.git", "/srv/repos/app.git"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := normalizeGitURL(c.in); got != c.want {
				t.Errorf("normalizeGitURL(%q) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}

func TestFormatGitURL(t *testing.T) {
	t.Run("no token returns url unchanged", func(t *testing.T) {
		in := "https://github.com/acme/app"
		if got := formatGitURL(in, ""); got != in {
			t.Errorf("formatGitURL(%q, \"\") = %q, want unchanged", in, got)
		}
	})

	t.Run("https token injected", func(t *testing.T) {
		got := formatGitURL("https://github.com/acme/app", "tok123")
		want := "https://x-access-token:tok123@github.com/acme/app"
		if got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	})

	t.Run("http token injected", func(t *testing.T) {
		got := formatGitURL("http://example.com/repo", "tok123")
		want := "http://x-access-token:tok123@example.com/repo"
		if got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	})

	t.Run("schemeless gets https with token", func(t *testing.T) {
		got := formatGitURL("github.com/acme/app", "tok123")
		want := "https://x-access-token:tok123@github.com/acme/app"
		if got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	})

	t.Run("token with special chars is escaped", func(t *testing.T) {
		raw := "p@ss/word:1"
		got := formatGitURL("https://github.com/acme/app", raw)
		// The token must be URL-escaped so it doesn't corrupt the userinfo.
		if !strings.Contains(got, "x-access-token:"+url.QueryEscape(raw)) {
			t.Errorf("expected escaped token in %q", got)
		}
		if strings.Contains(got, raw) {
			t.Errorf("raw unescaped token leaked into %q", got)
		}
	})
}

func TestValidAppName(t *testing.T) {
	valid := []string{"ab", "my-app", "app1", "a1b2c3", "web-frontend-01", strings.Repeat("a", 40)}
	invalid := []string{
		"",                      // empty
		"a",                     // too short (min 2)
		"-app",                  // leading hyphen
		"app-",                  // trailing hyphen
		"App",                   // uppercase
		"my_app",                // underscore
		"../etc",                // path traversal
		"app/name",              // slash
		"app name",              // space
		strings.Repeat("a", 41), // too long (max 40)
	}
	for _, n := range valid {
		if !validAppName(n) {
			t.Errorf("validAppName(%q) = false, want true", n)
		}
	}
	for _, n := range invalid {
		if validAppName(n) {
			t.Errorf("validAppName(%q) = true, want false", n)
		}
	}
}

func TestAllocatePort(t *testing.T) {
	// allocatePort reads the global apps slice; isolate it for the test.
	appsLock.Lock()
	prev := apps
	apps = []App{
		{Port: 9000},
		{Port: 9001},
	}
	appsLock.Unlock()
	t.Cleanup(func() {
		appsLock.Lock()
		apps = prev
		appsLock.Unlock()
	})

	appsLock.Lock()
	p := allocatePort("localhost")
	appsLock.Unlock()

	if p < 9000 || p > 9999 {
		t.Fatalf("allocatePort() = %d, want in [9000,9999]", p)
	}
	if p == 9000 || p == 9001 {
		t.Fatalf("allocatePort() = %d, collided with an in-use port", p)
	}
}

func TestSecureIntn(t *testing.T) {
	if got := secureIntn(0); got != 0 {
		t.Errorf("secureIntn(0) = %d, want 0", got)
	}
	for i := 0; i < 1000; i++ {
		if got := secureIntn(10); got < 0 || got >= 10 {
			t.Fatalf("secureIntn(10) = %d, out of range [0,10)", got)
		}
	}
}
