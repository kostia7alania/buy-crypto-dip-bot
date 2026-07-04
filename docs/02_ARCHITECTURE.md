# Architecture

## Monorepo

```txt
apps/
  api/
  web/
  bot/

packages/
  shared-types/
  strategy-engine/
  risk-engine/
  exchange-bybit/
  seo-keywords/
  config/
  test-utils/
```

## Apps

### apps/api

Core API:

- market data endpoints
- strategy evaluation
- signal storage
- dry-run orders
- audit logs
- risk status

### apps/web

Nuxt 4 app:

- SSR/SSG SEO pages
- dashboard
- small BFF through `server/api`

### apps/bot

Telegram bot via grammY:

- status
- risk
- orders
- alerts
- pause/resume later

## Packages

### strategy-engine

Pure deterministic strategy logic.

### risk-engine

Pure deterministic risk checks.

### exchange-bybit

Bybit public client first. Private client later behind explicit task.

### shared-types

Shared contracts.

### seo-keywords

Metadata for SEO pages and keyword experiments.

## Flow

```txt
Bybit public data
  -> strategy-engine
  -> risk-engine
  -> dry-run ledger
  -> audit log
  -> Telegram alert
  -> Nuxt dashboard
```
