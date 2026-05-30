package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Version & self-update
// ---------------------------------------------------------------------------
//
// `version` is injected at build time:
//   go build -ldflags "-X main.version=v1.2.3" -o server .
// When unset (e.g. `go run`), it falls back to "dev", which the update checker
// treats as "always older than any release" so dev builds can still test the
// check flow.
//
// Update checking queries the GitHub Releases API for the configured repo and
// compares semantic versions. Applying an update is handled separately (see
// update.go) and is deliberately conservative: back up first, then hand off to
// an external script so the running server isn't replacing itself mid-request.

var version = "dev"

// updateRepoSlug is the "owner/repo" used to look up releases. It can be
// overridden at runtime via the UPDATE_REPO env var or the meta table, so a
// fork doesn't have to recompile to point at its own releases.
const updateRepoMetaKey = "update_repo"

func updateRepoSlug() string {
	if v := strings.TrimSpace(os.Getenv("UPDATE_REPO")); v != "" {
		return v
	}
	if v := strings.TrimSpace(dbGetMeta(updateRepoMetaKey)); v != "" {
		return v
	}
	// Fallback: derive owner/repo from the git remote of the checkout, so
	// installs that predate the UPDATE_REPO env var still work without manual
	// configuration.
	if slug := slugFromGitRemote(); slug != "" {
		return slug
	}
	return "" // unconfigured
}

// slugFromGitRemote reads the origin remote URL of the repo checkout and
// extracts an "owner/repo" slug. Returns "" when not a git checkout or the
// remote isn't a recognizable host URL.
func slugFromGitRemote() string {
	out, err := exec.Command("git", "-C", repoDir(), "config", "--get", "remote.origin.url").Output()
	if err != nil {
		return ""
	}
	return parseRepoSlug(strings.TrimSpace(string(out)))
}

// parseRepoSlug normalizes common git remote URL shapes into "owner/repo":
//   git@github.com:owner/repo.git
//   https://github.com/owner/repo.git
//   https://github.com/owner/repo
func parseRepoSlug(remote string) string {
	s := strings.TrimSpace(remote)
	if s == "" {
		return ""
	}
	s = strings.TrimSuffix(s, ".git")
	// scp-like: git@host:owner/repo
	if i := strings.Index(s, ":"); strings.HasPrefix(s, "git@") && i >= 0 {
		s = s[i+1:]
		return cleanSlug(s)
	}
	// URL form: scheme://host/owner/repo
	if i := strings.Index(s, "://"); i >= 0 {
		rest := s[i+3:]
		if j := strings.Index(rest, "/"); j >= 0 {
			return cleanSlug(rest[j+1:])
		}
	}
	return ""
}

// cleanSlug keeps only the first two path segments (owner/repo) and validates
// that both are present.
func cleanSlug(s string) string {
	s = strings.Trim(s, "/")
	parts := strings.Split(s, "/")
	if len(parts) < 2 || parts[0] == "" || parts[1] == "" {
		return ""
	}
	return parts[0] + "/" + parts[1]
}

// ---------------------------------------------------------------------------
// Semantic version comparison
// ---------------------------------------------------------------------------

// semver is a parsed major.minor.patch (pre-release/build metadata ignored for
// ordering beyond stripping it).
type semver struct {
	major, minor, patch int
	valid               bool
}

// parseSemver parses strings like "v1.2.3", "1.2", "1.2.3-rc1". Missing
// components default to 0. Returns valid=false when no leading number is found.
func parseSemver(s string) semver {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "v")
	// Drop pre-release / build metadata for ordering purposes.
	if i := strings.IndexAny(s, "-+"); i >= 0 {
		s = s[:i]
	}
	if s == "" {
		return semver{}
	}
	parts := strings.Split(s, ".")
	out := semver{valid: true}
	for i := 0; i < len(parts) && i < 3; i++ {
		n, err := strconv.Atoi(strings.TrimSpace(parts[i]))
		if err != nil {
			if i == 0 {
				return semver{} // not a version at all
			}
			break
		}
		switch i {
		case 0:
			out.major = n
		case 1:
			out.minor = n
		case 2:
			out.patch = n
		}
	}
	return out
}

