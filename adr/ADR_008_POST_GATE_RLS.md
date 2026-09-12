# ADR 008: Defer PostgreSQL RLS Until Runtime Roles Are Separated

> Baseline notice, 2026-09-12: this deferral applies to the local Gate 1 line using the older runtime role. Remote main `becc46b` already has a restricted role and forced RLS under [its separate cost-first ADR](ADR_008_COST_FIRST_HYBRID_EDGE.md). Reconcile the role, migration and evidence models before making a combined RLS claim. See [project status](../docs/23_PROJECT_STATUS.md).

Status: accepted — deferred until after Gate 1 (2026-08-02).

## Decision

Do not enable row-level security in the current deployment. Tenant predicates,
same-owner foreign keys, owner-required rows, versioned audit scope, and A/B
tests remain the primary controls.

The current application connects as the `postgres` superuser. PostgreSQL
superusers, `BYPASSRLS` roles, and normally table owners can bypass policies;
adding policies under that connection would create a security claim without a
working enforcement boundary.

## Required design before this decision can be reopened

- The runtime role is `NOSUPERUSER`, `NOBYPASSRLS`, `NOINHERIT`, is not a table
  owner, and has only the DML privileges used by the application.
- A separate non-runtime migrator owns schema objects and performs DDL. Its
  credential is unavailable to API, bot, and runner processes.
- Tenant identity is established with transaction-local state only after an
  authenticated principal is resolved. Missing tenant state is default-deny.
- Pool reuse tests prove tenant A's state is absent from tenant B's transaction,
  including error, rollback, cancellation, and connection-reuse paths.
- Tenant policies cover strategies, orders, sessions, notification outbox, and
  USER-scoped audit events. SYSTEM audit access uses a separate operator path.
- `FORCE ROW LEVEL SECURITY` is evaluated for every tenant table; table-owner
  and maintenance behavior is tested rather than assumed.
- A dedicated backup role and procedure prove that encrypted backups contain
  every tenant and SYSTEM/V0/V1 audit evidence. Restore counts and checksums are
  compared outside the runtime role.
- Direct SQL A/B, application A/B, migration, backup, restore, and incident
  drills pass on PostgreSQL 18 before any RLS protection is claimed.

## Consequences

RLS is defense in depth, not a replacement for application authorization or
relational ownership constraints. No current UI, API response, documentation,
or deployment evidence may claim RLS isolation. A future implementation needs
a new ADR with exact roles, policies, pool protocol, bypass inventory, and
PostgreSQL 18 proof.
