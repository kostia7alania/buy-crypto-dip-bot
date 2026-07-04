# Agent workflow

## File ownership

| Area | Allowed paths |
|---|---|
| API | `apps/api/**`, `packages/exchange-bybit/**` |
| Web | `apps/web/**`, `packages/seo-keywords/**` |
| Bot | `apps/bot/**` |
| Strategy | `packages/strategy-engine/**` |
| Risk | `packages/risk-engine/**` |
| Docs/tasks | `docs/**`, `tasks/**`, `adr/**` |

## Rules

- One task = one bounded area.
- Do not edit root config unless the task says so.
- Do not change safety rules without explicit approval.
- Run `pnpm check` before finishing.
