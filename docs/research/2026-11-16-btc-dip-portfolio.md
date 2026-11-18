# BTC dip thresholds: exploratory portfolio comparison

**2026-11-18 update.** The [hourly follow-up and source audit](2026-11-18-mvp-evidence.md)
found a material provenance problem in the hourly mirrors and a close match
to the daily mirror. Treat this report's figures as exploratory.

Research date: 2026-11-16. This evaluates an illustrative portfolio, not an
exchange-ready strategy, profit guarantee, or demonstrated predictive edge.

## Data and limits

Daily BTC/USD OHLCV attributed to Bitstamp, obtained through a
[third-party mirror](https://github.com/daniegitx1/btc-price-history/blob/main/data/btc_usd_daily.csv).
The upstream market origin has not been independently reconciled with Bitstamp.
It is not Bybit BTC/USDT. The CSV SHA-256 for the data used is
`1021e805a5d9d7bdb40879622588dfeac40f4ea03e5828070433401e57de0330`;
verify it before reproducing. All dates are UTC. Consecutive days, annual
coverage and basic OHLC bounds were checked, not the origin or realism of
individual values. We already inspected some 2025 data in the previous study:
this entire exercise is exploratory, with no genuinely untouched holdout.

## Comparison rules

- Every calendar year is a separate experiment funded with $1,200 on January
  1. All strategies start with identical cash, no deposits or withdrawals.
- DCA invests $100 on the first day of each month. Buy-and-hold invests $1,200
  on January 1. Dip variants spend $100 per signal while cash remains.
- The "one-day" rule triggers after daily close falls at least the threshold
  against the previous close. The "30-day" rule triggers when daily close first
  crosses below a threshold measured from the maximum of the previous 30
  **daily closes**; it can trigger again after the condition clears and then
  recurs. This is different from the project's 24-hour intraday high rule.
- Signals are known after the close; buys are modeled at the next day's open.
  Open is nearly simultaneous with the close, so execution at that price is
  optimistic. A sensitivity check models the following daily close instead.
- Each buy incurs an assumed 0.1% fee on the budget and an additional 0.1%
  adverse execution-price adjustment. These are scenarios, not verified
  current Bitstamp or Bybit fees. No order-book depth, taxes or outages.
- The year-end portfolio value includes unspent cash plus BTC marked at the
  December 31 close; there is no sale or exit fee. ROI is `(value / 1200 - 1)`.
  The script also reports end cash, purchase count, blocked signals and maximum
  daily-close drawdown. Results are unrealized and not a compounded portfolio.

## 2023–2025: total portfolio ROI and purchase count

Each cell is ROI / number of buys. These three years are illustrative results,
not three independent experiments established in advance.

| Rule | 2023 | 2024 | 2025 |
| --- | ---: | ---: | ---: |
| Buy and hold | +155.13% / 1 | +120.54% / 1 | −6.46% / 1 |
| Monthly DCA | +58.51% / 12 | +53.50% / 12 | −12.10% / 12 |
| One-day −2% | +78.31% / 12 | +76.61% / 12 | −8.94% / 12 |
| One-day −5% | +36.17% / 7 | +49.25% / 12 | −1.22% / 8 |
| One-day −7% | +4.86% / 1 | +20.07% / 3 | −1.78% / 2 |
| One-day −10% | 0.00% / 0 | 0.00% / 0 | 0.00% / 0 |
| One-day −15% | 0.00% / 0 | 0.00% / 0 | 0.00% / 0 |
| 30-day −2% | +64.22% / 12 | +62.73% / 12 | −18.23% / 12 |
| 30-day −5% | +56.66% / 12 | +46.28% / 12 | −14.63% / 10 |
| 30-day −7% | +65.41% / 12 | +49.43% / 12 | −9.84% / 10 |
| 30-day −10% | +55.00% / 10 | +59.20% / 12 | −7.08% / 12 |
| 30-day −15% | +8.92% / 1 | +62.06% / 10 | +0.28% / 9 |

For the one-day −10% rule, 0% means all $1,200 stayed in cash — no purchase,
not a breakeven trade. Under the 30-day −10% rule, remaining cash at year end
was $200 in 2023 and $0 in 2024 and 2025. The 30-day −15% rule left $300 in
2025. This materially changes exposure and limits pure ROI comparisons.

## Rolling historical selection

For each test year, rank the ten dip variants by equal-weight mean annual ROI
on the preceding three years, select one (ties alphabetically), then evaluate
it in the next year. The ranking does not include DCA or buy-and-hold. This
checks a selection procedure; the family of rules, periods and results have
already been explored, so this is not evidence from a pristine forward test.

| Test year | Training years | Selected rule | Test ROI | Buys | Test ROI with later close entry |
| --- | --- | --- | ---: | ---: | ---: |
| 2023 | 2020–2022 | One-day −5% | +36.17% | 7 | +36.23% |
| 2024 | 2021–2023 | One-day −2% | +76.61% | 12 | +74.35% |
| 2025 | 2022–2024 | One-day −2% | −8.94% | 12 | −8.47% |

Result: no fixed threshold is established as best for future returns. In
particular, 10% in one day and 10% below a prior 30-day peak are very different
events. Compare portfolio allocations, unspent capital, drawdown and execution
assumptions, not just the winning ROI. Source reconciliation, more markets,
additional periods and a later genuinely untouched evaluation are needed.

## Reproduce

```sh
python3 scripts/research/btc_dip_portfolio.py path/to/btc_usd_daily.csv
```

The JSON contains every annual result from 2020 to 2025, selected variants,
late-entry sensitivity and the input checksum.
