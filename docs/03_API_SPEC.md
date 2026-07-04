# API Spec

## Health

```http
GET /health
GET /version
```

## Market

```http
GET /market/:symbol/ticker
GET /market/:symbol/klines?interval=1d&limit=30
```

MVP allowlist:

```txt
BTCUSDT
```

## Strategy

```http
GET /strategies
POST /strategies
PATCH /strategies/:id
POST /strategies/:id/enable
POST /strategies/:id/disable
POST /signals/evaluate
GET /signals
```

## Risk

```http
GET /risk/status
POST /risk/evaluate
```

## Orders

```http
GET /orders
POST /orders/dry-run
```

No live order endpoint in Task 0.

## Audit

```http
GET /audit
```

## Response rules

- Validate all input with Valibot.
- Return typed error codes.
- Never leak secrets.
- Log every signal and risk decision.
