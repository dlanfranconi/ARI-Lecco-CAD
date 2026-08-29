#!/bin/sh
# Turns a stock Raspberry Pi OS install into a running ARI Lecco CAD server.
# Safe to re-run: installing Docker again is a no-op, and the compose/env
# files are only written the first time so a re-run won't touch a config
# that's already in use.
#
# Usage:
#   curl -fsSL https://github.com/dlanfranconi/ARI-Lecco-CAD/releases/latest/download/bootstrap.sh | sudo sh
#
# Override the image tag for testing a specific build instead of the
# default release, e.g.: CAD_IMAGE_TAG=wip sudo -E sh bootstrap.sh
set -e

IMAGE_NAME="ghcr.io/dlanfranconi/ari-lecco-cad"
IMAGE_TAG="${CAD_IMAGE_TAG:-latest}"
INSTALL_DIR="/opt/ari-lecco-cad"

if [ "$(id -u)" -ne 0 ]; then
  echo "This needs to run as root (try: sudo sh bootstrap.sh)" >&2
  exit 1
fi

echo "==> Installing Docker (skips cleanly if already installed)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true

mkdir -p "$INSTALL_DIR/data"
cd "$INSTALL_DIR"

if [ ! -f .env ]; then
  echo "==> Generating .env"
  # SESSION_SECRET and APRSFI_API_KEY are both left blank on purpose: the
  # app generates and persists its own session secret on first boot, and
  # the aprs.fi key (plus poll interval) is meant to be entered from the
  # Configuration page once the server is up, not baked into this file --
  # this is what a from-scratch headless Pi ends up shipping with no
  # operator-specific secrets at all.
  cat > .env <<EOF
CAD_IMAGE_TAG=${IMAGE_TAG}
CAD_ADMIN_USERNAME=dispatch
CAD_ADMIN_PASSWORD=dispatch
SESSION_SECRET=
APRSFI_API_KEY=
APRS_POLL_SECONDS=60
MDNS_HOSTNAME=cad-server
PORT=80
HTTPS_ENABLED=false
HTTPS_PORT=443
NETWORK_MONITOR_ENABLED=true
EOF
else
  echo "==> .env already exists, leaving it as-is"
fi

if [ ! -f docker-compose.yml ]; then
  echo "==> Writing docker-compose.yml"
  cat > docker-compose.yml <<'EOF'
services:
  cad:
    image: ghcr.io/dlanfranconi/ari-lecco-cad:${CAD_IMAGE_TAG:-latest}
    container_name: ari-lecco-cad
    restart: unless-stopped
    # Host networking so mDNS (cad-server.local) can reach the LAN.
    network_mode: host
    env_file: .env
    volumes:
      - ari-lecco-cad-data:/data

volumes:
  ari-lecco-cad-data:
    name: ari-lecco-cad-data
EOF
else
  echo "==> docker-compose.yml already exists, leaving it as-is"
fi

echo "==> Pulling ${IMAGE_NAME}:${IMAGE_TAG} and starting the CAD server"
docker compose pull
docker compose up -d

echo ""
echo "==> Done. The CAD server should be reachable shortly at:"
echo "      http://cad-server.local   (or http://<this-pi's-ip>)"
echo ""
echo "    Default login: dispatch / dispatch -- change the password in Configuration before real use."
