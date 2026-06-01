# Contributing to Better-PaaS

Thank you for your interest in contributing to Better-PaaS! We welcome contributions from developers of all skill levels. By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## How Can I Contribute?

### 1. Reporting Bugs
If you find a bug, please search existing issues to see if it has already been reported. If not, open a new issue and include:
- A clear, descriptive title.
- Steps to reproduce the bug.
- Expected vs. actual behavior.
- Screenshots or log outputs, if applicable.
- Your environment details (OS, Docker version, Go version).

### 2. Suggesting Enhancements
We are always looking for ways to make Better-PaaS better. If you have an idea:
- Open an issue describing the feature.
- Explain *why* this feature is useful and what problem it solves.
- Describe how it should work or look.

### 3. Submitting Pull Requests
If you want to contribute code changes:
1. Fork the repository and create your branch from `main`.
2. Keep your branch names short and descriptive (e.g. `feat/custom-domains`, `fix/caddy-reload`).
3. Implement your changes, write tests, and ensure everything builds locally.
4. Follow the coding guidelines below.
5. Open a Pull Request (PR) against our `main` branch.

---

## Local Development Setup

To run Better-PaaS locally for development, you will need:
- **Go** (version 1.25 or higher)
- **Node.js** (version 18.17.0 or higher)
- **pnpm** (package manager for the frontend)
- **Docker** (running on your host)
- **Nixpacks** & **Caddy** (optional for basic testing, but required for full deployment flows)

### 1. Clone the Repository
```bash
git clone https://github.com/sumon-ohid/better-paas.git
cd better-paas
```

### 2. Run the Backend
The backend is a Go application that interacts with SQLite and the local Docker daemon.
```bash
cd backend
# Create dynamic data directories (ignored by Git)
mkdir -p data builds
# Run in development mode
go run .
```
The API server will listen on `http://localhost:8080` by default.

### 3. Run the Frontend
The frontend is a Next.js single-page application.
```bash
cd frontend
# Install dependencies
pnpm install
# Run the development server
pnpm dev
```
Open `http://localhost:3000` in your web browser.

---

## Coding Guidelines

### Code Formatting
- **Go**: Always format your Go code using `go fmt` before committing.
- **TypeScript/React**: Ensure there are no TypeScript compile errors and run linter commands if applicable.

### Database Migrations
The backend uses a lightweight, custom additive schema migration runner (`backend/db.go`). If you add or modify tables, add your schema updates to the migration runner logic in `backend/db.go`.

### Commit Message Guidelines
We prefer clean, descriptive commit messages. Try to follow the [Conventional Commits](https://www.conventionalcommits.org/) format:
- `feat: ...` for new features (e.g. `feat: add Slack notification support`)
- `fix: ...` for bug fixes (e.g. `fix: resolve caddy reload race condition`)
- `chore: ...` for build tasks or housekeeping (e.g. `chore: update dependencies`)
- `docs: ...` for documentation changes (e.g. `docs: add contributing guide`)
