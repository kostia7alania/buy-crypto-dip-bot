# ExecPlan 006 — Gate 1 Proof Night Research

## Goal

Independently verify the uncommitted Gate 1 multi-user `DRY_RUN` implementation, turn every unresolved assumption into an executable proof, and decide whether work may safely advance toward Bybit Demo without implementing private exchange access.

This is the second overnight research cycle, started on 2026-08-02. It continues ExecPlans 004 and 005 instead of repeating their market and architecture research.

## Safety and scope

- `DRY_RUN` remains the only supported execution mode.
- Do not create, request, store, or use exchange credentials.
- Do not implement private Bybit calls or enable live trading.
- Treat the existing uncommitted Gate 1 code and UI as work owned by another pass; inspect it, but do not edit it.
- Add research artifacts only, with primary sources for current external claims.
- Gate 1 is not passed unless PostgreSQL-backed A-versus-B tests and the migration rehearsal actually run.

## Twenty-task backlog

- [x] 1. Capture the current git/runtime/database baseline and separate pre-existing work.
- [x] 2. Map current implementation evidence to tickets I01–I10 and identify unproven claims.
- [x] 3. Audit ownership columns, keys, indexes, and cross-table tenant invariants.
- [x] 4. Audit expand/backfill/verify/contract migrations for correctness and reversibility.
- [x] 5. Determine whether a production-like PostgreSQL rehearsal can run tonight without unsafe environment changes.
- [x] 6. Audit Hono service authentication, principal resolution, deny-by-default routing, and IDOR behavior.
- [x] 7. Audit Nuxt BFF session propagation, cookie contract, upstream error handling, and stale-session behavior.
- [x] 8. Audit Telegram Login freshness, replay resistance, session issuance, rotation, revocation, and cleanup.
- [x] 9. Audit logs and error paths for session-token, identity, and financial-data disclosure.
- [x] 10. Audit CSRF, Origin/Referer validation, browser-to-BFF trust, and unsafe state-changing request shapes.
- [x] 11. Audit tenant scoping for strategies, orders, audit, PnL, and performance aggregates.
- [x] 12. Audit Telegram command, wizard, callback, and group-chat actor ownership.
- [x] 13. Audit runner ownership propagation, caps, per-user digests, and notification routing.
- [x] 14. Specify an executable PostgreSQL A-versus-B integration matrix with fixtures and assertions.
- [x] 15. Specify concurrency, replay, expiry-boundary, outage, and recovery tests beyond happy-path isolation.
- [x] 16. Evaluate composite ownership constraints and PostgreSQL RLS as defense in depth without false confidence.
- [x] 17. Define session/audit retention, backup, restore, migration rollback, and incident evidence requirements.
- [x] 18. Refresh Bybit Demo environment, regional-domain, retention, and transport constraints from official docs.
- [x] 19. Produce a strict Gate 1 go/no-go decision with blocking, high, and later findings.
- [x] 20. Convert findings into a dependency-ordered proof-and-hardening backlog with acceptance criteria.

## Deliverables

- This completed 20-task plan with evidence and verification notes.
- `docs/17_GATE1_PROOF_AND_DEMO_READINESS.md`, containing the audit, test design, go/no-go decision, and next backlog.
- No modification to the implementation under review.

## Progress

### 2026-08-02 — cycle opened

- Current branch is `main` at `cedc6df`.
- Found an extensive uncommitted Gate 1 implementation recorded in ExecPlan 005, plus the earlier Safety Ledger UI work.
- Docker was initially stopped; it was started only for the isolated PostgreSQL proof described below.
- Node.js `v26.5.0` and pnpm `11.0.0` match repository requirements.

### 2026-08-02 — Tasks 1–5 complete

- Preserved all pre-existing Gate 1 and UI changes and added research files only.
- Started Docker Desktop and used a dedicated PostgreSQL 18.4 container with tmpfs storage and a loopback-only port; no existing database or volume was used.
- Applied the automatic migrations and rehearsed expand, backfill, verify, contract, unresolved-owner refusal, explicit resolution, and idempotent rerun.
- Confirmed owner NOT NULL and per-user symbol uniqueness, but proved the final contract accepts an A-owned order referencing B's strategy.
- Confirmed the final Drizzle source/schema snapshot does not represent the manual contract.

### 2026-08-02 — Tasks 6–13 complete

- Ran real Hono A/B calls with two synthetic sessions: coherent reads stayed isolated and A's PATCH of B's strategy returned 404.
- Confirmed production API service authentication fails open when `API_KEY` is missing.
- Replayed one correctly signed Telegram Login payload and confirmed it minted two separate sessions.
- Audited cookie, BFF, logout, stale-session, CSRF, log-redaction, session-retention, route, aggregate, bot, runner, callback, audit, and notification paths.
- Found the group-chat `/start` notification-binding gap and the non-transactional order/audit transitions.

### 2026-08-02 — Tasks 14–18 complete

- Added a deterministic two-tenant fixture design and forty-case integration/failure matrix to the dossier.
- Selected composite ownership constraints as the immediate database control and documented why naive RLS would be bypassed by the current PostgreSQL superuser role.
- Defined session, audit, backup, restore, migration, and incident-evidence requirements.
- Refreshed current official Telegram, OWASP, PostgreSQL, and Bybit Demo/region constraints.

### 2026-08-02 — Tasks 19–20 complete

- Issued a strict Gate 1 NO-GO with five blockers, twelve high-priority findings, and four later Demo-readiness findings.
- Produced twenty dependency-ordered proof/hardening tickets P01–P20.
- Kept I11 and every private Bybit credential/order task blocked pending an independent P20 Gate 1 rerun.

### 2026-08-02 — verification

- `git diff --check` passed.
- Automatic and manual migrations were exercised against disposable PostgreSQL 18.4.
- Two-tenant Hono reads and foreign-id mutation behavior were exercised with synthetic sessions.
- Negative probes confirmed the cross-owner DB hole, Telegram Login replay, and production missing-`API_KEY` fail-open behavior.
- A final `pnpm check` was attempted but the shared worktree changed concurrently: an incomplete uncommitted PGlite/test-utils layer rewired the lockfile and node_modules while omitting its exported `seed-tenants` file. Nuxt/drizzle resolution and test-utils typecheck therefore failed before a trustworthy full-suite result. This pass did not edit or complete that separate implementation.
