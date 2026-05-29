#!/usr/bin/env bash
# =============================================================================
# Better-PaaS — Single-Command VPS Installer
#
# Set BETTER_PAAS_REPO_URL to your fork/repo before piping to bash, e.g.:
#   curl -fsSL https://raw.githubusercontent.com/<you>/better-paas/main/install.sh \
#     | BETTER_PAAS_REPO_URL=https://github.com/<you>/better-paas.git bash
# Or run it from a checked-out copy:
#   bash install.sh
# =============================================================================

set -euo pipefail

REPO_DIR="$HOME/better-paas"
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"
DATA_DIR="$BACKEND_DIR/data"
SERVICE_USER="${SUDO_USER:-$USER}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

# ── Detect OS ────────────────────────────────────────────────────────────────

detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS="${ID:-unknown}"
  elif [ "$(uname)" = "Darwin" ]; then
    OS="darwin"
  else
    OS="unknown"
  fi
}

# ── Root check ───────────────────────────────────────────────────────────────

require_root() {
  if [ "$(id -u)" -ne 0 ] && [ "$OS" != "darwin" ]; then
    error "This installer must be run as root on Linux. Try: sudo bash install.sh"
  fi
}

# ── Install system packages ───────────────────────────────────────────────────

install_dependencies() {
  info "Installing system dependencies..."

  case "$OS" in
    ubuntu|debian)
      apt-get update -qq
      apt-get install -y -qq curl git build-essential ca-certificates gnupg lsb-release
      ;;
    centos|rhel|fedora|almalinux|rocky)
      yum install -y curl git gcc ca-certificates
      ;;
    darwin)
      if ! command -v brew &>/dev/null; then
        info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      fi
      brew install git curl || true
      ;;
    *)
      warn "Unknown OS. Assuming required tools are installed."
      ;;
  esac
  success "System dependencies ready."
}

# ── Install Go ───────────────────────────────────────────────────────────────

install_go() {
  if command -v go &>/dev/null; then
    GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
    info "Go already installed: ${GO_VERSION}"
    return
  fi

  info "Installing Go 1.25.0..."
  GO_VERSION="1.25.0"
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64)  GO_ARCH="amd64" ;;
    aarch64) GO_ARCH="arm64" ;;
    arm64)   GO_ARCH="arm64" ;;
    *)       error "Unsupported architecture: $ARCH" ;;
  esac

  if [ "$OS" = "darwin" ]; then
    GOOS="darwin"
  else
    GOOS="linux"
  fi

  TARBALL="go${GO_VERSION}.${GOOS}-${GO_ARCH}.tar.gz"
  curl -fsSL "https://go.dev/dl/${TARBALL}" -o /tmp/go.tar.gz
  rm -rf /usr/local/go
  tar -C /usr/local -xzf /tmp/go.tar.gz
  rm /tmp/go.tar.gz

  export PATH="/usr/local/go/bin:$PATH"
  echo 'export PATH="/usr/local/go/bin:$PATH"' >> "$HOME/.profile"
  success "Go ${GO_VERSION} installed."
}

# ── Install Docker ────────────────────────────────────────────────────────────

install_docker() {
  if command -v docker &>/dev/null; then
    info "Docker already installed: $(docker --version)"
    return
  fi

  info "Installing Docker..."

  case "$OS" in
    ubuntu|debian)
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/${OS}/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      chmod a+r /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/${OS} $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list
      apt-get update -qq
      apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      systemctl enable --now docker
      ;;
    centos|rhel|almalinux|rocky)
      yum install -y yum-utils
      yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
      yum install -y docker-ce docker-ce-cli containerd.io
      systemctl enable --now docker
      ;;
    darwin)
      warn "Install Docker Desktop manually from https://www.docker.com/products/docker-desktop"
      return
      ;;
    *)
      warn "Could not auto-install Docker. Please install it manually."
      return
      ;;
  esac

  # Add current user to docker group (no sudo for docker commands)
  if [ -n "${SUDO_USER:-}" ]; then
    usermod -aG docker "$SUDO_USER" || true
  fi

  success "Docker installed."
}

# ── Install Nixpacks ──────────────────────────────────────────────────────────

install_nixpacks() {
  if command -v nixpacks &>/dev/null; then
    info "Nixpacks already installed: $(nixpacks --version)"
    return
  fi

  info "Installing Nixpacks..."
  curl -fsSL https://nixpacks.com/install.sh | bash
  success "Nixpacks installed."
}

