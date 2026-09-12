# Cost-First SaaS Strategy

> Source snapshot: `origin/main` at `becc46b`, authored 2026-08-20, restored 2026-09-12. "Current" and "COMPLETE" below refer to that remote source, not this recovery checkout or verified production. See [current status](23_PROJECT_STATUS.md) before implementation. Provider prices and capabilities below retain their original check date.

- Status: approved direction; tenant-safe VPS slice implemented, edge cutover pending
- Last reviewed: 2026-08-20
- Decision record: [`ADR_008_COST_FIRST_HYBRID_EDGE.md`](../adr/ADR_008_COST_FIRST_HYBRID_EDGE.md)
- Delivery plan: [`004-cost-first-multi-tenant-edge.md`](../plans/004-cost-first-multi-tenant-edge.md)

## Executive decision

Build one modern TypeScript SaaS with clear runtime boundaries:

- Nuxt 4 prerenders public SEO pages.
- The authenticated dashboard is CSR and talks only to a dynamic Nuxt BFF.
- Hono runs the tenant-aware application API on Cloudflare Workers.
- Supabase provides PostgreSQL and Auth; PostgreSQL RLS is the final data
  boundary.
- Telegram uses OIDC for login and a verified webhook for bot updates.
- Cloudflare Cron produces scheduled work and Queues deliver it with durable
  idempotency.
- A separate stable-egress Node executor may be introduced for live spot
  orders later. It is not part of the current product or the first edge
  migration.

The budget hypothesis is domain-only infrastructure while the MVP is small
enough for free allowances. That is a target, not a guarantee: a public SaaS
with paying users should upgrade when backups, availability, support, or
usage make a paid plan the responsible choice.

## Product truth today

| Area | Current repository | Target after this plan |
| --- | --- | --- |
| Trading | Dry-run orders only; public Bybit market data; live execution hard-disabled | Still dry-run at edge; optional isolated live executor only after a separate decision |
| Tenancy | Personal tenants, scoped BFF/API/bot/runner paths, forced PostgreSQL RLS | Supabase identity plus `auth.uid()` RLS |
| Public web | Static, prerendered acquisition routes in the Nuxt build | Same assets served at the Cloudflare edge |
| Dashboard | CSR-only, noindex, one tenant snapshot refresh | Same contract behind Supabase session/JWT |
| API | Hono Node server with interval runner | Hono Worker with JWT tenant context |
| Bot | grammY long polling | Telegram webhook Worker with secret verification |
| Scheduling | Idempotent minute-slot `setInterval` runner with a process kill switch | Cloudflare Cron producer plus Queue consumer |
| Deployment | Immutable-image VPS workflow with backup, migration and health gates | Cloudflare Workers plus Supabase migrations; VPS scheduler disabled after cutover |

Until the target column is implemented and released, marketing and docs must
describe the product as a self-hosted dry-run simulator. A source file, plan,
or database column named `LIVE` is not evidence that live trading exists.

## Why this stack

### Nuxt instead of adding Astro now

Astro is excellent for content-heavy static sites, but adding it here would
create a second router, component system, SEO pipeline, and deployment. Nuxt
already supports build-time prerendering for public routes, client-only
rendering for private routes, and dynamic Nitro endpoints for the BFF. The
single-framework hybrid is cheaper to operate and easier to present as one
coherent SaaS codebase.

Revisit Astro only if public content becomes a separate publishing product
with independent ownership and release cadence.

### Prerender public pages

Public landing pages change on deploy, need indexable HTML, and do not contain
user data. Build them once and serve them as static assets. This gives search
engines complete HTML without paying request-time rendering cost for every
visitor or crawler.

The public route set is the `seoRoutes` contract in
`packages/seo-keywords/src/index.ts`, plus `robots.txt` and `sitemap.xml`.
Adding a public route requires adding it to that contract and the prerender
rules in the same change.

### CSR for the authenticated dashboard

