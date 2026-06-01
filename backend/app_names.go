package main

import (
	"regexp"
	"strconv"
	"strings"
)

var appNameCleanRe = regexp.MustCompile(`[^a-z0-9-]+`)

func cleanAppNameBase(name, fallback string) string {
	clean := strings.ToLower(strings.TrimSpace(name))
	clean = appNameCleanRe.ReplaceAllString(clean, "-")
	clean = strings.Trim(clean, "-")
	if clean == "" {
		clean = fallback
	}
	if len(clean) > 40 {
		clean = strings.Trim(clean[:40], "-")
	}
	if clean == "" {
		clean = "app"
	}
	return clean
}

func fitAppNameWithSuffix(base, suffix string) string {
	trimTo := 40 - len(suffix)
	if trimTo < 1 {
		trimTo = 1
	}
	if len(base) > trimTo {
		base = strings.Trim(base[:trimTo], "-")
	}
	if base == "" {
		base = "app"
	}
	return base + suffix
}

func uniqueAppName(base string, taken map[string]bool) string {
	base = cleanAppNameBase(base, "app")
	if validAppName(base) && !taken[base] {
		taken[base] = true
		return base
	}

	for i := 0; i < 12; i++ {
		name := fitAppNameWithSuffix(base, "-"+generateRandomID()[:4])
		if validAppName(name) && !taken[name] {
			taken[name] = true
			return name
		}
	}

	for i := 2; ; i++ {
		name := fitAppNameWithSuffix(base, "-"+strconv.Itoa(i))
		if validAppName(name) && !taken[name] {
			taken[name] = true
			return name
		}
	}
}

func uniqueAppNameForExisting(base, currentID string) string {
	appsLock.Lock()
	defer appsLock.Unlock()

	taken := make(map[string]bool, len(apps))
	for _, a := range apps {
		if a.ID != currentID {
			taken[a.Name] = true
		}
	}
	return uniqueAppName(base, taken)
}
