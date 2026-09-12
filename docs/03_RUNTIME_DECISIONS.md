# Runtime decisions

Reviewed: 2026-09-12.

Use Node.js 26+ and pnpm 11 for the current repository. PostgreSQL 18 is the
local and VPS database; PGlite is a fast test harness, not production proof.
Nuxt 4, Hono, Valibot and Drizzle remain the chosen application stack.

Current code runs on Node/Docker. The cost-first decision targets Workers
for web/API/background entry points and Supabase for PostgreSQL/Auth. It
requires an explicit compatibility and cutover slice; Node interval jobs and
long polling have not become Worker handlers through documentation alone.
See [architecture](02_ARCHITECTURE.md) for source-line differences.
