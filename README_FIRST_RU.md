# buy-crypto-dip-bot — быстрый старт

Это чистый Codex-only bootstrap. Внутри уже есть реальные `apps/` и `packages/`, а не только md-молитвенник для роботов.

## Что делать

```bash
cd buy-crypto-dip-bot
corepack enable
corepack use pnpm@latest-11
pnpm install
pnpm check
pnpm dev
```

## Первый prompt для Codex

Открой `CODEX_TASK_0.md` и дай его Codex как первый локальный task.

## Жёсткие правила

- Только crypto spot.
- По умолчанию только dry-run.
- Нет futures.
- Нет leverage.
- Нет martingale.
- Нет withdrawals.
- Нет meme coins.
- Нет live trading без явного env-флага и RiskGuard.

Если агент предлагает папки `controllers/services/models/utils` в корне — бей по рукам. Это не 2017.
