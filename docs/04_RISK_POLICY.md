# Risk Policy

## Default mode

DRY_RUN.

## Forbidden in MVP

- futures
- leverage
- martingale
- meme coins
- withdrawals
- live trading
- private API keys in Task 0

## Required RiskGuard checks

- live trading disabled by default
- symbol allowlist
- min order size
- max order size
- max daily spend
- max weekly spend
- cooldown
- max open orders
- duplicate signal prevention

## Reason codes

```txt
LIVE_TRADING_DISABLED
SYMBOL_NOT_ALLOWED
DAILY_LIMIT_EXCEEDED
WEEKLY_LIMIT_EXCEEDED
COOLDOWN_ACTIVE
ORDER_TOO_SMALL
ORDER_TOO_LARGE
DUPLICATE_SIGNAL
MAX_OPEN_ORDERS_EXCEEDED
```

## Worst-case thinking

The product should assume:

- BTC can drop 30-50%
- altcoins can drop 70-95%
- meme coins can go to zero
- CEX accounts can be restricted
- API keys can be misconfigured
- humans can panic-click green buttons

Therefore:

- no giant buy button
- no live trading by default
- no withdrawals
- no leverage
- audit everything
