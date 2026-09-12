# ExecPlan 004 — Multi-user Bybit Safety Research

## Goal

Turn the existing multi-user Bybit research into an evidence-backed, implementation-ready plan without adding private exchange execution or enabling live trading.

This is an overnight research pass started on 2026-07-31. It is deliberately documentation-first because the current product still has global data paths and no private trading adapter.

## Safety boundaries

- Keep `DRY_RUN` as the default and only currently supported execution mode.
- Do not implement futures, leverage, transfers, withdrawals, martingale, or meme-coin trading.
- Do not create, request, print, or store real exchange credentials.
- Do not treat the shared service `API_KEY` as end-user authorization.
- Do not promise live execution in product copy while the private adapter and tenant isolation are absent.
- Preserve the pre-existing uncommitted Safety Ledger UI changes; this plan must remain independently reviewable.
- Prefer official Bybit, Telegram, OWASP, PostgreSQL, and framework documentation for technical claims.

## Current baseline

- Branch: `main` at `cedc6df`, matching `origin/main` when this pass began.
- Runtime: Node.js `v26.5.0`, pnpm `11.0.0`.
- Existing public Bybit adapter supports market data only.
- `ExchangeTradingPort.createSpotOrder()` is still a stub.
- Telegram Login creates a server-side web session, but downstream API data routes are not yet bound to that user session.
- `strategies.user_id` is nullable; `orders` and `audit_events` have no user ownership column.
- Runner notifications still use one global `TELEGRAM_CHAT_ID`.

## Twenty-task backlog

Each task is complete only when its evidence and conclusion are recorded in this plan or a linked repository document.

- [x] 1. Capture git/runtime baseline and isolate pre-existing UI work.
- [x] 2. Map current components, data flows, and trust boundaries.
- [x] 3. Re-audit tenant isolation across DB, API, BFF, bot, and runner.
- [x] 4. Recheck official Bybit onboarding options: API key, Demo, Broker OAuth, and AI Subaccount.
- [x] 5. Define the minimum acceptable Bybit permission contract and connection checks.
- [x] 6. Design per-user credential storage, encryption, rotation, and revocation.
- [x] 7. Define separate gates for DRY_RUN, Bybit Demo, closed live pilot, and public SaaS.
- [x] 8. Define the safe order lifecycle: idempotency, ACK, fills, partial fills, UNKNOWN, and reconciliation.
- [x] 9. Recheck Bybit rate limits and design shared market-data/connection management.
- [x] 10. Audit dashboard auth/session boundaries and `API_KEY` versus user authorization.
- [x] 11. Design user-owned schema, constraints, and legacy-data migration.
- [x] 12. Audit Telegram per-user routing, callback ownership, and session binding.
- [x] 13. Design risk reservations, per-user/global limits, and kill switches.
- [x] 14. Produce a hosted-product threat model and abuse-case list.
- [x] 15. Refresh the competitor comparison for onboarding, paper/demo trading, safety, and pricing.
- [x] 16. Validate positioning and monetization hypotheses without unsupported live-trading claims.
- [x] 17. Define customer-discovery hypotheses and first-user interview scripts.
- [x] 18. Define trust-first product analytics without sensitive-data leakage.
- [x] 19. Produce phase gates, a negative-test matrix, and an operational-readiness checklist.
- [x] 20. Synthesize a dependency-ordered implementation backlog with acceptance criteria.

## Deliverables

- This living ExecPlan, with evidence and task status kept current.
- A current-state trust-boundary diagram and tenant-isolation matrix.
- A Bybit connection and execution contract based on current official documentation.
- A threat model and safety test matrix.
- A competitor/product evidence table with date-stamped sources.
- A dependency-ordered delivery backlog that remains `DRY_RUN`-first.

## Progress log

### 2026-07-31 — Task 1 complete

