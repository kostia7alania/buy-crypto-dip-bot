# Bybit Integration

## MVP

Public market data only.

No private API.
No API key.
No orders.
No withdrawals.

## Package

```txt
packages/exchange-bybit/
```

## Public methods

```ts
getTicker(symbol)
getKline(symbol, interval, limit)
```

## Later private methods

Only after explicit task approval:

```ts
createSpotOrder()
getBalances()
getOpenOrders()
cancelOrder()
```

## Forbidden forever

```ts
withdraw()
transferAll()
createFuturesOrder()
setLeverage()
```

## Safety

Private API keys must:

- use a separate exchange subaccount
- be spot-only
- have no withdrawal permission
- have tiny balance
- use IP restrictions if possible
