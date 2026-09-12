# Exchange adapters

Reviewed: 2026-09-12. Scope: local recovery source.

`packages/exchange-core` defines the public ticker/kline ports.
`packages/exchange-bybit` implements public spot observations with validated
V5 envelopes, numeric/range checks, source and receipt timestamps, TTL and
typed failures. Application boundaries enforce the reviewed-symbol policy.

`ExchangeTradingPort.createSpotOrder()` remains a `Promise<never>` placeholder.
No private credentials, signing, Demo/private order endpoints or withdrawal
operations are implemented. A local completed order is a simulation.

The market-data hardening exists in the local recovery and must be preserved
when integrating the newer main. Future Demo work requires Gate 1 GO, a fresh
review of official provider capabilities, narrow permissions and requests,
immutable correlation, reconciliation and explicit unknown outcomes. Old
provider research is dated evidence, not a current capability guarantee.
