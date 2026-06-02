package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// App catalog — one-click deploys of popular open-source apps
// ---------------------------------------------------------------------------
//
// Each template describes a single prebuilt Docker image that runs as one
// container (no git clone, no Nixpacks build). Deploying a template reuses the
// normal zero-downtime release pipeline with BuildMethod == "image", so catalog
// apps get the same health-checked cutover, Caddy routing, logs, metrics, and
// rollback as git-based apps.
//
// Apps here are intentionally single-container with, at most, persistent
// volumes and environment variables. Templates that need a database/cache expose
// the required connection settings so users can pair them with Better PaaS
// add-ons until first-class compose-style stacks land.
//
// Logos are served from the community "dashboard-icons" CDN (jsDelivr). The
// frontend builds the URL from CatalogTemplate.Icon and falls back gracefully if
// a community icon slug disappears or is renamed.

// CatalogEnv describes one environment variable a template accepts.
type CatalogEnv struct {
	Key         string `json:"key"`
	Value       string `json:"value"`       // default value (may be empty)
	Description string `json:"description"` // shown next to the field
	Required    bool   `json:"required"`    // must be non-empty to deploy
	Secret      bool   `json:"secret"`      // mark as a secret env var (redacted)
	Generate    bool   `json:"generate"`    // auto-fill with a random secret when empty
}

type CatalogRequiredAddon struct {
	Type string `json:"type"`
}

// CatalogTemplate is a single one-click deployable app.
type CatalogTemplate struct {
	ID             string                 `json:"id"`
	Name           string                 `json:"name"`
	Description    string                 `json:"description"`
	Category       string                 `json:"category"`
	Image          string                 `json:"image"`      // pinned registry image
	Port           int                    `json:"port"`       // internal container port the app listens on
	VolumePath     string                 `json:"volumePath"` // container path to persist (empty = stateless)
	VolumePaths    []string               `json:"volumePaths,omitempty"`
	RequiredAddons []CatalogRequiredAddon `json:"requiredAddons,omitempty"`
	Env            []CatalogEnv           `json:"env"`
	HealthPath     string                 `json:"healthPath"` // HTTP path probed before cutover (empty = TCP check)
	Website        string                 `json:"website"`
	Icon           string                 `json:"icon"`  // dashboard-icons slug
	Notes          string                 `json:"notes"` // caveats (e.g. needs docker socket)
}

