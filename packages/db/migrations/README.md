# Migration authority

Run `pnpm --filter @buy-crypto-dip-bot/db db:migrate` with an explicit
`POSTGRES_CONNECTION_STRING`. The API and the deployment migration service use
the same guarded runner. Do not run `drizzle-kit migrate` or `push` directly.

- Root SQL and `meta/` freeze the recovery history through 0014.
- `histories/cost-first/` freezes main's original history through 0002.
- `convergence/` is the immutable bridge to `gate1_tenants_v1`.
- `forward/` is the only authority for subsequent SQL migrations. Its separate
  journal records SQL actually executed after convergence on either lineage.

Create a draft with `pnpm --filter @buy-crypto-dip-bot/db db:generate --name=description`.
This deliberately uses Drizzle's custom SQL mode. Automatic schema differencing
against the old snapshots cannot describe the hand-written policies, triggers
and dual source histories. Write and review the forward SQL, add statement
breakpoints between top-level statements, and update `src/schema.ts` as needed.
An empty migration is rejected at execution. Never modify an applied file or
relabel old journal rows. Exercise both upgrade histories and a clean install
with the PostgreSQL contract suite before release.

The startup guard validates migration history, bridge identity and critical RLS
flags/triggers. It is not a general-purpose catalog drift detector. The real PG
suite compares columns, constraints, indexes, policies and triggers across the
three supported paths; production catalog inspection remains a release step.
