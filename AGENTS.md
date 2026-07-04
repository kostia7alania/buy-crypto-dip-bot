# AGENTS.md

## Project

This repository contains `buy-crypto-dip-bot`, the codebase for `DCA Guard`.

DCA Guard is a risk-first crypto Dip-DCA automation system for buying crypto dips safely.

The system watches market data, detects predefined dip conditions, validates every action through a strict risk engine, creates dry-run orders by default, logs every decision, and sends Telegram alerts.

This is not a profit-maximizing trading bot. This is a safety-first automation product.

## Hard rules

- Default mode is DRY_RUN.
- Never enable live trading unless the task explicitly requests it and all RiskGuard checks are present.
- Never implement futures.
- Never implement leverage.
- Never implement martingale.
- Never implement meme coin trading.
- Never implement withdrawals through API.
- Never store seed phrases.
- Never log secrets.
- Never put API keys into source code.
- Never execute real orders without RiskGuard approval.
- Every signal, rejection, and order decision must be logged.
- Every trading feature must include tests.
- Prefer small scoped PRs.

## Product scope

MVP supports:

- Crypto-only.
- Bybit public market data.
- BTCUSDT spot-only strategy.
- Dip detection:
  - drop from 24h high
  - drop from previous daily close
  - drop from rolling high
  - optional flash-crash detection
- Dry-run order ledger.
- RiskGuard.
- Telegram alerts.
- Nuxt SEO landing pages.
- Nuxt dashboard.
- No real trading by default.

Later versions may support:

- real spot order execution with tiny cap
- multi-symbol allowlist
- backtesting
- portfolio limits
- self-custody reminders
- exchange health checks
- SEO keyword experiments

## Stack

- Node.js 26.4.0
- pnpm 11 with catalogs
- TypeScript strict mode
- pnpm workspaces
- Turborepo
- Hono for API
- Hono RPC-compatible route typing where useful
- Valibot for runtime validation
- `node:sqlite` for MVP persistence
- Nuxt 4 for web, SEO pages, dashboard, and small BFF
- Tailwind CSS 4
- shadcn-vue / Reka UI style primitives
- grammY for Telegram bot
- Vitest 4 for tests
- Biome for formatting/checks
- Oxlint for fast lint
- tsdown for package builds

## Repository structure

Use modern monorepo structure:

- `apps/api` for core HTTP API
- `apps/web` for Nuxt SEO pages, dashboard, and BFF
- `apps/bot` for Telegram bot
- `packages/strategy-engine` for strategy logic
- `packages/risk-engine` for risk checks
- `packages/exchange-bybit` for Bybit clients
- `packages/shared-types` for shared contracts
- `packages/seo-keywords` for keyword/page metadata
- `packages/config` for shared config
- `packages/test-utils` for fixtures and test helpers
- `docs` for product and architecture docs
- `tasks` for scoped implementation plans
- `adr` for architecture decisions

Do not create legacy global folders like:

- `controllers`
- `services`
- `models`
- `helpers`
- `utils`

Inside each app, prefer vertical slices, feature folders, colocated tests, and clear ownership.

## Backend rules

- Route handlers call feature modules.
- Feature modules call engines, repositories, or exchange clients.
- Do not call exchange clients directly from route handlers.
- Use Valibot schemas for request validation.
- Use typed errors.
- Keep functions small.
- Avoid hidden side effects.
- Avoid premature microservices.

## Web rules

Use Nuxt 4.

Web responsibilities:

- SSR/SSG SEO landing pages
- SEO keyword route cluster
- product marketing pages
- dashboard
- small BFF via Nuxt server routes

Use feature-sliced frontend structure:

- `app`
- `pages`
- `widgets`
- `features`
- `entities`
- `shared`

Dashboard must be risk-first:

- current mode: DRY_RUN or LIVE
- risk status
- daily spend
- weekly spend
- last signal
- rejected signals
- dry-run orders
- audit log
- Telegram status

Do not build casino UI:

- no dopamine fireworks
- no huge green BUY button
- no PnL flexing as the main screen
- no meme coin watchlist

## Testing rules

Required tests for every trading-related change:

- signal calculation
- risk approval
- risk rejection
- cooldown
- max daily spend
- max weekly spend
- duplicate signal prevention
- dry-run order creation
- live trading disabled by default

Run before finishing:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Security rules

- Use `.env.example`.
- Do not commit `.env`.
- Do not log API keys.
- Do not log Telegram token.
- Do not create withdrawal features.
- Do not request withdrawal permissions.
- For live trading, use a separate exchange subaccount and spot-only API key.
- Any live trading feature must have `LIVE_TRADING_ENABLED=false` by default.
- First private exchange integration must be behind explicit task approval.

## Agent behavior

Before coding:

1. Inspect the repo.
2. Read `docs/00_CONTEXT.md`.
3. Read `docs/01_PRODUCT_SPEC.md`.
4. Read `docs/02_ARCHITECTURE.md`.
5. Read `docs/04_RISK_POLICY.md`.
6. Read `docs/11_AGENT_WORKFLOW.md`.
7. Produce a short implementation plan.
8. Keep the change scoped.
9. Add or update tests.
10. Update docs if behavior changed.
