# Task 02 — Market Data

Implement Bybit public market data.

Scope:

- no keys
- no orders
- no private API

Methods:

- `getTicker(symbol)`
- `getKline(symbol, interval, limit)`

Endpoints:

- `GET /market/:symbol/ticker`
- `GET /market/:symbol/klines`

Tests:

- valid symbol
- invalid symbol
- invalid interval
- mocked Bybit response
