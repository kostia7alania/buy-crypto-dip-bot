# Architecture

This repository is a TypeScript monorepo for a risk-first crypto automation
product. It currently ships a tenant-safe, self-hosted dry-run VPS slice. The
target edge runtime is described in
[`ADR_008_COST_FIRST_HYBRID_EDGE.md`](../adr/ADR_008_COST_FIRST_HYBRID_EDGE.md).

Do not read the target diagram as shipped behavior. Migration progress lives
in [`ExecPlan 004`](../plans/004-cost-first-multi-tenant-edge.md).

## Repository boundaries

- `apps/web`: Nuxt 4 UI and a small server-only BFF. Frontend code follows
  FSD-lite under `app/`.
- `apps/api`: Hono application API organized as vertical slices under
  `src/modules/`.
- `apps/bot`: grammY Telegram interface and onboarding.
- `packages/config`: strategy and risk defaults.
- `packages/strategy-engine`: deterministic signal evaluation.
- `packages/risk-engine`: fail-closed order-like action approval.
- `packages/exchange-core`: exchange ports and shared market contracts.
- `packages/exchange-bybit`: public Bybit spot market-data adapter.
- `packages/db`: Drizzle PostgreSQL schema, migrations, and connection code.
- `packages/shared-types`: cross-application contracts.

PostgreSQL is used in development and production. SQLite is not supported.

## Current runtime

```text
Public visitor -> prerendered Nuxt assets from the Node/Traefik deployment

Authenticated browser -> Nuxt CSR dashboard/BFF -> Hono Node API -> PostgreSQL
                                  |       |
                                  |       +-> idempotent minute-slot dry-run runner
                                  +----------> public Bybit market data

Telegram <-> grammY long polling
```

Current safety and limitations:

- RiskGuard passes `liveTradingEnabled: false`; there is no private exchange
  execution adapter.
- The runner creates and completes simulated orders only.
- Telegram web identity maps to a personal tenant. BFF, API, bot, aggregates,
  runner writes and PostgreSQL RLS all enforce that tenant boundary.
- Public Nuxt routes prerender; `/dashboard/**` is CSR/noindex and uses one
  visibility-aware private snapshot refresh.
- Production deployment still targets an optional VPS and Docker Compose.

## Target runtime

```text
Public visitor -> prerendered Nuxt assets on Cloudflare

Authenticated browser
  -> Nuxt BFF Worker (secure session)
      -> Hono API Worker (verified Supabase JWT)
          -> Supabase PostgreSQL (required ownership + RLS)

Telegram -> verified webhook Worker -> Hono/domain services
Cloudflare Cron -> Queue -> idempotent tenant jobs -> PostgreSQL/outbox

Future only: signed execution job -> isolated Node live executor
```

### Web rendering

- Public acquisition routes are prerendered at build time for SEO and low
  runtime cost.
- `/dashboard/**` is client-rendered, noindex, and fetches data only after
  authentication.
- `/api/**` and auth callbacks remain dynamic. The BFF owns cookies and
  server-only credentials but does not contain trading domain logic.

### Auth and tenancy

- Supabase Auth is the target issuer, with Telegram Custom OIDC, PKCE, and an
  email-optional identity.
- The BFF forwards a short-lived Bearer token; Hono derives the tenant from
  the verified token rather than request data.
- Strategies, orders, and audit events require an owner.
- PostgreSQL RLS based on `auth.uid()` is defense in depth, not a replacement
  for scoped application queries.

### Background work

- Telegram uses webhooks rather than an idle long-polling process.
- Cron produces bounded scheduled work; Queues deliver actionable jobs.
- Webhook, Cron, and Queue handling is idempotent and auditable.
- One `/dashboard/snapshot` request replaces independent widget polling.

### Live execution

Live trading is not shipped. If approved later, it belongs in a separate
stable-egress Node executor with isolated private credentials. The public web,
BFF, API Worker, bot Worker, and queue never receive exchange secrets.

## Architecture invariants

- `DRY_RUN` is the released mode and safe default.
- Every signal, risk decision, simulated order, and state transition is
  auditable.
- No browser receives internal API, bot, Supabase service-role, or exchange
  secrets.
- Private routes fail closed without a verified session.
- User ownership is enforced in BFF, API, bot, background jobs, and RLS.
- Duplicate event delivery cannot duplicate a durable side effect.
- Exactly one bot delivery mode and one scheduler run in production.
