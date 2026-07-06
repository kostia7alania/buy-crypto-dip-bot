#!/usr/bin/env bash
# One-time (idempotent) VPS setup for Buy Crypto Dip Bot.
# Usage: bash vps-bootstrap.sh  (as root, on the VPS)
set -euo pipefail

APP_DIR=/opt/buy-crypto-dip-bot

echo "=== 1. Base packages ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ufw nginx

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

echo "=== 4. Firewall: only SSH + HTTP(S) ==="
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
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

echo "=== 6. App directory ==="
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

echo "=== 7. Nginx: proxy 80 -> nuxt (3000) ==="
cat > /etc/nginx/sites-available/buy-crypto-dip-bot <<'EOF'
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # SSE-friendly defaults for the future /events stream
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
EOF
ln -sf /etc/nginx/sites-available/buy-crypto-dip-bot /etc/nginx/sites-enabled/buy-crypto-dip-bot
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== Done. Next steps ==="
echo "1. Put docker-compose.prod.yml at $APP_DIR/docker-compose.yml"
echo "2. Fill Telegram vars in $APP_DIR/.env"
echo "3. docker compose -f $APP_DIR/docker-compose.yml up -d"
