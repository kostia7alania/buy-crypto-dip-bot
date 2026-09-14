# Product model and delivery strategy

Reviewed: 2026-09-14. Source scope: [project status](23_PROJECT_STATUS.md).

## Product today

A self-hosted spot dip simulator for people who want to inspect automation
before considering real exchange execution. Telegram is the interaction and
notification surface; the Safety Ledger explains configured limits, decisions
and local outcomes. `DRY_RUN`, backtest, benchmark context and auditability
are the current product. No hosted tariff, SLA or private exchange execution
is offered by this record.

## Recorded direction

The approved 2026-08-20 cost-first decision keeps one Nuxt application:
prerender public pages, render the private dashboard in the browser, and keep
a dynamic server-only BFF. The target uses Hono Workers, Supabase PostgreSQL
and Auth, Telegram webhook/OIDC, and bounded Cron/Queue work.

A small MVP may fit provider free allowances, but domain-only running cost is
a hypothesis. Database capacity/egress, CPU, queue retries, backups and
availability can require paid infrastructure. The dated assumptions are in
[the cost-first source document](15_COST_FIRST_SAAS_STRATEGY.md); verify vendor
limits before sizing or cutover.

## Monetization hypothesis

First validate whether people return to inspect their simulated decisions.
A future hosted subscription would charge for managed operation, useful
history/export and reliable notification/recovery, subject to measured
support and infrastructure costs. Pricing interviews and packaging tests are
open work. No price, conversion result, user count or revenue is established
by repository implementation.

Do not monetize bypassing risk controls or add custody, performance fees,
leverage, meme coins or a strategy marketplace to this MVP.

## Delivery order

1. Completed locally: recovered safety fixes and preserved their evidence.
2. Completed locally: converge personal tenants/RLS with recovery sessions,
   immutable audit, market policy, notification hardening and dashboard snapshot.
3. Prove the resulting revision and catalog, browser identity transitions,
   operations and deployment readiness. Gate 1 must have one explicit verdict.
4. Implement the cost-first runtime in bounded slices and verify a single
   scheduler/bot delivery mode during cutover.
5. Run customer discovery and measure healthy dry-run use with actual evidence
   viewing. Hosted pricing remains unannounced until supported by evidence.
6. Consider Bybit Demo, then any closed live pilot, only through their separate
   safety and external approval gates. Live execution stays unavailable.

The [backlog](../tasks/00_MASTER_PLAN.md) owns priorities. The old single-user
"next three months" timeline and competitor price claims are historical
research, not today's plan. Weeks of healthy use and returning evidence
viewers are proposed success metrics; first-party reporting is still pending.
