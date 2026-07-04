# Локальный запуск через Codex

## Что это

Bootstrap для репы `buy-crypto-dip-bot`, продукт `DCA Guard`.

Цель первого запуска Codex: создать современный monorepo scaffold с Nuxt 4, Hono, Telegram bot skeleton, risk/strategy packages, docs, tasks и тестами.

## Как запускать

1. Создай GitHub repo `buy-crypto-dip-bot` или локальную папку.
2. Распакуй содержимое архива в корень репы, не во вложенную папку.
3. Проверь, что в корне лежат:

```bash
ls -la
# AGENTS.md
# CODEX.md
# CODEX_TASK_0.md
# package.json
# pnpm-workspace.yaml
# docs
# tasks
# adr
```

4. Запусти bootstrap-проверку:

```bash
bash SETUP_SCRIPT.sh
```

5. Открой локальный Codex в корне репы.

6. Вставь содержимое `CODEX_TASK_0.md` как первый большой task.

## Жёсткие ограничения

- no live trading
- no futures
- no leverage
- no martingale
- no withdrawals
- no meme coins
- no private Bybit API in first task
- no secrets
- no Express / Nest / Jest / axios / ts-node
- no global controllers/services/models/utils dump

## После выполнения

Codex должен прогнать:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Если он начинает спорить с архитектурой и тащить олдятину, отменяй. Это не демократия, это trading-risk проект.
