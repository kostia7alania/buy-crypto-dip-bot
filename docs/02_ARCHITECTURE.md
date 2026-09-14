# Architecture

Reviewed: 2026-09-14. [Current source and verification](23_PROJECT_STATUS.md)
are authoritative for readiness; the target is not a deployment claim.

## Stable boundaries

Nuxt 4 owns web rendering and a small BFF. Hono owns application routes in
vertical slices. The Telegram bot resolves an actor before owned operations.
Strategy and risk live in their packages, shared defaults in `packages/config`,
contracts in `packages/shared-types`, and PostgreSQL/Drizzle in `packages/db`.
Web code follows FSD-lite. Exchange integration uses ports/adapters and only
public Bybit market observations are implemented.

## Integrated local runtime

Browser -> sealed Nuxt session -> BFF opaque API token -> resolved user ->
personal tenant transaction -> restricted dipbot_app role -> PostgreSQL.
Owned routes retain owner predicates and constraints in addition to forced RLS.
Auth/bootstrap, scheduler discovery and delivery still have trusted privileged
operations; the full bypass inventory is in the research.

Recovery through 0014 and cost-first through 0002 retain separate immutable
journals. The guarded runner recognizes either history and converges it to
gate1_tenants_v1. Only the common forward directory receives later migrations.
There is no journal relabelling or guessed quarantine owner.

The page owns one private dashboard snapshot; its hook owns polling,
cancellation and cache invalidation. Widgets receive data and emit refresh
requests. Public routes are prerendered; dashboard is CSR/noindex/no-store.

The active Node runner retains single-flight, pending uniqueness, typed outbox
and digest. Main ledger/outbox history is preserved without activating a second
scheduler/dispatcher. Release uses digest-pinned images, a one-shot migration,
backup and dependency-aware readiness. No old-image rollback follows attempted
DDL automatically.

See [ADR 009](../adr/ADR_009_TENANT_HISTORY_CONVERGENCE.md) and
[research](24_TENANT_INTEGRATION_RESEARCH.md) for design, proof and limitations.

## Approved target

```text
Public visitor -> prerendered Nuxt assets on Cloudflare
Browser -> Nuxt BFF -> Hono Worker -> Supabase PostgreSQL with scoped access/RLS
Telegram -> verified webhook -> bounded domain work
Cron -> Queue -> idempotent DRY_RUN jobs -> PostgreSQL/outbox
```

Supabase identity, Telegram OIDC, Worker entry points, webhook, Cron, Queues
and provider cutover are pending. Their detailed original decision is in
[the cost-first ADR](../adr/ADR_008_COST_FIRST_HYBRID_EDGE.md). A separately
isolated stable-egress live executor is only a future proposal and cannot
bypass the Gate 1/Demo/live approval sequence.

Exactly one scheduler and one Telegram delivery mode must own production
work after cutover. Public static assets do not eliminate the dynamic BFF,
authentication, database or background-work costs.
