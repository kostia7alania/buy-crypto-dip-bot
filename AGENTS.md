# AGENTS.md

## Mission

Build a risk-first crypto dip buying automation product.

The system watches crypto market data, detects configured dip conditions, validates every action through RiskGuard, creates dry-run orders by default, and alerts the user through Telegram and the dashboard.

## Repository name

`buy-crypto-dip-bot`

## Product name

`DCA Guard`

## SEO focus

`AI Crypto DCA Bot for Buying the Dip`

## Hard safety rules

- Default mode is DRY_RUN.
- Never enable live trading unless the task explicitly says so.
- No futures.
- No leverage.
- No martingale.
- No meme coins.
- No withdrawals through API.
- No API keys in source code.
- No secrets in logs.
- Every signal must go through RiskGuard.
- Every order-like action must be logged.
- Every trading-related change must include tests.

## Stack

- Node.js 26.4.0 Current
- pnpm 11
- TypeScript strict
- Turborepo
- Hono for API
- Nuxt 4 for SSR/SSG SEO and dashboard
- Nuxt server routes as small BFF
- grammY for Telegram bot
- Valibot for runtime validation
- node:sqlite for MVP persistence
- Vitest 4
- Biome + Oxlint
- tsdown for packages

## Folder rules

Use this structure:

```txt
apps/
  api/
  web/
  bot/

packages/
  shared-types/
  strategy-engine/
  risk-engine/
  exchange-bybit/
  seo-keywords/
  config/
  test-utils/
```

Do not create global legacy folders:

```txt
controllers/
services/
models/
utils/
```

Inside each app, prefer vertical slices and feature modules.

## Backend rules

- Route files live in `apps/api/src/routes`.
- Domain logic lives in `apps/api/src/features` or packages.
- Route handlers must not call exchanges directly.
- Exchange calls go through `packages/exchange-bybit`.
- Strategy decisions go through `packages/strategy-engine`.
- Risk decisions go through `packages/risk-engine`.

## Web rules

`apps/web` is Nuxt 4.

Responsibilities:

- SSR/SSG SEO pages.
- Dashboard shell.
- Small BFF via Nuxt server routes.
- Risk-first UI.

No casino UI. No huge green buy button. No PnL flexing as the main screen.

## Required checks

Before finishing any task, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
```
