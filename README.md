# DCA Guard

Risk-first crypto Dip-DCA automation system.

Repository: `buy-crypto-dip-bot`

## Product positioning

DCA Guard is an AI-assisted crypto automation product for safer dip buying.

It is not a profit-maximizing casino bot. It watches crypto market data, detects predefined dip conditions, validates every action through a strict RiskGuard, creates dry-run orders by default, logs every decision, and sends Telegram alerts.

## SEO positioning

Primary SEO phrase:

```txt
AI Crypto DCA Bot for Buying the Dip
```

Secondary SEO phrases:

```txt
buy crypto dip bot
buy the dip crypto bot
crypto DCA bot
bitcoin DCA bot
crypto dip buying bot
Bybit DCA bot
flash crash crypto bot
crypto risk management bot
```

## Hard rules

- No futures.
- No leverage.
- No martingale.
- No meme coins.
- No withdrawals.
- No live trading by default.
- No secrets committed.
- No private Bybit integration in Task 0.
- RiskGuard must approve every order-like action.
- Every signal, rejection, and order decision must be auditable.

## Stack

- Node.js 26.4.0
- pnpm 11
- TypeScript strict
- pnpm workspaces
- Turborepo
- Hono for core API
- Valibot for validation
- `node:sqlite` for local MVP persistence
- Nuxt 4 for SEO/dashboard/BFF
- grammY for Telegram bot
- Vitest 4
- Biome
- Oxlint
- tsdown

## Target monorepo structure

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

docs/
tasks/
adr/
```

## Jules

Use `JULES_TASK_0.md` as the first task prompt.

Initial setup:

```bash
bash JULES_SETUP_SCRIPT.sh
```

## Local commands after Task 0

```bash
corepack enable
corepack prepare pnpm@latest-11 --activate
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
```
