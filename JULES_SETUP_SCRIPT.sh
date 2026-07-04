#!/usr/bin/env bash
set -euo pipefail

# Jules Initial Setup script.
# Pin project to latest checked Node Current.
# Checked on 2026-07-04: Node.js v26.4.0 Current.

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm install 26.4.0
  nvm use 26.4.0
else
  echo "nvm not found. Jules normally provides nvm. Continuing with system node."
fi

node -v
corepack enable
corepack prepare pnpm@latest-11 --activate
pnpm -v

pnpm install

# These may fail before Task 0 creates real packages.
# Jules should make them pass before finishing the task.
pnpm typecheck || true
pnpm lint || true
pnpm test || true
