#!/usr/bin/env bash
# =============================================================================
# Better-PaaS — Single-Command VPS Installer
#
# Set BETTER_PAAS_REPO_URL to your fork/repo before piping to bash, e.g.:
#   curl -fsSL https://raw.githubusercontent.com/<you>/better-paas/main/install.sh \
#     | BETTER_PAAS_REPO_URL=https://github.com/<you>/better-paas.git sudo bash
# Or run it from a checked-out copy:
#   bash install.sh
# =============================================================================

set -euo pipefail

# Determine the user's real home directory (even if running under sudo)
get_user_home() {
  if [ -n "${SUDO_USER:-}" ]; then
    if command -v getent &>/dev/null; then
      getent passwd "$SUDO_USER" | cut -d: -f6
    else
      eval echo "~$SUDO_USER"
    fi
  else
    echo "$HOME"
  fi
}

REAL_HOME=$(get_user_home)
REPO_DIR="$REAL_HOME/better-paas"

# Determine if running from a local repository copy
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-}")" && pwd 2>/dev/null || pwd)"
if [ -f "$SCRIPT_DIR/backend/main.go" ]; then
  REPO_DIR="$SCRIPT_DIR"
fi

BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"
DATA_DIR="$REPO_DIR/data"
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

# Returns 0 if version $1 >= $2, 1 otherwise
version_ge() {
  awk -v v1="$1" -v v2="$2" '
    function clean(v) { gsub(/[^0-9.]/, "", v); return v }
    BEGIN {
      split(clean(v1), a, ".")
      split(clean(v2), b, ".")
      for (i=1; i<=3; i++) {
        if ((a[i]+0) > (b[i]+0)) exit 0
        if ((a[i]+0) < (b[i]+0)) exit 1
      }
      exit 0
    }'
}

# Warn if standard ports are already bound
check_ports() {
  local ports=(3000 8080)
  for port in "${ports[@]}"; do
    if command -v lsof &>/dev/null; then
      if lsof -Pi :$port -sTCP:LISTEN -t &>/dev/null; then
        warn "Port $port is already in use. This might cause startup issues."
      fi
    elif command -v netstat &>/dev/null; then
      if netstat -tuln | grep -q ":$port "; then
        warn "Port $port is already in use. This might cause startup issues."
      fi
    fi
  done
}

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
      apt-get install -y -qq curl git build-essential ca-certificates gnupg lsb-release libcap2-bin
      ;;
    centos|rhel|fedora|almalinux|rocky)
      yum makecache || true
      yum install -y curl git gcc ca-certificates libcap
      ;;
    darwin)
      if ! command -v brew &>/dev/null; then
        info "Installing Homebrew..."
        NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        # Load Homebrew into PATH for the current shell session
        if [ -f /opt/homebrew/bin/brew ]; then
          eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [ -f /usr/local/bin/brew ]; then
          eval "$(/usr/local/bin/brew shellenv)"
        fi
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
    if version_ge "$GO_VERSION" "1.25.0"; then
      info "Go already installed: ${GO_VERSION} (meets requirement >= 1.25.0)"
      return
    else
      warn "Installed Go version ${GO_VERSION} is older than required 1.25.0."
    fi
  fi

  info "Installing Go 1.25.0..."
  if [ "$OS" = "darwin" ]; then
    brew install go
    success "Go installed via Homebrew."
    return
  fi

  GO_VERSION="1.25.0"
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64)  GO_ARCH="amd64" ;;
    aarch64) GO_ARCH="arm64" ;;
    arm64)   GO_ARCH="arm64" ;;
    *)       error "Unsupported architecture: $ARCH" ;;
  esac

  GOOS="linux"
  TARBALL="go${GO_VERSION}.${GOOS}-${GO_ARCH}.tar.gz"
  curl -fsSL "https://go.dev/dl/${TARBALL}" -o /tmp/go.tar.gz
  rm -rf /usr/local/go
  tar -C /usr/local -xzf /tmp/go.tar.gz
  rm /tmp/go.tar.gz

  export PATH="/usr/local/go/bin:$PATH"
  echo 'export PATH="/usr/local/go/bin:$PATH"' > /etc/profile.d/go.sh
  chmod +x /etc/profile.d/go.sh
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
      curl -fsSL https://download.docker.com/linux/${OS}/gpg | gpg --yes --dearmor -o /etc/apt/keyrings/docker.gpg
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
  if [ "$OS" = "darwin" ]; then
    brew install nixpacks
  else
    curl -fsSL https://nixpacks.com/install.sh | bash
  fi
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
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
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

