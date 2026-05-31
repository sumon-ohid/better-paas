package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Public tracking script
// ---------------------------------------------------------------------------
//
// Served at GET /api/analytics/script.js. The operator embeds it on a deployed
// site with the app's ID:
//
//   <script defer data-site="<appId>"
//           src="https://<dashboard-host>:8080/api/analytics/script.js"></script>
//
// The script sends a pageview on load and on SPA navigations (history API +
// popstate). It uses navigator.sendBeacon when available so the request isn't
// cancelled by a page unload. No cookies, no localStorage, no fingerprinting.

const analyticsScript = `(function(){
  try {
    // document.currentScript works for a normal <script> the browser parses
    // from HTML. But framework loaders (Next.js next/script, etc.) inject the
    // tag dynamically, and currentScript is null for injected scripts — so we
    // fall back to locating our own tag by the script src path.
    var s = document.currentScript;
    if (!s) {
      var all = document.querySelectorAll('script[data-site][src*="/api/analytics/script.js"]');
      s = all[all.length - 1];
    }
    if (!s) return;
    var site = s.getAttribute('data-site');
    if (!site) return;
    var endpoint = new URL(s.src).origin + '/api/track';

    function send(){
      try {
        var payload = {
          s: site,
          p: location.pathname,
          r: document.referrer || ''
        };
        var body = JSON.stringify(payload);
        if (navigator.sendBeacon) {
          navigator.sendBeacon(endpoint, body);
        } else {
          fetch(endpoint, {method:'POST', body:body, keepalive:true, headers:{'Content-Type':'text/plain'}});
        }
      } catch (e) {}
    }

    // Initial pageview.
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      send();
    } else {
      window.addEventListener('DOMContentLoaded', send);
    }

    // SPA navigations: patch pushState/replaceState and listen for popstate.
    var last = location.pathname;
    function maybeSend(){
      if (location.pathname !== last) { last = location.pathname; send(); }
    }
    var push = history.pushState;
    history.pushState = function(){ push.apply(this, arguments); maybeSend(); };
    var replace = history.replaceState;
    history.replaceState = function(){ replace.apply(this, arguments); maybeSend(); };
    window.addEventListener('popstate', maybeSend);
  } catch (e) {}
})();`

func handleAnalyticsScript(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	// Cache for an hour: the script is static and small.
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	_, _ = w.Write([]byte(analyticsScript))
}

// ---------------------------------------------------------------------------
// Public collector: POST /api/track
// ---------------------------------------------------------------------------
//
// Called by the tracking script from arbitrary origins, so it is exempt from
// the admin auth gate (registered under a public prefix) and allows CORS from
// any origin. It is still covered by the global per-IP rate limiter and the
// body-size cap. Validation is strict: the site must map to a known app.

