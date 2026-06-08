package paas

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Lightweight, privacy-friendly website analytics
// ---------------------------------------------------------------------------
//
// This gives every deployed app a Plausible/Umami-style visitor counter without
// the weight (or the privacy baggage) of a full analytics product. The design
// goals are:
//
//   * No cookies, no cross-site tracking, no persistent visitor IDs. A
//     visitor's "identity" for a given day is a salted hash of
//     (app, ip, user-agent) using a salt that ROTATES DAILY and is never
//     written to disk in a way that can be tied back to an individual. After
//     the day rolls over the salt is gone, so yesterday's hashes can't be
//     correlated with today's. Raw IPs are never stored.
//   * Cheap ingestion. A single INSERT per pageview into SQLite. Aggregation
//     happens at read time on the (indexed) events table.
//   * Drop-in. The operator copies a one-line <script> snippet into their site;
//     the backend serves the script and the collector endpoint.
//
// Retention is bounded by a background pruner (analyticsRetentionDays).

// analyticsRetentionDays is how long raw events are kept before pruning.
const analyticsRetentionDays = 90

// maxAnalyticsFieldLen caps stored string fields to keep junk/abuse bounded.
const maxAnalyticsFieldLen = 512

// analyticsTimeLayout is SQLite's canonical datetime format. We store and query
// analytics timestamps in this exact layout (UTC, no timezone suffix) for two
// reasons:
//
//  1. strftime() parses it natively, which the timeseries bucketing relies on.
//     Go's default time.Time string form ("... +0000 UTC") is NOT parseable by
//     strftime, so we must normalize on write.
//  2. It is fixed-width, so lexicographic ">=" / "<" comparisons (used for the
//     range filters and the retention pruner) order correctly.
const analyticsTimeLayout = "2006-01-02 15:04:05"

// analyticsTime formats a time for storage/comparison in the analytics table.
func analyticsTime(t time.Time) string {
	return t.UTC().Format(analyticsTimeLayout)
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

// runAnalyticsMigrations creates the events table. Called from initDB after the
// core migrations so analytics stays self-contained in this file.
func runAnalyticsMigrations() error {
	schema := `
CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id TEXT NOT NULL,
    visitor_hash TEXT NOT NULL,
    event TEXT NOT NULL,
    path TEXT NOT NULL,
    referrer_domain TEXT,
    browser TEXT,
    os TEXT,
    device TEXT,
    created_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_app_time ON analytics_events(app_id, created_at);
`
	_, err := sqliteDB.Exec(schema)
	return err
}

// ---------------------------------------------------------------------------
// Daily-rotating visitor salt
// ---------------------------------------------------------------------------

var (
	saltMu      sync.Mutex
	saltDate    string // YYYY-MM-DD the cached salt belongs to
	saltCurrent string
)

// dailyVisitorSalt returns the salt for today (UTC), generating and persisting
// it on first use. Persisting to the meta table means a same-day restart keeps
// visitor counts consistent; the value is meaningless once the day rolls over.
func dailyVisitorSalt() string {
	today := time.Now().UTC().Format("2006-01-02")

	saltMu.Lock()
	defer saltMu.Unlock()
	if saltDate == today && saltCurrent != "" {
		return saltCurrent
	}

	// Try to reuse a salt already persisted for today (survives restarts).
	metaKey := "analytics_salt"
	if sqliteDB != nil {
		if stored := dbGetMeta(metaKey); stored != "" {
			if parts := strings.SplitN(stored, ":", 2); len(parts) == 2 && parts[0] == today {
				saltDate, saltCurrent = today, parts[1]
				return saltCurrent
			}
		}
	}

	// Generate a fresh salt for today.
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// Fall back to a time-derived salt; uniqueness still holds per-day.
		saltCurrent = today + "-fallback-salt"
	} else {
		saltCurrent = hex.EncodeToString(b)
	}
	saltDate = today
	if sqliteDB != nil {
		_ = dbSetMeta(metaKey, today+":"+saltCurrent)
	}
	return saltCurrent
}

// visitorHash derives a per-day, non-reversible visitor identifier. It is
// stable for the same visitor within a UTC day and uncorrelatable across days.
func visitorHash(appID, ip, ua string) string {
	h := sha256.New()
	h.Write([]byte(dailyVisitorSalt()))
	h.Write([]byte{0})
	h.Write([]byte(appID))
	h.Write([]byte{0})
	h.Write([]byte(ip))
	h.Write([]byte{0})
	h.Write([]byte(ua))
	return hex.EncodeToString(h.Sum(nil))
}

// ---------------------------------------------------------------------------
// User-agent classification (deliberately coarse, no fingerprinting)
// ---------------------------------------------------------------------------

