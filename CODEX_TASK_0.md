# Codex Task 0 — Production-first scaffold completion

## Goal

Inspect this repository and complete the production-first scaffold without breaking architecture rules.

## Runtime and tools

- Node.js 26+
- pnpm 11
- no Corepack dependency
- mise for local runtime management
- Turborepo
- TypeScript strict
- Hono API
- Nuxt 4 SSR/SSG + BFF
- PostgreSQL production DB
- SQLite only for local/dev/test adapter
- Drizzle
- Valibot
- grammY
- Vitest
- Biome
- Oxlint
- tsdown

## Hard safety rules

- No futures.
- No leverage.
- No martingale.
- No withdrawals.
- No meme coins.
- No live trading by default.
- No secrets in source code.
- Every signal/order/risk decision must be auditable.
- RiskGuard must approve every order-like action.

## Scope

1. Verify all packages/apps compile.
2. Fix package scripts if needed.
3. Ensure `pnpm check` runs typecheck, lint, and tests.
4. Ensure `apps/api` has Hono health/version routes.
5. Ensure `apps/web` has Nuxt SEO pages and dashboard shell.
6. Ensure `apps/bot` has grammY skeleton commands `/start` and `/status`.
7. Ensure `packages/risk-engine` rejects live trading by default with tests.
8. Ensure `packages/strategy-engine` has deterministic dip strategy placeholder with tests.
9. Ensure `packages/db` has Postgres-first Drizzle schema and SQLite dev adapter placeholders.
10. Update docs if implementation differs.

## Acceptance criteria

- `pnpm install` works.
- `pnpm typecheck` works.
- `pnpm lint` works.
- `pnpm test` works.
- `pnpm check` works.
- No live trading is possible by default.
- No private exchange integration yet.
- No secrets required to run local dev.
- No legacy global folders.
