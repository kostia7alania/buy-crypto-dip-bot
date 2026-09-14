# ExecPlan 011: Converge the two PostgreSQL histories

Started: 2026-09-14. Status: implementation and verification complete; source checkpoint pending.

## Objective

Integrate the cost-first foundation at `becc46b` with recovery `d183fa2`,
preserving the stronger session, symbol, audit and notification controls.
Keep the recovery branch intact. Research and implementation belong together:
each architecture choice must have a source, a concrete implementation and a
test of the security or data-preservation property.

## Sequence

1. Verify both immutable migration histories, installed Drizzle behavior and
   PostgreSQL 18 locking/RLS/transaction rules. Record the research in docs.
2. Implement strict migration-history recognition and serialize migration
   attempts. Refuse unknown, mixed, edited or unjournalled databases before
   changing application tables. Never mark a migration applied without running it.
3. Build explicit forward convergence paths. Keep all original migration
   hashes, IDs, owners and audit payloads. Do not infer owners of quarantine
   records or silently replay old outbox work. An unresolved owner is a failed
   preflight requiring an explicit decision, not a guessed migration.
4. Preserve main's tenant/RLS, dashboard refresh and release protections while
   retaining recovery's sessions, replay/CSRF, typed outbox and immutable audit.
   Do not restore the weaker header-only user-auth boundary.
5. Prove clean install, each supported upgrade, failed preflight atomicity,
   repeated/concurrent migrations and restricted-role A/B behavior on real
   PostgreSQL 18. Run relevant regression suites, typecheck and build.
6. Update project status, backlog and reproducible evidence; save local commits.

## Boundaries

No new dependencies, provider login, deployment, push, private exchange access
or live mode. Existing production data has not been inspected. A tested source
upgrade path does not authorize running it on production or claim Gate 1 GO.
The Cloudflare/Supabase cutover is a later platform change, not part of this
database integration. Transaction-local tenant context must use one connection;
application authorization and ownership foreign keys remain necessary with RLS.

## Verification record

The two source histories converge through guarded forward SQL. Clean install,
recovery upgrade, main upgrade, preserved audit/numeric fields, refused
quarantine/mixed/edited histories, pool reuse and forward-migration rollback
passed on PostgreSQL 18 (16 cases in the explicit lane). Source check/build,
345 workspace tests, 4 release control-flow fixtures and browser account/cache
checks passed. The first-request cancellation race discovered in the browser
was corrected and retested. Original migrations and all 123 backlog entries
are retained. See the September 14 appendix in docs/20 for commands and limits.

Source choices: keep recovery's stronger session/replay/CSRF, reviewed symbols,
versioned immutable audit, typed outbox and digest; carry main's personal tenant
foundation, private snapshot/prerender and immutable release source forward.
Generic ledger/evaluation columns and historical rows are preserved without
activating a competing dispatcher. Platform and reservation work remain scoped
separately in N10/N11. The separate privileged credential is still a pre-GO
requirement, not claimed complete by transaction-local role switching.
