package main

import (
	"log"
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
