package paas

import (
	"os"
	"strconv"
	"strings"
)

// trustProxy controls whether X-Forwarded-For / X-Real-IP headers are honored.
// Default to false: if the API is directly exposed, trusting forwarded headers
// lets clients spoof their source IP and bypass rate limits/auth lockouts.
var trustProxy = parseBoolEnv("TRUST_PROXY")

// listenAddr returns the address the API listens on. Defaults to all
// interfaces on :8080 (the dashboard needs remote access for self-hosting),
// but can be overridden via LISTEN_ADDR (e.g. "127.0.0.1:8080" when fronted
// by a reverse proxy).
func listenAddr() string {
	if a := strings.TrimSpace(os.Getenv("LISTEN_ADDR")); a != "" {
		return a
	}
	return ":8080"
}

// envInt reads an integer environment variable, returning def when unset or
// unparseable.
func envInt(key string, def int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func parseBoolEnv(key string) bool {
	v := strings.TrimSpace(os.Getenv(key))
	return strings.EqualFold(v, "true") || v == "1" || strings.EqualFold(v, "yes")
}
