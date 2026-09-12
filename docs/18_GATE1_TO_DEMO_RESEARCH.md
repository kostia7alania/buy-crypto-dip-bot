# Gate 1 to Bybit Demo: Night Research Dossier

> Historical 2026-08-02 research snapshot. Its old missing-FK/schema/startup statements are superseded by later local implementation. [Project status](23_PROJECT_STATUS.md) is now the normative gate record and remains NO-GO. This supersession does not authorize private credentials, Demo submission or live execution.

Date: 2026-08-02\
Status: 50/50 research tasks completed; Gate 1 remains **NO-GO**\
Scope: repository and source research only; no tests, builds, private exchange access, or live trading

## Executive decision

The current uncommitted implementation has moved forward since `docs/17_GATE1_PROOF_AND_DEMO_READINESS.md`, but it is not yet safe to call Gate 1 complete.

Two positive deltas are visible in source:

- group `/start` now refuses non-private chats before writing a notification destination;
- a PGlite seed/harness and A-versus-B API, migration, bot, and digest suites now exist.

Those changes do not close Gate 1. The present source still lacks the composite database invariant that prevents an A-owned order from referencing B's strategy, the declared Drizzle schema still disagrees with the manual contracted catalog, and production can listen and continue after missing authentication or failed migrations. The new suites were intentionally not run in this cycle and, by construction, their main lane applies only the automatic expand migrations rather than the manual contract on PostgreSQL 18.

The next milestone remains an isolated, fail-closed, auditable multi-user `DRY_RUN`. Bybit Demo work may advance only as a reviewed design contract. No private adapter, credential storage, or order placement should begin before an independent Gate 1 rerun is green.

## What changed since dossier 17

| Prior blocker | Current static state | Decision |
| --- | --- | --- |
| B1: cross-owner order/strategy relationship | Still open; manual contract adds separate foreign keys, not a same-owner composite foreign key | Blocking |
| B2: Drizzle/manual contract drift | Still open; source columns remain nullable and the journal ends at expand migration 0002 | Blocking |
| B3: group `/start` notification leak | Private-chat guard now runs before upsert in `apps/bot/src/bot.ts:37-70` | Resolved in source, not runtime-proven |
| B4: no working A/B gate | Seed and several suites now exist, but they were not run and do not prove the contracted PostgreSQL 18 catalog | Blocking proof gap |
| B5: production startup/deploy fail-open | Still open; listen precedes migrations and migration failure is swallowed | Blocking |

Two additional decision blockers appeared:

1. `plans/005-multi-user-isolation.md` calls Gate 1 passed while dossier 17 calls it NO-GO. Until there is one normative verdict, downstream work can select the convenient interpretation.
2. ownership preflight does not count an order with non-null `user_id` and null `strategy_id`; the contract then fails later at `SET NOT NULL` instead of refusing during the explicit verification step.

## Fifty-task result ledger

### A. Moving baseline and decision control

1. **Baseline captured.** HEAD is `cedc6df` on `main`; the worktree contains a large pre-existing uncommitted Gate 1/UI/test-harness change. This dossier and ExecPlan 007 are the only files owned by this research cycle.
2. **Dossier 17 reconciled.** Its missing-seed statement is stale, its cross-owner/schema/startup findings remain current, and its group-chat finding is fixed in current source.
3. **Code separated from proof.** Uncommitted source, unexecuted tests, migration scripts, CI gates, deployment readiness, and a merged revision are separate evidence classes; none substitutes for the others.
4. **Four schema artifacts separated.** `packages/db/src/schema.ts`, automatic SQL, the migration journal/snapshot, and `packages/db/migrations/manual/*` currently describe different catalog stages.
5. **Harness shape inspected.** `packages/db/src/testing-db.ts` uses PGlite and automatic migrations; the new suites therefore do not by themselves prove the manual contract or production PostgreSQL 18 behavior.
6. **API principal adoption traced.** The BFF forwards an opaque user session and Hono resolves it centrally, which is a strong normal-path shape; direct bot-to-DB mutations remain a second authorization boundary.
7. **BFF session boundary traced.** Owned routes propagate the session, but unsafe methods have no explicit Origin/CSRF guard and `/api/auth/me` trusts cookie contents without server-side session introspection.
8. **Bot/runner delta traced.** Owner-scoped reads and per-user digest work are present; atomic audit, single-flight scheduling, and durable notification delivery are not.
9. **Public claims audited.** The primary CTA correctly says `Open the dry-run console`, but `crypto-paper-trading-bot.vue` still says the simulation behaves “exactly” like real capital and is the engine live trading “will use”. That certainty is not supported before fee/slippage/private-order/reconciliation work. “Free” also needs to distinguish open-source self-hosting from any future hosted service.
10. **Verdict refreshed.** Gate 1 remains NO-GO; Gate 2 stays research-only.

