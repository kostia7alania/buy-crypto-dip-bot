# Plans

Use ExecPlans for work that spans more than two apps/packages or changes
architecture, security or trading behavior.

Current truth: [project status](docs/23_PROJECT_STATUS.md).
Current priorities: [master backlog](tasks/00_MASTER_PLAN.md).

## Current work

- [013: Cost-first architecture and merge review](plans/013-cost-first-merge-review.md),
  current provider research, security/correctness review and main integration.
- [012: Durable dry-run reservation lifecycle](plans/012-reservation-lifecycle.md),
  bounded local N10 slice and PostgreSQL 18 connection-race/reopen proof;
  independent process restart remains unproved.
- [011: Tenant history convergence](plans/011-tenant-history-convergence.md), researched integration and PostgreSQL/browser proof.

- [010: Interrupted Gate 1 recovery](plans/010-recovery-and-project-status.md), four review fixes and documentation reconciliation.
- [009: R001-R123 implementation history](plans/009-123-practical-execution.md), local Gate 1 line; not a release verdict.
- [004: Cost-first multi-tenant edge](plans/004-cost-first-multi-tenant-edge.md), restored remote source plan; edge cutover pending.

## Historical plans

- [001: Production scaffold](plans/001-scaffold-production.md), completed baseline.
- [002: Lean single-user core](plans/002-architecture-crossroads.md), historical direction superseded by current model.
- [003: Telegram Login](plans/003-telegram-login.md), implemented bootstrap identity.
- [004: Multi-user research](plans/004-multi-user-night-research.md), research completed.
- [005: User isolation](plans/005-multi-user-isolation.md), local implementation history; Gate 1 remains NO-GO.
- [006: Gate 1 proof research](plans/006-gate1-proof-night-research.md), research completed.
- [007: Gate 1 to Demo research](plans/007-gate1-to-demo-night-research.md), research completed.
- [008: 123-ticket research](plans/008-123-task-night-research-loop.md), frozen acceptance inventory; current delivery statuses are in the master backlog.

Plan number 004 and ADR number 008 were independently reused in the two
source lines. Full filenames identify them unambiguously. Their source scope
is recorded; integration must resolve the underlying decisions rather than
silently replacing either historical record.
