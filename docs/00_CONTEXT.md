# Context

Reviewed: 2026-09-12.

Buy Crypto Dip Bot is a self-hosted `DRY_RUN` spot dip simulator. Its product
surface is Telegram plus a Safety Ledger dashboard. The approved cost-first
direction keeps Nuxt and PostgreSQL, with Cloudflare/Supabase as a future
runtime. Hosted service availability and live exchange execution are not
current capabilities.

Read [project status](23_PROJECT_STATUS.md) for the current source identities,
verification and gate verdict. [The backlog](../tasks/00_MASTER_PLAN.md) owns
current priorities; old research checkboxes are historical outcomes.

The recovery checkout uses user ownership through catalog `0014`; newer
remote main uses personal tenants and RLS through its own `0002`. Neither
set of evidence proves the other. The shared invariants are `DRY_RUN`, no
private exchange credentials, accountable ownership and preserved audit.
