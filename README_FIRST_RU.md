# Что это

Bootstrap-архив для Jules / Codex / Claude / Antigravity.

Репа: `buy-crypto-dip-bot`  
Продукт: `DCA Guard`  
Фокус: crypto-only, buy-the-dip / DCA bot, risk-first, dry-run first.

## Как использовать

1. Создай private GitHub repo: `buy-crypto-dip-bot`.
2. Распакуй содержимое этого архива в корень репы.
3. Закоммить:

```bash
git add .
git commit -m "chore: add AI-first project bootstrap"
git push
```

4. Открой Jules.
5. Выбери репу `buy-crypto-dip-bot`.
6. Вставь содержимое `JULES_TASK_0.md`.
7. В Initial Setup Jules добавь команды из `JULES_SETUP_SCRIPT.sh`.
8. Нажми `Give me a plan`.
9. Проверь план Jules перед запуском кода.

## Красные флаги при review плана Jules

Отклоняй план, если Jules предлагает:

- futures
- leverage
- martingale
- withdrawals
- live trading by default
- meme coins
- seed phrase storage
- private Bybit API в первом task
- global `controllers/services/models/utils`
- plain Vue SPA вместо Nuxt SSR/SSG
- Express/NestJS/Jest/axios/ts-node

Да, приходится объяснять роботу, что не надо строить казино с withdraw permissions. Прогресс цивилизации, как он есть.
