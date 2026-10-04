# Migration authority

Run `pnpm --filter @buy-crypto-dip-bot/db db:migrate` with an explicit
`POSTGRES_CONNECTION_STRING`. The API and the deployment migration service use
the same guarded runner. Do not run `drizzle-kit migrate` or `push` directly.

- Root SQL and `meta/` freeze the recovery history through 0014.
- `histories/cost-first/` freezes main's original history through 0002.
- `convergence/` is the immutable bridge to `gate1_tenants_v1`.
- `forward/` is the only authority for subsequent SQL migrations. Its separate
  journal records SQL actually executed after convergence on either lineage.

Create a draft with `pnpm --filter @buy-crypto-dip-bot/db db:generate --name=description`.
This deliberately uses Drizzle's custom SQL mode. Automatic schema differencing
against the old snapshots cannot describe the hand-written policies, triggers
and dual source histories. Write and review the forward SQL, add statement
breakpoints between top-level statements, and update `src/schema.ts` as needed.
An empty migration is rejected at execution. Never modify an applied file or
relabel old journal rows. Exercise both upgrade histories and a clean install
with the PostgreSQL contract suite before release.

The startup guard validates migration history, bridge identity and critical RLS
flags/triggers. It is not a general-purpose catalog drift detector. The real PG
suite compares columns, constraints, indexes, policies and triggers across the
three supported paths; production catalog inspection remains a release step.

Forward `0001_reservation_economics` refuses nonfinite order/reservation amounts
and existing mismatched holds without rewriting rows. Correct such historical
data only through a separately authorized remediation; the failed migration
rolls back its catalog and journal changes. Reserved order identity, economics
and decision evidence stay immutable after settlement too. Status transitions,
execution scheduling and Telegram delivery metadata retain their existing
contracts. Startup also checks the reservation RLS, constraints and triggers.

Forward `0002_runtime_credentials` creates a non-owner NOLOGIN service role
with explicit trusted-service grants and role-specific policies. The migration
CLI provisions its separate SCRAM password after convergence; production needs
`POSTGRES_RUNTIME_PASSWORD` before any DDL. Non-local API/bot startup verifies
the exact full histories and runtime credential read-only, without migration.
Owned operations still use `SET LOCAL ROLE dipbot_app`. Cross-user auth and
delivery access is trusted-service authority, not arbitrary-SQL tenant isolation.
See the [production credential rollout](../../../docs/13_VPS_DEPLOYMENT_RUNBOOK.md#separate-database-credentials).