// compareSemver returns -1 if a<b, 0 if equal, 1 if a>b.
func compareSemver(a, b semver) int {
	if a.major != b.major {
		return signInt(a.major - b.major)
	}
	if a.minor != b.minor {
		return signInt(a.minor - b.minor)
	}
	return signInt(a.patch - b.patch)
}

func signInt(n int) int {
	switch {
	case n < 0:
		return -1
	case n > 0:
		return 1
	default:
		return 0
	}
}

// isNewer reports whether candidate is a strictly newer release than current.
// A "dev" current build is always considered older so the flow is testable.
func isNewer(current, candidate string) bool {
	cand := parseSemver(candidate)
	if !cand.valid {
		return false
	}
	cur := parseSemver(current)
	if !cur.valid {
		// "dev" or unparseable current → any valid release counts as newer.
		return true
	}
	return compareSemver(cur, cand) < 0
}

// ---------------------------------------------------------------------------
// GitHub release lookup (cached)
// ---------------------------------------------------------------------------

type releaseInfo struct {
	TagName     string    `json:"tagName"`
	Name        string    `json:"name"`
	Notes       string    `json:"notes"`
	URL         string    `json:"url"`
	PublishedAt time.Time `json:"publishedAt"`
}

type updateStatus struct {
	Current    string       `json:"current"`
	Latest     string       `json:"latest"`
	HasUpdate  bool         `json:"hasUpdate"`
	Configured bool         `json:"configured"`
	Release    *releaseInfo `json:"release,omitempty"`
	CheckedAt  time.Time    `json:"checkedAt"`
}

var (
	updateCacheLock sync.Mutex
	updateCache     *updateStatus
	updateCacheTime time.Time
)

const updateCacheTTL = 30 * time.Minute

// checkForUpdate returns the current/latest version status, hitting the GitHub
// Releases API at most once per updateCacheTTL (unless force is set).
func checkForUpdate(force bool) (*updateStatus, error) {
	updateCacheLock.Lock()
	defer updateCacheLock.Unlock()

	if !force && updateCache != nil && time.Since(updateCacheTime) < updateCacheTTL {
		return updateCache, nil
	}

	slug := updateRepoSlug()
	status := &updateStatus{
		Current:    version,
		Configured: slug != "",
		CheckedAt:  time.Now(),
	}
	if slug == "" {
		updateCache = status
		updateCacheTime = time.Now()
		return status, nil
	}

	rel, err := fetchLatestRelease(slug)
	if err != nil {
		return nil, err
	}
	status.Latest = rel.TagName
	status.Release = rel
	status.HasUpdate = isNewer(version, rel.TagName)

	updateCache = status
	updateCacheTime = time.Now()
	return status, nil
}

// fetchLatestRelease queries the GitHub Releases API for the newest release.
func fetchLatestRelease(slug string) (*releaseInfo, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", slug)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "better-paas-updater")
	// Use the stored GitHub token if present to avoid tight rate limits / reach
	// private release repos.
	if tok := decryptSecret(dbGetMeta("github_token")); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("no published releases found for %s", slug)
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("github releases API returned %d", resp.StatusCode)
	}

	var gh struct {
		TagName     string    `json:"tag_name"`
		Name        string    `json:"name"`
		Body        string    `json:"body"`
		HTMLURL     string    `json:"html_url"`
		PublishedAt time.Time `json:"published_at"`
		Draft       bool      `json:"draft"`
		Prerelease  bool      `json:"prerelease"`
	}
	if err := json.Unmarshal(body, &gh); err != nil {
		return nil, fmt.Errorf("could not parse release data: %w", err)
	}
	return &releaseInfo{
		TagName:     gh.TagName,
		Name:        gh.Name,
		Notes:       gh.Body,
		URL:         gh.HTMLURL,
		PublishedAt: gh.PublishedAt,
	}, nil
}
