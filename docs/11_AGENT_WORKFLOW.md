# Agent Workflow

## Principle

One task. One agent. One branch. One bounded area.

## File ownership

| Area | Owner role | Allowed paths |
|---|---|---|
| API | Backend Engineer | `apps/api/**`, `packages/exchange-bybit/**` |
| Strategy | Strategy Engineer | `packages/strategy-engine/**`, `packages/risk-engine/**` |
| Web SEO | Frontend SEO Engineer | `apps/web/**`, `packages/seo-keywords/**` |
| Telegram | Telegram Engineer | `apps/bot/**` |
| Tests | QA Engineer | `**/*.test.ts`, `**/*.spec.ts`, `packages/test-utils/**` |
| Docs | Lead / Architect | `docs/**`, `tasks/**`, `adr/**` |
| Infra | Lead / Architect | root config files |

## Rules

- Do not edit files outside your assigned area unless the task explicitly allows it.
- Do not change root config files without an infra task.
- Do not change `AGENTS.md` without architect approval.
- Do not enable live trading.
- Do not add futures, leverage, martingale, withdrawals, or meme-coin support.
- Every PR must pass:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`

## Suggested parallelization

### Phase 0

One agent only:

```txt
feat/scaffold-nuxt-hono-monorepo
```

### Phase 1

Parallel agents:

```txt
feat/api-market-data
feat/strategy-risk-engine
feat/web-seo-pages
feat/telegram-bot
```

### Phase 2

Integration branch:

```txt
feat/integration-dry-run-flow
```
