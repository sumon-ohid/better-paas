package main

import (
	"fmt"
	"path/filepath"
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

// validateBuildMethod normalizes and validates the build method and Dockerfile
// path. Returns the normalized (method, dockerfilePath). An empty method
// defaults to "nixpacks". The Dockerfile path is constrained to a safe relative
// path (no absolute paths or "..") since it is joined onto the clone dir.
func validateBuildMethod(method, dockerfilePath string) (string, string, error) {
	method = strings.TrimSpace(strings.ToLower(method))
	if method == "" {
		method = "nixpacks"
	}
	switch method {
	case "nixpacks":
		return method, "", nil
	case "compose":
		return "", "", fmt.Errorf("docker compose builds are not supported yet")
	case "dockerfile":
		path := strings.TrimSpace(dockerfilePath)
		if path == "" {
			path = "Dockerfile"
		}
		if !safeRelPath(path) {
			return "", "", fmt.Errorf("invalid Dockerfile path: must be a relative path inside the repo")
		}
		return method, path, nil
	default:
		return "", "", fmt.Errorf("invalid build method %q (use nixpacks or dockerfile)", method)
	}
}

// safeRelPath reports whether p is a relative path that stays within its base
// (no leading slash, no "." escape via ".." segments).
func safeRelPath(p string) bool {
	p = strings.TrimSpace(p)
	if p == "" || strings.HasPrefix(p, "/") || strings.HasPrefix(p, "~") {
		return false
	}
	// Reject any ".." segment.
	for _, seg := range strings.Split(filepath.ToSlash(p), "/") {
		if seg == ".." {
			return false
		}
	}
	return true
}