func classifyBrowser(ua string) string {
	u := strings.ToLower(ua)
	switch {
	case u == "":
		return "Unknown"
	case strings.Contains(u, "edg/") || strings.Contains(u, "edga") || strings.Contains(u, "edgios"):
		return "Edge"
	case strings.Contains(u, "opr/") || strings.Contains(u, "opera"):
		return "Opera"
	case strings.Contains(u, "firefox") || strings.Contains(u, "fxios"):
		return "Firefox"
	case strings.Contains(u, "chrome") || strings.Contains(u, "crios"):
		return "Chrome"
	case strings.Contains(u, "safari"):
		return "Safari"
	case strings.Contains(u, "bot") || strings.Contains(u, "crawl") || strings.Contains(u, "spider"):
		return "Bot"
	default:
		return "Other"
	}
}

func classifyOS(ua string) string {
	u := strings.ToLower(ua)
	switch {
	case u == "":
		return "Unknown"
	case strings.Contains(u, "windows"):
		return "Windows"
	case strings.Contains(u, "android"):
		return "Android"
	case strings.Contains(u, "iphone") || strings.Contains(u, "ipad") || strings.Contains(u, "ipod"):
		return "iOS"
	case strings.Contains(u, "mac os") || strings.Contains(u, "macintosh"):
		return "macOS"
	case strings.Contains(u, "cros"):
		return "ChromeOS"
	case strings.Contains(u, "linux"):
		return "Linux"
	default:
		return "Other"
	}
}

func classifyDevice(ua string) string {
	u := strings.ToLower(ua)
	switch {
	case strings.Contains(u, "ipad") || (strings.Contains(u, "android") && !strings.Contains(u, "mobile")):
		return "Tablet"
	case strings.Contains(u, "mobile") || strings.Contains(u, "iphone") || strings.Contains(u, "ipod"):
		return "Mobile"
	case u == "":
		return "Unknown"
	default:
		return "Desktop"
	}
}

// referrerDomain extracts the bare hostname from a referrer URL, dropping
// "www." and ignoring same-site referrers (which are just internal navigation).
// selfURL may be a full URL (e.g. the app's URL) or a bare host.
func referrerDomain(referrer, selfURL string) string {
	referrer = strings.TrimSpace(referrer)
	if referrer == "" {
		return ""
	}
	u, err := url.Parse(referrer)
	if err != nil || u.Host == "" {
		return ""
	}
	host := strings.ToLower(u.Hostname())
	host = strings.TrimPrefix(host, "www.")
	if host == "" || host == normalizeHost(selfURL) {
		return "" // self-referral → treat as direct
	}
	return host
}

// normalizeHost extracts a lowercase, www-stripped hostname from a value that
// may be a full URL or a bare host.
func normalizeHost(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	if s == "" {
		return ""
	}
	if strings.Contains(s, "://") {
		if u, err := url.Parse(s); err == nil && u.Hostname() != "" {
			s = u.Hostname()
		}
	} else if h, _, ok := strings.Cut(s, "/"); ok {
		s = h
	}
	return strings.TrimPrefix(s, "www.")
}

func truncateField(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > maxAnalyticsFieldLen {
		return s[:maxAnalyticsFieldLen]
	}
	return s
}

// cleanPath normalizes a tracked path: keeps only the path component, strips
// the query string, and bounds the length. A missing/odd value becomes "/".
func cleanPath(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "/"
	}
	// Accept either a full URL or a bare path.
	if u, err := url.Parse(raw); err == nil && u.Path != "" {
		raw = u.Path
	}
	if !strings.HasPrefix(raw, "/") {
		raw = "/" + raw
	}
	return truncateField(raw)
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

func dbInsertAnalyticsEvent(appID, visitor, event, path, refDomain, browser, os, device string) error {
	_, err := sqliteDB.Exec(`
		INSERT INTO analytics_events
			(app_id, visitor_hash, event, path, referrer_domain, browser, os, device, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, appID, visitor, event, path, refDomain, browser, os, device, analyticsTime(time.Now()))
	return err
}

func dbDeleteAnalyticsForApp(appID string) error {
	_, err := sqliteDB.Exec(`DELETE FROM analytics_events WHERE app_id = ?`, appID)
	return err
}

// ---------------------------------------------------------------------------
// Retention pruner
// ---------------------------------------------------------------------------

// startAnalyticsPruner periodically deletes events older than the retention
// window so the table can't grow without bound on a long-lived node.
func startAnalyticsPruner() {
	prune := func() {
		cutoff := time.Now().UTC().AddDate(0, 0, -analyticsRetentionDays)
		_, _ = sqliteDB.Exec(`DELETE FROM analytics_events WHERE created_at < ?`, analyticsTime(cutoff))
	}
	go func() {
		prune() // once at startup
		ticker := time.NewTicker(12 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			prune()
		}
	}()
}
