# Context

Repository: `buy-crypto-dip-bot`  
Product: `DCA Guard`  
Date: 2026-07-04

## Focus

Crypto-only. Do not generalize to stocks, real estate, commodities, or REITs in this repository.

The product helps users automate safer dip buying in crypto spot markets.

## Core idea

```txt
market data -> signal -> RiskGuard -> dry-run order -> audit log -> Telegram alert -> dashboard
```

## First supported market

- Exchange: Bybit
- Market type: spot only
- Symbol: BTCUSDT only in MVP
- Mode: DRY_RUN by default

## Why risk-first

Trading automation can amplify bad decisions. The product must reduce impulsive trading, not accelerate it.

The first version must prove:

- clear signal calculation
- strict risk rejection
- safe defaults
- auditability
- no live money touched