func handleTrack(w http.ResponseWriter, r *http.Request) {
	// CORS preflight / permissive origin (the script runs on third-party sites).
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Site     string `json:"s"`
		Path     string `json:"p"`
		Referrer string `json:"r"`
	}
	// sendBeacon posts as text/plain; decodeJSON handles the raw body fine.
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Swallow malformed beacons quietly — never surface errors to the
		// tracked site's console.
		w.WriteHeader(http.StatusNoContent)
		return
	}

	req.Site = strings.TrimSpace(req.Site)
	if req.Site == "" {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// The site must correspond to a real app, otherwise drop it. This stops
	// strangers from stuffing the events table with arbitrary site IDs.
	app := findApp(req.Site)
	if app == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	ua := r.Header.Get("User-Agent")
	ip := clientIP(r)
	visitor := visitorHash(app.ID, ip, ua)

	path := cleanPath(req.Path)
	refDomain := truncateField(referrerDomain(req.Referrer, app.URL))
	browser := classifyBrowser(ua)
	osName := classifyOS(ua)
	device := classifyDevice(ua)

	if err := dbInsertAnalyticsEvent(app.ID, visitor, "pageview", path, refDomain, browser, osName, device); err != nil {
		// Best-effort: log internally, still return 204 to the beacon.
		w.WriteHeader(http.StatusNoContent)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// Authed query API: GET /api/analytics?id=<appId>&days=<n>
// ---------------------------------------------------------------------------

// AnalyticsBucket is one point on the pageviews/visitors timeseries.
type AnalyticsBucket struct {
	Date     string `json:"date"` // YYYY-MM-DD (or hour label for the 1-day range)
	Views    int    `json:"views"`
	Visitors int    `json:"visitors"`
}

// AnalyticsBreakdown is a labelled count used for top lists.
type AnalyticsBreakdown struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

// AnalyticsSummary is the full payload returned for one app.
type AnalyticsSummary struct {
	AppID         string               `json:"appId"`
	AppName       string               `json:"appName"`
	RangeDays     int                  `json:"rangeDays"`
	TotalViews    int                  `json:"totalViews"`
	TotalVisitors int                  `json:"totalVisitors"`
	Timeseries    []AnalyticsBucket    `json:"timeseries"`
	TopPages      []AnalyticsBreakdown `json:"topPages"`
	TopReferrers  []AnalyticsBreakdown `json:"topReferrers"`
	Browsers      []AnalyticsBreakdown `json:"browsers"`
	OS            []AnalyticsBreakdown `json:"os"`
	Devices       []AnalyticsBreakdown `json:"devices"`
}

func handleAnalyticsQuery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	appID := strings.TrimSpace(r.URL.Query().Get("id"))
	if appID == "" {
		jsonError(w, "id is required", http.StatusBadRequest)
		return
	}
	app := findApp(appID)
	if app == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}

	days := 7
	if d, err := strconv.Atoi(r.URL.Query().Get("days")); err == nil {
		days = d
	}
	switch days {
	case 1, 7, 30, 90:
		// allowed
	default:
		days = 7
	}

	since := time.Now().UTC().AddDate(0, 0, -days)
	if days == 1 {
		since = time.Now().UTC().Add(-24 * time.Hour)
	}
	sinceStr := analyticsTime(since)

	summary := AnalyticsSummary{
		AppID:     app.ID,
		AppName:   app.Name,
		RangeDays: days,
	}

	// Totals.
	_ = sqliteDB.QueryRow(`
		SELECT COUNT(*), COUNT(DISTINCT visitor_hash)
		FROM analytics_events WHERE app_id = ? AND created_at >= ?
	`, app.ID, sinceStr).Scan(&summary.TotalViews, &summary.TotalVisitors)

	summary.Timeseries = queryTimeseries(app.ID, sinceStr, days)
	summary.TopPages = queryBreakdown("path", app.ID, sinceStr, 10)
	summary.TopReferrers = queryReferrers(app.ID, sinceStr, 10)
	summary.Browsers = queryBreakdown("browser", app.ID, sinceStr, 8)
	summary.OS = queryBreakdown("os", app.ID, sinceStr, 8)
	summary.Devices = queryBreakdown("device", app.ID, sinceStr, 8)

	jsonOK(w, summary)
}

// queryTimeseries buckets events by hour (1-day range) or day (multi-day).
func queryTimeseries(appID, since string, days int) []AnalyticsBucket {
	// strftime grouping format and the bucket-label format must match so we can
	// pre-fill empty buckets for a continuous chart.
	hourly := days == 1
	groupFmt := "%Y-%m-%d"
	if hourly {
		groupFmt = "%Y-%m-%d %H:00"
	}

	rows, err := sqliteDB.Query(`
		SELECT strftime(`+"'"+groupFmt+"'"+`, created_at) AS bucket,
		       COUNT(*) AS views,
		       COUNT(DISTINCT visitor_hash) AS visitors
		FROM analytics_events
		WHERE app_id = ? AND created_at >= ?
		GROUP BY bucket
		ORDER BY bucket ASC
	`, appID, since)
	if err != nil {
		return []AnalyticsBucket{}
	}
	defer rows.Close()

	counts := map[string]AnalyticsBucket{}
	for rows.Next() {
		var b AnalyticsBucket
		if err := rows.Scan(&b.Date, &b.Views, &b.Visitors); err == nil {
			counts[b.Date] = b
		}
	}

	// Pre-fill the full range so the chart has no gaps.
	out := make([]AnalyticsBucket, 0, days)
	if hourly {
		start := time.Now().UTC().Add(-23 * time.Hour).Truncate(time.Hour)
		for i := 0; i < 24; i++ {
			key := start.Add(time.Duration(i) * time.Hour).Format("2006-01-02 15:00")
			if b, ok := counts[key]; ok {
				out = append(out, b)
			} else {
				out = append(out, AnalyticsBucket{Date: key})
			}
		}
	} else {
		start := time.Now().UTC().AddDate(0, 0, -(days - 1))
		for i := 0; i < days; i++ {
			key := start.AddDate(0, 0, i).Format("2006-01-02")
			if b, ok := counts[key]; ok {
				out = append(out, b)
			} else {
				out = append(out, AnalyticsBucket{Date: key})
			}
		}
	}
	return out
}

