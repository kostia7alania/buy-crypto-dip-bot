# buy-crypto-dip-bot — production-first старт

Crypto-only SaaS **DCA Guard** для risk-first покупки просадок.

## Стек

- Node.js 26+ как production runtime.
- pnpm 11 без Corepack, через `mise` или глобальную установку.
- PostgreSQL как production DB.
- SQLite только local/dev/test adapter.
- Nuxt 4 SSR/SSG + маленький BFF.
- Hono API.
- Valibot.
- Drizzle.
- FSD-lite для web.
- Vertical slices для API.
- Ports/adapters для бирж.
- Audit-first.
- `.codex/skills/*` для AI-агентов.
- `PLANS.md` + `plans/*` для больших задач.

## Запуск

```bash
./SETUP_SCRIPT.sh
pnpm dev
```

Первый task для Codex: `CODEX_TASK_0.md`.
