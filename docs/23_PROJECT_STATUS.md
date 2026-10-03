# Project status

Reviewed: 2026-10-03. This document owns the current readiness verdict.
Historical plans preserve their original evidence and do not override it.

**Gate 1: NO-GO. Execution: DRY_RUN only. Hosted, edge, Demo and live launch
remain unapproved.**

## Current source

Overnight pilot work is tracked in [plan 014](../plans/014-low-cost-pilot-delivery.md).
It adds truthful incomplete reports, new rejected-decision provenance, actual
process-crash recovery proof and actionable auth outage states. The pilot stays
on the existing VPS without a new hosting subscription; edge migration is optional.

October review implementation: `fc47168`. Review and merge work is tracked in
[plan 013](../plans/013-cost-first-merge-review.md). The architecture decision
and provider limits were refreshed in the [cost-first strategy](15_COST_FIRST_SAAS_STRATEGY.md).
The review adds auth replay/logout fixes, runner and budget safeguards,
idempotent Telegram toggles, locked config edits and forward-only reservation
economics constraints. These changes do not approve production or implement
the edge/provider target.

Reservation baseline: `37d986aa72d20f80b319ae6ebff7bfb628793a13`.
Integration branch: `codex/remote-continuation-20260916`. It descends from the documented
tenant-integration checkpoint `3b90246`, whose runtime merge
`5ee012d1d4271333c24f4b195633a28cdd0cb71f` combines recovery `d183fa2` with
the relevant cost-first foundation from main
`becc46bb3b957c484324dbc3c517d5db7762be97`. Recovery remains preserved on
`codex/gate1-recovery-20260912`; its code snapshot is
`31212e159d8da7b5ccebb52b57f5b794db156ec2`.

The interrupted work was located in task "Составить и выполнить 20 задач",
ID `019fb904-e09c-7672-acae-ad417f4a95ae`. Its four outstanding review fixes were
recovered on September 12. The September 14 integration preserves them. The
September 16 continuation adds the bounded reservation lifecycle and targeted
concurrency/restart proof described below.

Read-only destination inventory on October 2 confirmed API/bot/web still run
`becc46bb3b957c484324dbc3c517d5db7762be97`, PostgreSQL 18.4 and the exact
three-migration cost-first lineage. This is not the current main revision.
Further SSH access and backup rehearsal require an independently verified
host fingerprint, currently unavailable. No provider-delivery claim follows
from inventory or local source integration. Exact source/check identities are recorded in
[implementation evidence](20_GATE1_IMPLEMENTATION_EVIDENCE.md).

## What changed in this integration

| Area | Current local result | Remaining acceptance |
| --- | --- | --- |
| Migration history | Strict recognition of both original histories; guarded transactional bridges to `gate1_tenants_v1`; one authority for subsequent forward SQL | Destination catalog review and explicit decisions for any unresolved ownership |
| Data preservation | Original migration journals preserved; original audit fields and numeric amounts retained; quarantine preflight refuses without writes; destination lineage inventoried | Fresh destination backup restoration and comparison |
| Tenant access | Personal tenants, memberships, owner constraints, forced RLS and restricted transactions for owned API routes and bot/runner mutations | Full integrated matrix, independent review and service-credential separation |
| Login | Recovery opaque sessions, replay/abuse, CSRF, revocation and authoritative BFF retained | Real Telegram login/private start/provider smoke; OIDC later |
| Dashboard | One private snapshot, account invalidation and 401 pause; explicit login/API outages; local setup and recovery checked; keyboard focus, 320/390 px reflow and shared-control contrast improved | Provider login, VoiceOver/Safari and actual 200% zoom remain open; see web quality evidence |
| Audit, reservation and Telegram | Immutable approved and new rejected decision evidence; atomic dry-run holds; process restart and callback/executor contention proof; bounded Telegram requests and just-in-time outbox claims; truthful shared reports | Actual provider delivery, broader fairness and benchmark contracts; historical rejection evidence is not backfilled |
| Release | Immutable digest, commit-pinned files, separate migration service, writer quiescence, backup and readiness ordering; no automatic old-image restart after attempted DDL | Restore/incident rehearsal and production approval |
| Public web | Public prerender; private CSR/noindex/no-store; truthful signed-out backtest copy | Published revision and claims/analytics QA |
| Platform | Cloudflare/Supabase remain targets | OIDC/JWT, edge entries, webhook, Cron/Queues and cutover proof |

