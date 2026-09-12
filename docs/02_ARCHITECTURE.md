# Architecture

Reviewed: 2026-09-12. [Current source and verification](23_PROJECT_STATUS.md)
are authoritative for readiness; the target is not a deployment claim.

## Stable boundaries

Nuxt 4 owns web rendering and a small BFF. Hono owns application routes in
vertical slices. The Telegram bot resolves an actor before owned operations.
Strategy and risk live in their packages, shared defaults in `packages/config`,
contracts in `packages/shared-types`, and PostgreSQL/Drizzle in `packages/db`.
Web code follows FSD-lite. Exchange integration uses ports/adapters and only
public Bybit market observations are implemented.

## Two source lines that must be reconciled

| Concern | Local Gate 1 recovery from `cedc6df` | Fetched main `becc46b` |
| --- | --- | --- |
| Ownership | Required user owners, same-owner order FK, tenant/system audit scope | Personal tenants, memberships, auth identities, required tenant ownership |
| PostgreSQL | Journal through `0014_bouncy_zuras`; append-only audit and typed notification outbox | `0002_cost_first_tenancy`; quarantine, restricted runtime role and forced RLS |
| Login | HMAC Login Widget, hashed opaque sessions, replay/abuse controls and revocation | HMAC bootstrap identity with tenant context; Supabase JWT/OIDC pending |
| Web | Safety Ledger, separate widget polling, recovered account-change cleanup | Public prerender, private CSR/noindex, one visibility-aware snapshot |
| Background work | Node intervals, durable notification/digest and bot heartbeat | Node minute-slot evaluation ledger and outbox; long polling, digest removed |
| Release | Local Gate 1 CI/catalog proof and readiness additions | Immutable-image VPS release and backup/health gates |

The `0002` names, snapshots and journals describe different changes. Do not
concatenate them or replace a catalog already used by a deployment. Preserve
evidence, identify the installed catalog, and design forward migrations for
each supported starting point. Keep the local session, audit and notification
controls when porting to the newer tenant model.

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
