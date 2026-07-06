#!/bin/bash
set -e

echo "=== 1. Updating System Packages ==="
apt-get update
apt-get install -y curl build-essential git docker-compose-v2 nginx unzip

echo "=== 2. Installing Node.js (via fnm) and Global Packages ==="
# Install fnm (Fast Node Manager) if not already installed
if [ ! -d "$HOME/.local/share/fnm" ]; then
  curl -fsSL https://fnm.vercel.app/install | bash
fi

# Load fnm into environment
export FNM_DIR="$HOME/.local/share/fnm"
export PATH="$FNM_DIR:$PATH"
eval "`fnm env --shell bash`"

# Install Node.js 26
fnm install 26
fnm use 26
fnm default 26

# Verify versions
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# Install pnpm and pm2 globally
npm install -g pnpm@11 pm2

echo "pnpm version: $(pnpm -v)"
echo "pm2 version: $(pm2 -v)"

echo "=== 3. Creating Application Directory ==="
mkdir -p /var/www/buy-crypto-dip-bot

echo "=== VPS Setup Completed Successfully! ==="