// catalogTemplates is the curated, single-container catalog. Image tags are
// pinned to a major/minor line rather than "latest" so deploys are repeatable.
func catalogTemplates() []CatalogTemplate {
	return []CatalogTemplate{
		// ── Monitoring & status ──────────────────────────────────────────────
		{
			ID:          "uptime-kuma",
			Name:        "Uptime Kuma",
			Description: "Self-hosted uptime monitoring with status pages and alerts.",
			Category:    "Monitoring",
			Image:       "louislam/uptime-kuma:1",
			Port:        3001,
			VolumePath:  "/app/data",
			HealthPath:  "/",
			Website:     "https://github.com/louislam/uptime-kuma",
			Icon:        "uptime-kuma",
		},
		{
			ID:          "dozzle",
			Name:        "Dozzle",
			Description: "Real-time log viewer for your Docker containers.",
			Category:    "Monitoring",
			Image:       "amir20/dozzle:v8",
			Port:        8080,
			HealthPath:  "/",
			Website:     "https://dozzle.dev",
			Icon:        "dozzle",
			Notes:       "Needs read-only access to the Docker socket to read logs. Add a volume mapping /var/run/docker.sock:/var/run/docker.sock:ro after deploy.",
		},
		{
			ID:          "beszel",
			Name:        "Beszel",
			Description: "Lightweight server resource monitoring hub with history and alerts.",
			Category:    "Monitoring",
			Image:       "henrygd/beszel:0",
			Port:        8090,
			VolumePath:  "/beszel_data",
			HealthPath:  "/",
			Website:     "https://beszel.dev",
			Icon:        "beszel",
		},
		{
			ID:          "glances",
			Name:        "Glances",
			Description: "An eye on your system: CPU, memory, disk, network in one web view.",
			Category:    "Monitoring",
			Image:       "nicolargo/glances:latest-full",
			Port:        61208,
			Env: []CatalogEnv{
				{Key: "GLANCES_OPT", Value: "-w", Description: "Run in web-server mode."},
			},
			HealthPath: "/",
			Website:    "https://nicolargo.github.io/glances/",
			Icon:       "glances",
			Notes:      "For full host metrics it needs host PID and the Docker socket; the basic web view works without them.",
		},
		{
			ID:          "changedetection",
			Name:        "Changedetection.io",
			Description: "Website change detection, price watch, and content monitoring with alerts.",
			Category:    "Monitoring",
			Image:       "dgtlmoon/changedetection.io:latest",
			Port:        5000,
			VolumePath:  "/datastore",
			Env: []CatalogEnv{
				{Key: "BASE_URL", Description: "Public URL, e.g. https://changes.example.com.", Required: false},
			},
			HealthPath: "/",
			Website:    "https://changedetection.io",
			Icon:       "changedetection",
			Notes:      "Browser-based checks need a Playwright/browser helper container; basic HTTP checks work in this starter.",
		},

		// ── Productivity & notes ──────────────────────────────────────────────
		{
			ID:          "memos",
			Name:        "Memos",
			Description: "A lightweight, privacy-first, self-hosted note-taking service.",
			Category:    "Productivity",
			Image:       "neosmemo/memos:stable",
			Port:        5230,
			VolumePath:  "/var/opt/memos",
			HealthPath:  "/",
			Website:     "https://usememos.com",
			Icon:        "memos",
		},
		{
			ID:          "trilium",
			Name:        "Trilium Notes",
			Description: "Hierarchical note-taking app for building personal knowledge bases.",
			Category:    "Productivity",
			Image:       "triliumnext/notes:latest",
			Port:        8080,
			VolumePath:  "/home/node/trilium-data",
			HealthPath:  "/",
			Website:     "https://github.com/TriliumNext/Notes",
			Icon:        "trilium",
		},
		{
			ID:          "linkding",
			Name:        "Linkding",
			Description: "Minimal, fast self-hosted bookmark manager.",
			Category:    "Productivity",
			Image:       "sissbruecker/linkding:latest",
			Port:        9090,
			VolumePath:  "/etc/linkding/data",
			Env: []CatalogEnv{
				{Key: "LD_SUPERUSER_NAME", Value: "admin", Description: "Initial admin username.", Required: true},
				{Key: "LD_SUPERUSER_PASSWORD", Description: "Initial admin password.", Required: true, Secret: true, Generate: true},
			},
			HealthPath: "/",
			Website:    "https://linkding.link",
			Icon:       "linkding",
		},
		{
			ID:          "freshrss",
			Name:        "FreshRSS",
			Description: "A free, self-hostable RSS feed aggregator (SQLite mode).",
			Category:    "Productivity",
			Image:       "freshrss/freshrss:latest",
			Port:        80,
			VolumePath:  "/var/www/FreshRSS/data",
			HealthPath:  "/",
			Website:     "https://freshrss.org",
			Icon:        "freshrss",
		},
		{
			ID:          "hedgedoc",
			Name:        "HedgeDoc",
			Description: "Collaborative markdown notes and docs for teams.",
			Category:    "Productivity",
			Image:       "lscr.io/linuxserver/hedgedoc:latest",
			Port:        3000,
			VolumePath:  "/config",
			Env: []CatalogEnv{
				{Key: "DB_TYPE", Value: "sqlite", Description: "Use SQLite for the one-container starter."},
				{Key: "TZ", Value: "UTC", Description: "Container timezone."},
				{Key: "CMD_DOMAIN", Description: "Public domain, e.g. docs.example.com.", Required: false},
			},
			HealthPath: "/",
			Website:    "https://hedgedoc.org",
			Icon:       "hedgedoc",
		},
		{
			ID:          "mealie",
			Name:        "Mealie",
			Description: "Recipe manager and meal planner for households and small communities.",
			Category:    "Productivity",
			Image:       "ghcr.io/mealie-recipes/mealie:latest",
			Port:        9000,
			VolumePath:  "/app/data",
			Env: []CatalogEnv{
				{Key: "ALLOW_SIGNUP", Value: "true", Description: "Allow account creation from the web UI."},
				{Key: "BASE_URL", Description: "Public URL, e.g. https://mealie.example.com.", Required: false},
			},
			HealthPath: "/",
			Website:    "https://mealie.io",
			Icon:       "mealie",
		},
		{
			ID:          "wallabag",
			Name:        "Wallabag",
			Description: "Self-hosted read-it-later app for saving articles and pages.",
			Category:    "Productivity",
			Image:       "wallabag/wallabag:2.6.13",
			Port:        80,
			VolumePaths: []string{"/var/www/wallabag/data", "/var/www/wallabag/images"},
			Env: []CatalogEnv{
				{Key: "SYMFONY__ENV__DOMAIN_NAME", Description: "Public URL, e.g. https://read.example.com.", Required: false},
			},
			HealthPath: "/",
			Website:    "https://wallabag.org",
			Icon:       "wallabag",
			Notes:      "Uses SQLite for a simple one-container starter. Use a database add-on for heavier usage.",
		},
		{
			ID:          "nextcloud",
			Name:        "Nextcloud",
			Description: "File sync, sharing, calendars, contacts, and collaboration suite.",
			Category:    "Productivity",
			Image:       "nextcloud:31-apache",
			Port:        80,
			VolumePath:  "/var/www/html",
			Env: []CatalogEnv{
				{Key: "SQLITE_DATABASE", Value: "nextcloud", Description: "Use SQLite for the one-container starter."},
				{Key: "NEXTCLOUD_ADMIN_USER", Value: "admin", Description: "Initial admin username.", Required: true},
				{Key: "NEXTCLOUD_ADMIN_PASSWORD", Description: "Initial admin password.", Required: true, Secret: true, Generate: true},
			},
			HealthPath: "/",
			Website:    "https://nextcloud.com",
			Icon:       "nextcloud",
			Notes:      "SQLite is fine for a quick start. For production, attach Postgres/MySQL and move file storage deliberately.",
		},
		{
			ID:          "paperless-ngx",
			Name:        "Paperless-ngx",
			Description: "Document management with OCR, tagging, search, and archiving.",
			Category:    "Productivity",
			Image:       "ghcr.io/paperless-ngx/paperless-ngx:latest",
			Port:        8000,
			VolumePaths: []string{"/usr/src/paperless/data", "/usr/src/paperless/media", "/usr/src/paperless/consume", "/usr/src/paperless/export"},
			RequiredAddons: []CatalogRequiredAddon{
				{Type: "redis"},
			},
			Env: []CatalogEnv{
				{Key: "PAPERLESS_REDIS", Description: "Auto-filled from a managed Redis add-on.", Secret: true},
				{Key: "PAPERLESS_SECRET_KEY", Description: "Django secret key.", Required: true, Secret: true, Generate: true},
				{Key: "PAPERLESS_ADMIN_USER", Value: "admin", Description: "Initial admin username.", Required: true},
				{Key: "PAPERLESS_ADMIN_PASSWORD", Description: "Initial admin password.", Required: true, Secret: true, Generate: true},
				{Key: "PAPERLESS_URL", Description: "Public URL, e.g. https://paperless.example.com.", Required: false},
			},
			HealthPath: "/",
			Website:    "https://docs.paperless-ngx.com",
			Icon:       "paperless-ngx",
			Notes:      "Better PaaS creates and connects a Redis add-on automatically. Tika/Gotenberg helpers are optional and not included in this single-container starter.",
		},

		// ── CMS & publishing ─────────────────────────────────────────────────
		{
			ID:          "pocketbase",
			Name:        "PocketBase",
			Description: "Lightweight backend with database, auth, file storage, and an admin UI.",
			Category:    "CMS",
			Image:       "ghcr.io/muchobien/pocketbase:latest",
			Port:        8090,
			VolumePath:  "/pb_data",
			HealthPath:  "/",
			Website:     "https://pocketbase.io",
			Icon:        "pocketbase",
		},
		{
			ID:          "ghost",
			Name:        "Ghost",
			Description: "Modern publishing platform for blogs, newsletters, and publications.",
			Category:    "CMS",
			Image:       "ghost:5-alpine",
			Port:        2368,
			VolumePath:  "/var/lib/ghost/content",
			Env: []CatalogEnv{
				{Key: "url", Description: "Public URL, e.g. https://blog.example.com. Can be set after deploy.", Required: false},
			},
			HealthPath: "/ghost",
			Website:    "https://ghost.org",
			Icon:       "ghost",
			Notes:      "This single-container starter uses Ghost's built-in SQLite storage. For high-traffic production sites, Ghost recommends MySQL.",
		},
		{
			ID:          "directus",
			Name:        "Directus",
			Description: "Headless CMS and data platform with instant APIs and a polished admin studio.",
			Category:    "CMS",
			Image:       "directus/directus:11",
			Port:        8055,
			VolumePaths: []string{"/directus/database", "/directus/uploads", "/directus/extensions"},
			Env: []CatalogEnv{
				{Key: "KEY", Description: "Directus project key.", Required: true, Secret: true, Generate: true},
				{Key: "SECRET", Description: "Directus secret.", Required: true, Secret: true, Generate: true},
				{Key: "ADMIN_EMAIL", Value: "admin@example.com", Description: "Initial admin email.", Required: true},
				{Key: "ADMIN_PASSWORD", Description: "Initial admin password.", Required: true, Secret: true, Generate: true},
				{Key: "DB_CLIENT", Value: "sqlite3", Description: "Database client for this single-container starter."},
				{Key: "DB_FILENAME", Value: "/directus/database/data.db", Description: "SQLite database file path."},
			},
			HealthPath: "/",
			Website:    "https://directus.io",
			Icon:       "directus",
		},
		{
			ID:          "wikijs",
			Name:        "Wiki.js",
			Description: "Modern wiki and documentation CMS with a clean editor experience.",
			Category:    "Productivity",
			Image:       "lscr.io/linuxserver/wikijs:latest",
			Port:        3000,
			VolumePath:  "/config",
			Env: []CatalogEnv{
				{Key: "DB_TYPE", Value: "sqlite", Description: "Use SQLite for the one-container starter."},
				{Key: "TZ", Value: "UTC", Description: "Container timezone."},
			},
			HealthPath: "/",
			Website:    "https://js.wiki",
			Icon:       "wikijs",
			Notes:      "SQLite is convenient for a small wiki. For larger teams, attach Postgres and switch DB_TYPE to postgres.",
		},
		{
			ID:          "wordpress",
			Name:        "WordPress",
			Description: "The classic open-source CMS for websites, blogs, and content-heavy pages.",
			Category:    "CMS",
			Image:       "wordpress:6-php8.3-apache",
			Port:        80,
			VolumePath:  "/var/www/html",
			RequiredAddons: []CatalogRequiredAddon{
				{Type: "mysql"},
			},
			Env: []CatalogEnv{
				{Key: "WORDPRESS_DB_HOST", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "WORDPRESS_DB_USER", Value: "appuser", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "WORDPRESS_DB_PASSWORD", Description: "Auto-filled from a managed MySQL add-on.", Secret: true},
				{Key: "WORDPRESS_DB_NAME", Value: "appdb", Description: "Auto-filled from a managed MySQL add-on."},
			},
			HealthPath: "/",
			Website:    "https://wordpress.org",
			Icon:       "wordpress",
			Notes:      "Better PaaS creates and connects a MySQL add-on automatically for this template.",
		},
		{
			ID:          "drupal",
			Name:        "Drupal",
			Description: "Flexible CMS for structured content, editorial workflows, and larger sites.",
			Category:    "CMS",
			Image:       "drupal:11-php8.3-apache",
			Port:        80,
			VolumePaths: []string{"/var/www/html/sites", "/opt/drupal/web/modules", "/opt/drupal/web/themes"},
			HealthPath:  "/",
			Website:     "https://www.drupal.org",
			Icon:        "drupal",
			Notes:       "Complete Drupal's web installer after deploy. Use SQLite for a quick start or attach Postgres/MySQL for production.",
		},

		// ── Developer tools ──────────────────────────────────────────────────
		{
			ID:          "gitea",
			Name:        "Gitea",
			Description: "Lightweight Git hosting with issues, pull requests, packages, and actions.",
			Category:    "Developer Tools",
			Image:       "gitea/gitea:1.24",
			Port:        3000,
			VolumePath:  "/data",
			Env: []CatalogEnv{
				{Key: "USER_UID", Value: "1000", Description: "Container user UID."},
				{Key: "USER_GID", Value: "1000", Description: "Container user GID."},
				{Key: "GITEA__server__ROOT_URL", Description: "Public URL, e.g. https://git.example.com.", Required: false},
			},
			HealthPath: "/",
			Website:    "https://about.gitea.com",
			Icon:       "gitea",
		},
		{
			ID:          "forgejo",
			Name:        "Forgejo",
			Description: "Community-driven Git forge for code hosting, collaboration, and packages.",
			Category:    "Developer Tools",
			Image:       "codeberg.org/forgejo/forgejo:12",
			Port:        3000,
			VolumePath:  "/data",
			Env: []CatalogEnv{
				{Key: "USER_UID", Value: "1000", Description: "Container user UID."},
				{Key: "USER_GID", Value: "1000", Description: "Container user GID."},
				{Key: "FORGEJO__server__ROOT_URL", Description: "Public URL, e.g. https://forge.example.com.", Required: false},
			},
			HealthPath: "/",
			Website:    "https://forgejo.org",
			Icon:       "forgejo",
		},
		{
			ID:          "woodpecker",
			Name:        "Woodpecker CI",
			Description: "Lightweight CI/CD server that pairs well with Gitea and Forgejo.",
			Category:    "Developer Tools",
			Image:       "woodpeckerci/woodpecker-server:v3",
			Port:        8000,
			VolumePath:  "/var/lib/woodpecker",
			Env: []CatalogEnv{
				{Key: "WOODPECKER_HOST", Description: "Public URL, e.g. https://ci.example.com.", Required: true},
				{Key: "WOODPECKER_ADMIN", Description: "Admin username from your Git provider.", Required: true},
				{Key: "WOODPECKER_OPEN", Value: "true", Description: "Allow open registration/login through the configured forge."},
				{Key: "WOODPECKER_AGENT_SECRET", Description: "Shared secret for Woodpecker agents.", Required: true, Secret: true, Generate: true},
			},
			HealthPath: "/",
			Website:    "https://woodpecker-ci.org",
			Icon:       "woodpecker",
			Notes:      "This starts the Woodpecker server. Add forge OAuth settings and run an agent before jobs can execute.",
		},

		// ── Notifications ─────────────────────────────────────────────────────
		{
			ID:          "gotify",
			Name:        "Gotify",
			Description: "A simple server for sending and receiving push notifications.",
			Category:    "Notifications",
			Image:       "gotify/server:latest",
			Port:        80,
			VolumePath:  "/app/data",
			HealthPath:  "/",
			Website:     "https://gotify.net",
			Icon:        "gotify",
		},
		{
			ID:          "ntfy",
			Name:        "ntfy",
			Description: "Pub-sub notifications to your phone or desktop over HTTP.",
			Category:    "Notifications",
			Image:       "binwiederhier/ntfy:latest",
			Port:        80,
			VolumePath:  "/var/cache/ntfy",
			Env: []CatalogEnv{
				{Key: "NTFY_BASE_URL", Description: "Public base URL of this server, e.g. https://ntfy.example.com.", Required: false},
			},
			HealthPath: "/",
			Website:    "https://ntfy.sh",
			Icon:       "ntfy",
		},

		// ── Security ──────────────────────────────────────────────────────────
		{
			ID:          "vaultwarden",
			Name:        "Vaultwarden",
			Description: "Lightweight Bitwarden-compatible password manager server.",
			Category:    "Security",
			Image:       "vaultwarden/server:latest",
			Port:        80,
			VolumePath:  "/data",
			Env: []CatalogEnv{
				{Key: "ADMIN_TOKEN", Description: "Token to access the /admin panel.", Required: false, Secret: true, Generate: true},
				{Key: "SIGNUPS_ALLOWED", Value: "true", Description: "Allow new account sign-ups."},
			},
			HealthPath: "/alive",
			Website:    "https://github.com/dani-garcia/vaultwarden",
			Icon:       "vaultwarden",
		},
		{
			ID:          "privatebin",
			Name:        "PrivateBin",
			Description: "Minimalist, zero-knowledge online pastebin.",
			Category:    "Security",
			Image:       "privatebin/nginx-fpm-alpine:stable",
			Port:        8080,
			VolumePath:  "/srv/data",
			HealthPath:  "/",
			Website:     "https://privatebin.info",
			Icon:        "privatebin",
		},

		// ── Developer tools & utilities ───────────────────────────────────────
		{
			ID:          "it-tools",
			Name:        "IT Tools",
			Description: "A handy collection of tools for developers (stateless).",
			Category:    "Utilities",
			Image:       "corentinth/it-tools:latest",
			Port:        80,
			HealthPath:  "/",
			Website:     "https://it-tools.tech",
			Icon:        "it-tools",
		},
		{
			ID:          "cyberchef",
			Name:        "CyberChef",
			Description: "The cyber swiss-army knife for encoding, encryption and analysis.",
			Category:    "Utilities",
			Image:       "mpepping/cyberchef:latest",
			Port:        8000,
			HealthPath:  "/",
			Website:     "https://github.com/gchq/CyberChef",
			Icon:        "cyberchef",
		},
		{
			ID:          "excalidraw",
			Name:        "Excalidraw",
			Description: "Virtual whiteboard for sketching hand-drawn style diagrams (stateless).",
			Category:    "Utilities",
			Image:       "excalidraw/excalidraw:latest",
			Port:        80,
			HealthPath:  "/",
			Website:     "https://excalidraw.com",
			Icon:        "excalidraw",
		},
		{
			ID:          "stirling-pdf",
			Name:        "Stirling PDF",
			Description: "A powerful, locally-hosted web-based PDF manipulation toolkit.",
			Category:    "Utilities",
			Image:       "stirlingtools/stirling-pdf:latest",
			Port:        8080,
			VolumePath:  "/configs",
			HealthPath:  "/",
			Website:     "https://stirlingpdf.com",
			Icon:        "stirling-pdf",
		},
		{
			ID:          "filebrowser",
			Name:        "File Browser",
			Description: "A web-based file manager for a directory on your server.",
			Category:    "Utilities",
			Image:       "filebrowser/filebrowser:latest",
			Port:        80,
			VolumePath:  "/srv",
			HealthPath:  "/",
			Website:     "https://filebrowser.org",
			Icon:        "filebrowser",
			Notes:       "Default login is admin / admin — change it immediately after first sign-in.",
		},
		{
			ID:          "libretranslate",
			Name:        "LibreTranslate",
			Description: "Free and open-source machine translation API, fully self-hosted.",
			Category:    "Utilities",
			Image:       "libretranslate/libretranslate:latest",
			Port:        5000,
			VolumePath:  "/home/libretranslate/.local",
			HealthPath:  "/",
			Website:     "https://libretranslate.com",
			Icon:        "libretranslate",
			Notes:       "First start downloads language models and may take a few minutes to become healthy.",
		},
		{
			ID:          "homepage",
			Name:        "Homepage",
			Description: "Highly customizable dashboard for your deployed apps and infrastructure.",
			Category:    "Dashboard",
			Image:       "ghcr.io/gethomepage/homepage:latest",
			Port:        3000,
			VolumePath:  "/app/config",
			Env: []CatalogEnv{
				{Key: "HOMEPAGE_ALLOWED_HOSTS", Value: "*", Description: "Allowed hostnames. Replace * with your public domain for production."},
			},
			HealthPath: "/",
			Website:    "https://gethomepage.dev",
			Icon:       "homepage",
			Notes:      "Docker integrations need the Docker socket mounted manually after deploy.",
		},
		{
			ID:          "yourls",
			Name:        "YOURLS",
			Description: "Simple self-hosted URL shortener with a small admin interface.",
			Category:    "Utilities",
			Image:       "yourls:1.10-apache",
			Port:        80,
			RequiredAddons: []CatalogRequiredAddon{
				{Type: "mysql"},
			},
			Env: []CatalogEnv{
				{Key: "YOURLS_DB_HOST", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "YOURLS_DB_USER", Value: "appuser", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "YOURLS_DB_PASS", Description: "Auto-filled from a managed MySQL add-on.", Secret: true},
				{Key: "YOURLS_DB_NAME", Value: "appdb", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "YOURLS_SITE", Description: "Public short URL base, e.g. https://go.example.com.", Required: true},
				{Key: "YOURLS_USER", Value: "admin", Description: "Admin username.", Required: true},
				{Key: "YOURLS_PASS", Description: "Admin password.", Required: true, Secret: true, Generate: true},
			},
			HealthPath: "/",
			Website:    "https://yourls.org",
			Icon:       "yourls",
			Notes:      "Better PaaS creates and connects a MySQL add-on automatically for this template.",
		},
		{
			ID:          "pairdrop",
			Name:        "PairDrop",
			Description: "Local/private AirDrop-style file sharing through the browser.",
			Category:    "Utilities",
			Image:       "lscr.io/linuxserver/pairdrop:latest",
			Port:        3000,
			VolumePath:  "/config",
			Env: []CatalogEnv{
				{Key: "TZ", Value: "UTC", Description: "Container timezone."},
			},
			HealthPath: "/",
			Website:    "https://github.com/schlagmichdoch/PairDrop",
			Icon:       "pairdrop",
		},
		{
			ID:          "searxng",
			Name:        "SearXNG",
			Description: "Privacy-respecting self-hosted metasearch engine.",
			Category:    "Privacy",
			Image:       "searxng/searxng:latest",
			Port:        8080,
			VolumePath:  "/etc/searxng",
			Env: []CatalogEnv{
				{Key: "BASE_URL", Description: "Public URL, e.g. https://search.example.com.", Required: false},
				{Key: "INSTANCE_NAME", Value: "Better PaaS Search", Description: "Instance display name."},
			},
			HealthPath: "/",
			Website:    "https://docs.searxng.org",
			Icon:       "searxng",
		},
		{
			ID:          "n8n",
			Name:        "n8n",
			Description: "Workflow automation for APIs, webhooks, AI workflows, and internal tools.",
			Category:    "Automation",
			Image:       "n8nio/n8n:latest",
			Port:        5678,
			VolumePath:  "/home/node/.n8n",
			Env: []CatalogEnv{
				{Key: "N8N_ENCRYPTION_KEY", Description: "Encryption key for credentials.", Required: true, Secret: true, Generate: true},
				{Key: "N8N_SECURE_COOKIE", Value: "false", Description: "Set true when serving only over HTTPS."},
				{Key: "WEBHOOK_URL", Description: "Public URL for webhooks, e.g. https://n8n.example.com.", Required: false},
			},
			HealthPath: "/",
			Website:    "https://n8n.io",
			Icon:       "n8n",
			Notes:      "Uses SQLite by default. Attach Postgres for production or larger workflows.",
		},
		{
			ID:          "umami",
			Name:        "Umami",
			Description: "Simple, privacy-friendly web analytics for your sites and apps.",
			Category:    "Analytics",
			Image:       "ghcr.io/umami-software/umami:postgresql-latest",
			Port:        3000,
			RequiredAddons: []CatalogRequiredAddon{
				{Type: "postgres"},
			},
			Env: []CatalogEnv{
				{Key: "DATABASE_URL", Description: "Auto-filled from a managed Postgres add-on.", Secret: true},
				{Key: "APP_SECRET", Description: "Secret used by Umami.", Required: true, Secret: true, Generate: true},
			},
			HealthPath: "/",
			Website:    "https://umami.is",
			Icon:       "umami",
			Notes:      "Better PaaS creates and connects a Postgres add-on automatically for this template.",
		},

		// ── Media ─────────────────────────────────────────────────────────────
		{
			ID:          "jellyfin",
			Name:        "Jellyfin",
			Description: "The free software media system for streaming your own library.",
			Category:    "Media",
			Image:       "jellyfin/jellyfin:latest",
			Port:        8096,
			VolumePath:  "/config",
			HealthPath:  "/health",
			Website:     "https://jellyfin.org",
			Icon:        "jellyfin",
			Notes:       "Mount your media as an extra volume after deploy (e.g. /path/to/media:/media).",
		},
		{
			ID:          "navidrome",
			Name:        "Navidrome",
			Description: "Modern music server and streamer compatible with Subsonic clients.",
			Category:    "Media",
			Image:       "deluan/navidrome:latest",
			Port:        4533,
			VolumePath:  "/data",
			HealthPath:  "/",
			Website:     "https://navidrome.org",
			Icon:        "navidrome",
			Notes:       "Mount your music as an extra volume after deploy (e.g. /path/to/music:/music:ro).",
		},
		{
			ID:          "calibre-web",
			Name:        "Calibre-Web",
			Description: "A clean web app for browsing and reading your eBook library.",
			Category:    "Media",
			Image:       "linuxserver/calibre-web:latest",
			Port:        8083,
			VolumePath:  "/config",
			HealthPath:  "/",
			Website:     "https://github.com/janeczku/calibre-web",
			Icon:        "calibre-web",
		},
		{
			ID:          "home-assistant",
			Name:        "Home Assistant",
			Description: "Home automation dashboard for devices, scenes, automations, and integrations.",
			Category:    "Home",
			Image:       "ghcr.io/home-assistant/home-assistant:stable",
			Port:        8123,
			VolumePath:  "/config",
			Env: []CatalogEnv{
				{Key: "TZ", Value: "UTC", Description: "Container timezone."},
			},
			HealthPath: "/",
			Website:    "https://www.home-assistant.io",
			Icon:       "home-assistant",
			Notes:      "Many device integrations need host networking, USB, Bluetooth, or mDNS access that this single-container starter does not grant.",
		},
		{
			ID:          "open-webui",
			Name:        "Open WebUI",
			Description: "Chat UI for local or remote LLM providers such as Ollama and OpenAI-compatible APIs.",
			Category:    "AI",
			Image:       "ghcr.io/open-webui/open-webui:main",
			Port:        8080,
			VolumePath:  "/app/backend/data",
			Env: []CatalogEnv{
				{Key: "OLLAMA_BASE_URL", Description: "Optional Ollama endpoint, e.g. http://host.docker.internal:11434.", Required: false},
			},
			HealthPath: "/",
			Website:    "https://openwebui.com",
			Icon:       "open-webui",
			Notes:      "Connect an external LLM provider or Ollama endpoint after deploy. GPU/Ollama containers are not included.",
		},
		{
			ID:          "vikunja",
			Name:        "Vikunja",
			Description: "Polished, modern collaborative to-do list and task manager.",
			Category:    "Productivity",
			Image:       "vikunja/vikunja:latest",
			Port:        3456,
			VolumePath:  "/app/vikunja/files",
			HealthPath:  "/",
			Website:     "https://vikunja.io",
			Icon:        "vikunja",
		},
		{
			ID:          "listmonk",
			Name:        "Listmonk",
			Description: "High-performance self-hosted newsletter and mailing list manager.",
			Category:    "Marketing",
			Image:       "listmonk/listmonk:latest",
			Port:        9000,
			RequiredAddons: []CatalogRequiredAddon{
				{Type: "postgres"},
			},
			Env: []CatalogEnv{
				{Key: "LISTMONK_db__host", Description: "Auto-filled from a managed Postgres add-on."},
				{Key: "LISTMONK_db__user", Value: "appuser", Description: "Auto-filled from a managed Postgres add-on."},
				{Key: "LISTMONK_db__password", Description: "Auto-filled from a managed Postgres add-on.", Secret: true},
				{Key: "LISTMONK_db__database", Value: "appdb", Description: "Auto-filled from a managed Postgres add-on."},
				{Key: "LISTMONK_db__port", Value: "5432", Description: "Database port."},
				{Key: "LISTMONK_db__sslmode", Value: "disable", Description: "SSL mode for database connection."},
				{Key: "LISTMONK_app__address", Value: "0.0.0.0:9000", Description: "App bind address."},
			},
			HealthPath: "/",
			Website:    "https://listmonk.app",
			Icon:       "listmonk",
		},
		{
			ID:          "grafana",
			Name:        "Grafana",
			Description: "The open observability platform: visualize metrics, logs, and traces.",
			Category:    "Monitoring",
			Image:       "grafana/grafana:11",
			Port:        3000,
			VolumePath:  "/var/lib/grafana",
			HealthPath:  "/api/health",
			Website:     "https://grafana.com",
			Icon:        "grafana",
		},
		{
			ID:          "bookstack",
			Name:        "BookStack",
			Description: "A platform to create simple, self-hosted, and easy-to-use wikis.",
			Category:    "Productivity",
			Image:       "lscr.io/linuxserver/bookstack:latest",
			Port:        80,
			VolumePath:  "/config",
			RequiredAddons: []CatalogRequiredAddon{
				{Type: "mysql"},
			},
			Env: []CatalogEnv{
				{Key: "DB_HOST", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "DB_USER", Value: "appuser", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "DB_PASS", Description: "Auto-filled from a managed MySQL add-on.", Secret: true},
				{Key: "DB_DATABASE", Value: "appdb", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "APP_URL", Description: "Public app URL, e.g. https://wiki.example.com", Required: false},
			},
			HealthPath: "/",
			Website:    "https://www.bookstackapp.com",
			Icon:       "bookstack",
		},
		{
			ID:          "nocodb",
			Name:        "NocoDB",
			Description: "Turns any database into a smart, collaborative spreadsheet.",
			Category:    "Productivity",
			Image:       "nocodb/nocodb:latest",
			Port:        8080,
			VolumePath:  "/usr/app/data",
			HealthPath:  "/",
			Website:     "https://nocodb.com",
			Icon:        "nocodb",
		},
		{
			ID:          "formbricks",
			Name:        "Formbricks",
			Description: "Privacy-first, open-source micro-surveys and user feedback widgets.",
			Category:    "Utilities",
			Image:       "formbricks/formbricks:latest",
			Port:        3000,
			RequiredAddons: []CatalogRequiredAddon{
				{Type: "postgres"},
			},
			Env: []CatalogEnv{
				{Key: "DATABASE_URL", Description: "Auto-filled Postgres connection string.", Secret: true},
				{Key: "NEXTAUTH_SECRET", Description: "Random NextAuth secret.", Required: true, Secret: true, Generate: true},
				{Key: "WEBAPP_URL", Description: "Public app URL, e.g. https://forms.example.com", Required: false},
			},
			HealthPath: "/",
			Website:    "https://formbricks.com",
			Icon:       "formbricks",
		},
		{
			ID:          "jenkins",
			Name:        "Jenkins",
			Description: "The leading open-source automation server for building, deploying, and automating any project.",
			Category:    "Developer Tools",
			Image:       "jenkins/jenkins:lts",
			Port:        8080,
			VolumePath:  "/var/jenkins_home",
			HealthPath:  "/login",
			Website:     "https://www.jenkins.io",
			Icon:        "jenkins",
			Notes:       "Initial admin password is written to the container log or /var/jenkins_home/secrets/initialAdminPassword.",
		},
		{
			ID:          "semaphore",
			Name:        "Ansible Semaphore",
			Description: "A beautiful web UI for running Ansible playbooks.",
			Category:    "Developer Tools",
			Image:       "semaphoreui/semaphore:latest",
			Port:        3000,
			RequiredAddons: []CatalogRequiredAddon{
				{Type: "postgres"},
			},
			Env: []CatalogEnv{
				{Key: "SEMAPHORE_DB_DIALECT", Description: "Dialect for the database connection (postgres)."},
				{Key: "SEMAPHORE_DB_HOST", Description: "Auto-filled from a managed Postgres add-on."},
				{Key: "SEMAPHORE_DB_PORT", Description: "Auto-filled from a managed Postgres add-on."},
				{Key: "SEMAPHORE_DB_USER", Description: "Auto-filled from a managed Postgres add-on."},
				{Key: "SEMAPHORE_DB_PASS", Description: "Auto-filled from a managed Postgres add-on.", Secret: true},
				{Key: "SEMAPHORE_DB", Description: "Auto-filled from a managed Postgres add-on."},
				{Key: "SEMAPHORE_ADMIN", Value: "admin", Description: "Initial admin username.", Required: true},
				{Key: "SEMAPHORE_ADMIN_PASSWORD", Description: "Initial admin password.", Required: true, Secret: true, Generate: true},
				{Key: "SEMAPHORE_ADMIN_EMAIL", Value: "admin@example.com", Description: "Initial admin email.", Required: true},
				{Key: "SEMAPHORE_ADMIN_NAME", Value: "Administrator", Description: "Initial admin display name.", Required: true},
			},
			HealthPath: "/",
			Website:    "https://github.com/semaphoreui/semaphore",
			Icon:       "semaphore",
		},
		{
			ID:          "onedev",
			Name:        "OneDev",
			Description: "All-in-one DevOps platform featuring Git hosting, kanban project management, and CI/CD.",
			Category:    "Developer Tools",
			Image:       "1dev/server:latest",
			Port:        6610,
			VolumePath:  "/opt/onedev",
			HealthPath:  "/",
			Website:     "https://github.com/theonedev/onedev",
			Icon:        "onedev",
		},
		{
			ID:          "mixpost",
			Name:        "Mixpost",
			Description: "Self-hosted social media management and scheduling platform.",
			Category:    "Marketing",
			Image:       "inovector/mixpost:latest",
			Port:        80,
			VolumePath:  "/var/www/html/storage/app",
			RequiredAddons: []CatalogRequiredAddon{
				{Type: "mysql"},
				{Type: "redis"},
			},
			Env: []CatalogEnv{
				{Key: "APP_KEY", Description: "Laravel encryption key (32 characters).", Required: true, Secret: true, Generate: true},
				{Key: "APP_URL", Description: "Public app URL, e.g. https://social.example.com", Required: false},
				{Key: "APP_DEBUG", Value: "false", Description: "Enable/disable debug logs."},
				{Key: "DB_CONNECTION", Value: "mysql", Description: "Database connection type."},
				{Key: "DB_HOST", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "DB_PORT", Value: "3306", Description: "Database port."},
				{Key: "DB_DATABASE", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "DB_USERNAME", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "DB_PASSWORD", Description: "Auto-filled from a managed MySQL add-on.", Secret: true},
				{Key: "REDIS_HOST", Description: "Auto-filled from a managed Redis add-on."},
				{Key: "REDIS_PORT", Value: "6379", Description: "Redis port."},
				{Key: "REDIS_PASSWORD", Description: "Auto-filled from a managed Redis add-on.", Secret: true},
			},
			HealthPath: "/",
			Website:    "https://mixpost.app",
			Icon:       "mixpost",
		},
		{
			ID:          "docuseal",
			Name:        "DocuSeal",
			Description: "Open-source platform that provides secure and legally-binding digital document signing (DocuSign alternative).",
			Category:    "Utilities",
			Image:       "docuseal/docuseal:latest",
			Port:        3000,
			VolumePath:  "/data",
			HealthPath:  "/",
			Website:     "https://www.docuseal.com",
			Icon:        "docuseal",
		},
		{
			ID:          "matomo",
			Name:        "Matomo Analytics",
			Description: "The leading open-source web analytics platform, providing full privacy compliance and native e-commerce tracking.",
			Category:    "Analytics",
			Image:       "matomo:latest",
			Port:        80,
			VolumePath:  "/var/www/html",
			RequiredAddons: []CatalogRequiredAddon{
				{Type: "mysql"},
			},
			Env: []CatalogEnv{
				{Key: "MATOMO_DATABASE_HOST", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "MATOMO_DATABASE_DBNAME", Value: "appdb", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "MATOMO_DATABASE_USERNAME", Value: "appuser", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "MATOMO_DATABASE_PASSWORD", Description: "Auto-filled from a managed MySQL add-on.", Secret: true},
			},
			HealthPath: "/",
			Website:    "https://matomo.org",
			Icon:       "matomo",
		},
		{
			ID:          "prestashop",
			Name:        "PrestaShop",
			Description: "Popular open-source e-commerce solution to create and manage your online store.",
			Category:    "E-commerce",
			Image:       "prestashop/prestashop:latest",
			Port:        80,
			VolumePath:  "/var/www/html",
			RequiredAddons: []CatalogRequiredAddon{
				{Type: "mysql"},
			},
			Env: []CatalogEnv{
				{Key: "DB_SERVER", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "DB_NAME", Value: "appdb", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "DB_USER", Value: "appuser", Description: "Auto-filled from a managed MySQL add-on."},
				{Key: "DB_PASSWD", Description: "Auto-filled from a managed MySQL add-on.", Secret: true},
				{Key: "PS_INSTALL_AUTO", Value: "true", Description: "Enables automatic installer on startup."},
				{Key: "PS_DEV_MODE", Value: "0", Description: "Enable PrestaShop development debug mode (1 = enabled, 0 = disabled)."},
			},
			HealthPath: "/",
			Website:    "https://www.prestashop-project.org",
			Icon:       "prestashop",
		},
	}
}

