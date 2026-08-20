# ADR 003: Nuxt 4 Hybrid Rendering for SEO and Private UI

- Status: accepted; amended 2026-08-20
- Implementation: pending in ExecPlan 004, task 21
- Superseded scope: blanket SSR wording

## Context

The first decision selected Nuxt 4 SSR so public landing pages would deliver
indexable HTML. The repository now has a second, fundamentally different
surface: an authenticated dashboard containing tenant data.

Rendering every route on every request is unnecessary for static marketing
content and offers little SEO value for private UI. It also spends server CPU
on crawlers and risks serializing private data into an SSR payload before the
multi-tenant auth boundary is complete.

## Decision

Use Nuxt 4 hybrid route rules in one Nitro server build:

- Prerender `/` and every route in
  `packages/seo-keywords/src/index.ts` at build time.
- Prerender `robots.txt` and `sitemap.xml`.
- Configure `/dashboard` and `/dashboard/**` with `ssr: false`,
  `prerender: false`, and `X-Robots-Tag: noindex, nofollow, noarchive`.
- Keep `/api/**` and auth callbacks dynamic and never prerender them.
- Mark private responses `private, no-store` and vary them by session where
  applicable.
- Build with hybrid-capable `nuxt build`. Do not use a fully static export,
  because that would omit the Nitro BFF endpoints.

The dashboard loads a static client shell and requests tenant data from the
BFF only after the session is available. CSR does not provide authorization;
the BFF, Hono API, scoped database queries, and RLS all remain fail-closed.

SSR is not considered obsolete or useful only for old devices. It can improve
first paint, previews, and resilience when JavaScript is slow. We are not
using it for the dashboard because the route has no indexing requirement and
the current product benefits more from a simple private-data boundary and
lower request-time compute. A measured route-specific need may justify SSR in
the future.

## Consequences

- Public pages keep complete HTML, metadata, structured data, and internal
  links for search engines while being served as static assets.
- Private account data is not embedded in server-rendered page payloads.
- The dynamic Nuxt BFF remains available for auth, cookies, and API
  aggregation.
- Client devices perform dashboard rendering, so loading, error, offline, and
  session-expiry states must be complete and accessible.
- Route rules and the SEO route registry must change together when a landing
  page is added or removed.

## Related decisions

- [`ADR_008_COST_FIRST_HYBRID_EDGE.md`](ADR_008_COST_FIRST_HYBRID_EDGE.md)
- [`docs/15_COST_FIRST_SAAS_STRATEGY.md`](../docs/15_COST_FIRST_SAAS_STRATEGY.md)
- [Nuxt rendering modes](https://nuxt.com/docs/4.x/guide/concepts/rendering)
