#!/usr/bin/env bash
# One-time (idempotent) VPS setup for Buy Crypto Dip Bot.
# Usage: bash vps-bootstrap.sh  (as root, on the VPS)
set -euo pipefail

APP_DIR=/opt/buy-crypto-dip-bot
TRAEFIK_DIR=/opt/traefik
RAW=https://raw.githubusercontent.com/kostia7alania/buy-crypto-dip-bot/main

echo "=== 1. Base packages ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ufw

echo "=== 2. Docker ==="
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "=== 3. Swap (2G) — 1GB RAM needs headroom ==="
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
mkdir -p "$TRAEFIK_DIR"
if [ ! -f "$TRAEFIK_DIR/docker-compose.yml" ]; then
  curl -fsSL "$RAW/infra/traefik/docker-compose.yml" -o "$TRAEFIK_DIR/docker-compose.yml"
fi
(cd "$TRAEFIK_DIR" && docker compose up -d)

echo "=== 7. App directory ==="
mkdir -p "$APP_DIR"
if [ ! -f "$APP_DIR/.env" ]; then
  API_KEY=$(openssl rand -hex 32)
  PG_PASS=$(openssl rand -hex 24)
  cat > "$APP_DIR/.env" <<EOF
POSTGRES_PASSWORD=${PG_PASS}
API_KEY=${API_KEY}
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
ALLOWLIST_SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT
EOF
  chmod 600 "$APP_DIR/.env"
  echo ">>> Generated $APP_DIR/.env — fill TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID"
fi
chown -R deploy:deploy "$APP_DIR"

echo "=== Done. Next steps ==="
echo "1. curl -fsSL $RAW/docker-compose.prod.yml -o $APP_DIR/docker-compose.yml"
echo "2. Fill Telegram vars in $APP_DIR/.env"
echo "3. su - deploy -c 'cd $APP_DIR && docker compose up -d'"
