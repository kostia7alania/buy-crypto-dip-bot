# ExecPlan 004: Cost-First Multi-Tenant Edge SaaS

> Source snapshot: `origin/main` at `becc46b`, authored 2026-08-20, restored 2026-09-12. "Current" and "COMPLETE" below refer to that remote source, not this recovery checkout or verified production. See [current status](../docs/23_PROJECT_STATUS.md) before implementation. Provider prices and capabilities below retain their original check date.

- Status: active
- Created: 2026-08-20
- Base: `main` at `cedc6df`
- Decision: [`ADR_008_COST_FIRST_HYBRID_EDGE.md`](../adr/ADR_008_COST_FIRST_HYBRID_EDGE.md)
- Strategy: [`15_COST_FIRST_SAAS_STRATEGY.md`](../docs/15_COST_FIRST_SAAS_STRATEGY.md)

## Objective

Move the working single-tenant dry-run MVP to a tenant-safe, cost-first SaaS:
public Nuxt pages prerendered, private dashboard CSR behind a dynamic BFF,
Supabase PostgreSQL/Auth/RLS, and Cloudflare webhook/Cron/Queue runtimes.
Live exchange execution remains disabled and, if approved later, belongs to a
separate stable-egress executor.

This plan deliberately contains no coverage, TDD, fixture, or test-matrix
workstream. Existing project checks remain a release gate because auth,
tenancy, idempotency, and deployment are expensive failure domains.

## Delivery tasks

The status labels describe the implementation on this branch. Edge-provider
items remain pending until code, credentials, migrations, cutover and live
verification all exist; a design document alone never changes a status.

