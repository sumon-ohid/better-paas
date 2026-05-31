package main

import (
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Scheduled jobs (cron)
// ---------------------------------------------------------------------------
//
// A single scheduler goroutine wakes once a minute and runs any enabled job
// whose 5-field cron expression matches the current time. Each job executes a
// command inside the app's running container via `docker exec`.
//
// Supported cron syntax (5 fields: minute hour day-of-month month day-of-week):
//   *            any value
//   N            exact value
//   */N          every N
//   A,B,C        list
//   A-B          range
//
// This is intentionally minimal but covers the common cases (e.g. "0 * * * *",
// "*/15 * * * *", "30 2 * * 1-5").

// startCronScheduler launches the background scheduler loop.
func startCronScheduler() {
	go func() {
		// Align to the start of the next minute, then tick every minute.
		now := time.Now()
		time.Sleep(time.Duration(60-now.Second()) * time.Second)
		runDueCronJobs(time.Now())
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for t := range ticker.C {
			runDueCronJobs(t)
		}
	}()
}

// runDueCronJobs runs every enabled job whose schedule matches t.
func runDueCronJobs(t time.Time) {
	jobs, err := dbLoadCronJobs()
	if err != nil {
		return
	}
	for _, job := range jobs {
		if !job.Enabled {
			continue
		}
		if cronMatches(job.Schedule, t) {
			go runCronJob(job)
		}
	}
}

// runCronJob executes one job against its app's container.
func runCronJob(job CronJob) {
	app := findApp(job.AppID)
	if app == nil {
		log.Printf("[cron] job %s: app %s not found", job.ID, job.AppID)
		return
	}
	container := app.containerName()
	log.Printf("[cron] running job %s on %s: %s", job.ID, container, job.Command)

	cmd := exec.Command("docker", "exec", container, "sh", "-c", job.Command)
	out, err := cmd.CombinedOutput()

	job.LastRun = time.Now()
	if err != nil {
		job.LastStatus = "failed"
		log.Printf("[cron] job %s failed: %v — %s", job.ID, err, string(out))
	} else {
		job.LastStatus = "success"
	}
	if err := dbSaveCronJob(job); err != nil {
		log.Printf("[cron] failed to update job %s: %v", job.ID, err)
	}
}

// ---------------------------------------------------------------------------
// Minimal cron expression matching
// ---------------------------------------------------------------------------

// cronMatches reports whether a 5-field cron expression matches time t.
func cronMatches(expr string, t time.Time) bool {
	fields := strings.Fields(expr)
	if len(fields) != 5 {
		return false
	}
	return fieldMatches(fields[0], t.Minute(), 0, 59) &&
		fieldMatches(fields[1], t.Hour(), 0, 23) &&
		fieldMatches(fields[2], t.Day(), 1, 31) &&
		fieldMatches(fields[3], int(t.Month()), 1, 12) &&
		fieldMatches(fields[4], int(t.Weekday()), 0, 6)
}

// fieldMatches evaluates one cron field against a value.
func fieldMatches(field string, value, min, max int) bool {
	for _, part := range strings.Split(field, ",") {
		if part == "*" {
			return true
		}
		// Step: */N or A-B/N
		if strings.Contains(part, "/") {
			sp := strings.SplitN(part, "/", 2)
			step, err := strconv.Atoi(sp[1])
			if err != nil || step <= 0 {
				continue
			}
			lo, hi := min, max
			if sp[0] != "*" && strings.Contains(sp[0], "-") {
				lo, hi = parseRange(sp[0], min, max)
			}
			for v := lo; v <= hi; v += step {
				if v == value {
					return true
				}
			}
			continue
		}
		// Range: A-B
		if strings.Contains(part, "-") {
			lo, hi := parseRange(part, min, max)
			if value >= lo && value <= hi {
				return true
			}
			continue
		}
		// Exact value.
		if n, err := strconv.Atoi(part); err == nil && n == value {
			return true
		}
	}
	return false
}

func parseRange(s string, min, max int) (int, int) {
	parts := strings.SplitN(s, "-", 2)
	lo, err1 := strconv.Atoi(parts[0])
	hi, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return min, max
	}
	return lo, hi
}

// validCronExpr validates a 5-field cron expression: it checks the field count
// and that every field is structurally valid and within its allowed range, so
// an expression that could never fire (e.g. "99 99 99 99 99") is rejected at
// creation time rather than silently never running.
func validCronExpr(expr string) bool {
	fields := strings.Fields(expr)
	if len(fields) != 5 {
		return false
	}
	bounds := [5][2]int{
		{0, 59}, // minute
		{0, 23}, // hour
		{1, 31}, // day of month
		{1, 12}, // month
		{0, 6},  // day of week
	}
	for i, f := range fields {
		if !validCronField(f, bounds[i][0], bounds[i][1]) {
			return false
		}
	}
	return true
}

