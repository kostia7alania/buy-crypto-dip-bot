# CODEX TASK 0 — verify and complete scaffold

You are working locally in the `buy-crypto-dip-bot` repo.

## Goal

Verify and complete the modern Codex-first TypeScript monorepo scaffold.

This repo must already contain real app folders:

```txt
apps/api
apps/web
apps/bot
packages/shared-types
packages/strategy-engine
packages/risk-engine
packages/exchange-bybit
packages/seo-keywords
packages/config
packages/test-utils
```

If any required folder is missing, create it.

## Product

Risk-first crypto dip buying automation system.

Product name: DCA Guard  
SEO focus: AI Crypto DCA Bot for Buying the Dip

## Hard constraints

- Node.js 26.4.0 Current.
- pnpm 11.
- No futures.
- No leverage.
- No martingale.
- No withdrawals.
- No meme coins.
- No live trading by default.
- No private exchange calls in this task.
- No secrets required.
- No global legacy `controllers/services/models/utils` folders.

## Tasks

1. Inspect the repo and confirm all required `apps/` and `packages/` exist.
2. Make `pnpm install` work.
3. Make `pnpm typecheck` work.
4. Make `pnpm lint` work.
5. Make `pnpm test` work.
6. Keep `apps/api` as Hono API with `/health` and `/version`.
7. Keep `apps/web` as Nuxt 4 with SEO pages and dashboard shell.
8. Keep `apps/bot` as grammY bot skeleton with `/start` and `/status`.
9. Keep `packages/strategy-engine` as pure tested logic.
10. Keep `packages/risk-engine` rejecting live trading by default, with tests.
11. Keep `packages/exchange-bybit` public-only placeholder, no secrets.
12. Update docs only if behavior changed.

## Acceptance criteria

- `apps/` exists with `api`, `web`, `bot`.
- `packages/` exists with all listed packages.
- No live trading.
- No private Bybit integration.
- RiskGuard rejects live trading by default.
- Tests pass.
- The repo is ready for the next task: public Bybit market data.
