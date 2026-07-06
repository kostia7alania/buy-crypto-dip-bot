# AGENTS.md

## Non-negotiable rules

- Risk-first crypto automation SaaS.
- Default mode is `DRY_RUN`.
- Never implement futures, leverage, martingale, withdrawals, or meme-coin trading.
- Never enable live trading by default.
- Every signal/order/risk decision must be auditable.
- Do not log secrets or commit `.env`.
- Do not create global `controllers`, `services`, `models`, `helpers`, or `utils` folders.
- Use Node.js 26+.
- Use pnpm 11.
- Use PostgreSQL everywhere (prod and local dev via docker compose). SQLite was dropped — see ADR 002.
- Protect the API with `API_KEY` (`x-api-key` header) on any non-local deployment; never expose the key to the browser.
- Never add HTTP endpoints that delete or truncate audit history.
- Defaults for strategies/risk live in `packages/config` — never duplicate them inline.
- Use Nuxt 4 for web.
- Use Hono for API.
- Use Valibot for runtime validation.
- Use Drizzle for database schema and migrations.
- Vue components must always declare props using `const props = defineProps<...>()`. Implicit props usage is prohibited; in both `<script>` and `<template>`, props must always be accessed explicitly via `props.propName` (e.g. `props.checked`).
- Vue components must always declare emits using `const emit = defineEmits<...>()`. Implicit emits usage is prohibited; in both `<script>` and `<template>`, emits must always be invoked explicitly via the captured `emit` variable (e.g. `emit('toggle')` instead of `$emit('toggle')`).


## Commands

- Install: `pnpm install`
- Dev: `pnpm dev`
- Build: `pnpm build`
- Check: `pnpm check`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Lint: `pnpm lint`

## Architecture

- API uses vertical slices in `apps/api/src/modules`.
- Web uses FSD-lite in `apps/web/app`.
- Nuxt server routes are only a small BFF, not the trading core.
- Exchange integration goes through ports/adapters.
- Risk logic lives in `packages/risk-engine`.
- Strategy logic lives in `packages/strategy-engine`.
- Shared contracts live in `packages/shared-types`.
- Database schema lives in `packages/db`.

## Before changing code

1. Read the closest task/doc file.
2. For changes touching more than two packages/apps, create or update an ExecPlan in `plans/` first.
3. Keep changes scoped.
4. Add tests for risk, strategy, orders, auth, DB, security-sensitive logic, and BFF contracts.
5. Update docs when behavior changes.
