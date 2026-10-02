# ExecPlan 012: Durable dry-run reservation lifecycle

Started: 2026-09-16. Status: complete for the bounded local slice.

Evidence wording corrected on 2026-10-02: the native PostgreSQL test uses
multiple pools inside one Node process, not multiple application processes.

## Objective

Deliver the bounded N10 reservation-correctness slice and the matching N07
failure, concurrency and restart proof. A risk approval must atomically create
one durable budget hold and one `PENDING` dry-run order. Completion consumes
the hold; cancellation releases it. Strategy edits must not rewrite evidence
captured by an active reservation.

## Scope and boundaries

- Add only a forward migration; do not edit either original migration history.
- Keep execution `DRY_RUN`-only and use public market data. No provider login,
  exchange credentials, Telegram delivery, deploy, push or external action.
- Reuse the personal-tenant transaction and forced-RLS model.
- Touch DB, API runner and existing bot transition tests only. Add no dependency
  and do not activate the preserved generic ledger/outbox dispatcher.
- This slice can advance R047-R051 locally, but does not complete N07, N10 or
  change the Gate 1 `NO-GO` verdict.

## Sequence

1. Research PostgreSQL 18 row locking, transactions, deferred constraint
   triggers and RLS behavior from official documentation.
2. Add an owner-scoped immutable reservation ledger and enforce order/hold
   lifecycle consistency at transaction commit.
3. Serialize reservation decisions on the strategy row, persist config and
   public-market snapshots, and reuse the existing evaluation-key uniqueness.
4. Route the runner through one atomic repository operation; retain existing
   risk audit and notification contracts.
5. Prove rollback, release, consume, duplicate suppression and config-snapshot
   retention locally. On disposable PostgreSQL 18, prove competing-connection
   serialization and completion through a newly opened connection pool.
6. Run the repository checks/build, update evidence/backlog/status honestly,
   and save local commits without push or deployment.

## Acceptance record

- A forward migration creates an owner-scoped reservation ledger, backfills
  valid legacy `PENDING` orders, and defers order/reservation consistency checks
  until commit. Evidence columns cannot be rewritten and an active hold can
  transition only once to `CONSUMED` or `RELEASED`.
- One owner transaction locks the strategy row, re-reads its active config,
  evaluates the public ticker, totals completed and reserved spend, and commits
  the order, hold, config/market/risk snapshot and approval audit together.
- Cancellation releases the hold; scheduled or buy-now completion consumes it.
  The exact evaluation/config/market tuple is duplicate-suppressed after a
  release, while later strategy edits do not mutate captured evidence.
- `pnpm check` and `pnpm build` passed. The ordinary API, bot and DB suites
  passed, with PostgreSQL-only cases skipped in that lane as designed.
- A disposable loopback-only `postgres:18-alpine` instance passed the existing
  16-case PostgreSQL contract suite and the two-pool reservation race
  plus reopened-pool settlement case in one application process. These do not
  prove process-crash recovery or startup discovery. The container was removed after
  verification; no persistent volume, provider credential or external action
  was used.
- The first cold parallel `pnpm check` attempt exposed two five-second PGlite
  test timeouts. Both exact files passed alone and the complete warmed check
  then passed; no assertion or production failure was hidden.
- N07 and N10 remain incomplete outside this slice. Gate 1 stays `NO-GO`; no
  push, deployment, Telegram delivery, Demo request or live order occurred.