configure_caddy_bind_capability() {
  if [ "$OS" = "darwin" ]; then
    return
  fi

  if ! command -v caddy &>/dev/null; then
    warn "Caddy is not available in PATH; skipping low-port capability setup."
    return
  fi

  local caddy_bin
  caddy_bin="$(command -v caddy)"
  if command -v readlink &>/dev/null; then
    caddy_bin="$(readlink -f "$caddy_bin" 2>/dev/null || echo "$caddy_bin")"
  fi

  if ! command -v setcap &>/dev/null; then
    warn "setcap is not available; Caddy may fail to bind ports 80/443 unless run as root."
    return
  fi

  info "Allowing Caddy to bind ports 80/443 without running Better-PaaS as root..."
  if setcap 'cap_net_bind_service=+ep' "$caddy_bin"; then
    success "Caddy bind capability configured on $caddy_bin."
  else
    warn "Could not set cap_net_bind_service on $caddy_bin. If app URLs fail, run: sudo setcap 'cap_net_bind_service=+ep' $caddy_bin"
  fi
}

# ── Install Node.js + pnpm ────────────────────────────────────────────────────

do_install_node() {
  info "Installing Node.js 22..."
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
}

install_node() {
  if command -v node &>/dev/null; then
    NODE_VER=$(node --version | sed 's/v//')
    if version_ge "$NODE_VER" "22.13.0"; then
      info "Node.js already installed: v${NODE_VER} (meets requirement >= 22.13.0)"
    else
      warn "Installed Node.js version v${NODE_VER} is older than required 22.13.0."
      do_install_node
    fi
  else
    do_install_node
  fi

  corepack enable 2>/dev/null || true
  if ! corepack prepare pnpm@11.1.2 --activate 2>/dev/null; then
    info "Installing pnpm..."
    if [ "$OS" = "darwin" ]; then
      brew install pnpm || npm install -g pnpm@11.1.2
    else
      npm install -g pnpm@11.1.2
    fi
  fi
  success "Node.js and pnpm ready."
}

# ── Clone or update the repo ──────────────────────────────────────────────────

