# ExecPlan 007 — Gate 1 to Demo Night Research

## Goal

Run a third evidence-first overnight research cycle, convert the moving Gate 1 worktree and current external constraints into fifty bounded decisions, and produce the next safe delivery sequence without implementing private exchange access.

This cycle started on 2026-08-02. It continues ExecPlans 004–006; it does not treat their findings as current without rechecking the repository and external primary sources.

## Safety and scope

- `DRY_RUN` remains the only supported execution mode.
- Do not create, request, store, or use exchange credentials.
- Do not implement Bybit private calls, live order placement, leverage, futures, martingale, withdrawals, or meme-coin support.
- Treat every pre-existing uncommitted implementation file as concurrent user work; inspect it, but do not edit or claim it.
- Add research documentation only.
- Per the explicit instruction for this cycle, do not run tests, builds, typechecks, or linters. Read-only inspection and documentation checks are allowed.

## Fifty-task backlog

### A. Moving baseline and decision control

- [x] 1. Capture HEAD, dirty-worktree scope, and the research-only ownership boundary.
- [x] 2. Reconcile the current worktree with ExecPlan 006 and dossier 17.
- [x] 3. Separate implemented-looking code from proved behavior and merge evidence.
- [x] 4. Recheck schema, automatic migrations, manual migrations, and migration metadata as four distinct artifacts.
- [x] 5. Recheck the current database test-harness shape without executing it.
- [x] 6. Trace current API principal adoption across every user-data route.
- [x] 7. Trace current BFF session propagation and unsafe-method boundary.
- [x] 8. Trace bot and runner ownership/notification changes now present in the diff.
- [x] 9. Audit public product copy against current `DRY_RUN` capabilities and packaging reality.
- [x] 10. Issue a refreshed Gate 1 go/no-go decision with explicit blockers.

### B. PostgreSQL and tenant-invariant research

- [x] 11. Specify the same-owner order-to-strategy database invariant.
- [x] 12. Specify how the final Drizzle schema must converge with the contracted catalog.
- [x] 13. Resolve the automatic-versus-manual migration source-of-truth model.
- [x] 14. Define an operator-owned legacy-row resolution artifact and evidence trail.
- [x] 15. Define clean-install versus upgrade catalog-equivalence evidence.
- [x] 16. Define the runtime-role prerequisites that make PostgreSQL RLS meaningful.
- [x] 17. Define tenant-versus-system audit ownership semantics and constraints.
- [x] 18. Define the transaction boundary for state transitions and immutable audit evidence.
- [x] 19. Convert the A-versus-B matrix into a deterministic PostgreSQL gate design.
- [x] 20. Define the database merge-evidence manifest and review order.

### C. Authentication, bot, and operations research

- [x] 21. Define fail-closed `API_KEY` startup behavior for non-local deployments.
- [x] 22. Define required startup validation for session and database configuration.
- [x] 23. Define migration-before-listen and migration-before-runner ordering.
- [x] 24. Define Telegram Login freshness, replay, and throttling policy.
- [x] 25. Define idle, absolute, renewal, revocation, and cleanup session policy.
- [x] 26. Define the host-only cookie and CSRF/origin contract.
- [x] 27. Define one secret-safe error and logging boundary.
- [x] 28. Define verified private-chat notification eligibility.
- [x] 29. Define bot command/callback actor binding and no-group mutation policy.
- [x] 30. Define readiness, migration, retention, backup/restore, and incident evidence.

### D. Bybit Demo and private-adapter research

- [x] 31. Refresh the official Demo capability, retention, and transport matrix.
- [x] 32. Decide between user-created Demo keys and privileged API-created Demo accounts.
- [x] 33. Define fixed environment and region-domain selection rules.
- [x] 34. Define HMAC/RSA signer scope, time synchronization, and receive-window rules.
- [x] 35. Define the read-only API-key permission-verification contract.
- [x] 36. Define dynamic instrument, precision, minimum, and allowlist validation.
- [x] 37. Define a narrow spot-market-buy request that cannot express forbidden products.
- [x] 38. Define REST acceptance, private-stream confirmation, and fill normalization.
- [x] 39. Define idempotency, `UNKNOWN` recovery, reservation, and reconciliation behavior.
- [x] 40. Define endpoint/UID/IP rate budgets and Broker-OAuth prerequisites.

