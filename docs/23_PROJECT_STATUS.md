# Project status

Reviewed: 2026-09-12. This is the current readiness record for the recovery
checkout. Historical plans retain their original research and implementation
claims; they do not override this verdict.

**Gate 1: NO-GO. Execution: DRY_RUN only. Hosted/edge/Demo/live launch: not approved.**

## Source identity

| Source | Observed state | What its evidence proves |
| --- | --- | --- |
| Recovery source | `31212e159d8da7b5ccebb52b57f5b794db156ec2`, based on `cedc6df`; existing Gate 1/Safety Ledger package plus recovery fixes | Local source and checks through catalog `0014_bouncy_zuras` |
| Remote main | `becc46bb3b957c484324dbc3c517d5db7762be97`, fetched 2026-09-11 | Cost-first tenant/RLS and VPS implementation merged on 2026-08-20 |
| Running production | Revision, database catalog and provider configuration not inspected in this recovery | No deployment, availability or production isolation claim |

Remote main adds three commits: `3379cfd` cost-first multi-tenancy, `3536031`
deployment session-secret bootstrap, and `becc46b` private backtest error
preservation. The local working package does not contain those code changes.
It began with 204 changed/untracked status entries; that is a worktree entry
count, not completed tasks or a release.

The package and recovery fixes are preserved on local branch
`codex/gate1-recovery-20260912`. The immutable source identity and the exact
files changed during this recovery are in
[implementation evidence](20_GATE1_IMPLEMENTATION_EVIDENCE.md).

The remote [cost-first strategy](15_COST_FIRST_SAAS_STRATEGY.md),
[ADR](../adr/ADR_008_COST_FIRST_HYBRID_EDGE.md) and
[delivery plan](../plans/004-cost-first-multi-tenant-edge.md) are restored here
with source-scope notices. Their provider snapshot is dated 2026-08-20 and
has not been refreshed into a current price or capacity promise.

## What exists

| Capability | Local recovery | Remote main | Remaining work |
| --- | --- | --- | --- |
| Dip/RiskGuard/local orders | Implemented, DRY_RUN only | Implemented, DRY_RUN only | Accurate reservation and policy/snapshot lifecycle |
| Reviewed-symbol policy | Central policy; creation, inputs and completion guarded by this recovery | Still unions active strategy symbols into runner allowlist | Port the recovery fix before release |
| Account isolation | Opaque sessions, owner-qualified routes, same-owner FK and A/B suites | Personal tenants, identities/memberships, restricted role and forced RLS in source | One converged auth/catalog and full proof |
| Login security | Replay/abuse limits, lifecycle/revocation, CSRF and server-authoritative identity | Tenant bootstrap HMAC flow | Preserve hardening during tenant/OIDC migration |
| Audit | Versioned, transactional, immutable V0/V1 history | Tenant-owned audit plus event ledger | Reconcile schemas without losing original evidence |
| Telegram | Private binding, command sessions, durable typed outbox and digest | Scoped long-polling bot; digest removed from runner | Port delivery controls, then webhook/idempotent cutover |
| Web | Safety Ledger; fixed account-cache and login remount | Prerendered public pages, CSR/noindex dashboard, one snapshot refresh | Combine the dashboard contract with session/privacy fixes |
| PnL, benchmarks, backtest | Implemented basic simulation/reporting | Implemented with private error handling | Complete freshness, missing-data and methodology evidence |
| Operations | Fail-closed startup, readiness, bot-only heartbeat, PG18 CI lane | Immutable-image VPS release, backups and health gates | Unified release gate, restore and incident rehearsal |
| Cloudflare / Supabase | Target only | Target only | Identity/JWT, runtime entries, webhook/Cron/Queues and cutover |

"Implemented" in this table means source exists at the named baseline. It
never means the two versions are integrated, deployed, independently approved
or commercially available. There are no verified customer, revenue or pricing
outcomes in this recovery.

## Interrupted review findings recovered

| Finding | Outcome | Evidence |
| --- | --- | --- |
| P0: stored strategies expand the approved pair list | Fixed locally. `packages/config` owns the reviewed list; environment only narrows it. Creation/activation, input routes, bot and order completion enforce it. | Config, API policy and pending-order regression tests |
| P1: `/market` reveals whether another tenant configured a pair | Fixed locally. Public market access no longer queries strategy ownership/configuration. | Same response before/after an unsupported B-owned legacy row |
| P1: A's private Nuxt cache survives login as B | Fixed locally. Identity changes invalidate private cache entries and pending writes; keyed dashboard content remounts. | Local browser A -> logout -> B, including a delayed A response |
| P1: Telegram widget disappears after logout | Fixed locally. Post-render lifecycle installs one widget/callback for the signed-out host and cleans them on state change. | Local browser logout/re-login plus failed-logout feedback |

Unsupported historical pending orders remain pending and cancellable; the
recovery does not erase them or silently label them completed. Deployment
policy must be shared by API and bot, including an explicit empty allowlist.

## Verification in this recovery

Node `v26.7.0`, pnpm `11.0.0`.

- Before fixes: `pnpm check` and `pnpm build` passed.
- After the four fixes: `pnpm check` passed, including new policy and legacy
  order tests. Turbo reused unchanged tasks; this does not include PG18 when
  `POSTGRES18_TEST_URL` is absent.
- After the bot subset follow-up: 64 bot tests passed.
- A fresh isolated PostgreSQL 18 lane passed **7/7** through exact local
  catalog `0014`: clean install/upgrade equivalence, ownership and audit
  constraints. No developer or production database was used.
- Real local browser, fixture API and simulated Telegram callback: successful
  A login, failed logout stays signed in with error, successful logout removes
  A, exactly one widget/callback returns, B sees B, and a late A order response
  does not overwrite B. This proves the frontend transition with fixtures,
  not actual Telegram authentication or provider delivery.
- Final full checks, build and source snapshot identity are recorded in
  [implementation evidence](20_GATE1_IMPLEMENTATION_EVIDENCE.md).

## Why Gate 1 remains NO-GO

1. The newer main and recovery use incompatible migrations: local
   `0002_left_pride` through `0014` versus main's `0002_cost_first_tenancy`.
   Ownership, roles, sessions, audit and outbox semantics must converge on
   forward migrations; neither prior proof covers that future result.
2. The final integrated revision needs the complete A/B API/BFF/bot/runner,
   aggregate, race/restart, outbox and configuration matrix plus independent
   review. A seven-case catalog lane is necessary but insufficient.
3. Production revision/catalog, proxy/header trust, per-service secrets,
   readiness and backup/restore/incident behavior need actual evidence.
4. Actual Telegram login/private `/start`/delivery, provider smoke and the full
   R121 accessibility checks remain open. Local fixture success is narrower.

The next priority is integration and proof, not private exchange access.
Gate 1 proof tasks run **before** the GO decision; their old AFTER_GATE1
labels must not create a circular dependency. Demo implementation remains
blocked until GO and a separately reviewed scope. Live is a later explicit
approval, never an inferred next step.

See [the master backlog](../tasks/00_MASTER_PLAN.md) for owners, acceptance
criteria and the current R001-R123 index.
