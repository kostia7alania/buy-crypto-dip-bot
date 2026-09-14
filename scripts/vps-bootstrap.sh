#!/usr/bin/env bash
# One-time (idempotent) VPS setup for Buy Crypto Dip Bot.
# Usage: REPO_REF=<40-char-main-commit> bash vps-bootstrap.sh
# Run as root on the VPS. REPO_REF keeps every downloaded file immutable.
set -euo pipefail

APP_DIR=/opt/buy-crypto-dip-bot
TRAEFIK_DIR=/opt/traefik
: "${REPO_REF:?set REPO_REF to the 40-character commit SHA being deployed}"
if ! [[ "$REPO_REF" =~ ^[0-9a-f]{40}$ ]]; then
  echo "REPO_REF must be a lowercase 40-character commit SHA" >&2
  exit 1
fi
RAW="https://raw.githubusercontent.com/kostia7alania/buy-crypto-dip-bot/$REPO_REF"

echo "=== 1. Base packages ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git openssl ufw

echo "=== 2. Docker ==="
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "=== 3. Swap (2G) - 1GB RAM needs headroom ==="
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "=== 4. Firewall: SSH + web entrypoints only ==="
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
# Cloudflare alternative HTTPS port used while :443 is occupied by another
# service on this host (see infra/traefik/docker-compose.yml).
ufw allow 2053/tcp
ufw --force enable

echo "=== 5. Deploy user (never deploy as root) ==="
if ! id deploy >/dev/null 2>&1; then
  useradd -m -s /bin/bash deploy
fi
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
echo ">>> Add your public key to /home/deploy/.ssh/authorized_keys"

echo "=== 6. Traefik edge proxy (shared by all projects on this box) ==="
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy
if [ ! -s "$TRAEFIK_DIR/docker-compose.yml" ] || [ ! -s "$TRAEFIK_DIR/dynamic.yml" ]; then
  echo "Refusing to replace the host-specific shared Traefik/VPN config." >&2
  echo "Provision and verify $TRAEFIK_DIR/docker-compose.yml and dynamic.yml first." >&2
  exit 1
fi
(cd "$TRAEFIK_DIR" && docker compose config --quiet && docker compose up -d --wait)

echo "=== 7. App directory ==="
mkdir -p "$APP_DIR"
if [ ! -f "$APP_DIR/.env" ]; then
  API_KEY=$(openssl rand -hex 32)
  BOT_HEARTBEAT_SECRET=$(openssl rand -hex 32)
  PG_PASS=$(openssl rand -hex 24)
  SESSION_SECRET=$(openssl rand -hex 32)
  cat > "$APP_DIR/.env" <<EOF
POSTGRES_PASSWORD=${PG_PASS}
API_KEY=${API_KEY}
SESSION_SECRET=${SESSION_SECRET}
BOT_HEARTBEAT_SECRET=${BOT_HEARTBEAT_SECRET}
DIPBOT_IMAGE=
TELEGRAM_BOT_TOKEN=
OPERATOR_TELEGRAM_USER_ID=
NUXT_PUBLIC_TELEGRAM_BOT_USERNAME=
NUXT_PUBLIC_SITE_URL=https://buy-crypto-dip-bot.com
ALLOWLIST_SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT
EOF
  chmod 600 "$APP_DIR/.env"
  echo ">>> Generated $APP_DIR/.env - fill TELEGRAM_BOT_TOKEN"
fi
mkdir -p "$APP_DIR/.deploy" "$APP_DIR/backups"
chown -R deploy:deploy "$APP_DIR"

echo "=== Done. Next steps ==="
echo "1. curl -fsSL $RAW/docker-compose.prod.yml -o $APP_DIR/docker-compose.yml"
echo "2. Fill Telegram vars in $APP_DIR/.env"
echo "3. After Gate 1 proof and production approval, run Deploy for commit $REPO_REF"
