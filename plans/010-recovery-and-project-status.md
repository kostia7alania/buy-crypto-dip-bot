# ExecPlan 010: Resume the interrupted Gate 1 work

Started: 2026-09-11. Completed: 2026-09-12.
Status: complete for the recovery scope; integration remains N05-N08.

## Objective and baseline

Finish the four outstanding findings from the interrupted 2026-08-10 review,
then reconcile project documentation and the delivery backlog with current
source. Keep `DRY_RUN` and the Gate 1 NO-GO boundary.

Local `main` is `cedc6df`, with 204 pre-existing changed/untracked status entries.
The fetched `origin/main` is `becc46bb3b957c484324dbc3c517d5db7762be97`, three
commits ahead. Its cost-first tenancy/RLS implementation and migration `0002`
are different from the local user-owned Gate 1 catalog through `0014`.
The recovery must preserve both histories; a green local check does not prove
their integration or the deployed state.

An owner-local copy of the original diff and changed files was saved under
`/tmp/buy-crypto-dip-recovery-20260911` before editing.

## Scoped outcomes

- [x] Close the reviewed-symbol policy bypass across strategy creation,
  public market access, backtest, runner and Telegram entry points. Preserve
  audit history and allow cancellation of legacy unsupported orders.
- [x] Remove the cross-tenant strategy-existence lookup from `/market`.
- [x] Clear private Nuxt data and pending requests on identity changes so
  account B cannot see account A's cached data.
- [x] Mount the Telegram login widget again after logout, with one owned
  callback and cleanup on unmount.
- [x] Run relevant regression checks, full `pnpm check` and build. Keep
  PostgreSQL 18 and real browser/provider evidence explicitly separate.
- [x] Record current architecture, source comparison, gate state and a prioritized
  backlog; preserve historical research instead of relabeling it delivered.

## Implementation boundaries

- `packages/config` owns the reviewed symbols. Environment values can only
  narrow them. Persisted strategies cannot expand product policy.
- API strategy creation/activation, bot onboarding/input, and order completion
  reject unsupported symbols. Historical completed records remain readable;
  unsupported pending orders remain cancellable and retain their evidence.
- The login widget owns identity-transition cache cleanup and widget lifecycle.
  Dashboard remains a composition surface. No new UI framework or dependency.
- New verification covers security behavior, not implementation shape.
- No merge, deployment, private Bybit adapter or live trading is part of this
  recovery. The incompatible migration histories require an explicit separate
  integration plan against the confirmed remote base.

## Verification

Before edits, Node `v26.7.0` / pnpm `11.0.0`: `pnpm check` and `pnpm build`
passed. After all source fixes, the full check passed with 341 package tests
and the build passed. Turbo reused unchanged tasks. The seven optional PG18
cases were skipped in that generic run and then passed separately on a fresh
isolated PostgreSQL 18.4 container through exact catalog `0014`.

A local browser verified A/B transitions, a late A response, logout failure
and widget recreation using fixtures. Actual Telegram/provider and full
accessibility checks remain separate. Evidence, source identity and the
recovery file inventory are recorded in
[implementation evidence](../docs/20_GATE1_IMPLEMENTATION_EVIDENCE.md).

The original package and these fixes are preserved on local branch
`codex/gate1-recovery-20260912`. No remote integration or deployment occurred.
