# Project status

Reviewed: 2026-09-14. This document owns the current readiness verdict.
Historical plans preserve their original evidence and do not override it.

**Gate 1: NO-GO. Execution: DRY_RUN only. Hosted, edge, Demo and live launch
remain unapproved.**

## Current source

Integration branch: `codex/tenant-integration-20260914`. It combines recovery
`d183fa2` with the relevant cost-first foundation from main
`becc46bb3b957c484324dbc3c517d5db7762be97`, fetched again on 2026-09-14.
Recovery is preserved on `codex/gate1-recovery-20260912`; its code snapshot is
`31212e159d8da7b5ccebb52b57f5b794db156ec2`.

The interrupted work was located in task "Составить и выполнить 20 задач",
ID `019fb904-e09c-7672-acae-ad417f4a95ae`. Its four outstanding review fixes were
recovered on September 12. The September 14 integration preserves them and
adds the forward migration and runtime convergence described below.

The running production revision, catalog and provider configuration have not
been inspected. No deployment or provider-delivery claim follows from this
local source integration. Exact source/check identities are recorded in
[implementation evidence](20_GATE1_IMPLEMENTATION_EVIDENCE.md).

## What changed in this integration

| Area | Current local result | Remaining acceptance |
| --- | --- | --- |
| Migration history | Strict recognition of both original histories; guarded transactional bridges to `gate1_tenants_v1`; one authority for subsequent forward SQL | Destination catalog review and explicit decisions for any unresolved ownership |
| Data preservation | Original migration journals preserved; original audit fields and numeric amounts retained; quarantine strategy/order preflight refuses without writes | Real destination inventory and restored-backup comparison |
| Tenant access | Personal tenants, memberships, owner constraints, forced RLS and restricted transactions for owned API routes and bot/runner mutations | Full integrated matrix, independent review and service-credential separation |
| Login | Recovery opaque sessions, replay/abuse, CSRF, revocation and authoritative BFF retained | Real Telegram login/private start/provider smoke; OIDC later |
| Dashboard | One private snapshot, visibility-aware refresh, account invalidation, 401 pause; first-request cancellation race fixed | Full accessibility/mobile/provider checks in N09 |
| Audit and Telegram | Recovery immutable versioned audit, private notification binding, typed outbox and digest retained | Full restart/delivery matrix and fairness/reservation work |
| Release | Immutable digest, commit-pinned files, separate migration service, writer quiescence, backup and readiness ordering; no automatic old-image restart after attempted DDL | Restore/incident rehearsal and production approval |
| Public web | Public prerender; private CSR/noindex/no-store; truthful signed-out backtest copy | Published revision and claims/analytics QA |
| Platform | Cloudflare/Supabase remain targets | OIDC/JWT, edge entries, webhook, Cron/Queues and cutover proof |

The migration retains main's event ledger, generic outbox and evaluation keys
as data/schema. It does not activate main's minute-slot/generic dispatch path
alongside recovery's runner/outbox. Decision provenance, reservations and
scheduler cutover remain N10/N11. Identity profile fields are compatibility
snapshots until a future canonical OIDC/profile contract is implemented.

## Verified locally

- PostgreSQL 18 contract lane: clean install, both known upgrades, catalog
  equivalence, audit/numeric preservation, quarantine refusal, concurrent and
  repeat execution, modified history refusal, critical RLS drift refusal and
  subsequent forward migration atomicity.
- Restricted-role pool reuse: A, forbidden foreign write, rollback, B, missing
  context and restored connection state. No developer or production DB used.
- API snapshot A/B isolation and anonymous refusal; BFF session forwarding,
  private caching headers and upstream outage behavior.
- Browser with fixtures: immediate first A snapshot, logout/re-login, one
  widget/callback, B remains B after a delayed A result, no refreshes during
  179 seconds of simulated hidden visibility, and private data cleared on 401.
  This does not prove real Telegram authentication or delivery.
- Local source checks, build and compose validation are detailed in the
  evidence appendix, including failures corrected during development.

## What keeps Gate 1 at NO-GO

1. The complete integrated API/BFF/bot/runner, aggregate, restart/concurrency,
   outbox and configuration matrix and independent review remain incomplete.
2. The privileged connection still supports trusted auth, discovery, delivery
   and some owner-qualified bot reads. RLS is proved in designated restricted
   transactions, not as containment of arbitrary SQL through the privileged pool.
3. Actual production catalog, secrets, forwarding trust, restore/incident
   procedure and dependency-aware readiness need a destination rehearsal.
4. Actual Telegram login, private `/start`, delivery and the complete R121
   accessibility checks remain open.
5. Reservation accounting, immutable decision/market/config provenance and
   truthful partial/stale reporting remain explicit N10 work.

The next deliverable is integrated proof and reservation correctness. Gate 1
checks happen before GO. Demo requires GO plus a separate reviewed scope;
live execution remains unavailable and requires later explicit approval.

[Research and decisions](24_TENANT_INTEGRATION_RESEARCH.md) explain the chosen
approach and primary sources. [Master backlog](../tasks/00_MASTER_PLAN.md)
retains every R001-R123 acceptance item.