- Confirmed `main` at `cedc6df`, initially matching `origin/main`.
- Confirmed Node.js `v26.5.0` and pnpm `11.0.0` satisfy repository rules.
- `git diff --check` passed.
- Recorded and left untouched the pre-existing Safety Ledger UI work: 16 modified and 2 untracked files at the start of this pass.

### 2026-07-31 — Tasks 2–3 complete

- Added the current trust-boundary map and tenant-isolation matrix to `docs/16_MULTI_USER_BYBIT_RESEARCH.md`.
- Confirmed that Telegram identity terminates at the Nuxt session while ordinary BFF/API calls remain service-authenticated and globally scoped.
- Confirmed global bot mutations, symbol-only onboarding, order-id-only callbacks, ownerless order/audit rows, global aggregates, and one-chat runner notifications.
- Kept the private Bybit adapter out of scope until these isolation gaps are closed.

### 2026-07-31 — Tasks 4–9 complete

- Rechecked current official Bybit guidance for manual keys, Demo Trading, API Broker OAuth, the new AI Subaccount, key permissions, signing, spot order creation, instruments, private streams, execution history, and rate limits.
- Chose Demo as the first private-adapter target and API Broker OAuth as the preferred public hosted target, with AI Subaccount kept as a pilot candidate pending explicit Bybit compatibility confirmation.
- Defined a fail-closed SpotTrade-only permission contract, encrypted per-user credential envelope, three explicit execution modes, an idempotent/reconciling order lifecycle, and shared market-data plus per-UID private connection architecture.
- Recorded current official source links in `docs/16_MULTI_USER_BYBIT_RESEARCH.md`.

### 2026-07-31 — Tasks 10–14 complete

- Designed separate service authentication and revocable end-user API sessions, with fail-closed BFF/API behavior and production cookie/session requirements.
- Defined the target owner columns, connection/session/reservation records, and an explicit expand-backfill-verify-contract migration that never guesses a legacy owner.
- Converted global Telegram behavior into a per-caller ownership contract, including callback actor checks and verified chat routing.
- Defined serialized budget reservations and user/global kill-switch invariants.
- Added a threat model covering cross-tenant access, credentials, permissions, environment confusion, duplicate orders, risk races, streams, quotas, migrations, logging, and insider access.

### 2026-07-31 — Tasks 15–17 complete

- Refreshed official product/pricing/Demo/security evidence for 3Commas, Bitsgap, Coinrule, Cryptohopper, and Pionex.
- Confirmed that paper trading is common; the differentiator must be explainable safety evidence and low-cognitive-load spot-only operation.
- Replaced unsupported live positioning with a truthful current one-line promise and defined monetization experiments rather than inventing a final price.
- Added interview cohorts, falsifiable hypotheses, evidence thresholds, and a behavior-first interview script.

### 2026-07-31 — Task 18 complete

- Audited the existing production-only GA4 loader and documented its current placeholder/no-event state.
- Defined an 11-event acquisition/activation contract, three key events, safe parameter allowlists, explicit prohibited data, and a validation checklist.
- Separated GA4 acquisition signals from first-party product/operational metrics and kept the north-star focused on sustained dry-run trust rather than order count, spend, or PnL.

### 2026-07-31 — Tasks 19–20 complete

- Defined cumulative go/no-go gates for truthful single-tenant DRY_RUN, isolated multi-user DRY_RUN, Bybit Demo, closed live pilot, and public hosted SaaS.
- Added a 30-case negative/failure test matrix and a release-oriented operational readiness checklist.
- Converted the research into 20 dependency-ordered implementation tickets with explicit acceptance criteria.
- Selected I01–I10 as the next milestone; private credential/order work is blocked until Gate 1 tenant isolation passes.

### 2026-07-31 — Verification

- `git diff --check` passed.
- `pnpm check` passed: typecheck and all test tasks succeeded; lint completed with 23 existing warnings and no errors.
- Confirmed all 20 research checklist items are marked complete.
