#!/usr/bin/env bash
set -euo pipefail

corepack enable
corepack use pnpm@latest-11
pnpm install
pnpm typecheck
pnpm lint
pnpm test
