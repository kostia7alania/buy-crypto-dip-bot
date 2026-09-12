# ADR 008: Cost-First Hybrid Edge Runtime

> Source snapshot: `origin/main` at `becc46b`, authored 2026-08-20, restored 2026-09-12. "Current" and "COMPLETE" below refer to that remote source, not this recovery checkout or verified production. See [current status](../docs/23_PROJECT_STATUS.md) before implementation. Provider prices and capabilities below retain their original check date.

- Status: Accepted; tenant-safe VPS slice implemented, edge cutover pending
- Date: 2026-08-20
- Owners: product and engineering
- Delivery plan: [`plans/004-cost-first-multi-tenant-edge.md`](../plans/004-cost-first-multi-tenant-edge.md)

## Context

The repository began this decision as a working single-tenant dry-run MVP.
This branch now implements a tenant-safe VPS slice while retaining several
deliberate transition constraints:

- Nuxt prerenders public routes while the private dashboard is CSR/noindex and
  reads one authenticated snapshot through the BFF.
- The Nuxt BFF requires a versioned session and propagates a server-derived
  user/tenant principal to the internal API.
- Strategies, orders and audit events require a tenant. Application checks and
  forced PostgreSQL RLS run under the restricted `dipbot_app` role.
- The exchange adapter reads public Bybit market data only. RiskGuard sets
  `liveTradingEnabled` to `false`; there is no private order execution adapter.
- Hono and an idempotent minute-slot runner still run in one Node process, the
  Telegram bot still uses long polling, and deployment still targets the VPS.

The product needs strong public SEO, a private application, Telegram-native
onboarding, auditable background work, and a credible SaaS architecture. It
should also sit idle at close to zero infrastructure cost while usage is low.

## Decision

### Rendering boundary

Keep Nuxt 4 and use one hybrid Nitro build:

- Prerender every public acquisition route, plus `robots.txt` and
  `sitemap.xml`, at build time. These pages are static assets at runtime.
- Render `/dashboard` and descendants only in the browser with `ssr: false`.
  Mark them `noindex` and fetch private data only after authentication.
- Keep `/api/**` and auth callbacks dynamic. The Nuxt server remains a small
  BFF that owns cookies, CSRF boundaries, response shaping, and server-only
  credentials.
- Use `nuxt build` with route rules, not a fully static `nuxt generate`,
  because the BFF must remain available.

SSR is not reserved for old devices. It can improve first paint and resilience
when JavaScript is slow or unavailable. The private dashboard does not need
search indexing, however, and server-rendering tenant data would add compute
and payload-leak risk without enough product value. CSR is therefore the
default for authenticated UI; SSR remains available for a future route only
when a measured need justifies it.

### Identity and data boundary

- Use Supabase PostgreSQL as the system of record and Supabase Auth as the
  identity issuer.
- Configure Telegram's OIDC authorization-code flow as a Supabase Custom OIDC
  provider with PKCE and `email_optional`. Link its stable subject to the app
  user. A recovery identity such as Google may be linked later; it must not
  create a second tenant.
- Store the Supabase session in secure, HttpOnly cookies managed by the BFF.
  Propagate a short-lived Bearer token to Hono; never expose the internal API
  key or Supabase service-role key to the browser.
- Require `user_id` ownership on strategies, orders, and audit events. Verify
  tenant scope in BFF, API, bot callbacks, runner writes, and database queries.
- Enable PostgreSQL RLS using `auth.uid()` as defense in depth. Application
  checks remain mandatory; CSR is not an authorization mechanism.

### Runtime boundary

- Deploy the Nuxt BFF/static assets and Hono API to Cloudflare Workers.
- Replace Telegram long polling with a webhook Worker and verify Telegram's
  secret header before processing an update.
- Replace in-process intervals with Cloudflare Cron producers. Enqueue only
  actionable work, then process it with Cloudflare Queues.
- Treat webhook, Cron, and Queue delivery as at-least-once. Use idempotency
  keys, conditional state transitions, a transactional outbox, durable
  deduplication, retries, and a dead-letter path.
- Replace the six dashboard polling loops with one tenant-scoped
  `/dashboard/snapshot` request every 30-60 seconds. Pause refresh while the
  tab is hidden and refresh after mutations.

### Live trading boundary

Live exchange execution is not part of this migration and must not run at the
edge. The current product remains dry-run-only.

If live spot trading is approved later, add a separate Node executor with
stable egress, isolated private credentials, strict symbol and spend limits,
and an auditable job contract. Cloudflare may produce signed jobs, but neither
the browser, Nuxt BFF, general API Worker, nor Telegram webhook may read an
exchange secret. Live mode remains opt-in and disabled by default.

## Cost model

The initial budget target is the domain fee only, not a pricing guarantee or a
production SLO. At low usage, prerendered pages avoid per-visit rendering,
webhooks avoid an always-on bot process, and Cron/Queue replace idle polling.
Cloudflare and Supabase free allowances can cover an early MVP, but database
size, egress, CPU, queue operations, backups, support, and provider policy can
force a paid tier.

Budgets and alerts must be configured before public launch. Recheck provider
pricing at every release; never encode a free-tier allowance as a product
invariant.

## Consequences

### Benefits

- Public SEO pages are fast and cheap to serve.
- Authenticated rendering cost scales with actual use, not crawler traffic.
- The same TypeScript monorepo demonstrates modern SaaS boundaries without a
  second public-site framework.
- Tenant isolation is enforced at multiple layers.
- Background work survives restarts and duplicate delivery.
- Private exchange credentials stay outside the general web stack.

### Costs and risks

- Cloudflare runtime limits require small handlers and bounded batches.
- Supabase free projects can pause and are not a substitute for production
  backups or an availability commitment.
- Queue semantics add idempotency and observability work.
- The migration cannot be released until legacy rows have an owner or are
  quarantined and cross-tenant access is fail-closed.
- The existing VPS deployment remains the rollback path until cutover is
  verified; only one scheduler and one Telegram delivery mode may be active.

## Rejected alternatives

- **SSR for every route:** spends compute on private UI and risks serializing
  tenant data without improving private-page SEO.
- **A fully static Nuxt export:** removes the BFF required for secure cookies
  and server-only credentials.
- **Astro for public pages plus Nuxt for the app:** technically valid, but it
  duplicates routing, design, SEO, and deployment for a small site. Revisit
  only if the public content platform becomes independently complex.
- **One always-on VPS for all workloads:** simple today, but carries fixed idle
  cost and couples web, bot, scheduler, and future execution failure domains.
- **Live execution inside Workers:** rejected because credential isolation,
  stable egress, exchange controls, and operational rollback deserve a
  separate boundary.

## References

- [Nuxt rendering modes](https://nuxt.com/docs/4.x/guide/concepts/rendering)
- [Nuxt prerendering](https://nuxt.com/docs/4.x/getting-started/prerendering)
- [Telegram OIDC login](https://core.telegram.org/bots/telegram-login)
- [Supabase Custom OIDC providers](https://supabase.com/docs/guides/auth/custom-oauth-providers)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
