# Cost-First SaaS Strategy

Originally authored 2026-08-20; reviewed against current provider documentation
and local source on 2026-10-02. [Project status](23_PROJECT_STATUS.md) owns the
release verdict. The target architecture below is still partly unimplemented.

- Status: existing-VPS pilot chosen; edge remains an optional later migration
- Last reviewed: 2026-10-02
- Decision record: [`ADR_008_COST_FIRST_HYBRID_EDGE.md`](../adr/ADR_008_COST_FIRST_HYBRID_EDGE.md)
- Delivery plan: [`004-cost-first-multi-tenant-edge.md`](../plans/004-cost-first-multi-tenant-edge.md)

## Executive decision

### Pilot decision after destination inspection

Use the existing paid VPS for the first reviewed DRY_RUN release. The owner
reported Singapore 1 GB and Russia 8 GB hosts and delegated the hosting choice.
The configured deployment destination was inspected on October 2: 960 MB RAM,
261 MB available and approximately 201 MiB across the four project containers.
Swap is already in use. Keep builds and restore rehearsals off this small host;
this snapshot does not establish spare capacity under load. Exact evidence is
in [plan 014](../plans/014-low-cost-pilot-delivery.md).

Keep Nuxt 4 public prerender, private CSR, the server-owned BFF/session boundary,
Hono, PostgreSQL and the existing Telegram identity flow. Do not add a new auth
provider or rewrite the runner just to avoid rent on a server already paid for.
The pilot has no new hosting subscription; it is not a zero-total-cost system.
The domain currently serves the older VPS revision, not the latest main build.

Use free managed hosting when it saves total development and operational work.
Revisit Cloudflare/Supabase on measured resource limits, reliability needs or
costs, not automatically upon the first customer. Preserve normal PostgreSQL
and explicit application/auth boundaries so relocation remains possible.
For a Russian audience, verify the complete site/login/API path without VPN;
static CDN delivery does not eliminate reachability problems or API latency.

### Optional edge target

The previously researched edge design remains a candidate, not a pilot blocker:

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

Starting from scratch without an existing deployment, I would choose the same
Nuxt/Vue, TypeScript, Hono, PostgreSQL/Drizzle and Supabase Auth direction. Use
current stable, supported releases and pinned dependencies. A prerequisite
upgrade to every newest major is unnecessary for reviewing this branch.
Public assets should bypass Worker execution; backend work should run on
events or bounded schedules. The expensive part is continuous strategy work,
database traffic and retained evidence, rather than public-page rendering.

Registry checks on 2026-10-02 returned Nuxt 4.5.2, Hono 4.13.12 and Better Auth
1.7.7 as their latest releases. These are research observations, not versions
installed by this review. The existing lockfile remains the reproducible build
input; upgrade it in a focused compatibility change.

## Questions used to review the decision

### Stack and hosting

1. Which work must run without visitors: price collection, strategy evaluation,
   due orders, notification delivery and retries? What latency does each need?
2. Which routes need build-time HTML, client rendering or request-time server
   work? Can public asset requests avoid the Worker entirely?
3. Does Astro save measurable browser JavaScript or editorial effort compared
   with prerendered Nuxt, enough to justify another application?
4. Can one small BFF own cookies and server credentials while the public pages
   and private shell remain static? What still needs the domain API?
5. Which allowance expires first: CPU, requests, queue operations, database
   size, egress or authentication email? What happens when it is exhausted?
6. What do 100, 1,000 and 10,000 daily dashboard users cost under explicit
   viewing-time and refresh assumptions? How does pending-order polling differ?
7. Can market observations be fetched once per symbol and reused across users?
   Can one scheduled batch replace a queue message per user per minute?
8. How are crawler requests, webhook retries and abusive clients charged, and
   which limits stop unbounded work before it reaches the database?
9. Which dependencies need Node APIs, permanent connections or a persistent
   process? Are edge entries and deployment configuration actually present?
10. What migration preserves accounts, tenant data and audit history when free
    capacity runs out? Can one producer own work throughout cutover?
11. Which stable framework/runtime releases fit together, and which upgrades
    solve a concrete problem rather than changing version labels?
12. What can the resume demonstrate with source and measurements: tenant
    isolation, sessions, idempotency, migrations, observability and releases?

### Authentication

1. Is Telegram the primary identity for this audience, and which linked login
   can restore access if the Telegram account becomes unavailable?
2. Does managed Supabase Auth reduce total work compared with Clerk or owning
   Better Auth operations when PostgreSQL is already needed?
3. Which features have separate limits or charges: active users, SMTP, SMS,
   MFA, organizations, session controls and custom domains?
