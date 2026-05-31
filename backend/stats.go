package main

import (
	"log"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/mem"
)

// ---------------------------------------------------------------------------
// Host metrics sampling
// ---------------------------------------------------------------------------
//
// CPU/memory/disk are sampled by a single background goroutine and cached, for
// two reasons:
//
//  1. Correctness: gopsutil's CPU percentage is computed as a delta between
//     successive calls. If every WebSocket connection called it independently
//     the readings would interfere with each other. One sampler keeps the
//     delta window consistent.
//  2. Cost: df / proc reads are cheap but not free; sampling once and fanning
//     the result out to all subscribers avoids redundant work.
//
// Readings are best-effort: if a probe fails we keep the last known value
// rather than reporting a misleading zero.

type hostMetrics struct {
	mu     sync.RWMutex
	cpu    float64
	memory float64
	disk   float64
	ready  bool // true once at least one successful sample has landed
}

var metrics hostMetrics

const metricsSampleInterval = 2 * time.Second

// startMetricsSampler launches the background sampler. Safe to call once at
// startup. The first CPU reading primes gopsutil's internal counters.
func startMetricsSampler() {
	// Prime the CPU delta counters; the first real reading follows one interval
	// later and will be meaningful rather than 0.
	_, _ = cpu.Percent(0, false)

	go func() {
		ticker := time.NewTicker(metricsSampleInterval)
		defer ticker.Stop()
		for range ticker.C {
			sampleOnce()
		}
	}()
}

// sampleOnce reads CPU, memory, and disk, updating the cache for any value it
// can obtain. Failures leave the previous value intact.
func sampleOnce() {
	metrics.mu.Lock()
	defer metrics.mu.Unlock()

	if pcts, err := cpu.Percent(0, false); err == nil && len(pcts) > 0 {
		metrics.cpu = pcts[0]
		metrics.ready = true
	} else if err != nil {
		log.Printf("[stats] cpu sample failed: %v", err)
	}

	if vm, err := mem.VirtualMemory(); err == nil && vm != nil {
		metrics.memory = vm.UsedPercent
		metrics.ready = true
	} else if err != nil {
		log.Printf("[stats] memory sample failed: %v", err)
	}

	if du, err := disk.Usage("/"); err == nil && du != nil {
		metrics.disk = du.UsedPercent
	} else if err != nil {
		log.Printf("[stats] disk sample failed: %v", err)
	}
}

// readMetrics returns the most recent cached CPU/memory/disk percentages.
func readMetrics() (cpuPct, memPct, diskPct float64) {
	metrics.mu.RLock()
	defer metrics.mu.RUnlock()
	return metrics.cpu, metrics.memory, metrics.disk
}

// ---------------------------------------------------------------------------
// Per-app (per-container) metrics
// ---------------------------------------------------------------------------
//
// `docker stats --no-stream` gives a one-shot CPU/memory/network snapshot for
// all running containers. We map the better-paas-app label back to app IDs so
// the dashboard can show usage per app. This is read on demand (the call takes
// ~1s) rather than sampled continuously.

func collectPerAppMetrics() []PerAppMetrics {
	// Map containerID/name → appID via labels.
	out, err := exec.Command("docker", "ps",
		"--filter", "label=better-paas-app",
		"--format", "{{.Names}}\t{{.Label \"better-paas-app\"}}").Output()
	if err != nil {
		return []PerAppMetrics{}
	}
	nameToApp := map[string]string{}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) == 2 {
			nameToApp[parts[0]] = parts[1]
		}
	}

	// Compose-service rows don't carry the better-paas-app label (compose owns
	// the container), so map their resolved container name → appID directly.
	appsLock.Lock()
	for _, a := range apps {
		if a.ComposeProject != "" && a.ActiveContainer != "" {
			nameToApp[a.ActiveContainer] = a.ID
		}
	}
	appsLock.Unlock()

	if len(nameToApp) == 0 {
		return []PerAppMetrics{}
	}

	statsOut, err := exec.Command("docker", "stats", "--no-stream",
		"--format", "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}").Output()
	if err != nil {
		return []PerAppMetrics{}
	}

	// Resolve app names for display.
	appsLock.Lock()
	idToName := map[string]string{}
	for _, a := range apps {
		idToName[a.ID] = a.Name
	}
	appsLock.Unlock()

	var result []PerAppMetrics
	for _, line := range strings.Split(strings.TrimSpace(string(statsOut)), "\n") {
		if line == "" {
			continue
		}
		f := strings.Split(line, "\t")
		if len(f) < 5 {
			continue
		}
		appID, ok := nameToApp[f[0]]
		if !ok {
			continue
		}
		memUsage, memLimit := parseMemUsage(f[2])
		rx, tx := parseNetIO(f[4])
		result = append(result, PerAppMetrics{
			AppID:      appID,
			Name:       idToName[appID],
			CPUPercent: parsePercent(f[1]),
			MemUsageMB: memUsage,
			MemLimitMB: memLimit,
			MemPercent: parsePercent(f[3]),
			NetRxMB:    rx,
			NetTxMB:    tx,
		})
	}
	if result == nil {
		result = []PerAppMetrics{}
	}
	return result
}

// parsePercent parses strings like "12.34%" into a float.
func parsePercent(s string) float64 {
	s = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(s), "%"))
	v, _ := strconv.ParseFloat(s, 64)
	return v
}

// parseMemUsage parses "12.3MiB / 1.95GiB" into (usedMB, limitMB).
func parseMemUsage(s string) (float64, float64) {
	parts := strings.Split(s, "/")
	if len(parts) != 2 {
		return 0, 0
	}
	return toMB(parts[0]), toMB(parts[1])
}

// parseNetIO parses "1.2kB / 3.4MB" into (rxMB, txMB).
func parseNetIO(s string) (float64, float64) {
	parts := strings.Split(s, "/")
	if len(parts) != 2 {
		return 0, 0
	}
	return toMB(parts[0]), toMB(parts[1])
}

// toMB converts a docker size string (e.g. "12.3MiB", "1.95GB", "512kB") to MB.
func toMB(s string) float64 {
	s = strings.TrimSpace(s)
	mult := 1.0 / (1024 * 1024) // default: bytes
	switch {
	case strings.HasSuffix(s, "GiB"):
		s, mult = strings.TrimSuffix(s, "GiB"), 1024
	case strings.HasSuffix(s, "GB"):
		s, mult = strings.TrimSuffix(s, "GB"), 1000
	case strings.HasSuffix(s, "MiB"):
		s, mult = strings.TrimSuffix(s, "MiB"), 1
	case strings.HasSuffix(s, "MB"):
		s, mult = strings.TrimSuffix(s, "MB"), 1
	case strings.HasSuffix(s, "kiB"), strings.HasSuffix(s, "KiB"):
		s, mult = strings.TrimSuffix(strings.TrimSuffix(s, "kiB"), "KiB"), 1.0/1024
	case strings.HasSuffix(s, "kB"), strings.HasSuffix(s, "KB"):
		s, mult = strings.TrimSuffix(strings.TrimSuffix(s, "kB"), "KB"), 1.0/1000
	case strings.HasSuffix(s, "B"):
		s, mult = strings.TrimSuffix(s, "B"), 1.0/(1024*1024)
	}
	v, _ := strconv.ParseFloat(strings.TrimSpace(s), 64)
	return v * mult
}