1. **[COMPLETE] Keep dry-run safety fail-closed.** Live execution is blocked, RiskGuard defaults to no live trading, and the Bybit adapter reads public market data only. Evidence: `packages/config/src/index.ts`, `packages/risk-engine/src/index.ts`, `packages/exchange-bybit/src/index.ts`.
2. **[COMPLETE] Deliver the PostgreSQL dry-run loop.** Strategies, RiskGuard decisions, pending simulated orders, audit history, PnL, performance, and backtest run on PostgreSQL. Evidence: `packages/db/src/schema.ts`, `apps/api/src/modules/runner/runner.service.ts`, and the orders/audit/PnL/performance/backtest slices.
3. **[COMPLETE] Deliver the first user-facing MVP.** Telegram onboarding, verified Telegram web login, dashboard, SEO pages, and the Nuxt BFF exist. Evidence: `apps/bot/src/onboarding.ts`, `apps/api/src/modules/auth`, `apps/web/app/pages`, and `apps/web/server/api`.
4. **[COMPLETE] Record the cost-first architecture.** This ExecPlan, ADR 008, the SaaS strategy, `PLANS.md`, `docs/02_ARCHITECTURE.md`, and ADR 003 distinguish the released VPS slice from the target edge runtime.
5. **[COMPLETE] Remove claims for unshipped live trading or managed SaaS.** Public pages describe public market data and simulated orders, explicitly reject private exchange keys, and keep the future managed/edge direction separate from shipped behavior.
6. **[PENDING] Add the Supabase runtime and auth identity link.** Add `packages/db/src/supabase.ts` and migration `0002_auth_identity.sql`; update DB exports, environment examples, and package metadata so an app user maps uniquely to `auth.uid()`.
7. **[COMPLETE] Make ownership mandatory.** Migration `0002_cost_first_tenancy.sql` requires `tenant_id` on strategies, orders, and audit events, with foreign keys, indexes, composite order ownership, and `(tenant_id, symbol)` uniqueness.
8. **[COMPLETE] Resolve legacy global rows before constraints.** The same transactional migration maps provable ownership and quarantines ambiguous rows before enabling constraints; `claimQuarantinedLegacy` is an explicit administrative operation.
9. **[IN PROGRESS] Enable PostgreSQL RLS.** VPS PostgreSQL now uses a restricted `dipbot_app` role, transaction-local tenant context, policies, and forced RLS. Supabase `auth.uid()` policies remain part of tasks 6, 10, and 12.
10. **[PENDING] Replace bootstrap login with Supabase Telegram Custom OIDC.** Use Telegram OIDC authorization code plus PKCE and `email_optional`, complete the callback in Nuxt, and link the Telegram subject to the existing app user without creating duplicate tenants.
11. **[IN PROGRESS] Make the BFF fail closed.** The current BFF has a shared session guard, versioned secure cookies, same-site mutation protection, private no-store responses, and consistent `401` behavior. Supabase Bearer propagation awaits tasks 10 and 12.
12. **[PENDING] Verify Supabase JWTs in Hono.** Add auth middleware that derives tenant context from a verified token, rejects caller-supplied ownership, and makes the context available to all domain routes.
13. **[COMPLETE] Scope strategies and default provisioning by tenant.** Strategy reads, writes and uniqueness are tenant-bound; global startup seeding has been removed and onboarding provisions personal strategies.
14. **[COMPLETE] Scope orders and audit history by tenant.** Routes and runner writes carry tenant ownership; cancel and buy-now transitions require the same tenant, `DRY_RUN`, and `PENDING` state.
15. **[COMPLETE] Scope PnL and performance and add the dashboard snapshot.** Aggregates take one tenant and `/dashboard/snapshot` returns the private strategies, orders, audit, PnL, performance and risk view in one request.
16. **[COMPLETE] Scope every bot path.** Private-chat Telegram identity resolves to the same tenant for onboarding, commands, callbacks, destinations and pending-order transitions; group fallbacks are rejected.
17. **[PENDING] Make the Hono API edge-compatible.** Split Node startup from the fetch app, add a Cloudflare Worker entry and Wrangler configuration, and use an edge-compatible Supabase/PostgreSQL access path.
18. **[PENDING] Replace Telegram long polling with a webhook.** Add a bot Worker, verify Telegram's secret header, deduplicate by `update_id`, acknowledge quickly, and ensure only one delivery mode is enabled in production.
19. **[PENDING] Replace runner and digest intervals with Cron producers.** Add bounded scheduled handlers and remove production reliance on `setInterval`; aggregate work by tenant and symbol and record each scheduled run.
20. **[IN PROGRESS] Add Queue consumption and durable idempotency.** PostgreSQL now has event-ledger, outbox and evaluation keys; the VPS runner claims one strategy/minute and uses conditional order transitions. Cloudflare Queue consumption, retries and dead-letter delivery remain pending.
21. **[COMPLETE] Implement hybrid Nuxt and one dashboard refresh.** All public SEO routes prerender, `/dashboard/**` is CSR/noindex, private APIs stay dynamic, and one visibility-aware snapshot replaces six polling loops.
22. **[IN PROGRESS] Cut deployment over to Cloudflare and Supabase.** The VPS release path now verifies, builds an immutable image, backs up PostgreSQL, gates startup on migrations and health, and can roll code back. Provider cutover and production edge verification remain pending.

## Dependency order

- Tasks 4-6 can proceed independently after the dry-run baseline.
- Ownership work is ordered 7, then 8, then 9 so legacy rows cannot violate
  the final constraints.
- Auth task 10 precedes BFF/API enforcement in 11-12; tenant domain tasks
  13-16 follow the verified identity context and can then proceed in parallel.
- Worker compatibility in 17 precedes webhook and Cron work in 18-19.
- Queue/idempotency task 20 consumes the event contracts from 18-19.
- Hybrid web task 21 can proceed beside the runtime migration after the
  authenticated snapshot contract is stable.
- Deployment task 22 is last.

## Release gates

- Existing `pnpm check` and `pnpm build` pass before release. No new coverage
  target or test-only workstream is introduced by this plan.
- User A cannot read or mutate User B through BFF, Hono, Telegram, or direct
  Supabase access.
- Replaying one webhook, Cron event, or Queue message cannot create a second
  order, audit fact, or notification.
- Public routes are served from prerendered output; dashboard routes are CSR
  and noindex; private endpoints return `401` without a valid session.
- Production has exactly one Telegram delivery mode and one scheduler.
- No private exchange credentials exist in browser, BFF, API Worker, bot
  Worker, Queue, or general SaaS database. Live execution remains unavailable.

## Rollback and cutover

The current VPS deployment remains intact until Cloudflare/Supabase production
verification is complete. Cutover must disable old producers before enabling
new ones, or use a shared durable lease that proves only one producer is
active. Rollback restores web/API/bot traffic together and does not roll back
ownership or RLS migrations that have already accepted tenant data.
