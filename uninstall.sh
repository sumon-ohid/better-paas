#!/usr/bin/env bash
# =============================================================================
# Better-PaaS — Clean Uninstaller
#
# Removes Better-PaaS background services and configurations safely without
# deleting your system-wide dependencies (like Go, Node, Docker, Caddy, etc.).
# =============================================================================

set -euo pipefail

# Determine the user's real home directory
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

# Detect if running from a local repository copy
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-}")" && pwd 2>/dev/null || pwd)"
if [ -f "$SCRIPT_DIR/backend/main.go" ]; then
  REPO_DIR="$SCRIPT_DIR"
fi

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

# ── Stop and Remove Services ─────────────────────────────────────────────────
remove_services() {
  info "Stopping Better-PaaS background services..."

  if [ "$OS" = "darwin" ]; then
    # Unload and remove LaunchAgent files if they exist
    local plist_dir="$REAL_HOME/Library/LaunchAgents"
    local backend_plist="$plist_dir/org.better-paas.backend.plist"
    local frontend_plist="$plist_dir/org.better-paas.frontend.plist"

    launchctl unload "$backend_plist" 2>/dev/null || true
    launchctl unload "$frontend_plist" 2>/dev/null || true
    rm -f "$backend_plist" "$frontend_plist"

    # Stop backend and frontend processes running from better-paas directories
    pgrep -f "server" | while read -r pid; do
      if lsof -p "$pid" 2>/dev/null | grep -q "better-paas/backend/server"; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    done
    pgrep -f "next-server" | while read -r pid; do
      if lsof -p "$pid" 2>/dev/null | grep -q "better-paas/frontend"; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    done
    pgrep -f "caddy" | while read -r pid; do
      if lsof -p "$pid" 2>/dev/null | grep -q "better-paas/backend"; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    done
    pkill -f "better-paas/backend/server" 2>/dev/null || true
    pkill -f "better-paas/frontend" 2>/dev/null || true
    success "Stopped macOS background processes and removed LaunchAgents."
  else
    # Linux systemd services
    if systemctl is-active --quiet better-paas-backend 2>/dev/null; then
      systemctl stop better-paas-backend || true
    fi
    if systemctl is-active --quiet better-paas-frontend 2>/dev/null; then
      systemctl stop better-paas-frontend || true
    fi

    if systemctl is-enabled --quiet better-paas-backend 2>/dev/null; then
      systemctl disable better-paas-backend || true
    fi
    if systemctl is-enabled --quiet better-paas-frontend 2>/dev/null; then
      systemctl disable better-paas-frontend || true
    fi

    # Remove service files
    rm -f /etc/systemd/system/better-paas-backend.service
    rm -f /etc/systemd/system/better-paas-frontend.service
    
    systemctl daemon-reload
    systemctl reset-failed
    success "Removed systemd service units."
  fi
}

# ── Clean up Docker Containers ───────────────────────────────────────────────
clean_docker() {
  if ! command -v docker &>/dev/null; then
    return
  fi

  # Check if there are any containers running with label="better-paas"
  local containers
  containers=$(docker ps -aq --filter "label=better-paas" 2>/dev/null || true)
  
  if [ -n "$containers" ]; then
    echo ""
    read -p "Do you want to stop and remove all deployed app containers managed by Better-PaaS? (y/N): " -r choice
    if [[ "$choice" =~ ^[Yy]$ ]]; then
      info "Removing Better-PaaS Docker containers..."
      docker rm -f $containers
      docker network prune -f
      success "Docker containers removed."
    else
      info "Skipping Docker container removal. Your deployed apps will keep running."
    fi
  fi
}

# ── Remove Repo & Data ────────────────────────────────────────────────────────
clean_files() {
  # Safety check: if running from a local repository checkout, do not delete the codebase!
  if [ -f "$SCRIPT_DIR/backend/main.go" ]; then
    warn "Running from a local development checkout. Accidental deletion of the repository is prevented."
    
    local data_dir="$SCRIPT_DIR/backend/data"
    if [ -d "$data_dir" ]; then
      echo ""
      read -p "Do you want to delete only the database and logs at $data_dir? (y/N): " -r choice
      if [[ "$choice" =~ ^[Yy]$ ]]; then
        info "Removing databases and logs..."
        rm -rf "$data_dir"
        success "Databases and logs deleted."
      fi
    fi
    return
  fi

  echo ""
  read -p "Do you want to delete the Better-PaaS folder and all database/logs at $REPO_DIR? (y/N): " -r choice
  if [[ "$choice" =~ ^[Yy]$ ]]; then
    info "Removing directory $REPO_DIR..."
    rm -rf "$REPO_DIR"
    success "Files deleted."
  else
    info "Skipping file deletion. Your databases and logs are preserved at $REPO_DIR."
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  echo -e "${CYAN}"
  echo "  ╔═══════════════════════════════════════╗"
  echo "  ║     Better-PaaS Uninstaller v1.0      ║"
  echo "  ╚═══════════════════════════════════════╝"
  echo -e "${NC}"

  detect_os
  
  if [ "$(id -u)" -ne 0 ] && [ "$OS" != "darwin" ]; then
    error "This uninstaller must be run as root on Linux. Try: sudo bash uninstall.sh"
  fi

  remove_services
  clean_docker
  clean_files

  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}   ✅  Better-PaaS uninstalled successfully!           ${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo ""
  warn "System dependencies (Go, Node, Docker, Nixpacks, Caddy, etc.) were NOT removed"
  warn "as they might be used by other applications on this machine."
  echo ""
}

main "$@"
