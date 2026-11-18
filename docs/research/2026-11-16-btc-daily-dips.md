# BTC daily dips: exploratory check

**2026-11-18 update.** See the [source audit](2026-11-18-mvp-evidence.md)
before using this mirror for strategy decisions.

Research date: 2026-11-16. This is a descriptive check, not an executable
strategy, forecast, or evidence of trading profitability.

## Data and method

- Third-party mirror of Bitstamp BTC/USD daily candles, not Bybit BTC/USDT:
  [CSV source](https://github.com/daniegitx1/btc-price-history/blob/main/data/btc_usd_daily.csv).
  Upstream provenance has not been independently verified against Bitstamp.
- CSV Git blob SHA: `6a75d4ea001ec40cc77cb3eec48a7fc5c481df82`; SHA-256 of
  the downloaded bytes: `1021e805a5d9d7bdb40879622588dfeac40f4ea03e5828070433401e57de0330`.
  The mirror can change; verify the checksum before reproducing.
- Observed range: 2011-08-18 through 2026-11-15, 5,569 daily rows. Dates
  are consecutive and OHLC values satisfy basic range checks; these checks do
  not establish authenticity or eliminate fabricated/filled prices.
- For each UTC day in 2020–2025, calculate next-day close return. Compare all
  days against the subset whose close fell at least 5% versus the previous
  close. The year is the signal day; next-day data can cross year boundaries.

| Year | All days n | All next-day mean | All next-day median | Dip days n | Dip next-day mean | Dip next-day median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020 | 366 | +0.47% | +0.41% | 17 | +3.06% | +1.50% |
| 2021 | 365 | +0.22% | +0.06% | 35 | +0.72% | +0.38% |
| 2022 | 365 | −0.23% | −0.19% | 24 | −0.10% | +0.28% |
| 2023 | 365 | +0.29% | −0.01% | 7 | +0.01% | −0.72% |
| 2024 | 366 | +0.25% | +0.14% | 12 | +1.02% | −0.26% |
| 2025 | 365 | +0.01% | +0.005% | 8 | −0.53% | −0.51% |

The threshold and years were chosen for exploration; there is no preregistered
holdout or uncertainty estimate, and dip-day samples are small. The all-days
group includes dip days. Close-to-close returns assume no executable entry,
fees, spread or slippage. This is not the project's 24-hour-high rule and is
not a DCA comparison. These results do not prove a repeatable advantage.

Reproduce after obtaining and checking the same CSV:

```sh
python3 scripts/research/btc_daily_dip.py path/to/btc_usd_daily.csv
```

Next: obtain independently verifiable Bybit spot data; define capital,
execution costs, chronological validation, and an untouched period before
comparing the project's rule with a cash-matched DCA baseline. Evaluate
timestamped news only as an incremental feature with a price-only control.
