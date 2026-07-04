# Локальный runbook для Codex

## 1. Установка

```bash
corepack enable
corepack use pnpm@latest-11
pnpm install
```

## 2. Проверка

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## 3. Запуск

```bash
pnpm dev
```

## 4. Первый task

Скорми Codex файл `CODEX_TASK_0.md`.

## 5. Что не разрешать агенту

- live trading;
- futures;
- leverage;
- martingale;
- withdrawals;
- meme coins;
- старые глобальные папки `controllers/services/models/utils`;
- Express/Nest/Jest/axios.
