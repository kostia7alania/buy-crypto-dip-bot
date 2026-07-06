# buy-crypto-dip-bot

**DCA Guard** — production-first crypto dip buying automation SaaS.

Risk-first system for detecting crypto dips, validating every action through RiskGuard, creating dry-run orders by default, and notifying through Telegram and a Nuxt dashboard.

## Apps

- `apps/api` — Hono API, trading core, market data, signals, orders, audit.
- `apps/web` — Nuxt 4 SEO pages, dashboard, small BFF.
- `apps/bot` — Telegram bot with safe commands and alerts.

## Packages

- `packages/shared-types`
- `packages/strategy-engine`
- `packages/risk-engine`
- `packages/exchange-core`
- `packages/exchange-bybit`
- `packages/db`
- `packages/seo-keywords`
- `packages/config`
- `packages/test-utils`

## Quickstart

```bash
# Node 26 (repo has .nvmrc / mise.toml)
nvm use            # or: mise install

cp .env.example .env   # fill TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
docker compose up -d   # local PostgreSQL
pnpm install
pnpm dev               # api :8787, web :3000, bot
```

Migrations run automatically when the API starts. Default BTC/ETH/SOL
dry-run strategies are seeded once and never overwritten afterwards.

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm check
```
