# Product claims registry

Registry version: 2\
Source review: 2026-09-12; deployed-revision review pending\
Product phase: self-hosted `DRY_RUN`; Gate 1 NO-GO\
Default owner: product maintainer\
Next source review: 2026-10-12 or before integration/capability changes; publication requires a deployed-revision review

This is the publishing contract for product claims. A claim that is absent,
expired, contradicted by the exact deployed revision, or outside its allowed
surface must not be published. Vendor documentation supports upstream facts;
it does not prove this product's runtime outcome.

## Source-scope correction

The phase matrix describes the local recovery, not a verified deployment.
Remote main has a separate tenant/RLS implementation and still requires the
allowlist recovery fix. [Project status](23_PROJECT_STATUS.md) records the
difference. Expired C002/C004 claims remain pending a deployed-revision audit;
this source review does not automatically renew public permission to publish.
C008 now has local regression evidence for enforcement, but is not verified
on remote main or production. The signed-out backtest copy also needs repair
because the API/BFF requires login (master backlog N09).

## Phase matrix

| Capability | Local source | Research or preparation | Not offered |
| --- | --- | --- | --- |
| Delivery model | Self-hosted repository | Hosted operational model | Hosted SaaS, SLA or tariff |
| Execution | Local `DRY_RUN` records | Gate 1 isolation and future Demo design | Private exchange submission or live trading |
| Market input | Public Bybit spot observations for reviewed symbols | Shared budgets/circuit breaker | Guaranteed continuous or exchange-equivalent data |
| Identity | Telegram Login plus tenant-scoped sessions | Independent Gate 1 proof | Browser-held service key or exchange identity |
| Notifications | Private `/start` eligibility plus durable delivery states | Fair dispatch | Guaranteed delivery or execution-dependent countdown |
| Risk evidence | Configured per-buy/daily/weekly/cooldown checks | Versioned policy/snapshot evidence | Risk-free, defect-proof or profit-safe automation |
| Credentials | No private exchange credential path | Demo credential architecture after Gate 1 GO | Withdrawal, transfer, margin or derivatives permission |

## Approved public claims

| ID | Approved wording or required meaning | Evidence owner | Evidence | Allowed surfaces | Expiry |
| --- | --- | --- | --- | --- | --- |
| C001 | `DRY_RUN` is the only shipped execution mode; no exchange order or asset transfer occurs. | engineering | DB mode constraints, runner and Gate 1 evidence | all | capability change |
| C002 | The product reads public Bybit spot observations for reviewed symbols. | engineering | public adapter and configured allowlist | product, docs | 2026-09-02 |
| C003 | RiskGuard checks configured limits; this reduces exposure but is not a guarantee against defects, configuration mistakes or losses. | risk owner | risk-engine contract and decision evidence | product, docs | policy revision |
| C004 | Telegram sign-in alone does not enable notifications; private `/start` establishes eligibility and delivery has durable status. | engineering | user binding and outbox catalog | product, docs, support | 2026-09-02 |
| C005 | No hosted SaaS, hosted tariff or SLA is currently offered; self-hosting carries infrastructure and operating costs. | product | current delivery model | product, docs, FAQ | delivery-model change |
| C006 | The shipped product has no legitimate need for an exchange API key. Withdrawal, transfer, margin and derivatives permissions are prohibited. | security owner | current public-only adapter and product policy | all | private-adapter proposal |
| C007 | Simulated results do not prove fills, fees, slippage, liquidity, latency, outages or reconciliation. | product and risk | current dry-run model | product, methodology, FAQ | model revision |
| C008 | BTCUSDT, ETHUSDT and SOLUSDT are the default reviewed allowlist; arbitrary input is not a support claim. | engineering | current config default | product, docs, support | allowlist revision |

## Forbidden wording

The following forms require new, reviewed evidence and must not be used now:

- `risk-free`, `guaranteed`, `physically cannot`, `not ever`, `safe way`;
- simulation behaves `exactly` like real capital or proves future live behavior;
- every Telegram alert is delivered or its countdown controls execution;
- any Bybit pair is supported merely because it can be stored;
- the product is free/open source without separating license, hosted price and
  self-hosting costs;
- `accepted`, `filled` or live profit language for local `DRY_RUN` completion;
- promised live/Demo dates, permissions or behavior before the relevant gate.

## Safety Ledger vocabulary

| Term | Public meaning |
| --- | --- |
| Detected | A configured market condition matched; no risk approval or order is implied. |
| Approved | Recorded risk checks passed for that decision; not an exchange acknowledgement or fill. |
| Rejected | A policy, cap, cooldown or other check blocked the proposed action. |
| Simulated | A local `DRY_RUN` outcome; no exchange order, fee, fill or transfer occurred. |
| Accepted / Filled | Reserved for future external evidence and not emitted by the current product. |
| Unknown / Stale | Evidence is ambiguous or too old; it must not be represented as success. |

## Review workflow

1. Link the exact revision and observable runtime/catalog evidence.
2. Identify whether the claim is product-owned, vendor-reported or inferred.
3. Update the phase matrix and affected claim row before changing public copy.
4. Search the complete public corpus for the forbidden wording and semantic
   equivalents.
5. Review structured data, metadata, FAQ and UI copy together.
6. Record the reviewer and next expiry. External legal review remains a
   separate prerequisite for legal conclusions; this registry makes none.
