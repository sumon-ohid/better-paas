# Backend Architecture

The backend is a Go module. The executable entrypoint lives at `main.go` in
the backend root, while the main application package lives in `internal/paas`.

## Layout

- `main.go`: binary entrypoint. Keep this thin.
- `internal/paas/`: API process, domain models, deployment workflows, storage,
  background jobs, tests, and feature handlers.
- `internal/catalog/`: curated one-click app template data and template
  structs. Edit app catalog definitions here.
- `internal/paas/app.go`: boot sequence for the API process and background workers.
- `internal/paas/routes.go`: HTTP and WebSocket route registration, grouped by feature area.
- `internal/paas/http_middleware.go`: auth gate, CORS, and request body protection.
- `internal/paas/config.go`: environment parsing and process-level runtime configuration.
- `internal/paas/models.go`: shared domain models passed between handlers, storage, and
  deployment code.
- `internal/paas/db.go`: SQLite initialization, migrations, and persistence helpers.
- `internal/paas/catalog.go`: catalog API handlers, image size fetching, and custom catalog
  deploy orchestration.
- `internal/paas/docker.go`, `internal/paas/compose.go`, `internal/paas/caddy.go`, `internal/paas/executor.go`: deployment,
  container, compose, proxy, local, and SSH execution workflows.
- Feature files such as `internal/paas/addons.go`, `internal/paas/backup.go`,
  `internal/paas/cron.go`, `internal/paas/domains.go`,
  `internal/paas/servers.go`, `internal/paas/terminal.go`, and
  `internal/paas/analytics*.go` own their API behavior.

## Contributor Guidelines

Prefer small, feature-named files over broad catch-all files. When a file grows
large, split by responsibility first:

- request handlers
- storage helpers
- background jobs
- provider/client code
- static or curated data

Keep `main.go` limited to calling `paas.Run()`. This keeps the
runtime path easy to test and avoids hiding behavior in the command package.

Go packages are directory-scoped, so moving feature files into subdirectories
also creates new packages. Prefer incremental moves into `internal/<feature>`
when the code has a clean boundary, as with `internal/catalog`. Avoid moving a
large file just for tidiness if it would require exporting unrelated globals or
handler internals.

Run backend checks from this directory:

```bash
go test ./...
go run .
```
