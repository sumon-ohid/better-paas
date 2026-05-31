package main

import "testing"

func TestClassifyBrowser(t *testing.T) {
	cases := []struct{ ua, want string }{
		{"Mozilla/5.0 (Windows NT 10.0) Chrome/120.0", "Chrome"},
		{"Mozilla/5.0 (Macintosh) AppleWebKit Version/17.0 Safari/605", "Safari"},
		{"Mozilla/5.0 (Windows NT 10.0) Gecko Firefox/121.0", "Firefox"},
		{"Mozilla/5.0 Edg/120.0", "Edge"},
		{"Mozilla/5.0 OPR/106.0", "Opera"},
		{"Googlebot/2.1 (+http://www.google.com/bot.html)", "Bot"},
		{"", "Unknown"},
	}
	for _, c := range cases {
		if got := classifyBrowser(c.ua); got != c.want {
			t.Errorf("classifyBrowser(%q) = %q, want %q", c.ua, got, c.want)
		}
	}
}

func TestClassifyOSAndDevice(t *testing.T) {
	if got := classifyOS("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"); got != "iOS" {
		t.Errorf("classifyOS iPhone = %q, want iOS", got)
	}
	if got := classifyOS("Mozilla/5.0 (X11; Linux x86_64)"); got != "Linux" {
		t.Errorf("classifyOS Linux = %q, want Linux", got)
	}
	if got := classifyDevice("Mozilla/5.0 (iPhone) Mobile Safari"); got != "Mobile" {
		t.Errorf("classifyDevice iPhone = %q, want Mobile", got)
	}
	if got := classifyDevice("Mozilla/5.0 (iPad)"); got != "Tablet" {
		t.Errorf("classifyDevice iPad = %q, want Tablet", got)
	}
	if got := classifyDevice("Mozilla/5.0 (Windows NT 10.0) Chrome"); got != "Desktop" {
		t.Errorf("classifyDevice desktop = %q, want Desktop", got)
	}
}

func TestReferrerDomain(t *testing.T) {
	cases := []struct {
		referrer, self, want string
	}{
		{"https://www.google.com/search?q=x", "myapp.sslip.io", "google.com"},
		{"https://news.ycombinator.com/", "myapp.sslip.io", "news.ycombinator.com"},
		{"", "myapp.sslip.io", ""},
		{"not a url", "myapp.sslip.io", ""},
		// Self-referral should be treated as direct (empty).
		{"https://myapp.sslip.io/page", "http://myapp.sslip.io", ""},
	}
	for _, c := range cases {
		if got := referrerDomain(c.referrer, c.self); got != c.want {
			t.Errorf("referrerDomain(%q, %q) = %q, want %q", c.referrer, c.self, got, c.want)
		}
	}
}

func TestCleanPath(t *testing.T) {
	cases := []struct{ in, want string }{
		{"", "/"},
		{"/about", "/about"},
		{"about", "/about"},
		{"https://x.com/blog/post?utm=1", "/blog/post"},
		{"/search?q=hello", "/search"},
	}
	for _, c := range cases {
		if got := cleanPath(c.in); got != c.want {
			t.Errorf("cleanPath(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestVisitorHashStableAndScoped(t *testing.T) {
	a := visitorHash("app1", "1.2.3.4", "UA")
	b := visitorHash("app1", "1.2.3.4", "UA")
	if a != b {
		t.Error("visitorHash should be stable within the same day for identical inputs")
	}
	// Different app → different hash (no cross-app correlation).
	if visitorHash("app2", "1.2.3.4", "UA") == a {
		t.Error("visitorHash should differ across apps")
	}
	// Different IP → different hash.
	if visitorHash("app1", "5.6.7.8", "UA") == a {
		t.Error("visitorHash should differ across IPs")
	}
}

func TestSnippetForApp(t *testing.T) {
	got := snippetForApp("https://dash.example.com:8080/", "abc123")
	want := `<script defer data-site="abc123" src="https://dash.example.com:8080/api/analytics/script.js"></script>`
	if got != want {
		t.Errorf("snippetForApp = %q, want %q", got, want)
	}
}