### B. PostgreSQL and tenant-invariant research

11. **Same-owner invariant specified.** Add `UNIQUE (user_id, id)` on strategies and a composite foreign key from `orders(user_id, strategy_id)` to it; keep owner-qualified lookups and a corrupt-row negative case.
12. **Schema convergence specified.** After a controlled contract migration, the final Drizzle schema must declare non-null owners/strategy, foreign keys, and per-user symbol uniqueness, with metadata matching the catalog.
13. **Migration authority resolved.** A manual, unjournalled final state cannot be the ordinary production source of truth. The contract needs a versioned, reproducible, readiness-visible path without hiding the operator's legacy-owner decision.
14. **Legacy evidence specified.** Record the selected legacy owner, unresolved/quarantined rows, before/after counts, operator identity, timestamp, schema version, and approval without placing secrets in audit payloads.
15. **Catalog equivalence specified.** A clean install and a real 0001→0002→backfill→contract upgrade must end with identical relevant columns, constraints, indexes, and ownership counts.
16. **RLS prerequisites specified.** RLS is later defense in depth only with a non-owner/non-`BYPASSRLS` runtime role, transaction-local tenant context, pool-reset proof, and backup behavior that cannot silently filter tenants.
17. **Audit ownership semantics specified.** Tenant-shaped events require an owner; operator/system events need an explicit scope. A nullable owner alone cannot express the distinction.
18. **Atomic evidence boundary specified.** Strategy mutations and order transitions must commit state plus immutable event in one transaction; notifications follow through an outbox after commit.
19. **A/B gate design specified.** Keep PGlite for fast feedback, but Gate 1 requires a PostgreSQL 18 contracted lane covering clean install, real upgrade, coherent A/B rows, corrupt relationship rejection, API/BFF/bot/runner/aggregate isolation, and concurrency.
20. **Merge manifest specified.** Review in order: normative verdict → path diff → schema/journal/manual catalog → PG18 clean/upgrade evidence → A/B results → CI job → startup/readiness/deploy evidence. A remote branch or a green PGlite lane alone is insufficient.

### C. Authentication, bot, and operations research

21. **`API_KEY` gate specified.** Non-local API startup must refuse an absent key before binding a port; web and bot server-side callers must not silently omit the header in production.
22. **Configuration gate specified.** Validate `API_KEY`, `SESSION_SECRET`, PostgreSQL URL, Telegram requirements, execution mode, and expected schema version centrally, with secret values excluded from errors.
23. **Startup ordering specified.** Configuration and required migrations finish first, then readiness can become true, then HTTP and runner start. A migration error exits non-zero.
24. **Telegram Login policy specified.** Use a short freshness window, a consumed-payload fingerprint with TTL, per-source/per-user throttles, and structured success/replay/rejection evidence.
25. **Session policy specified.** Add idle plus absolute limits, renewal rules, active-session listing, revoke-one/revoke-all, security-event revocation, and scheduled cleanup after an investigation grace period.
26. **Browser boundary specified.** Production cookie should use a `__Host-` name, `Secure`, `HttpOnly`, `Path=/`, no `Domain`; unsafe methods need an allowlisted Origin/Referer and a same-origin custom header or session-bound CSRF token.
27. **Logging boundary specified.** Use an allowlist structured logger with correlation ID and redaction for API/session/bot tokens, Telegram hashes, signed bodies, database URLs, raw exchange payloads, and sensitive financial detail.
28. **Notification eligibility specified.** Web login must not imply that the bot may message the user. A successful private `/start` establishes a verified binding and `notificationEnabledAt`; delivery status is independent user state.
29. **Bot actor contract specified.** Every command/callback/mutation carries `ActorContext(userId, channel, correlationId)`, rejects group mutation, and uses one owner-scoped application boundary even if the bot retains direct database access.
30. **Operational evidence specified.** Separate liveness/readiness, pin deployments to immutable SHA, wait for schema/readiness, make bot absence fail visibly, add encrypted off-host PostgreSQL backup/restore drills, log rotation, retention policy, and session/API-key/bot-token incident playbooks.