// queryBreakdown returns the top N values of a column. The column name is from
// a fixed allow-list (never user input) so interpolating it is safe.
func queryBreakdown(column, appID, since string, limit int) []AnalyticsBreakdown {
	switch column {
	case "path", "browser", "os", "device":
	default:
		return []AnalyticsBreakdown{}
	}
	rows, err := sqliteDB.Query(`
		SELECT `+column+` AS label, COUNT(*) AS c
		FROM analytics_events
		WHERE app_id = ? AND created_at >= ? AND `+column+` != ''
		GROUP BY label
		ORDER BY c DESC
		LIMIT ?
	`, appID, since, limit)
	if err != nil {
		return []AnalyticsBreakdown{}
	}
	defer rows.Close()
	return scanBreakdown(rows)
}

// queryReferrers is split out because empty referrers represent "Direct"
// traffic, which we surface explicitly rather than dropping.
func queryReferrers(appID, since string, limit int) []AnalyticsBreakdown {
	var direct int
	_ = sqliteDB.QueryRow(`
		SELECT COUNT(*) FROM analytics_events
		WHERE app_id = ? AND created_at >= ? AND (referrer_domain IS NULL OR referrer_domain = '')
	`, appID, since).Scan(&direct)

	rows, err := sqliteDB.Query(`
		SELECT referrer_domain AS label, COUNT(*) AS c
		FROM analytics_events
		WHERE app_id = ? AND created_at >= ? AND referrer_domain != ''
		GROUP BY label
		ORDER BY c DESC
		LIMIT ?
	`, appID, since, limit)
	if err != nil {
		return []AnalyticsBreakdown{}
	}
	defer rows.Close()
	out := scanBreakdown(rows)

	if direct > 0 {
		out = append(out, AnalyticsBreakdown{Label: "Direct / None", Count: direct})
	}
	return out
}

func scanBreakdown(rows *sql.Rows) []AnalyticsBreakdown {
	out := []AnalyticsBreakdown{}
	for rows.Next() {
		var b AnalyticsBreakdown
		var label sql.NullString
		if err := rows.Scan(&label, &b.Count); err == nil {
			b.Label = label.String
			out = append(out, b)
		}
	}
	return out
}

// ---------------------------------------------------------------------------
// Authed overview API: GET /api/analytics/overview?days=<n>
// ---------------------------------------------------------------------------
//
// A compact per-app rollup so the dashboard can show totals across every app
// without one request per app.

type AnalyticsOverviewRow struct {
	AppID    string `json:"appId"`
	AppName  string `json:"appName"`
	Views    int    `json:"views"`
	Visitors int    `json:"visitors"`
}

func handleAnalyticsOverview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	days := 7
	if d, err := strconv.Atoi(r.URL.Query().Get("days")); err == nil {
		switch d {
		case 1, 7, 30, 90:
			days = d
		}
	}
	since := time.Now().UTC().AddDate(0, 0, -days)
	if days == 1 {
		since = time.Now().UTC().Add(-24 * time.Hour)
	}
	sinceStr := analyticsTime(since)

	// Aggregate counts grouped by app.
	type agg struct {
		views    int
		visitors int
	}
	byApp := map[string]agg{}
	rows, err := sqliteDB.Query(`
		SELECT app_id, COUNT(*), COUNT(DISTINCT visitor_hash)
		FROM analytics_events WHERE created_at >= ?
		GROUP BY app_id
	`, sinceStr)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id string
			var a agg
			if err := rows.Scan(&id, &a.views, &a.visitors); err == nil {
				byApp[id] = a
			}
		}
	}

	// Join against the live app list so names are current and deleted apps drop
	// out of the overview.
	appsLock.Lock()
	out := make([]AnalyticsOverviewRow, 0, len(apps))
	for _, a := range apps {
		stat := byApp[a.ID]
		out = append(out, AnalyticsOverviewRow{
			AppID:    a.ID,
			AppName:  a.Name,
			Views:    stat.views,
			Visitors: stat.visitors,
		})
	}
	appsLock.Unlock()

	jsonOK(w, out)
}

// snippetForApp builds the embed snippet shown in the dashboard. Exposed via
// the summary endpoint's app metadata is overkill; the frontend composes it
// from the app ID + dashboard origin instead. Kept here for reference/tests.
func snippetForApp(origin, appID string) string {
	return fmt.Sprintf(
		`<script defer data-site="%s" src="%s/api/analytics/script.js"></script>`,
		appID, strings.TrimRight(origin, "/"),
	)
}
