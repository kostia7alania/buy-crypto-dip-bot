# Delivery workflow

1. Read [current status](23_PROJECT_STATUS.md), the [master backlog](../tasks/00_MASTER_PLAN.md), nearest AGENTS.md and the relevant source.
2. Inspect branch, remote base and working changes before editing. Preserve unrelated work and record the source/catalog used for any evidence.
3. Use an ExecPlan for more than two apps/packages or architectural/security behavior. Keep implementation slices small and dependencies explicit.
4. Add meaningful regression coverage for auth, ownership, DB, risk/orders and BFF contracts. Run relevant checks, then required repository gates.
5. Distinguish source, local tests, real PostgreSQL, browser fixtures, actual provider/deployment evidence and independent approval.
6. Update behavior docs and ticket states from the final implementation. Research counts do not imply runtime completion. No private exchange work before its gate.

The current recovery is [plan 010](../plans/010-recovery-and-project-status.md).
