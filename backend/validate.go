package main

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// ---------------------------------------------------------------------------
// Input validation for the new app fields
// ---------------------------------------------------------------------------

// memoryRe matches docker memory strings like "512m", "1g", "1024k", "2048b".
var memoryRe = regexp.MustCompile(`^[0-9]+(b|k|m|g)?$`)

// validateResourceLimits checks docker --memory / --cpus values. Empty means
// "no limit" and is always allowed.
func validateResourceLimits(memory, cpus string) error {
	memory = strings.TrimSpace(strings.ToLower(memory))
	if memory != "" && !memoryRe.MatchString(memory) {
		return fmt.Errorf("invalid memory limit %q: use forms like 256m, 512m, 1g", memory)
	}
	cpus = strings.TrimSpace(cpus)
	if cpus != "" {
		v, err := strconv.ParseFloat(cpus, 64)
		if err != nil || v <= 0 || v > 256 {
			return fmt.Errorf("invalid cpus %q: use a positive number like 0.5, 1, 2", cpus)
		}
	}
	return nil
}

// domainRe is a permissive hostname matcher (labels of letters/digits/hyphens).
var domainRe = regexp.MustCompile(`^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$`)

// validateDomains ensures each custom domain is a syntactically valid hostname.
// This matters because the values are written into the Caddyfile verbatim, so a
// malformed/hostile value could corrupt the proxy config.
func validateDomains(domains []string) error {
	for _, d := range domains {
		d = strings.TrimSpace(d)
		if d == "" {
			continue
		}
		if len(d) > 253 || !domainRe.MatchString(d) {
			return fmt.Errorf("invalid domain %q", d)
		}
	}
	return nil
}

// mergeEnvVars reconciles an incoming env map with the stored one. The frontend
// sends "***" for secret values it never received in cleartext; for those keys
// we keep the previously stored value instead of overwriting it with the mask.
func mergeEnvVars(existing, incoming map[string]string, secretKeys []string) map[string]string {
	if incoming == nil {
		return existing
	}
	secret := make(map[string]bool, len(secretKeys))
	for _, k := range secretKeys {
		secret[k] = true
	}
	out := make(map[string]string, len(incoming))
	for k, v := range incoming {
		if v == "***" && secret[k] {
			if old, ok := existing[k]; ok {
				out[k] = old
				continue
			}
		}
		out[k] = v
	}
	return out
}
