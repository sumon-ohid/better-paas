# test-projects

A set of intentionally tiny apps for deploying and testing the BaaS platform.
Each one exercises a different Nixpacks build path so you can confirm every
stack your platform supports actually deploys end-to-end.

## The one rule every app follows

The platform injects a `PORT` environment variable and publishes the container
on that port. **Every app must bind `0.0.0.0:$PORT`.** Apps that hardcode a port
will 502 unless you set `PortOverride` to that exact port when creating the app.

Each app also exposes a health endpoint returning `200`, so you can set the
app's `healthPath` for a real readiness check during deploys.

## Projects

| Folder            | Stack                  | Deps | Health path    | Notes                                   |
|-------------------|------------------------|------|----------------|-----------------------------------------|
| `node-express`    | Node + Express         | yes  | `/health`      | Classic framework + npm install         |
| `node-plain`      | Node, stdlib           | none | `/health`      | Zero dependencies, fastest build        |
| `node-nextjs`     | Node + Next.js 14      | yes  | `/health`      | App Router, build step + `next start`   |
| `python-flask`    | Python + Flask         | yes  | `/health`      | `requirements.txt` + gunicorn (Procfile)|
| `python-fastapi`  | Python + FastAPI       | yes  | `/health`      | uvicorn (Procfile)                      |
| `go-http`         | Go, stdlib             | none | `/health`      | Compiled binary, tiny image             |
| `go-gin`          | Go + Gin               | yes  | `/health`      | Popular Go web framework                 |
| `rust-axum`       | Rust + axum            | yes  | `/health`      | Compiled binary, multi-stage build      |
| `ruby-sinatra`    | Ruby + Sinatra         | yes  | `/health`      | puma (Procfile), needs `.ruby-version`  |
| `php-vanilla`     | PHP 8.x                | no   | `/health`      | nginx + php-fpm via Nixpacks            |
| `java-springboot` | Java 17 + Spring Boot  | yes  | `/health`      | Maven build, reads `server.port=$PORT`  |
| `static-site`     | Static HTML            | none | `/health.html` | nginx static serving, no runtime        |

## How each app reads the port

- **Node** (`express`, `plain`): `process.env.PORT`, `listen(PORT, "0.0.0.0")`.
- **Next.js**: `next start` reads `PORT` automatically.
- **Flask/FastAPI**: the `Procfile` passes `$PORT` to gunicorn/uvicorn with `--host 0.0.0.0`.
- **Go** (`http`, `gin`): `os.Getenv("PORT")`, bind `0.0.0.0:$PORT`.
- **Rust**: `env::var("PORT")`, bind `0.0.0.0:$PORT`.
- **Ruby**: `Procfile` runs puma bound to `tcp://0.0.0.0:$PORT`.
- **PHP**: Nixpacks' nginx template substitutes `$PORT` automatically.
- **Java**: `application.properties` sets `server.port=${PORT:8080}`; Nixpacks
  also starts with `-Dserver.port=$PORT`.
- **Static**: Nixpacks' nginx config substitutes `$PORT` automatically.

## Deploying

The platform deploys by cloning a git repo. Two options:

- **Separate repos:** push each folder as its own repo, deploy with default `RootDir`.
- **Monorepo:** push `test-projects` as one repo and set the app's `RootDir`
  to the subfolder (e.g. `node-express`).

Recommended settings per app: leave build/start commands empty (Nixpacks
auto-detects them) and set `healthPath` to the value in the table above.

## Verification status

All projects were validated with `nixpacks plan` (the same builder the platform
uses) to confirm the stack is detected and a correct start command is produced.
`go-gin`, `go-http`, `node-plain`, `python-flask`, and `python-fastapi` were
additionally run locally and confirmed to serve `/` and `/health` with `200`.
The remaining apps (Next.js, Rust, Ruby, PHP, Java, static) rely on toolchains
not installed on this machine, so they were verified at the Nixpacks-plan level
only - build/run them on the platform to confirm end-to-end.