### E. Competitor, positioning, and product-evidence research

- [x] 41. Refresh the competitor set and compare like-for-like product types.
- [x] 42. Recheck 3Commas pricing, Demo inclusion, breadth, and positioning.
- [x] 43. Recheck Bitsgap free Demo, paid tiers, onboarding, and risk language.
- [x] 44. Recheck Coinrule free Demo limits, paid entry, and beginner positioning.
- [x] 45. Recheck Cryptohopper paper-trading packaging, pricing, and feature breadth.
- [x] 46. Recheck Pionex custody/fee/bot model and why it is not the target posture.
- [x] 47. Convert the market comparison into a defensible trust-first wedge and prohibited claims.
- [x] 48. Define the first-run proof journey and customer-discovery questions.
- [x] 49. Define pricing experiments and a privacy-minimal retention funnel.
- [x] 50. Produce one dependency-ordered research-to-delivery backlog with exit gates.

## Deliverables

- This completed fifty-task plan.
- `docs/18_GATE1_TO_DEMO_RESEARCH.md`, containing the refreshed decision, evidence, competitor comparison, and delivery sequence.
- No edits to the implementation under review.

## Progress

### 2026-08-02 — cycle opened

- Started three read-only subagents for DB/tenant, auth/operations, and Bybit/market research.
- Captured `main` at `cedc6df` with a large pre-existing uncommitted Gate 1, UI, and test-harness diff.
- Re-read ExecPlan 006, dossiers 14, 16, and 17, repository rules, and the current public-page copy.
- Refreshed official Bybit and competitor pages rather than copying the 2026-07-31 snapshot.
- Kept implementation and test execution outside this cycle.

### 2026-08-02 — Tasks 1–20 complete

- Reconciled the moving worktree with dossier 17 and found that the group `/start` source blocker is fixed while the new test harness now exists but remains unproved.
- Kept Gate 1 at NO-GO because composite ownership, final-schema authority, contracted PostgreSQL 18 proof, and startup/readiness are unresolved.
- Specified the same-owner composite key, catalog-equivalence, audit-scope, atomic-evidence, and two-lane database proof contracts.
- Found a new manual preflight gap for a non-null order owner with a null strategy and a conflicting Gate 1 verdict in plan 005.

### 2026-08-02 — Tasks 21–40 complete

- Defined fail-closed configuration/startup, session/replay/CSRF, verified notification eligibility, redacted logging, durable delivery, retention, and incident requirements.
- Found that runner ticks can overlap and that swallowed Telegram failures make the digest `sent` count unreliable.
- Refreshed Bybit Demo domains, seven-day retention, transport limits, regional hosts, signing, permissions, rate limits, idempotency, private streams, and recovery from official documentation.
- Chose user-created Demo keys for the future Demo MVP; automated Demo account/key creation would unnecessarily introduce a production master key and transfer-class permissions.

### 2026-08-02 — Tasks 41–50 complete

- Rechecked 3Commas, Bitsgap, Coinrule, Cryptohopper, and Pionex using current official product/pricing/security pages.
- Applied the competitor-research framework to distinguish automation SaaS from a custodial exchange, separate pricing from positioning, and turn the comparison into product/content recommendations.
- Confirmed that paper trading and large Demo quotas are commodity features; the defensible wedge is a narrow spot-only Safety Ledger with visible assumptions, rejections, and audit evidence.
- Produced dependency-ordered backlog R0–R7 and kept all private Bybit implementation behind an independent Gate 1 rerun.

### 2026-08-02 — documentation verification

- Confirmed that the backlog contains exactly fifty tasks and every task is marked complete.
- Confirmed that this cycle added only ExecPlan 007 and dossier 18.
- `git diff --check` passed for the full current worktree.
- No tests, build, typecheck, lint, database, exchange, or deployment command was run.