# ── Install Caddy ─────────────────────────────────────────────────────────────

install_caddy() {
  if command -v caddy &>/dev/null; then
    info "Caddy already installed: $(caddy version)"
    return
  fi

  info "Installing Caddy..."

  case "$OS" in
    ubuntu|debian)
      apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
      apt-get update -qq
      apt-get install -y -qq caddy
      ;;
    centos|rhel|almalinux|rocky|fedora)
      yum install -y 'dnf-command(copr)' || true
      yum copr enable -y @caddy/caddy || true
      yum install -y caddy
      ;;
    darwin)
      brew install caddy
      ;;
    *)
      # Fallback: direct binary download
      CADDY_VERSION="2.8.4"
      ARCH=$(uname -m)
      case "$ARCH" in
        x86_64)  CADDY_ARCH="amd64" ;;
        aarch64) CADDY_ARCH="arm64" ;;
        arm64)   CADDY_ARCH="arm64" ;;
        *)       error "Unsupported architecture for Caddy: $ARCH" ;;
      esac
      GOOS=$([ "$OS" = "darwin" ] && echo "darwin" || echo "linux")
      curl -fsSL "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_${GOOS}_${CADDY_ARCH}.tar.gz" \
        -o /tmp/caddy.tar.gz
      tar -C /usr/local/bin -xzf /tmp/caddy.tar.gz caddy
      chmod +x /usr/local/bin/caddy
      rm /tmp/caddy.tar.gz
      ;;
  esac
  success "Caddy installed."
}

# ── Install Node.js + pnpm ────────────────────────────────────────────────────

install_node() {
  if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    info "Node.js already installed: ${NODE_VER}"
  else
    info "Installing Node.js 22 via NodeSource..."
    case "$OS" in
      ubuntu|debian)
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        apt-get install -y -qq nodejs
        ;;
      centos|rhel|almalinux|rocky|fedora)
        curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
        yum install -y nodejs
        ;;
      darwin)
        brew install node@22 || brew upgrade node || true
        ;;
      *)
        warn "Please install Node.js 22 manually."
        ;;
    esac
  fi

  if ! command -v pnpm &>/dev/null; then
    info "Installing pnpm..."
    npm install -g pnpm@latest
  fi
  success "Node.js and pnpm ready."
}

# ── Clone or update the repo ──────────────────────────────────────────────────

setup_repo() {
  REPO_URL="${BETTER_PAAS_REPO_URL:-}"
  if [ -z "$REPO_URL" ]; then
    error "No repository URL set. Re-run with BETTER_PAAS_REPO_URL=https://github.com/<you>/better-paas.git, or run this script from inside a checked-out copy of the repo."
  fi

  if [ -d "$REPO_DIR/.git" ]; then
    info "Updating existing installation at $REPO_DIR..."
    git -C "$REPO_DIR" pull --ff-only
  else
    info "Cloning Better-PaaS to $REPO_DIR..."
    git clone "$REPO_URL" "$REPO_DIR"
  fi
  success "Repository ready."
}

# ── Build backend ─────────────────────────────────────────────────────────────

build_backend() {
  info "Building Go backend..."
  cd "$BACKEND_DIR"
  mkdir -p data builds
  go mod download
  go build -ldflags="-s -w" -o server .
  success "Backend binary compiled."
}

# ── Build frontend ────────────────────────────────────────────────────────────

build_frontend() {
  info "Installing frontend dependencies..."
  cd "$FRONTEND_DIR"
  pnpm install --frozen-lockfile
  info "Building frontend production bundle..."
  pnpm build
  success "Frontend built."
}

# ── Create systemd services ───────────────────────────────────────────────────

create_services() {
  if [ "$OS" = "darwin" ]; then
    create_launchd_services
    return
  fi

  info "Creating systemd service units..."

  # Backend service
  cat > /etc/systemd/system/better-paas-backend.service <<EOF
[Unit]
Description=Better-PaaS Backend
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${BACKEND_DIR}
ExecStart=${BACKEND_DIR}/server
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=better-paas-backend

[Install]
WantedBy=multi-user.target
EOF

  # Frontend service (Next.js)
  cat > /etc/systemd/system/better-paas-frontend.service <<EOF
[Unit]
Description=Better-PaaS Frontend
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${FRONTEND_DIR}
ExecStart=$(which pnpm) start
Restart=on-failure
RestartSec=5
Environment=PORT=3000
StandardOutput=journal
StandardError=journal
SyslogIdentifier=better-paas-frontend

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable better-paas-backend better-paas-frontend
  systemctl restart better-paas-backend better-paas-frontend
  success "Systemd services installed and started."
}