### D. Bybit Demo and private-adapter research

31. **Demo matrix refreshed.** Demo uses `https://api-demo.bybit.com`, private `wss://stream-demo.bybit.com`, and mainnet public market streams; WS Trade is unavailable, limits are not upgradable, and Bybit retains Demo orders for seven days.
32. **Provisioning path chosen.** The first design uses a user-created Demo key from the user's separate Demo UID. API-created demo members/keys require a production account key and transfer-class permissions, an unnecessarily privileged dependency before Broker approval.
33. **Domain policy specified.** Environment and region select from an internal allowlist; user input never selects a host. Unknown combinations, prohibited regions, and key/domain mismatches fail closed.
34. **Signer policy specified.** HMAC is the narrow first signer; RSA is a later extension. Canonical GET/POST strings, bounded receive window, NTP health, and server-time diagnostics are required.
35. **Permission preflight specified.** Read API-key metadata without placing an order; require writable Spot trading only, verify UID/parent UID/environment/region/IP/expiry, and reject withdrawal, transfer, derivatives, margin, or unexpected scopes.
36. **Instrument checks specified.** Pull current status, quote rules, precision, minimum order amount, and market-order limits from instrument metadata; apply an explicit mainstream-spot allowlist and never duplicate changing values in strategy defaults.
37. **Narrow request specified.** The domain operation constructs `category=spot`, `side=Buy`, `orderType=Market`, `marketUnit=quoteCoin`, `isLeverage=0`, `orderFilter=Order`, and a tenant-scoped unique `orderLinkId`; callers cannot pass arbitrary Bybit payloads.
38. **Lifecycle specified.** REST success means accepted, not filled. Confirm with private `order.spot` and `execution.spot`; aggregate multiple fills and tolerate duplicate/counterintuitive filled messages with a monotonic reducer.
39. **Recovery specified.** Reserve spend and local idempotency before submit. On a lost response or stream gap, enter `UNKNOWN`, reconcile by `orderLinkId`/order/execution history, and never blindly resubmit.
40. **Capacity and Broker boundary specified.** Budget requests by endpoint, UID, and IP using response headers; stop on IP ban and jitter reconnects. Broker/OAuth stays a separate post-Gate-1 approval/security/legal decision, not a prerequisite for the manual Demo MVP.

### E. Competitor, positioning, and product-evidence research

41. **Comparable set refreshed.** External automation SaaS (3Commas, Bitsgap, Coinrule, Cryptohopper) is distinct from an exchange with built-in bots (Pionex). Breadth, custody, connection friction, and paper-trading fidelity must not be collapsed into one ranking.
42. **3Commas refreshed.** Its official page lists $20/$50/$140 monthly tiers and includes Demo across paid plans, with increasing API-key and bot breadth. Competing on bot count is unwinnable and contrary to the product rules.
43. **Bitsgap refreshed.** Its free tier advertises up to 20 Demo bots; annual-equivalent paid tiers are $23/$55/$119, and its Demo spans many bot types including futures. Demo quantity is commodity; constrained spot-only explainability is the differentiation.
44. **Coinrule refreshed.** Its classic official page lists two free Demo rules and $29.99 annual-billed entry pricing, while a second official cloud pricing surface lists a different $19.99 entry and “paper trading free forever”. Competitor prices must always carry date and URL; the product should expose simulation limitations more clearly than either surface.
45. **Cryptohopper refreshed.** Official annual-equivalent tiers are $24.16/$57.50/$107.50; paper trading and backtesting start in the entry tier inside a marketplace/strategy-designer suite. The opportunity is one inspectable strategy, not a marketplace.
46. **Pionex refreshed.** It is a custodial exchange with built-in bots and trading-fee economics rather than an external user-key SaaS. Its low setup friction cannot be copied without changing the product's custody and safety posture.
47. **Trust-first wedge sharpened.** Position as a spot-only Safety Ledger: every signal, cap, rejection, simulated order, stale dependency, and simulation limitation is visible. Prohibited claims include live execution, guaranteed safety/performance, simulation equivalence, and free hosted service before those are real.
48. **First-run proof journey specified.** Choose a mainstream pair → set a bounded amount/threshold → see caps before activation → run without a key → inspect one approved and one rejected decision → understand fees/slippage/freshness limitations → optionally express Demo interest after sustained use.
49. **Commercial evidence specified.** Keep the open-source self-hosted dry-run core free; test hosted beta access and price points rather than declaring a tier. Track privacy-minimal funnel events from verified login through week-2 retained evidence viewing and Demo interest, never raw financial payloads or credentials.
50. **Delivery sequence produced.** The ordered backlog below is the exit artifact; no Demo implementation starts until its Gate 1 entry criterion is independently satisfied.

