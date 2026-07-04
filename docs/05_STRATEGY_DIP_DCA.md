# Strategy: Dip-DCA

## Goal

Buy crypto dips in a controlled way.

## Supported rules

### DROP_FROM_24H_HIGH

Signal when current price drops X% from 24h high.

### DROP_FROM_PREVIOUS_DAILY_CLOSE

Signal when current price drops X% from previous daily close.

### DROP_FROM_ROLLING_HIGH

Signal when current price drops X% from rolling high over N candles.

### FLASH_CRASH

Later rule. Signal when price drops X% within Y minutes/hours.

## Example config

```json
{
  "symbol": "BTCUSDT",
  "mode": "DRY_RUN",
  "baseQuoteCurrency": "USDT",
  "rules": [
    {
      "type": "DROP_FROM_24H_HIGH",
      "thresholdPercent": 10,
      "quoteAmount": 20
    }
  ],
  "cooldownMinutes": 360,
  "maxDailySpend": 20,
  "maxWeeklySpend": 100
}
```

## Output

```json
{
  "status": "BUY_SIGNAL",
  "symbol": "BTCUSDT",
  "reason": "DROP_FROM_24H_HIGH",
  "dropPercent": 10.4,
  "suggestedQuoteAmount": 20,
  "timestamp": "2026-07-04T00:00:00.000Z"
}
```

## Rule

Strategy engine suggests. RiskGuard decides.