The migration retains main's event ledger, generic outbox and evaluation keys
as data/schema. It does not activate main's minute-slot/generic dispatch path
alongside recovery's runner/outbox. The local runner now stores immutable
config, public-market and risk evidence for approved dry-run reservations.
New rejected decisions now retain their config, market and risk snapshots.
Dashboard reports share quotes and one final freshness cutoff; missing values
remain null and partial sums are not presented as whole-portfolio totals.
Broader benchmark contracts and scheduler cutover remain N10/N11. Identity profile
fields are compatibility snapshots until a future canonical OIDC/profile
contract is implemented.

## Verified locally

- PostgreSQL 18 contract lane: clean install, both known upgrades, catalog
  equivalence, audit/numeric preservation, quarantine refusal, concurrent and
  repeat execution, modified history refusal, critical RLS drift refusal and
  subsequent forward migration atomicity.
- Restricted-role pool reuse: A, forbidden foreign write, rollback, B, missing
  context and restored connection state. No developer or production DB used.
- Disposable PostgreSQL 18: reservation race plus an actual child-process
  SIGKILL after committed reservation, two fresh competing scheduler processes,
  one settlement/consumed hold/completion event, and another cold start without
  duplication. This does not prove a PostgreSQL crash or live exchange recovery.
- PostgreSQL callback/executor contention: the real bot cancellation repository
  and runner claim wait on the same row, then produce one terminal state/hold/event;
  replay adds nothing and another tenant's ledger remains unchanged.
- Telegram transport: five-second deadline covers response headers and body;
  cleanup aborts unread bodies. A stalled recipient is retried with existing
  backoff while the next recipient proceeds. Rows are claimed just before send,
  not held idle in an expiring batch lease. Timeouts can still mean Telegram
  accepted a message, so external delivery remains at-least-once, not exactly-once.
- API snapshot A/B isolation and anonymous refusal; BFF session forwarding,
  private caching headers and upstream outage behavior.
- Browser with fixtures: immediate first A snapshot, logout/re-login, one
  widget/callback, B remains B after a delayed A result, no refreshes during
  179 seconds of simulated hidden visibility, and private data cleared on 401.
  This does not prove real Telegram authentication or delivery.
- Local HTTP BFF/API/PostgreSQL flow: two synthetic signed identities, public
  Bybit-backed strategy creation, owner-only reads/updates, foreign 404,
  cross-origin 403, private/no-store snapshot and logout/revoked-cookie refusal.
- Local browser at 390 and 1440 px: create a paused pair, edit/read back caps,
  audit events, public-history backtest and logout. Stopping the API hides private
  data with an unavailable state; restarting and retrying restores the same
  account. Telegram identity used a synthetic local signature, not the provider.
- Local source checks, build and compose validation are detailed in the
  evidence appendix, including failures corrected during development.

## What keeps Gate 1 at NO-GO

1. The complete integrated API/BFF/bot/runner, aggregate, restart/concurrency,
   outbox and configuration matrix and independent review remain incomplete.
2. The privileged connection still supports trusted auth, discovery, delivery
   and some owner-qualified bot reads. RLS is proved in designated restricted
   transactions, not as containment of arbitrary SQL through the privileged pool.
3. Destination source/lineage inventory is complete, but SSH identity trust,
   service secrets, forwarding trust, fresh-backup restore/incident procedure
   and current dependency-aware readiness still need a destination rehearsal.
4. Actual Telegram login, private `/start`, delivery and the complete R121
   accessibility checks remain open.
5. Remaining N10 benchmark/matched-cash-flow contracts are not completed by
   truthful report metadata. New provenance/reporting and reservation changes
   are verified source, not deployed evidence; old audit rows remain unchanged.

The next release step needs independently trusted SSH identity, a restored
destination backup rehearsal and real Telegram/provider proof, together with
the remaining integrated acceptance. Gate 1 checks happen before GO. Demo requires GO
plus a separate reviewed scope; live execution remains unavailable and requires
later explicit approval.

[Research and decisions](24_TENANT_INTEGRATION_RESEARCH.md) explain the chosen
approach and primary sources. [Master backlog](../tasks/00_MASTER_PLAN.md)
retains every R001-R123 acceptance item.
