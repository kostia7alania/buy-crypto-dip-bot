# buy-crypto-dip-bot

Risk-first crypto dip buying automation system.

**Product name:** DCA Guard  
**SEO focus:** AI Crypto DCA Bot for Buying the Dip  
**Default mode:** DRY_RUN

This repo is intentionally boring: it is designed to prevent unsafe trading before it tries to automate anything.

## Stack

- Node.js 26.4.0 Current
- pnpm 11
- TypeScript strict
- Turborepo
- Hono API
- Nuxt 4 SSR/SSG web app
- grammY Telegram bot
- Valibot validation
- node:sqlite for MVP persistence
- Vitest 4
- Biome + Oxlint
- tsdown for packages

## Apps

```txt
apps/
  api/   Hono core API
  web/   Nuxt SEO site + dashboard + small BFF
  bot/   Telegram bot
```

## Packages

```txt
packages/
  shared-types/
  strategy-engine/
  risk-engine/
  exchange-bybit/
  seo-keywords/
  config/
  test-utils/
```

## Commands

```bash
corepack enable
corepack use pnpm@latest-11
pnpm install
pnpm check
pnpm dev
```

## Safety rules

- No futures.
- No leverage.
- No martingale.
- No withdrawals.
- No meme coins.
- No live trading by default.
- Every signal, risk decision, and order-like action must be auditable.