setup_repo() {
  REPO_URL="${BETTER_PAAS_REPO_URL:-https://github.com/sumon-ohid/better-paas.git}"
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

# ── Align data/builds with Docker layout (repo root) ──────────────────────────

normalize_data_paths() {
  local root_data="$REPO_DIR/data"
  local backend_data="$BACKEND_DIR/data"
  local root_builds="$REPO_DIR/builds"
  local backend_builds="$BACKEND_DIR/builds"

  mkdir -p "$root_data" "$root_builds"

  if [ -f "$root_data/baas.db" ]; then
    info "Using existing data at $root_data"
  elif [ -f "$backend_data/baas.db" ]; then
    info "Migrating control-plane data from $backend_data to $root_data..."
    shopt -s dotglob nullglob
    cp -a "$backend_data"/* "$root_data"/ 2>/dev/null || true
    shopt -u dotglob nullglob
    success "Data migrated to $root_data"
  fi

  if [ -d "$backend_builds" ] && [ -n "$(ls -A "$backend_builds" 2>/dev/null || true)" ]; then
    if [ -z "$(ls -A "$root_builds" 2>/dev/null || true)" ]; then
      info "Migrating app build cache from $backend_builds to $root_builds..."
      cp -a "$backend_builds"/. "$root_builds"/
      success "Build cache migrated to $root_builds"
    fi
  fi
}

# ── Build backend ─────────────────────────────────────────────────────────────

build_backend() {
  info "Building Go backend..."
  mkdir -p "$DATA_DIR" "$REPO_DIR/builds"
  cd "$BACKEND_DIR"
  go mod download
  # Bake the version (latest git tag, or short commit) into the binary so the
  # dashboard's updater can compare against published releases.
  VERSION="$(git -C "$REPO_DIR" describe --tags --always 2>/dev/null || echo dev)"
  go build -ldflags="-s -w -X paas/internal/paas.version=${VERSION}" -o server .
  success "Backend binary compiled (${VERSION})."
}

# ── Build frontend ────────────────────────────────────────────────────────────

build_frontend() {
  info "Installing frontend dependencies..."
  cd "$FRONTEND_DIR"
  CI=true pnpm install --frozen-lockfile
  info "Building frontend production bundle..."
  pnpm build
  success "Frontend built."
}

# ── Configure updater restart permissions ────────────────────────────────────

configure_updater_sudoers() {
  if [ "$OS" = "darwin" ]; then
    return
  fi

  local systemctl_path
  systemctl_path="$(command -v systemctl || true)"
  if [ -z "$systemctl_path" ]; then
    warn "systemctl not found; skipping updater sudoers setup."
    return
  fi

  info "Allowing updater to restart Better-PaaS services..."
  cat > /etc/sudoers.d/better-paas <<EOF
${SERVICE_USER} ALL=(root) NOPASSWD: ${systemctl_path} restart better-paas-backend, ${systemctl_path} restart better-paas-frontend
EOF
  chmod 0440 /etc/sudoers.d/better-paas
  if command -v visudo &>/dev/null; then
    visudo -cf /etc/sudoers.d/better-paas >/dev/null
  fi
  success "Updater restart permissions configured."
}

# ── Create systemd services ───────────────────────────────────────────────────

create_services() {
  if [ "$OS" = "darwin" ]; then
    create_launchd_services
    return
  fi

  info "Creating systemd service units..."

  # Derive the "owner/repo" slug from the configured repo URL so the in-app
  # updater knows where to look for releases. Best-effort; blank if unknown.
  UPDATE_REPO_SLUG=""
  REMOTE_URL="$(git -C "$REPO_DIR" config --get remote.origin.url 2>/dev/null || echo "")"
  if [ -n "$REMOTE_URL" ]; then
    UPDATE_REPO_SLUG="$(echo "$REMOTE_URL" \
      | sed -E 's#^git@[^:]+:##; s#^https?://[^/]+/##; s#\.git$##')"
  fi

  # Backend service
  cat > /etc/systemd/system/better-paas-backend.service <<EOF
[Unit]
Description=Better-PaaS Backend
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${REPO_DIR}
Environment=UPDATE_REPO=${UPDATE_REPO_SLUG}
Environment=PATH=/usr/local/go/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin
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
Environment=PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin
StandardOutput=journal
StandardError=journal
SyslogIdentifier=better-paas-frontend

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable better-paas-backend better-paas-frontend
  configure_updater_sudoers
  systemctl restart better-paas-backend better-paas-frontend
  success "Systemd services installed and started."
}

create_launchd_services() {
  info "macOS detected — configuring LaunchAgents..."

  local plist_dir="$REAL_HOME/Library/LaunchAgents"
  mkdir -p "$plist_dir"

  local backend_plist="$plist_dir/org.better-paas.backend.plist"
  local frontend_plist="$plist_dir/org.better-paas.frontend.plist"

  # Unload if currently loaded
  launchctl unload "$backend_plist" 2>/dev/null || true
  launchctl unload "$frontend_plist" 2>/dev/null || true

  # Kill any existing processes (specifically targeting better-paas directories to avoid false positives)
  (pgrep -f "server" || true) | while read -r pid; do
    if lsof -p "$pid" 2>/dev/null | grep -q "better-paas/backend/server"; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
  (pgrep -f "next-server" || true) | while read -r pid; do
    if lsof -p "$pid" 2>/dev/null | grep -q "better-paas/frontend"; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
  (pgrep -f "caddy" || true) | while read -r pid; do
    if lsof -p "$pid" 2>/dev/null | grep -q "better-paas/backend"; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
  pkill -f "better-paas/backend/server" 2>/dev/null || true
  pkill -f "better-paas/frontend" 2>/dev/null || true

  UPDATE_REPO_SLUG=""
  REMOTE_URL="$(git -C "$REPO_DIR" config --get remote.origin.url 2>/dev/null || echo "")"
  if [ -n "$REMOTE_URL" ]; then
    UPDATE_REPO_SLUG="$(echo "$REMOTE_URL" \
      | sed -E 's#^git@[^:]+:##; s#^https?://[^/]+/##; s#\.git$##')"
  fi

  # Create backend plist
  cat > "$backend_plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>org.better-paas.backend</string>
    <key>ProgramArguments</key>
    <array>
        <string>${BACKEND_DIR}/server</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${REPO_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>UPDATE_REPO</key>
        <string>${UPDATE_REPO_SLUG}</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${BACKEND_DIR}/server.log</string>
    <key>StandardErrorPath</key>
    <string>${BACKEND_DIR}/server.log</string>
</dict>
</plist>
EOF

  local pnpm_path
  pnpm_path=$(which pnpm 2>/dev/null || echo "pnpm")

  # Create frontend plist
  cat > "$frontend_plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>org.better-paas.frontend</string>
    <key>ProgramArguments</key>
    <array>
        <string>${pnpm_path}</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${FRONTEND_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PORT</key>
        <string>3000</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${FRONTEND_DIR}/frontend.log</string>
    <key>StandardErrorPath</key>
    <string>${FRONTEND_DIR}/frontend.log</string>
</dict>
</plist>
EOF

  chmod 644 "$backend_plist" "$frontend_plist"
  
  # Load the plists
  launchctl load "$backend_plist" 2>/dev/null || true
  launchctl load "$frontend_plist" 2>/dev/null || true

  success "LaunchAgents registered and started."
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
  echo -e "  ${CYAN}Logs dir:${NC}   $DATA_DIR/"
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
  check_ports

  if [ "$OS" != "darwin" ]; then
    require_root
  fi

  install_dependencies
  install_go
  install_docker
  install_nixpacks
  install_caddy
  configure_caddy_bind_capability
  install_node

  # If running from the repo directly, skip clone
  if [ -f "$REPO_DIR/backend/main.go" ]; then
    info "Running from existing repo directory."
  else
    setup_repo
  fi

  normalize_data_paths

  build_backend
  build_frontend

  if [ -n "${SUDO_USER:-}" ]; then
    chown -R "$SUDO_USER" "$REPO_DIR"
  fi

  create_services
  print_summary
}

main "$@"
