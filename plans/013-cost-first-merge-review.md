# Cost first architecture and merge review

Started: 2026-10-02. Status: source review complete; approved for main integration.

## Objective

Review all crypto-bot branches against the requested modern, low-cost SaaS
architecture and authentication choice. Merge the sound implementation into
main after fixing confirmed defects. Keep incomplete provider work visible.

## Source

- Fresh remote main: `becc46bb3b957c484324dbc3c517d5db7762be97`.
- Candidate: `8dc038c8e41d3bc173bf4a02846a872c7e01b722`, already a descendant
  of remote main through the tenant-integration merge.
- Local cost-first branch has the same tree as remote main. Its remote branch
  predates the two already-merged fixes. PRs 1, 2 and 3 are merged.

## Work

1. Refresh official hosting/auth documentation and save the detailed decision
   questions, assumptions, capacity model and provider comparison.
2. Review auth/BFF, DB/migrations and runner/order logic independently.
3. Fix confirmed defects, run focused regressions plus repository checks and
   PostgreSQL 18 migration/concurrency checks.
4. Update source status, merge by fast-forward and push main without rewriting
   history. Observe the resulting CI and deployment gate.

## Boundaries

Execution stays DRY_RUN. This merge does not implement Supabase OIDC, Worker
entries, webhook/Cron/Queues or claim domain-only operating cost. Gate 1 stays
NO-GO until its remaining acceptance is satisfied. The workflow's production
job requires GATE1_APPROVED; that variable is absent at review time.

## Results

- Research and branch inventory complete. Stack/auth questions and capacity
  assumptions are in `docs/15_COST_FIRST_SAAS_STRATEGY.md`.
- Three independent bounded reviews found logout/replay, runner-disabled,
  stale-market/deduplication/accounting, config merge/toggle, and reservation
  economics defects. Fixes are committed as `fc47168` and verified together.
- Additional base comparison restored Traefik security headers and the web
  healthcheck; the API PostgreSQL lane now runs in CI with built dependencies.
- Auth reviewer accepted the locked config/toggle receipt changes. DB and
  runner reviewers completed their bounded fixes and verification.
- `TURBO_FORCE=true pnpm check` passed with no reused check/test cache.
  `pnpm build` passed; PostgreSQL 18 DB and API lanes passed 20 and 1 cases.
- The built API applied migrations to a disposable database, returned ready
  with the runner disabled, and rejected anonymous orders with HTTP 401.
- Cold parallel package suites exceeded existing PGlite time budgets. Test
  packages now run sequentially, retaining all assertions and timeouts.
- Compose YAML parsed, but Docker Compose configuration rendering was not
  available on this host. Production/provider/UI acceptance remains outside
  this source review. See the evidence appendix for exact boundaries.
- Main publication is authorized as a fast-forward; GitHub commit history
  and Actions results, not this local plan, establish remote delivery.
