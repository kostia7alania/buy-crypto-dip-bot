# Database strategy

Reviewed: 2026-09-12.

PostgreSQL is used in production and local development through Docker
Compose. SQLite was removed; see ADR 002. Drizzle schema, SQL, journal and
snapshots must agree for an identified revision.

## Recovery catalog

The local line through `0014_bouncy_zuras` contains users, API sessions,
Telegram replay/abuse records, owned strategies/orders, versioned audit and a
typed notification outbox. Same-owner foreign keys and one-pending-order
uniqueness are database constraints. Audit updates/deletions are blocked,
including legacy V0. Pending order `execute_at` survives process restarts.

Fast tests use PGlite. `test:postgres18` separately proves clean install and
legacy upgrade against PostgreSQL 18. Neither lane proves every deployed
request or user flow.

## Main catalog and integration boundary

Remote `becc46b` instead contains `0002_cost_first_tenancy.sql`, personal
tenants/memberships, identities, destinations, ledger/outbox tables, a
restricted runtime role and forced RLS. The local RLS deferral ADR describes
the older local connection model, not the remote implementation.

Before integration, record each starting catalog, preserve ambiguous owner
and audit evidence, and define forward-only upgrade paths that converge on
one schema. Do not replay both versions of `0002`, silently choose a legacy
owner, edit an applied migration, or claim RLS proof from the other source
line. Backup/restore must preserve all owners and all audit versions.