create_launchd_services() {
  info "macOS detected — skipping systemd. Starting processes in background..."

  # Kill any existing processes
  pkill -f "better-paas/backend/server" 2>/dev/null || true
  pkill -f "better-paas/frontend" 2>/dev/null || true

  # Start backend
  cd "$BACKEND_DIR"
  nohup ./server > "$BACKEND_DIR/server.log" 2>&1 &
  echo "Backend PID: $!"

  # Start frontend
  cd "$FRONTEND_DIR"
  nohup pnpm start > "$FRONTEND_DIR/frontend.log" 2>&1 &
  echo "Frontend PID: $!"

  success "Processes started in background."
}

# ── Print summary ─────────────────────────────────────────────────────────────

print_summary() {
  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}   ✅  Better-PaaS installed successfully!         ${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${CYAN}Dashboard:${NC}  http://localhost:3000"
  echo -e "  ${CYAN}API:${NC}        http://localhost:8080"
  echo -e "  ${CYAN}Logs dir:${NC}   $BACKEND_DIR/data/"
  echo ""
  print_admin_token
  echo -e "  ${YELLOW}Deployed apps are accessible at:${NC}"
  echo -e "  http://[app-id].[server-ip].sslip.io"
  echo ""
  if [ "$OS" != "darwin" ]; then
    echo -e "  ${CYAN}Manage services:${NC}"
    echo -e "  sudo systemctl status better-paas-backend"
    echo -e "  sudo systemctl status better-paas-frontend"
    echo -e "  journalctl -u better-paas-backend -f"
  fi
  echo ""
}

# print_admin_token surfaces the auto-generated admin token so the operator can
# sign in to the dashboard. The backend writes it to data/admin_token.txt on
# first run.
print_admin_token() {
  local token_file="$DATA_DIR/admin_token.txt"
  # Give the backend a moment to start and generate the token on first run.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    [ -f "$token_file" ] && break
    sleep 1
  done

  if [ -f "$token_file" ]; then
    echo -e "${YELLOW}─────────────────────────────────────────────────────────────${NC}"
    echo -e "  ${YELLOW}🔑  ADMIN TOKEN — you need this to LOG IN to the dashboard${NC}"
    echo ""
    echo -e "      ${GREEN}$(cat "$token_file")${NC}"
    echo ""
    echo -e "  ${CYAN}Paste it into the sign-in screen at http://localhost:3000${NC}"
    echo -e "  ${CYAN}Saved at: $token_file${NC}"
    echo -e "  ${CYAN}Show again later:  cd $BACKEND_DIR && ./server token${NC}"
    echo -e "${YELLOW}─────────────────────────────────────────────────────────────${NC}"
  else
    echo -e "  ${YELLOW}🔑  ADMIN TOKEN (needed to log in):${NC} run ${CYAN}cd $BACKEND_DIR && ./server token${NC}"
    echo -e "      or check the backend logs / $token_file"
  fi
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────

main() {
  echo -e "${CYAN}"
  echo "  ╔═══════════════════════════════════════╗"
  echo "  ║     Better-PaaS Installer v1.0   ║"
  echo "  ╚═══════════════════════════════════════╝"
  echo -e "${NC}"

  detect_os
  info "Detected OS: ${OS}"

  if [ "$OS" != "darwin" ]; then
    require_root
  fi

  install_dependencies
  install_go
  install_docker
  install_nixpacks
  install_caddy
  install_node

  # If running from the repo directly, skip clone
  if [ -d "$BACKEND_DIR" ] && [ -f "$BACKEND_DIR/main.go" ]; then
    info "Running from existing repo directory."
    BACKEND_DIR="$(cd "$(dirname "$0")/backend" && pwd)"
    FRONTEND_DIR="$(cd "$(dirname "$0")/frontend" && pwd)"
  else
    setup_repo
  fi

  build_backend
  build_frontend
  create_services
  print_summary
}

main "$@"