## Critical technical findings

### 1. Database tenant consistency is still structurally incomplete

`packages/db/migrations/manual/003_contract_ownership.sql` sets non-null owners and a strategy foreign key, but does not couple the order owner to the strategy owner. The current migration test even records the cross-owner insert as accepted. Runner lookup by strategy id alone can then place B's strategy name into A's order evidence and notification.

Required contract:

```sql
ALTER TABLE strategies
  ADD CONSTRAINT strategies_user_id_id_unique UNIQUE (user_id, id);

ALTER TABLE orders
  ADD CONSTRAINT orders_user_id_strategy_id_fk
  FOREIGN KEY (user_id, strategy_id)
  REFERENCES strategies (user_id, id);
```

The exact migration form remains an implementation decision; the invariant is not optional.

### 2. The new test layer is useful but cannot be the Gate 1 claim

The added PGlite layer is good fast feedback. It is not equivalent to the production contract because:

- it applies automatic migrations, while the contract remains under `migrations/manual`;
- PGlite does not prove PostgreSQL 18 server roles, catalog, locks, deploy ordering, or RLS behavior;
- no current green run is asserted in this cycle;
- coherent fixtures do not exercise the corrupt cross-owner state the current database still accepts.

Gate 1 needs both a fast lane and a production-like contracted PostgreSQL 18 lane.

### 3. Runner scheduling and delivery evidence are new high-priority risks

Async strategy ticks are launched from `setInterval` without a single-flight guard. The “existing pending order” read and the new order insert are not one atomic reservation, so two overlapping ticks can schedule duplicates.

Telegram sending currently catches network/HTTP failure and resolves. The digest caller increments its `sent` count after that resolved promise, so logs can claim delivery that Telegram rejected. A durable outbox with explicit attempt state is needed before notification metrics or financial evidence can be trusted.

### 4. Public simulation copy needs a stricter truth boundary

The current product is strongest when it says exactly what happened. “Real prices, fake money”, visible RiskGuard decisions, and the audit ledger fit that posture. “Behaves exactly as it would with real capital” does not: there is no private order lifecycle, fill stream, fee/slippage model, rate-limit behavior, or reconciliation path yet.

Recommended content assets:

- “What `DRY_RUN` proves — and what it cannot prove”;
- “Why withdrawal permission is never needed”;
- “From signal to rejected order: an auditable example”.

Keep the CTA `Open the dry-run console` until Gate 1 closes.

## Competitor evidence

Snapshot checked 2026-08-02. Pricing can change by term, tax, region, and promotion.

| Competitor | Type | Current official signal | Product implication |
| --- | --- | --- | --- |
| 3Commas | Multi-exchange automation SaaS | $20/$50/$140 monthly; Demo included; large bot/API-key limits | Do not compete on breadth; make decision evidence the product |
| Bitsgap | Multi-exchange bots and Demo sandbox | Free tier with up to 20 Demo bots; paid annual-equivalent $23/$55/$119 | “Paper trading” is not a moat; explainability and spot-only restraint can be |
| Coinrule | No-code/AI rule builder | Two free Demo rules on classic pricing; inconsistent official pricing surfaces | Date every comparison and make simulation assumptions explicit |
| Cryptohopper | Automation and strategy marketplace | Paper trading/backtesting in $24.16 annual-equivalent entry plan | Avoid marketplace complexity; ship one auditable strategy |
| Pionex | Custodial exchange with built-in bots | No separate bot subscription; trading-fee model | Do not sacrifice user-owned-account posture to match connection friction |

Primary competitor sources:

- [3Commas pricing](https://3commas.io/pricing) and [security](https://3commas.io/security)
- [Bitsgap pricing](https://bitsgap.com/pricing) and [Demo guide](https://bitsgap.com/helpdesk/article/13512068818332-How-to-use-Bitsgap-Demo-Mode)
- [Coinrule classic pricing](https://coinrule.com/pricing.html), [cloud pricing](https://cloud.coinrule.com/pricing), and [Demo limitations](https://help.coinrule.com/articles/946340-comparing-live-trading-demo-exchange)
- [Cryptohopper pricing](https://www.cryptohopper.com/pricing) and [security guidance](https://support.cryptohopper.com/en/articles/8989860-how-to-ensure-the-safety-of-my-funds)
- [Pionex bot-fee model](https://www.pionex.com/blog/knowledge-base/whats-the-free-to-use-these-12-trading-bots-on-pionex/)

## Dependency-ordered backlog

### R0 — Establish one truth

- Make dossier 18 the current Gate 1 verdict and mark the conflicting “passed” language in plan 005 as historical.
- Define the exact contract version and required evidence manifest.

Exit: one binary Gate 1 status and no private-Bybit ticket considered unblocked.

### R1 — Close database ownership and migration authority

- Add same-owner composite constraint and the null-strategy preflight category.
- Make Drizzle schema, journal, automatic/manual workflow, and clean-install catalog converge.
- Define tenant/system audit scope and keep `DRY_RUN` structurally fail-closed.

Exit: impossible to persist cross-owner or ownerless tenant relationships in the contracted catalog.

### R2 — Build the real Gate 1 proof lane

- Retain the PGlite fast lane.
- Add PostgreSQL 18 clean-install and real-upgrade lanes ending in the contracted catalog.
- Exercise A/B data, corrupt rows, concurrency, bot, runner, aggregates, and migrations.

Exit: a reproducible CI job produces the merge evidence manifest.

### R3 — Fail closed in production

- Validate configuration before bind, migrate before traffic, and exit on failure.
- Add schema-aware readiness, runner/bot freshness, immutable image deployment, and readiness wait.

Exit: a misconfigured or stale-schema deployment cannot report ready or run ticks.

### R4 — Harden identity and browser boundaries

- Close Telegram Login replay, define session lifecycle and authoritative `me`, make logout truthfully report revocation, and add CSRF/host-cookie controls.
- Separate verified private-chat delivery eligibility from web identity.

Exit: identity/session/notification state is explicit, revocable, and fail-closed.

### R5 — Make every decision and delivery auditable

- Transact state changes with immutable audit events.
- Add runner single-flight/idempotent reservation and durable Telegram outbox.
- Operationalize retention, encrypted off-host backup, restore reconciliation, and incident playbooks.

Exit: no state transition or claimed notification success can exist without durable evidence.

### R6 — Independent Gate 1 rerun

- Run the full contracted PostgreSQL 18 matrix and deployment-readiness rehearsal after the explicit no-test restriction is lifted.
- Review the exact final diff and publish the evidence manifest.

Exit: all blockers closed and an independent reviewer records Gate 1 GO.

### R7 — Bybit Demo design, still no live funds

- Approve M01–M12 as a narrow user-provisioned Demo design.
- Keep Broker/OAuth as a separate later decision.
- Only then authorize implementation of encrypted per-user connections, Demo signing, spot-only order lifecycle, and reconciliation.

Exit: Gate 2 may begin in Demo only; `LIVE` remains unavailable and off by construction.

## Current official Bybit sources

Checked 2026-08-02:

- [Demo Trading Service](https://bybit-exchange.github.io/docs/v5/demo)
- [Integration and signing guidance](https://bybit-exchange.github.io/docs/v5/guide)
- [API key information](https://bybit-exchange.github.io/docs/v5/user/apikey-info)
- [Place Order](https://bybit-exchange.github.io/docs/v5/order/create-order)
- [Private order stream](https://bybit-exchange.github.io/docs/v5/websocket/private/order)
- [Private execution stream](https://bybit-exchange.github.io/docs/v5/websocket/private/execution)
- [Open and closed orders](https://bybit-exchange.github.io/docs/v5/order/open-order)
- [Order history](https://bybit-exchange.github.io/docs/v5/order/order-list)
- [Execution history](https://bybit-exchange.github.io/docs/v5/order/execution)
- [Rate-limit rules](https://bybit-exchange.github.io/docs/v5/rate-limit)
- [Error codes](https://bybit-exchange.github.io/docs/v5/error)
- [Broker OAuth guidance](https://bybit-exchange.github.io/docs/v5/broker/api-broker/guidance)

## Verification boundary

- Three subagents independently covered DB/tenant, auth/operations, and Bybit/competitor tracks.
- Repository and external sources were inspected read-only.
- No test, build, typecheck, lint, database, exchange, or deployment command was run, per the explicit instruction for this cycle.
- No credential was requested or used; no private or order endpoint was called.
- Documentation-only checks are recorded in ExecPlan 007 after completion.