// findCatalogTemplate returns the template with the given ID, or nil.
func findCatalogTemplate(id string) *CatalogTemplate {
	for _, t := range catalogTemplates() {
		if t.ID == id {
			tpl := t
			return &tpl
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// GET /api/catalog — list available one-click templates
// ---------------------------------------------------------------------------

func handleCatalog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jsonOK(w, catalogTemplates())
}

// ---------------------------------------------------------------------------
// POST /api/catalog/deploy — deploy a catalog template in one click
// ---------------------------------------------------------------------------

func handleCatalogDeploy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		TemplateID string            `json:"templateId"`
		Name       string            `json:"name"`
		EnvVars    map[string]string `json:"envVars"`
		Domains    []string          `json:"domains"`
		Memory     string            `json:"memory"`
		CPUs       string            `json:"cpus"`
		ServerID   string            `json:"serverId"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
		return
	}

	appID := generateRandomID()

	tpl := findCatalogTemplate(req.TemplateID)
	if tpl == nil {
		jsonError(w, "Unknown catalog template", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = tpl.ID
	}
	if !validAppName(name) {
		jsonError(w, "invalid name: use 2-40 lowercase letters, digits, or hyphens (must start and end alphanumeric)", http.StatusBadRequest)
		return
	}
	serverID := normalizeServerID(req.ServerID)
	if err := validateResourceLimits(req.Memory, req.CPUs); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := validateDomains(req.Domains); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	// ── Resolve env vars: start from template defaults, then apply overrides,
	// auto-generate any "generate" secrets left empty, and enforce "required".
	envVars := map[string]string{}
	var secretKeys []string
	var createdAddons []Addon
	autoEnv := map[string]string{}
	for _, required := range tpl.RequiredAddons {
		addonName := uniqueCatalogAddonName(name, required.Type)
		addon, password, err := createManagedAddon(required.Type, addonName, serverID)
		if err != nil {
			jsonError(w, fmt.Sprintf("failed to create %s add-on: %v", required.Type, err), http.StatusBadRequest)
			return
		}
		createdAddons = append(createdAddons, *addon)
		for k, v := range catalogTemplateAddonEnv(tpl.ID, *addon, password) {
			autoEnv[k] = v
		}
	}

	// Derive public URL for templates that need it
	appURL := defaultAppURL(appID, serverID)
	if len(req.Domains) > 0 {
		appURL = "https://" + req.Domains[0]
	}
	if tpl.ID == "mixpost" {
		autoEnv["APP_URL"] = appURL
	}
	for _, e := range tpl.Env {
		val := e.Value
		if auto, ok := autoEnv[e.Key]; ok {
			val = auto
		}
		if ov, ok := req.EnvVars[e.Key]; ok && strings.TrimSpace(ov) != "" {
			val = strings.TrimSpace(ov)
		}
		if val == "" && e.Generate {
			if tpl.ID == "mixpost" && e.Key == "APP_KEY" {
				val = laravelAppKey()
			} else {
				val = addonPassword() // 24-char hex secret
			}
		}
		if val == "" && e.Required {
			jsonError(w, fmt.Sprintf("%s is required", e.Key), http.StatusBadRequest)
			return
		}
		if val != "" {
			envVars[e.Key] = val
			if e.Secret {
				secretKeys = append(secretKeys, e.Key)
			}
		}
	}

	// ── Persistent volumes: generate uniquely-named volumes so redeploys keep
	// data. Stateless templates get none.
	appsLock.Lock()
	taken := make(map[string]bool, len(apps))
	for _, a := range apps {
		taken[a.Name] = true
	}
	name = uniqueAppName(name, taken)
	var volumes []string
	volumePaths := append([]string{}, tpl.VolumePaths...)
	if tpl.VolumePath != "" {
		volumePaths = append([]string{tpl.VolumePath}, volumePaths...)
	}
	for i, path := range volumePaths {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		volName := fmt.Sprintf("paas-%s-%s-%d-data", name, generateRandomID()[:6], i+1)
		volumes = append(volumes, fmt.Sprintf("%s:%s", volName, path))
	}
	if tpl.ID == "dozzle" {
		volumes = append(volumes, "/var/run/docker.sock:/var/run/docker.sock:ro")
	}
	newApp := App{
		ID:            appID,
		Name:          name,
		Status:        "building",
		Port:          allocatePort(serverID),
		ServerID:      serverID,
		CreatedAt:     time.Now(),
		EnvVars:       envVars,
		SecretKeys:    secretKeys,
		PortOverride:  tpl.Port,
		Domains:       req.Domains,
		Memory:        req.Memory,
		CPUs:          req.CPUs,
		Volumes:       volumes,
		HealthPath:    tpl.HealthPath,
		BuildMethod:   "image",
		Image:         tpl.Image,
		CatalogID:     tpl.ID,
		WebhookSecret: generateRandomID() + generateRandomID(),
	}
	newApp.URL = defaultAppURL(newApp.ID, serverID)
	apps = append(apps, newApp)
	appsLock.Unlock()

	if err := dbSaveApp(newApp); err != nil {
		log.Printf("[db] failed to save catalog app: %v", err)
	}
	for _, addon := range createdAddons {
		markAddonAttached(addon.ID, appID)
	}

	buildLogsLock.Lock()
	buildLogs[appID] = []string{}
	buildLogsLock.Unlock()

	rebuildCaddyfile()

	deployID := generateRandomID()
	logFile := filepath.Join("data", "logs", appID, deployID+".log")
	os.MkdirAll(filepath.Dir(logFile), 0755)
	dep := DeploymentRecord{
		ID:        deployID,
		AppID:     appID,
		AppName:   newApp.Name,
		Status:    "building",
		LogFile:   logFile,
		CreatedAt: time.Now(),
		Trigger:   "catalog",
	}
	if err := dbCreateDeployment(dep); err != nil {
		log.Printf("[db] failed to create deployment: %v", err)
	}

	jsonOK(w, newApp.Public())

	// Image-based deploy: gitURL is unused.
	go runDeployment(newApp, "", deployID, logFile, "catalog", "")
}

func uniqueCatalogAddonName(appName, addonType string) string {
	base := appName + "-" + addonType
	if len(base) > 40 {
		maxAppLen := 40 - len(addonType) - 1
		if maxAppLen < 2 {
			maxAppLen = 2
		}
		base = strings.TrimRight(appName[:min(len(appName), maxAppLen)], "-") + "-" + addonType
	}
	if validAppName(base) {
		return base
	}
	return addonType + "-" + generateRandomID()[:6]
}

func catalogTemplateAddonEnv(templateID string, addon Addon, password string) map[string]string {
	base := catalogAddonEnv(addon, password)
	out := map[string]string{}
	switch templateID {
	case "wordpress":
		if addon.Type == "mysql" {
			out["WORDPRESS_DB_HOST"] = base["MYSQL_HOST"]
			out["WORDPRESS_DB_USER"] = base["MYSQL_USER"]
			out["WORDPRESS_DB_PASSWORD"] = base["MYSQL_PASSWORD"]
			out["WORDPRESS_DB_NAME"] = base["MYSQL_DATABASE"]
		}
	case "yourls":
		if addon.Type == "mysql" {
			out["YOURLS_DB_HOST"] = base["MYSQL_HOST"]
			out["YOURLS_DB_USER"] = base["MYSQL_USER"]
			out["YOURLS_DB_PASS"] = base["MYSQL_PASSWORD"]
			out["YOURLS_DB_NAME"] = base["MYSQL_DATABASE"]
		}
	case "paperless-ngx":
		if addon.Type == "redis" {
			out["PAPERLESS_REDIS"] = base["REDIS_URL"]
		}
	case "listmonk":
		if addon.Type == "postgres" {
			out["LISTMONK_db__host"] = base["POSTGRES_HOST"]
			out["LISTMONK_db__user"] = base["POSTGRES_USER"]
			out["LISTMONK_db__password"] = base["POSTGRES_PASSWORD"]
			out["LISTMONK_db__database"] = base["POSTGRES_DB"]
			out["LISTMONK_db__port"] = "5432"
			out["LISTMONK_db__sslmode"] = "disable"
			out["LISTMONK_app__address"] = "0.0.0.0:9000"
		}
	case "bookstack":
		if addon.Type == "mysql" {
			out["DB_HOST"] = base["MYSQL_HOST"]
			out["DB_USER"] = base["MYSQL_USER"]
			out["DB_PASS"] = base["MYSQL_PASSWORD"]
			out["DB_DATABASE"] = base["MYSQL_DATABASE"]
		}
	case "semaphore":
		if addon.Type == "postgres" {
			out["SEMAPHORE_DB_DIALECT"] = "postgres"
			out["SEMAPHORE_DB_HOST"] = base["POSTGRES_HOST"]
			out["SEMAPHORE_DB_PORT"] = "5432"
			out["SEMAPHORE_DB_USER"] = base["POSTGRES_USER"]
			out["SEMAPHORE_DB_PASS"] = base["POSTGRES_PASSWORD"]
			out["SEMAPHORE_DB"] = base["POSTGRES_DB"]
		}
	case "mixpost":
		if addon.Type == "mysql" {
			out["DB_HOST"] = base["MYSQL_HOST"]
			out["DB_PORT"] = "3306"
			out["DB_DATABASE"] = base["MYSQL_DATABASE"]
			out["DB_USERNAME"] = base["MYSQL_USER"]
			out["DB_PASSWORD"] = base["MYSQL_PASSWORD"]
			out["DB_CONNECTION"] = "mysql"
		} else if addon.Type == "redis" {
			out["REDIS_HOST"] = base["REDIS_HOST"]
			out["REDIS_PORT"] = "6379"
			out["REDIS_PASSWORD"] = base["REDIS_PASSWORD"]
		}
	case "matomo":
		if addon.Type == "mysql" {
			out["MATOMO_DATABASE_HOST"] = base["MYSQL_HOST"]
			out["MATOMO_DATABASE_DBNAME"] = base["MYSQL_DATABASE"]
			out["MATOMO_DATABASE_USERNAME"] = base["MYSQL_USER"]
			out["MATOMO_DATABASE_PASSWORD"] = base["MYSQL_PASSWORD"]
		}
	case "prestashop":
		if addon.Type == "mysql" {
			out["DB_SERVER"] = base["MYSQL_HOST"]
			out["DB_NAME"] = base["MYSQL_DATABASE"]
			out["DB_USER"] = base["MYSQL_USER"]
			out["DB_PASSWD"] = base["MYSQL_PASSWORD"]
		}
	default:
		for k, v := range base {
			out[k] = v
		}
	}
	return out
}

// ---------------------------------------------------------------------------
// Shared helpers for custom (non-template) deploys
// ---------------------------------------------------------------------------

// customDeployCommon holds the fields shared by the image and Dockerfile custom
// deploy endpoints.
type customDeployCommon struct {
	Name       string            `json:"name"`
	EnvVars    map[string]string `json:"envVars"`
	SecretKeys []string          `json:"secretKeys"`
	Domains    []string          `json:"domains"`
	Memory     string            `json:"memory"`
	CPUs       string            `json:"cpus"`
	Volumes    []string          `json:"volumes"`
	Port       int               `json:"port"`
	HealthPath string            `json:"healthPath"`
	ServerID   string            `json:"serverId"`
}

// validateCustomDeploy validates the common fields and returns a resolved app
// name, or writes an error response and returns ok=false.
func validateCustomDeploy(w http.ResponseWriter, c customDeployCommon, fallbackName string) (string, bool) {
	name := strings.TrimSpace(c.Name)
	if name == "" {
		name = fallbackName
	}
	if !validAppName(name) {
		jsonError(w, "invalid name: use 2-40 lowercase letters, digits, or hyphens (must start and end alphanumeric)", http.StatusBadRequest)
		return "", false
	}
	serverID := c.ServerID
	if serverID == "" {
		serverID = "localhost"
	}
	if err := validateResourceLimits(c.Memory, c.CPUs); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return "", false
	}
	if err := validateDomains(c.Domains); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return "", false
	}
	if err := validateVolumes(c.Volumes); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return "", false
	}
	return name, true
}

// cleanEnvVars drops blank keys and returns the secret keys that actually
// correspond to a provided variable.
func cleanEnvVars(in map[string]string, secretKeys []string) (map[string]string, []string) {
	out := map[string]string{}
	for k, v := range in {
		k = strings.TrimSpace(k)
		if k == "" {
			continue
		}
		out[k] = v
	}
	secret := map[string]bool{}
	for _, k := range secretKeys {
		secret[strings.TrimSpace(k)] = true
	}
	var keys []string
	for k := range out {
		if secret[k] {
			keys = append(keys, k)
		}
	}
	return out, keys
}

// startCustomDeploy persists a new app and kicks off the deploy pipeline. It
// assumes the caller has already validated name, limits, domains, and volumes.
func startCustomDeploy(w http.ResponseWriter, newApp App, trigger string) {
	appsLock.Lock()
	taken := make(map[string]bool, len(apps))
	for _, a := range apps {
		taken[a.Name] = true
	}
	newApp.Name = uniqueAppName(newApp.Name, taken)
	newApp.URL = defaultAppURL(newApp.ID, newApp.ServerID)
	apps = append(apps, newApp)
	appsLock.Unlock()

	if err := dbSaveApp(newApp); err != nil {
		log.Printf("[db] failed to save custom app: %v", err)
	}

	buildLogsLock.Lock()
	buildLogs[newApp.ID] = []string{}
	buildLogsLock.Unlock()

	rebuildCaddyfile()

	deployID := generateRandomID()
	logFile := filepath.Join("data", "logs", newApp.ID, deployID+".log")
	os.MkdirAll(filepath.Dir(logFile), 0755)
	dep := DeploymentRecord{
		ID:        deployID,
		AppID:     newApp.ID,
		AppName:   newApp.Name,
		Status:    "building",
		LogFile:   logFile,
		CreatedAt: time.Now(),
		Trigger:   trigger,
	}
	if err := dbCreateDeployment(dep); err != nil {
		log.Printf("[db] failed to create deployment: %v", err)
	}

	jsonOK(w, newApp.Public())
	go runDeployment(newApp, "", deployID, logFile, trigger, "")
}

// ---------------------------------------------------------------------------
// POST /api/catalog/deploy-image — deploy any registry image
// ---------------------------------------------------------------------------

func handleCatalogDeployImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		customDeployCommon
		Image string `json:"image"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
		return
	}

	image, err := validateImageRef(req.Image)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Derive a fallback app name from the image (e.g. ghcr.io/owner/app:tag → app).
	fallback := imageBaseName(image)
	name, ok := validateCustomDeploy(w, req.customDeployCommon, fallback)
	if !ok {
		return
	}

	envVars, secretKeys := cleanEnvVars(req.EnvVars, req.SecretKeys)

	serverId := req.ServerID
	if serverId == "" {
		serverId = "localhost"
	}
	newApp := App{
		ID:            generateRandomID(),
		Name:          name,
		Status:        "building",
		Port:          allocatePortLocked(serverId),
		ServerID:      serverId,
		CreatedAt:     time.Now(),
		EnvVars:       envVars,
		SecretKeys:    secretKeys,
		PortOverride:  req.Port,
		Domains:       req.Domains,
		Memory:        req.Memory,
		CPUs:          req.CPUs,
		Volumes:       req.Volumes,
		HealthPath:    req.HealthPath,
		BuildMethod:   "image",
		Image:         image,
		WebhookSecret: generateRandomID() + generateRandomID(),
	}
	startCustomDeploy(w, newApp, "image")
}