4. Where do tokens live, who refreshes them, and how are sessions expired,
   revoked and cleared when the browser switches users?
5. How does the API verify a principal and establish tenant context? Does the
   actual database role enforce RLS, or bypass it?
6. What prevents replay, login CSRF, account-linking takeover and foreign-tenant
   reads/writes? Which negative cases have real evidence?
7. How does bot notification eligibility bind a private Telegram chat to the
   same application account without accepting a caller-selected recipient?
8. Can users and external identity subjects move to a different auth provider
   without replacing app-user IDs or losing their histories?

## Product truth today

| Area | Current repository | Target after this plan |
| --- | --- | --- |
| Trading | Dry-run orders only; public Bybit market data; live execution hard-disabled | Still dry-run at edge; optional isolated live executor only after a separate decision |
| Tenancy | Personal tenants, scoped BFF/API/bot/runner paths, forced PostgreSQL RLS | Supabase identity plus `auth.uid()` RLS |
| Public web | Static, prerendered acquisition routes in the Nuxt build | Same assets served at the Cloudflare edge |
| Dashboard | CSR-only, noindex, one tenant snapshot refresh | Same contract behind Supabase session/JWT |
| API | Hono Node server with interval runner | Hono Worker with JWT tenant context |
| Bot | grammY long polling | Telegram webhook Worker with secret verification |
| Scheduling | Node intervals, single-flight runner, durable reservation/evaluation keys and typed notification outbox | Bounded Cron batches plus Queue consumers; one producer after cutover |
| Deployment | Immutable-image VPS workflow with backup, migration and health gates | Cloudflare Workers plus Supabase migrations; VPS scheduler disabled after cutover |

The target column is optional future work, not the current pilot commitment.
Until it is implemented and released, marketing and docs must
describe the product as a self-hosted dry-run simulator. A source file, plan,
or database column named `LIVE` is not evidence that live trading exists.

## Why this stack

### Nuxt instead of adding Astro now

Astro is useful for content-heavy static sites, but adding it here would
create a second router, component system, SEO pipeline, and deployment. Nuxt
already supports build-time prerendering for public routes, client-only
rendering for private routes, and dynamic Nitro endpoints for the BFF. The
single-framework hybrid is cheaper to operate and easier to present as one
coherent SaaS codebase.

Revisit Astro only if public content becomes a separate publishing product
with independent ownership and release cadence.

