# Runtime decisions

Reviewed: 2026-10-02.

Use Node.js 26+ and pnpm 11 for the current repository. PostgreSQL 18 is the
local and VPS database; PGlite is a fast test harness, not production proof.
Nuxt 4, Hono, Valibot and Drizzle remain the chosen application stack.

Current code runs on Node/Docker. After inspecting the existing paid VPS, the
pilot retains that runtime without a new hosting subscription. Public pages
are prerendered and the private dashboard is CSR; Nuxt BFF endpoints still
need server execution. Workers and Supabase remain an optional later migration,
not a launch prerequisite. They require an explicit compatibility and cutover
slice; Node interval jobs and long polling are not Worker handlers.
See [architecture](02_ARCHITECTURE.md) for source-line differences.