// ---------------------------------------------------------------------------
// POST /api/catalog/deploy-dockerfile — build & run an inline Dockerfile
// ---------------------------------------------------------------------------

func handleCatalogDeployDockerfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		customDeployCommon
		Dockerfile string `json:"dockerfile"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonError(w, "Bad request: "+err.Error(), http.StatusBadRequest)
		return
	}

	content := strings.TrimSpace(req.Dockerfile)
	if content == "" {
		jsonError(w, "dockerfile content is required", http.StatusBadRequest)
		return
	}
	if len(content) > 64*1024 {
		jsonError(w, "dockerfile is too large (max 64 KB)", http.StatusBadRequest)
		return
	}
	if !strings.Contains(strings.ToUpper(content), "FROM ") {
		jsonError(w, "dockerfile must contain a FROM instruction", http.StatusBadRequest)
		return
	}

	name, ok := validateCustomDeploy(w, req.customDeployCommon, "app")
	if !ok {
		return
	}

	envVars, secretKeys := cleanEnvVars(req.EnvVars, req.SecretKeys)

	serverId := req.ServerID
	if serverId == "" {
		serverId = "localhost"
	}
	newApp := App{
		ID:                generateRandomID(),
		Name:              name,
		Status:            "building",
		Port:              allocatePortLocked(serverId),
		ServerID:          serverId,
		CreatedAt:         time.Now(),
		EnvVars:           envVars,
		SecretKeys:        secretKeys,
		PortOverride:      req.Port,
		Domains:           req.Domains,
		Memory:            req.Memory,
		CPUs:              req.CPUs,
		Volumes:           req.Volumes,
		HealthPath:        req.HealthPath,
		BuildMethod:       "dockerfile-inline",
		DockerfileContent: content,
		WebhookSecret:     generateRandomID() + generateRandomID(),
	}
	startCustomDeploy(w, newApp, "dockerfile")
}

// imageBaseName extracts a usable app-name seed from an image reference by
// taking the last path segment and stripping any tag/digest, then sanitizing.
func imageBaseName(image string) string {
	s := image
	if at := strings.Index(s, "@"); at >= 0 {
		s = s[:at]
	}
	// Take the final path segment.
	if slash := strings.LastIndex(s, "/"); slash >= 0 {
		s = s[slash+1:]
	}
	// Strip the tag.
	if colon := strings.Index(s, ":"); colon >= 0 {
		s = s[:colon]
	}
	s = strings.ToLower(s)
	// Keep only allowed characters.
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			b.WriteRune(r)
		}
	}
	out := strings.Trim(b.String(), "-")
	if len(out) < 2 {
		return "app"
	}
	if len(out) > 40 {
		out = strings.Trim(out[:40], "-")
	}
	return out
}

// allocatePortLocked acquires appsLock and allocates a free host port. The
// underlying allocatePort requires the caller to hold appsLock.
func allocatePortLocked(serverID string) int {
	appsLock.Lock()
	defer appsLock.Unlock()
	return allocatePort(serverID)
}

func laravelAppKey() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "base64:yS4U+ZJ3bYFqHl+3XmS7w9uXo4G6Z9d3Y5U+W8e7rNs="
	}
	return "base64:" + base64.StdEncoding.EncodeToString(b)
}
