package main

import (
	"fmt"
	"log"
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
	cpu    float64
	memory float64
	disk   float64
}

var (
	hostMetricsLock sync.RWMutex
	allHostMetrics  = make(map[string]hostMetrics)
)

const metricsSampleInterval = 2 * time.Second

// startMetricsSampler launches the background sampler. Safe to call once at
// startup. The first CPU reading primes gopsutil's internal counters.
func startMetricsSampler() {
	// Prime local CPU counters
	_, _ = cpu.Percent(0, false)

	go func() {
		ticker := time.NewTicker(metricsSampleInterval)
		defer ticker.Stop()
		for range ticker.C {
			sampleOnce()
		}
	}()
}

// sampleOnce reads CPU, memory, and disk for all servers.
func sampleOnce() {
	servers, err := dbLoadServers()
	if err != nil {
		log.Printf("[stats] failed to list servers: %v", err)
		return
	}

	hasLocal := false
	for _, s := range servers {
		if s.IsLocal || s.ID == "localhost" {
			hasLocal = true
			break
		}
	}
	if !hasLocal {
		servers = append(servers, Server{ID: "localhost", IsLocal: true})
	}

	var wg sync.WaitGroup
	for _, srv := range servers {
		wg.Add(1)
		go func(s Server) {
			defer wg.Done()
			var c, m, d float64
			var sampleErr error

			if s.IsLocal || s.ID == "localhost" {
				// Local sampling
				if pcts, err := cpu.Percent(0, false); err == nil && len(pcts) > 0 {
					c = pcts[0]
				} else if err != nil {
					sampleErr = fmt.Errorf("cpu: %w", err)
				}

				if vm, err := mem.VirtualMemory(); err == nil && vm != nil {
					m = vm.UsedPercent
				} else if err != nil {
					sampleErr = fmt.Errorf("mem: %w", err)
				}

				if du, err := disk.Usage("/"); err == nil && du != nil {
					d = du.UsedPercent
				} else if err != nil {
					sampleErr = fmt.Errorf("disk: %w", err)
				}
			} else {
				// Remote sampling
				exec, err := GetExecutorForServer(s.ID)
				if err != nil {
					sampleErr = err
				} else {
					if sshExec, ok := exec.(*SSHExecutor); ok {
						defer sshExec.Close()
					}
					c, m, d, sampleErr = sampleRemoteHost(exec)
				}
			}

			hostMetricsLock.Lock()
			if sampleErr == nil {
				allHostMetrics[s.ID] = hostMetrics{cpu: c, memory: m, disk: d}
			} else {
				log.Printf("[stats] server %s sample failed: %v", s.ID, sampleErr)
			}
			hostMetricsLock.Unlock()
		}(srv)
	}
	wg.Wait()
}

// readMetrics returns the most recent cached CPU/memory/disk percentages.
func readMetrics(serverID string) (cpuPct, memPct, diskPct float64) {
	if serverID == "" {
		serverID = "localhost"
	}
	hostMetricsLock.RLock()
	defer hostMetricsLock.RUnlock()
	m, ok := allHostMetrics[serverID]
	if !ok {
		return 0, 0, 0
	}
	return m.cpu, m.memory, m.disk
}

