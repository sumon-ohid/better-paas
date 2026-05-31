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

// volumeEntryRe matches a docker volume mapping "source:/container/path" with an
// optional ":ro"/":rw" mode. The source is either a named volume
// (letters/digits/._-) or an absolute host path. The container path must be
// absolute. Values are passed to `docker run -v` as a single argv element (no
// shell), but we still reject shell-hostile characters as defense-in-depth.
var (
	namedVolumeRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]*$`)
)

// validateVolumes checks each "source:/path[:mode]" entry. Empty entries are
// skipped. The source may be a named volume or an absolute host path; the
// destination must be an absolute container path.
func validateVolumes(volumes []string) error {
	for _, v := range volumes {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if strings.ContainsAny(v, " \t\n\r;&|$`<>(){}\"'") {
			return fmt.Errorf("invalid volume %q: contains illegal characters", v)
		}
		parts := strings.Split(v, ":")
		if len(parts) < 2 || len(parts) > 3 {
			return fmt.Errorf("invalid volume %q: use source:/container/path[:ro]", v)
		}
		src, dst := parts[0], parts[1]
		if src == "" || dst == "" {
			return fmt.Errorf("invalid volume %q: source and container path are required", v)
		}
		// Source: named volume or absolute host path.
		if !strings.HasPrefix(src, "/") && !namedVolumeRe.MatchString(src) {
			return fmt.Errorf("invalid volume source %q: use a named volume or an absolute path", src)
		}
		// Destination must be an absolute path inside the container.
		if !strings.HasPrefix(dst, "/") {
			return fmt.Errorf("invalid volume target %q: must be an absolute container path", dst)
		}
		if len(parts) == 3 && parts[2] != "ro" && parts[2] != "rw" {
			return fmt.Errorf("invalid volume mode %q: use ro or rw", parts[2])
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
	case "image":
		// Prebuilt-image deploys (catalog one-click apps). No Dockerfile path.
		return method, "", nil
	case "dockerfile-inline":
		// Inline-Dockerfile deploys (no repo). The Dockerfile content is stored
		// on the app, not a path; nothing to validate here.
		return method, "", nil
	case "compose":
		// Docker Compose deploys. The compose file path is validated separately
		// via validateComposePath (it lives in a different request field).
		return method, "", nil
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
		return "", "", fmt.Errorf("invalid build method %q (use nixpacks, dockerfile, or compose)", method)
	}
}

// validateComposePath normalizes and validates a compose file path. An empty
// path is allowed (the deployer auto-detects the file in the repo); a provided
// path is constrained to a safe relative path inside the repo, since it is
// joined onto the clone dir and passed to `docker compose -f`.
func validateComposePath(composePath string) (string, error) {
	p := strings.TrimSpace(composePath)
	if p == "" {
		return "", nil
	}
	if !safeRelPath(p) {
		return "", fmt.Errorf("invalid compose file path: must be a relative path inside the repo")
	}
	return p, nil
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

// dockerImageRe is a permissive matcher for a Docker image reference:
//
//	[registry[:port]/]name[:tag][@sha256:digest]
//
// It deliberately allows lowercase names, digits, and the usual separators
// (./_-), path slashes, an optional tag, and an optional digest. It is meant to
// reject shell-hostile input (spaces, quotes, ;, &, |, $, backticks, …) rather
// than to be a full OCI grammar, since the value is passed as a single argv
// element to `docker pull`/`docker run` (never through a shell).
var dockerImageRe = regexp.MustCompile(`^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[0-9]+)?(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[A-Za-z0-9_][A-Za-z0-9._-]*)?(?:@sha256:[a-f0-9]{64})?$`)

// validateImageRef checks that an image reference is well-formed and free of
// shell metacharacters. Returns the trimmed image string on success.
func validateImageRef(image string) (string, error) {
	image = strings.TrimSpace(image)
	if image == "" {
		return "", fmt.Errorf("image is required")
	}
	if len(image) > 255 {
		return "", fmt.Errorf("image reference is too long")
	}
	// Defense-in-depth: reject obvious shell metacharacters and whitespace even
	// though we never invoke a shell.
	if strings.ContainsAny(image, " \t\n\r;&|$`<>(){}\\\"'") {
		return "", fmt.Errorf("invalid image reference: contains illegal characters")
	}
	if !dockerImageRe.MatchString(image) {
		return "", fmt.Errorf("invalid image reference %q: expected forms like nginx, nginx:1.27, ghcr.io/owner/app:tag", image)
	}
	return image, nil
}
