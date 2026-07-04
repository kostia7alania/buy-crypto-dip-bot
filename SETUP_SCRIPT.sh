#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 26+ is required. Install via mise: mise install"
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 26 ]; then
  echo "Node.js 26+ is required. Current: $(node -v)"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Install pnpm 11 globally: npm i -g pnpm@11"
  exit 1
fi

PNPM_MAJOR=$(pnpm -v | cut -d. -f1)
if [ "$PNPM_MAJOR" -lt 11 ]; then
  echo "pnpm 11+ is required. Current: $(pnpm -v)"
  exit 1
fi

pnpm install
pnpm check
