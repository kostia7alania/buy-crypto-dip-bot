# Product specification

Reviewed: 2026-09-12. Scope: the recovery source, with release differences in
[project status](23_PROJECT_STATUS.md).

## User outcome

Let a person configure bounded simulated dip purchases, understand why a
signal was approved or rejected, and inspect the resulting local records.
The product does not promise profit, exchange fills or loss prevention.

## Current flow

1. Telegram Login establishes a web identity; private bot `/start` separately
   establishes notification eligibility.
2. A person configures a reviewed spot pair, threshold, amount, daily/weekly
   strategy caps and cooldown. Defaults come from `packages/config`.
3. Public Bybit observations feed the strategy and RiskGuard. Stored strategy
   rows cannot expand the reviewed-symbol policy.
4. Approved decisions create delayed `DRY_RUN` orders. Due orders complete
   locally; Telegram can cancel or request immediate simulated completion.
5. Owned audit and order records, PnL, benchmarks and historical replay provide
   evidence. Notifications have durable status rather than guaranteed delivery.

## Constraints and honest limitations

- Reviewed symbols are BTCUSDT, ETHUSDT and SOLUSDT. Environment configuration
  can narrow the list. Unsupported historical orders cannot complete, but can
  still be cancelled without erasing history.
- Spend aggregation is per strategy and counts completed local orders. A
  full reservation lifecycle, policy versions and portfolio-wide budgeting
  are not implemented guarantees.
- Historical replay does not prove fills, fees, slippage, latency or liquidity.
  Account access is required by the current backtest API/BFF contract.
- The recovery contains no general exchange connection, signer, credential
  vault, Demo submission, Broker OAuth or live executor.
- A source-level user boundary is not a release approval. Gate 1 remains
  NO-GO pending the integration and verification in the backlog.

## Product acceptance

A release must expose only the signed-in person's data, keep old in-flight
responses out of a new session, preserve state and audit atomically, reject
unsupported execution, and distinguish unavailable/stale evidence from
success. Growth, pricing and retention hypotheses need actual user evidence.