func sampleRemoteHost(exec Executor) (cpu, mem, disk float64, err error) {
	// 1. Disk
	diskOut, err := exec.RunCommand("df", "-h", "/")
	if err == nil {
		lines := strings.Split(strings.TrimSpace(diskOut), "\n")
		if len(lines) >= 2 {
			fields := strings.Fields(lines[len(lines)-1])
			if len(fields) >= 5 {
				pctStr := strings.TrimSuffix(fields[4], "%")
				if d, err := strconv.ParseFloat(pctStr, 64); err == nil {
					disk = d
				}
			}
		}
	}

	// 2. Memory
	memOut, err := exec.RunCommand("cat", "/proc/meminfo")
	if err == nil {
		var total, available float64
		for _, line := range strings.Split(memOut, "\n") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				if parts[0] == "MemTotal:" {
					total, _ = strconv.ParseFloat(parts[1], 64)
				} else if parts[0] == "MemAvailable:" {
					available, _ = strconv.ParseFloat(parts[1], 64)
				}
			}
		}
		if total > 0 {
			mem = (total - available) / total * 100
		}
	}

	// 3. CPU
	cpuOut1, err1 := exec.RunCommand("cat", "/proc/stat")
	time.Sleep(500 * time.Millisecond)
	cpuOut2, err2 := exec.RunCommand("cat", "/proc/stat")
	if err1 == nil && err2 == nil {
		t1, id1 := parseProcStat(cpuOut1)
		t2, id2 := parseProcStat(cpuOut2)
		if t2-t1 > 0 {
			cpu = (1.0 - (id2-id1)/(t2-t1)) * 100
		}
	}

	return cpu, mem, disk, nil
}

func parseProcStat(out string) (total, idle float64) {
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Fields(line)
		if len(fields) > 0 && fields[0] == "cpu" {
			var sum float64
			for i := 1; i < len(fields); i++ {
				val, _ := strconv.ParseFloat(fields[i], 64)
				sum += val
				if i == 4 { // idle
					idle = val
				}
				if i == 5 { // iowait
					idle += val
				}
			}
			total = sum
			return
		}
	}
	return
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
	servers, err := dbLoadServers()
	if err != nil {
		log.Printf("[stats] failed to list servers: %v", err)
		return []PerAppMetrics{}
	}

	hasLocal := false
	for _, s := range servers {
		if s.IsLocal || s.ID == "localhost" {
			hasLocal = true
			break
		}
	}
	if !hasLocal {
		servers = append(servers, Server{ID: "localhost", IsLocal: true})
	}

	appsLock.Lock()
	idToName := map[string]string{}
	for _, a := range apps {
		idToName[a.ID] = a.Name
	}
	appsLock.Unlock()

	var wg sync.WaitGroup
	var resultsLock sync.Mutex
	var results []PerAppMetrics

	for _, srv := range servers {
		wg.Add(1)
		go func(s Server) {
			defer wg.Done()
			srvMetrics := collectServerPerAppMetrics(s, idToName)
			if len(srvMetrics) > 0 {
				resultsLock.Lock()
				results = append(results, srvMetrics...)
				resultsLock.Unlock()
			}
		}(srv)
	}
	wg.Wait()

	if results == nil {
		results = []PerAppMetrics{}
	}
	return results
}

func collectServerPerAppMetrics(s Server, idToName map[string]string) []PerAppMetrics {
	exec, err := GetExecutorForServer(s.ID)
	if err != nil {
		log.Printf("[stats] failed to get executor for server %s: %v", s.ID, err)
		return nil
	}
	if sshExec, ok := exec.(*SSHExecutor); ok {
		defer sshExec.Close()
	}

	// Map containerID/name → appID via labels.
	out, err := exec.RunCommand("docker", "ps",
		"--filter", "label=better-paas-app",
		"--format", "{{.Names}}\t{{.Label \"better-paas-app\"}}")
	if err != nil {
		return nil
	}
	nameToApp := map[string]string{}
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) == 2 {
			nameToApp[parts[0]] = parts[1]
		}
	}

	// Compose-service rows don't carry the better-paas-app label, so map their
	// resolved container name → appID directly.
	appsLock.Lock()
	for _, a := range apps {
		sID := a.ServerID
		if sID == "" {
			sID = "localhost"
		}
		if sID == s.ID && a.ComposeProject != "" && a.ActiveContainer != "" {
			nameToApp[a.ActiveContainer] = a.ID
		}
	}
	appsLock.Unlock()

	if len(nameToApp) == 0 {
		return nil
	}

	statsOut, err := exec.RunCommand("docker", "stats", "--no-stream",
		"--format", "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}")
	if err != nil {
		return nil
	}

	var result []PerAppMetrics
	for _, line := range strings.Split(strings.TrimSpace(statsOut), "\n") {
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
