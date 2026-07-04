# ExecPlan 001 — Production Scaffold

## Goal

Complete the production-first scaffold described in `CODEX_TASK_0.md` while
preserving the repository safety rules: `DRY_RUN` by default, no private
exchange trading, no secrets, and auditable risk decisions.

## Scope

- Keep this MVP-first: build a minimally working product, but avoid throwaway
  shortcuts that force a ground-up rewrite later.
- Keep the monorepo package scripts runnable through `pnpm check`.
- Keep Hono API health, version, market-data, and risk routes minimal.
- Keep Nuxt pages SEO-oriented and the dashboard as a safe shell over BFF data.
- Keep Telegram bot commands limited to safe status/start responses.
- Keep risk and strategy logic deterministic and tested.
- Keep database work Postgres-first, with SQLite limited to local/dev/test
  adapter placeholders.
- Keep tests lean for the MVP: cover safety-critical risk/order-like decisions,
  DB boundaries, and API/BFF contracts first; expand broad coverage after the
  product behavior stabilizes.

## Validation

- `pnpm install`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check`