Astro's islands can reduce browser JavaScript on content pages. That is a
different saving from request-time compute: both frameworks can emit static
HTML. Choosing Astro alone does not remove auth, API or scheduled-work costs.
[Astro islands](https://docs.astro.build/en/concepts/islands/)

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

### Provider choice

Supabase Auth is the preferred target here because the application already
needs PostgreSQL and tenant isolation. Its current Free tier includes 50,000
monthly active users; custom OAuth/OIDC supports up to three custom providers
on Free. This makes Telegram plus an explicitly linked recovery identity a
reasonable small-project choice. This recommendation is an engineering
judgment, not a claim that the migration already exists.
[Pricing](https://supabase.com/pricing),
[custom providers](https://supabase.com/docs/guides/auth/custom-oauth-providers)

Better Auth is the alternative when owning authentication operations and
avoiding a separate hosted identity service matter more than maintenance
effort. Its session, OAuth, passkey and MFA features are useful, but application
hosting, the database, email, upgrades and incident handling remain ours.
[Better Auth](https://better-auth.com/docs/introduction)

Clerk is a valid managed alternative when ready-made account UI is the main
priority. Its current Hobby allowance is 50,000 monthly retained users, a
different metric from Supabase MAU. Its free sessions have a fixed seven-day
lifetime and MFA is in Pro. For this PostgreSQL-backed product, another auth
vendor has no demonstrated benefit yet. [Clerk pricing](https://clerk.com/pricing)

Prefer provider login at the start. Email OTP or magic links require a delivery
service: Supabase's default SMTP only sends to project-team addresses, is
currently limited to two messages per hour and is not a production mail
service. SMS adds a separate provider cost. A custom auth-service domain is
optional; the application's own domain does not require that add-on.
[Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

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

The current Telegram Login Widget HMAC flow creates a personal tenant and
feeds the restricted PostgreSQL RLS context. Its opaque API sessions remain
the implemented VPS contract. Supabase OIDC/JWT is pending. Keep issuer plus
subject as the external identity key; never merge users by a mutable username
or an unverified email. Account linking requires proof of both identities.

The BFF should own refresh tokens in HttpOnly cookies and perform refresh on
the server. Verifying a JWT signature alone does not prove immediate session
revocation: define the accepted access-token lifetime and sensitive-operation
session checks before cutover. Supabase's configurable inactivity/time-box and
single-session controls require a paid plan. Preserve the current logout and
revocation behavior when choosing the replacement contract.
[Supabase sessions](https://supabase.com/docs/guides/auth/sessions)

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

The integrated source requires matching owners and tenants for strategies,
orders and reservations. Tenant audit visibility remains owner-scoped;
historical and system audit records may retain a null tenant. Two frozen
migration histories converge through guarded SQL. Ambiguous legacy ownership
stops that migration for an explicit decision. See
[migration authority](../packages/db/migrations/README.md).

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

- refresh 30 seconds after the prior request completes, or three seconds while
  an order is pending;
- stop while the tab is hidden;
- refresh stale data when the tab becomes visible;
- refresh immediately after a successful mutation;
- cancel obsolete requests and never overlap refreshes;
- return `401` without any dashboard data when auth fails;
- use `private, no-store` and `Vary: Cookie` headers.

The current normal cadence is at most about two BFF requests per minute per
visible tab; the pending cadence is up to about twenty. Hidden tabs stop
scheduled refreshes and cancel their current request. Backend strategy work
continues independently.

## Free-tier capacity and what consumes it

Provider allowances below were checked on 2026-10-02 and can change.

- Cloudflare Workers Free lists 100,000 dynamic requests per day and 10 ms CPU
  per invocation. Static asset requests
  are listed as free and unlimited.
- Cloudflare Queues Free lists 10,000 operations per day. A normal message
  delivery is commonly three operations: write, read, and delete. Retries add
  reads.
- Supabase Free lists 50,000 monthly active users, a 500 MB database, 5 GB
  egress, and two active projects. Free projects can pause after one week of
  inactivity.

Asset-first routing matters: `run_worker_first` invokes dynamic code even for
matching assets. Cloudflare's optional Workers Caching also bills cached
requests. The static allowance is not a promise that every CDN-cached request
or CSR navigation is free. [Static asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/),
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

The public visitor count is therefore not directly capped by the Worker
request allowance when pages and assets are genuinely static. Authenticated
usage is different: login, BFF, API, bot webhooks, Cron, Queue, database reads,
and egress all consume finite resources.

An illustrative dashboard load of 100 users viewing for 30 minutes per day at
two snapshot refreshes per minute creates at least 6,000 dynamic BFF requests
per day, before downstream API work. Measure real invocations and database
egress rather than converting a marketing free-tier number into a promised
visitor count.

The following is a capacity model, not a measured benchmark. Assume 30 visible
minutes per user per day, two refreshes per minute, 30 days per month, and
10 KiB of database egress per refresh. Initial loads, mutations, login,
downstream calls, retries, bots and scheduled jobs are additional.

| Daily dashboard users | BFF requests per day | Modeled DB egress per month |
| --- | ---: | ---: |
| 100 | 6,000 | 1.84 GB |
| 1,000 | 60,000 | 18.43 GB |
| 10,000 | 600,000 | 184.32 GB |

Database egress could therefore exceed a free allowance before the auth-user
limit. Response bytes and database transfer are different measurements;
replace the 10 KiB assumption with actual provider metrics. Sustained pending
polling can multiply the request estimate by roughly ten.

Queue work must also be batched: one message per strategy per minute is 1,440
messages, usually about 4,320 operations per strategy per day before retries.
A small number of constantly evaluated strategies would exhaust 10,000 daily
operations. Fetch shared prices, scan bounded batches, and enqueue actions or
resumable work. Queue delays are not an exact timer; execution must recheck
the durable due time and expose overdue work.
[Queue pricing](https://developers.cloudflare.com/queues/platform/pricing/),
[queue delays](https://developers.cloudflare.com/queues/configuration/batching-retries/)

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

The first predictable paid baseline is currently Workers Paid from $5/month
and Supabase Pro from $25/month, plus domain and any usage/add-ons. It is a
starting budget, not an upper cap. Free Supabase lacks automatic backups;
regular exports and verified restoration need their own storage and work.
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[Supabase pricing](https://supabase.com/pricing)

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

## Resume value

Show the working engineering decisions: a TypeScript monorepo, public static
delivery, a private CSR dashboard, server-owned sessions, PostgreSQL tenant
isolation, auditable state transitions, durable jobs, migrations and a checked
release workflow. Explain one actual race or account-isolation failure and
the fix. These are transferable SaaS skills without adding Kubernetes,
Kafka or extra services solely for a technology list.

State measured results and released features precisely. Cloudflare/Supabase
deployment, provider OIDC and domain-only operating cost remain targets until
they are implemented and measured. The current branch is a VPS dry-run
foundation, not completion of all 22 edge migration items.

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