The dashboard has no SEO value and all meaningful content is tenant data.
Modern devices can render this UI in the browser without a request-time Vue
render. More importantly, CSR makes the privacy boundary explicit: the shell
contains no account data, and the browser asks the BFF only after a session is
available.

SSR is not only for old devices. It can improve first paint and no-JavaScript
resilience. We are choosing CSR because those benefits do not currently
outweigh private-payload risk and server compute. A measured accessibility or
performance problem can reopen the decision for a specific route.

### Keep the Nuxt BFF

Prerender does not mean the whole deployment is static. The BFF is still
needed to:

- own secure, HttpOnly session cookies;
- complete OIDC callbacks and enforce CSRF/state checks;
- keep API and service credentials out of browser bundles;
- normalize API failures into a small browser-facing contract;
- apply tenant-safe cache headers and rate limits;
- aggregate the dashboard into one snapshot.

The BFF is not the trading core and does not bypass API authorization. It
fails closed with `401` when a session is absent or invalid.

## Authentication and tenancy

### Login flow

Telegram now exposes a standard OIDC authorization-code flow with PKCE. The
target flow is:

- Register Telegram as a Supabase Custom OIDC provider.
- Enable `email_optional`, because Telegram identity does not require an
  email claim.
- Start authorization from Nuxt with state, nonce, and PKCE.
- Complete the callback server-side and store the Supabase session in secure,
  HttpOnly, SameSite cookies.
- Link the Supabase `auth.uid()` to exactly one application user and Telegram
  subject.
- Optionally link a recovery provider later. Linking must preserve the same
  app user and tenant rather than creating parallel accounts.

The current Telegram Login Widget HMAC flow now creates a personal tenant and
feeds the restricted PostgreSQL RLS context. It is a safe VPS bootstrap, but
it is not the target Supabase OIDC/JWT contract.

### Request flow

```text
Browser
  -> Nuxt BFF (session required)
      -> Hono API (Supabase Bearer token)
          -> tenant-scoped domain service
              -> PostgreSQL with RLS
```

Each boundary independently derives the user from a verified token. The
browser never chooses `user_id`. The API never trusts a tenant id from query
parameters or request JSON. Bot commands resolve the Telegram subject to the
same app user before any read or write.

### Data ownership

`tenant_id` is required on strategies, orders, audit facts, ledger events and
outbox rows. Migration `0002_cost_first_tenancy.sql` first assigns provable
personal ownership or quarantines ambiguous legacy data, then adds foreign
keys, uniqueness rules and forced RLS policies in the same transaction.

The Supabase service-role key stays server-only and is not a shortcut around
tenant checks. Administrative jobs using elevated access must carry an
explicit owner and write an audit event.

## Event-driven runtime

### Telegram

Long polling consumes an always-on process even when nobody messages the bot.
The target webhook runs only for incoming updates. It verifies Telegram's
secret header, validates update shape, resolves the tenant, and acknowledges
quickly. Slow work is enqueued.

Webhook retries are possible. Telegram `update_id` is therefore an
idempotency input, not just metadata.

### Strategy evaluation and pending orders

In-process timers disappear from production. A UTC Cron trigger starts a
bounded scan, records a run id, and enqueues tenant/symbol work. Queue
consumers evaluate a bounded batch and use conditional database transitions.

The queue carries work, not truth. PostgreSQL remains authoritative for order
state, execution time, deduplication, and audit history. A retried message
must not create a second order or notification.

Do not enqueue every no-signal ticker observation. Queue operations are a
budgeted resource; enqueue actionable or resumable work and aggregate market
data by symbol where possible.

### Dashboard refresh

The former six independent polling loops generated about 48 BFF requests per
minute for one visible dashboard tab. They are now replaced by one versioned
`/dashboard/snapshot` contract that:

- refresh every 30-60 seconds after the prior request completes;
- stop while the tab is hidden;
- refresh stale data when the tab becomes visible;
- refresh immediately after a successful mutation;
- cancel obsolete requests and never overlap refreshes;
- return `401` without any dashboard data when auth fails;
- use `private, no-store` and `Vary: Cookie` headers.

This reduces the baseline to one or two BFF requests per minute per visible
tab and removes all dashboard work for hidden tabs.

## Free-tier capacity and what consumes it

Provider allowances below were checked on 2026-08-20 and can change.

- Cloudflare Workers Free lists 100,000 dynamic requests per day, 10 ms CPU
  per invocation, and five Cron triggers per account. Static asset requests
  are listed as free and unlimited.
- Cloudflare Queues Free lists 10,000 operations per day. A normal message
  delivery is commonly three operations: write, read, and delete. Retries add
  reads.
- Supabase Free lists 50,000 monthly active users, a 500 MB database, 5 GB
  egress, and two active projects. Free projects can pause after one week of
  inactivity.

The public visitor count is therefore not directly capped by the Worker
request allowance when pages and assets are genuinely static. Authenticated
usage is different: login, BFF, API, bot webhooks, Cron, Queue, database reads,
and egress all consume finite resources.

An illustrative dashboard load of 100 users viewing for 30 minutes per day at
two snapshot refreshes per minute creates at least 6,000 dynamic BFF requests
per day, before downstream API work. Measure real invocations and database
egress rather than converting a marketing free-tier number into a promised
visitor count.

Bots and crawlers are not free by definition:

- A crawler hitting a prerendered public page is mostly a CDN/static-asset
  concern and should not query PostgreSQL.
- A crawler hitting dynamic endpoints consumes Worker capacity; private
  routes must require auth, return noindex headers, and be rate-limited.
- A Telegram webhook consumes resources only when an update arrives, but
  scheduled strategy evaluation consumes resources even with zero visitors.
- A long-polling bot and Node intervals consume an always-on host while idle;
  this is why they are removed from the cost-first target.

### Upgrade signals

Move to paid infrastructure before an emergency when any of these becomes
true:

- customers pay and the product needs non-pausing service, backups, support,
  or an availability commitment;
- database size or egress approaches its allowance;
- Worker CPU or request limits are repeatedly close to exhaustion;
- Queue retries, dead letters, or operation volume approach the daily budget;
- observability retention is too short to investigate money or security
  incidents;
- a live executor is approved and requires a dedicated host, stable egress,
  secret management, and on-call ownership.

## Live executor, later

The edge system must stay useful without live trading. Dry-run, backtest,
benchmarks, alerts, and auditability are the product now.

A future live executor is a separate security project. Its minimum contract
is spot-only, no withdrawals, stable egress, tenant-isolated encrypted keys,
an explicit opt-in, hard caps, idempotent client order ids, reconciliation,
kill switch, and complete audit history. It consumes signed jobs and reports
results; it does not host the public web app or bot.

No marketing page may say that users can enable live orders until that path
has passed release review and is demonstrably available in production.

## Operational invariants

- `DRY_RUN` remains the default and only released execution mode.
- No browser bundle receives an API key, service-role key, bot token, or
  exchange secret.
- User A cannot read or mutate User B through BFF, API, bot, or direct
  Supabase access.
- Duplicate webhook, Cron, or Queue delivery cannot duplicate an order,
  notification, or audit fact.
- Public routes are prerendered; dashboard routes are CSR and noindex.
- Production has exactly one Telegram delivery mode and one scheduler after
  cutover.
- Provider limits and costs are monitored; free tier is an optimization, not
  an architectural dependency.

## Sources

- [Nuxt rendering modes](https://nuxt.com/docs/4.x/guide/concepts/rendering)
- [Telegram Login with OIDC and PKCE](https://core.telegram.org/bots/telegram-login)
- [Supabase Custom OIDC providers](https://supabase.com/docs/guides/auth/custom-oauth-providers)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase pricing](https://supabase.com/pricing)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