// validCronField reports whether one cron field is syntactically valid and
// within [min,max]. Supports the same grammar as fieldMatches: "*", exact
// values, lists (A,B,C), ranges (A-B), and steps (*/N or A-B/N).
func validCronField(field string, min, max int) bool {
	if field == "" {
		return false
	}
	for _, part := range strings.Split(field, ",") {
		if part == "" {
			return false
		}
		// Step: */N or A-B/N
		if strings.Contains(part, "/") {
			sp := strings.SplitN(part, "/", 2)
			step, err := strconv.Atoi(sp[1])
			if err != nil || step <= 0 {
				return false
			}
			base := sp[0]
			if base == "*" {
				continue
			}
			if strings.Contains(base, "-") {
				if !validCronRange(base, min, max) {
					return false
				}
				continue
			}
			return false // a step base must be "*" or a range
		}
		// Range: A-B
		if strings.Contains(part, "-") {
			if !validCronRange(part, min, max) {
				return false
			}
			continue
		}
		// Wildcard.
		if part == "*" {
			continue
		}
		// Exact value.
		n, err := strconv.Atoi(part)
		if err != nil || n < min || n > max {
			return false
		}
	}
	return true
}

// validCronRange validates an "A-B" range where min <= A <= B <= max.
func validCronRange(s string, min, max int) bool {
	parts := strings.SplitN(s, "-", 2)
	if len(parts) != 2 {
		return false
	}
	lo, err1 := strconv.Atoi(parts[0])
	hi, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return false
	}
	return lo >= min && hi <= max && lo <= hi
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

// GET /api/cron — list all jobs.
func handleCronList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jobs, err := dbLoadCronJobs()
	if err != nil {
		jsonError(w, "Failed to load cron jobs", http.StatusInternalServerError)
		return
	}
	if jobs == nil {
		jobs = []CronJob{}
	}
	jsonOK(w, jobs)
}

// POST /api/cron/create
func handleCronCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		AppID    string `json:"appId"`
		Schedule string `json:"schedule"`
		Command  string `json:"command"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	app := findApp(req.AppID)
	if app == nil {
		jsonError(w, "App not found", http.StatusNotFound)
		return
	}
	if !validCronExpr(req.Schedule) {
		jsonError(w, "Invalid cron schedule (expected 5 fields, e.g. '0 * * * *')", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Command) == "" {
		jsonError(w, "Command is required", http.StatusBadRequest)
		return
	}

	job := CronJob{
		ID:        generateRandomID(),
		AppID:     req.AppID,
		AppName:   app.Name,
		Schedule:  req.Schedule,
		Command:   req.Command,
		Enabled:   true,
		CreatedAt: time.Now(),
	}
	if err := dbSaveCronJob(job); err != nil {
		jsonError(w, fmt.Sprintf("Failed to save job: %v", err), http.StatusInternalServerError)
		return
	}
	jsonOK(w, job)
}

// POST /api/cron/update — toggle enabled / edit schedule+command.
func handleCronUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ID       string `json:"id"`
		Schedule string `json:"schedule"`
		Command  string `json:"command"`
		Enabled  *bool  `json:"enabled"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	jobs, _ := dbLoadCronJobs()
	var job *CronJob
	for i := range jobs {
		if jobs[i].ID == req.ID {
			job = &jobs[i]
			break
		}
	}
	if job == nil {
		jsonError(w, "Job not found", http.StatusNotFound)
		return
	}
	if req.Schedule != "" {
		if !validCronExpr(req.Schedule) {
			jsonError(w, "Invalid cron schedule", http.StatusBadRequest)
			return
		}
		job.Schedule = req.Schedule
	}
	if req.Command != "" {
		job.Command = req.Command
	}
	if req.Enabled != nil {
		job.Enabled = *req.Enabled
	}
	if err := dbSaveCronJob(*job); err != nil {
		jsonError(w, "Failed to update job", http.StatusInternalServerError)
		return
	}
	jsonOK(w, *job)
}

// POST /api/cron/delete
func handleCronDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	if err := dbDeleteCronJob(req.ID); err != nil {
		jsonError(w, "Failed to delete job", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "deleted"})
}

// POST /api/cron/run — run a job immediately (manual trigger).
func handleCronRunNow(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request", http.StatusBadRequest)
		return
	}
	jobs, _ := dbLoadCronJobs()
	for _, j := range jobs {
		if j.ID == req.ID {
			go runCronJob(j)
			jsonOK(w, map[string]string{"status": "started"})
			return
		}
	}
	jsonError(w, "Job not found", http.StatusNotFound)
}
