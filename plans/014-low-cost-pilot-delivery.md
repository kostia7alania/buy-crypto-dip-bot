# Low-cost DRY_RUN pilot delivery

Started: 2026-10-02. Status: in progress.

## Objective and authority

The owner delegated implementation and hosting decisions overnight, through
07:00 Moscow on 2026-10-03. Deliver the smallest usable, verified DRY_RUN pilot
without new paid services. Existing capacity reported by the owner: Singapore
VPS with 1 GB RAM and Russia VPS with 8 GB RAM. These are not measured free RAM.

Start from clean main `20208bc22e17cb75886f970f911afbd1bb75db50`.
Do not touch the unrelated cafe checkout. Preserve the existing production
gate, audit history and neighboring VPN/services. No live trading or private
exchange credentials. An unavailable deployment is not a completed result.

## Hosting decision

Keep Nuxt public prerender and private CSR. Use free services when they reduce
total work, but do not rewrite the Node runner solely to avoid incremental
rent on an already-paid VPS. Cloudflare/Supabase remain an optional target,
not a prerequisite to this pilot or an already-completed migration. Measure
the existing deployment first. Keep API and database near each other.
Russian audience availability needs real network evidence, not a CDN promise.

## Work and progress

1. [complete] Inspect the existing destination without reading user rows or
   exposing credentials. Identify source/image, capacity, schema lineage and
   readiness. GitHub already has VPS SSH secrets; local SSH target is absent.
2. [complete] Independent bounded reviews identify remaining Gate 1 proof
   and the smallest working web/auth/onboarding flow.
3. [complete] Implement truthful partial/unavailable portfolio reporting
   and a real runner process-restart proof identified by those observations.
   Use focused checks for security, data preservation and user-visible flow.
4. [blocked on trusted host identity] Local restore fixture passes; fresh
   destination backup rehearsal is prepared but not run. Never migrate the
   actual database merely to discover whether it works.
5. [complete: NO-GO retained] Review evidence. Destination restore and provider
   conditions remain unproved; release gates are closed, not bypassed.
6. [in progress] Publish source, read back Actions and actual hosted state, then
   report URL, commit and remaining limitations separately.

## Initial observations

- Remote main matches the starting commit; working tree is clean.
- The public HTTPS root returns 200 with Cloudflare headers. This is not
  evidence of the deployed revision, auth, database or runner correctness.
- `DEPLOY_ENABLED=true`; `GATE1_APPROVED` remains absent.
- The latest workflow published an image but skipped deployment. The prior
  August 20 workflow did run its deploy job. Current destination is unknown.
- A read-only manual inventory workflow is the first infrastructure change;
  it must not stop/start containers, migrate, reveal environment values,
  print user rows or change shared proxy configuration.

## Destination evidence, 2026-10-02 19:51 UTC

[Inventory run 37056358829](https://github.com/kostia7alania/buy-crypto-dip-bot/actions/runs/37056358829)
completed without deployment or migration. API, bot and web run source
`becc46bb3b957c484324dbc3c517d5db7762be97`, image digest
`sha256:2bb3238968c2934726afaa344ee97962e21867076a7722e9acec5bf9600a14b2`.
PostgreSQL is 18.4, database size 89 MB; the three exact cost-first migration
hashes and timestamps match the frozen source history.

Host snapshot: 960 MB RAM, 261 MB available; 421 MB of 2047 MB swap used;
6.7 GB disk available. Project container memory totals approximately 201 MiB.
This is one observation, not capacity/load proof. API liveness and anonymous
orders return 200 and 401 respectively. Old `/health/ready` returns 401;
current dependency-aware readiness is not deployed.

The first inventory reused the existing unpinned SSH action configuration.
Further inventory/backup work now requires a host fingerprint matched against
an independently trusted key. The inventory has its own concurrency group so
it cannot replace a pending production deployment. No gate was opened.

## Verification in progress

- Inventory shell syntax, workflow YAML and repository lint passed (existing
  unrelated warnings remain); CI for `cf81d6c` succeeded and deploy was skipped.
- Production Compose configuration validated with dummy values using the
  already-installed Compose in Colima, without creating application services.
- A local PostgreSQL 18.6 cost-first fixture with an order and audit event
  passed the restore-migration verifier twice; original fields and journal
  survived. The verifier refuses non-local/non-rehearsal database URLs.
- Local port 55439 belonged to an unrelated Colima profile and was left alone.
  The disposable crypto proof database uses 55449, container
  `dipbot-pilot-pg18-20261002`. No production data is in that fixture.
- The fresh-backup rehearsal workflow and local-only verifier were independently
  reviewed. A driver query-string host override was found and fixed by refusing
  all DSN query/fragment components. Missing/mismatched SSH keys fail closed.
- A subsequent key-discovery run (37057984233) deliberately stopped before SSH
  execution because no trusted fingerprint is configured. Its observed host key
  is absent from available trusted local records; provider console requires
  login. Fresh production backup restoration remains pending independent SSH
  identity verification, not approved from `ssh-keyscan` alone.
- The new runner process regression passes on PostgreSQL 18.6: committed hold,
  SIGKILL, two fresh competing scheduler processes, one atomic settlement, then
  another cold start without duplication. Parent rerun passed 2/2 API PG cases.

## Source checkpoint and user-flow evidence, 2026-10-03

Published source: `8c2de0fb8d3499ff52f63dec71dff6131f992a8e`.
[CI 37083581968](https://github.com/kostia7alania/buy-crypto-dip-bot/actions/runs/37083581968)
passed, including native PostgreSQL lanes.
[Release 37083582029](https://github.com/kostia7alania/buy-crypto-dip-bot/actions/runs/37083582029)
verified source and published the image; the deploy job was skipped.
No production rollout follows from this push.

- Independent reviews covered report uncertainty/freshness, rejected-decision
  provenance, auth retry/privacy and the process-restart proof. A confirmed
  report freshness race was fixed: delayed later responses now invalidate
  earlier expired quotes at final assembly, with one shared dashboard cutoff.
- New rejections retain immutable effective config, market, risk and evaluation
  identifiers; old audit rows remain unchanged. Missing/partial valuations stay
  null; web, bot and digest label DRY_RUN and unmodelled fees/slippage.
- Uncached `pnpm check` passed: all package typechecks, lint and suites.
  Ordinary tests: API 170, bot 67, web 43, DB 68; shared/supporting suites passed.
  Native PostgreSQL-only cases are separate. `pnpm build` passed all 12 tasks.
- DB native PostgreSQL 18 lane passed 20/20. Release control-flow checks passed
  4/4. The release workflow now also runs the API PG lane after build and
  refuses SSH deployment without an independently verified host fingerprint.
- Real local BFF/API/PostgreSQL requests exercised two synthetic signed users:
  separate owners, public Bybit-backed pair creation, foreign 404, own config
  updates, cross-origin 403, private/no-store snapshot, logout and revoked-cookie
  refusal. This is not genuine Telegram provider authentication.
- Local browser at 390x844 and 1440x1000: create paused ETHUSDT, save/read back
  caps, see audit records, run a public-history backtest, then sign out. Mobile
  document width equals viewport width. API stop hid all private panels with an
  unavailable state; restart plus retry restored the same account and settings.
  Temporary synthetic browser cookies were removed through normal logout.
- Browser control stalled once before resuming; no success was inferred from
  the stalled call. Later visible DOM and screenshots confirmed the flow.

## Final runtime hardening

- Telegram send/edit requests have a five-second deadline including body reads.
  Finalizers abort unread bodies before clearing timers. Independent native-fetch
  loopback replay observed all six stalled 200/503 edit streams close, with no
  open streams/sockets after 5.2 seconds; no real Telegram request was involved.
- A stalled recipient retains retry/backoff while the next recipient is served.
  The bounded dispatcher now claims one row immediately before sending: a
  backlog no longer sits in SENDING until its lease expires. Telegram timeout
  ambiguity remains at-least-once delivery; duplicates are not claimed impossible.
- Real PostgreSQL contention now includes the bot cancel repository versus
  executor on one pending hold. Both wait on the actual order lock; exactly one
  state/hold/event wins, replay is inert and the other tenant stays unchanged.
  Parent reran the combined API PostgreSQL lane: 3/3 passed.
- Final uncached `pnpm check` passed again after transport fixes (API 176,
  bot 67, web 43, DB 68 ordinary tests plus supporting packages). Build passed
  all 12 tasks, rebuilding the changed API; final API PostgreSQL lane passed 3/3.

Destination restore, actual Telegram login/private-start/delivery,
credential-boundary acceptance and release sign-off remain separate blockers.
No service, secret or gate setting was purchased or changed.

## Accessibility follow-up

The next goal turn rechecked production variables/secrets: no trusted SSH
fingerprint or Gate 1 approval exists at repository or production-environment
scope. Independent R121 work fixed reproduced keyboard-focus losses, subtle
text/input contrast, forced-colors switch visibility and 320 px overflow.
Local browser evidence and remaining manual checks are recorded in
[web quality budgets](../docs/22_WEB_QUALITY_BUDGETS.md#local-accessibility-follow-up-2026-10-03).
R121 and deployment remain incomplete; no release gate was relaxed.

## Runner shutdown follow-up

R055 inspection found SIGTERM closing the runner pool without draining active
jobs or the HTTP server. One idempotent API shutdown owner now stops admission,
interrupts cosmetic waits, and drains active HTTP handlers/background work
before closing pools. The total deadline is 25 seconds, including pool closure;
timeout exits 1 with a redacted event. Docker grants the API 30 seconds.
Recurring runner jobs are single-flight per process. An already-started durable
claim/send finishes; no next claim starts after the stop flag is observed.
Pending holds and outbox leases retain their existing durable recovery model.

- Native PostgreSQL 18 process proof passed: SIGKILL recovery, two competing
  fresh runners, SIGTERM while one claim waits on the actual row lock, one
  committed settlement, clean drain exit, then an inert cold replay.
- Actual API process with enabled runner reached readiness, then SIGTERM
  produced both drain-completed events and exit 0; the port stopped serving.
- Actual HTTP login with a synthetic signature waited on a PostgreSQL users
  table lock. After SIGTERM the runner finished but API remained alive until
  the lock was released; HTTP 200, one committed session and exit 0 followed.
  No real Telegram identity or provider call was involved.
- Focused lifecycle tests protect idempotence, pool-close ordering, disconnected
  handlers and the total timeout; they are not a general coverage expansion.

Independent review against original plan 008 found R052/R057/R058 already meet
their source acceptance. A matched-cash-flow rewrite is not an R058 requirement
and R101 was originally after Gate 1, not an added release blocker. Current
backlog/status wording is corrected; destination/provider gates remain unchanged.
The bounded R101 pass exposes actual consumed/replay history, missing hours,
unconfirmed candles and original page clocks/cache age. The existing algorithm
is unchanged; equal-capital purchase schedules, PnL definition, unmodelled costs
and missing-data behavior are disclosed. Malformed history yields no result;
short/gappy/provisional history stays explicitly incomplete.

Final checks for this follow-up:

- Uncached `pnpm check` passed: API 192, bot 67, web 43 and DB 68 ordinary tests
  plus supporting packages; native PostgreSQL checks are separate. The first
  attempt stopped on one newly edited line's formatting, corrected before rerun.
- `pnpm build` passed 12/12 tasks; changed API and web rebuilt. DB native PG18
  passed 20/20, and the final API PG18 lane passed 3/3.
- Startup review found cancellation was initially delayed until preparation
  returned. Signal propagation and admission checks now stop seeding/cleanup
  and initial scheduling after migration. Actual SIGINT during the migration
  advisory lock wait exited 0 without starting any of those stages or HTTP.
- Holding that migration lock to test the global deadline instead reached the
  existing five-second migration lock timeout first, correctly exiting 1. It
  is not counted as proof of the 25-second global deadline. A separate admitted
  HTTP request with an incomplete body then proved the actual global deadline:
  runner drained, `API_SHUTDOWN_TIMED_OUT`, exit 1 after 25,030 ms.
- Production API/BFF builds with disposable PostgreSQL and a synthetic local
  identity fetched public Bybit BTCUSDT history: 361 input candles, 24 warm-up,
  337 replay, no missing hours and one unconfirmed current candle. Repeated
  runs retained original page clocks and the incomplete status through cache.
- Browser verified the same report and expanded calculation/source disclosure
  at 1280 px; 390 and 320 px had no page/control overflow. Logout removed the
  private report. Synthetic cookies and temporary viewport overrides were removed.
  Screenshots: `/tmp/dipbot-pilot-proof-20261003/backtest-method-desktop.png` and
  `/tmp/dipbot-pilot-proof-20261003/backtest-history-mobile.png` (local only).

### Current runtime ownership

| Job | Runtime owner / cadence | Stop and restart contract |
| --- | --- | --- |
| Strategy evaluation | API runner, immediate then 30 seconds | Per-process single-flight; stop between symbols/strategies, finish already-started reservation; durable evaluations/holds survive restart |
| Due orders | API runner, 3 seconds | Atomic DB claim/settlement; stop before the next claim, drain current claim; fresh runner discovers due PENDING orders |
| Notification outbox | API runner, immediate then 5 seconds, at most 20 attempts | One just-in-time claim per send; stop before next claim, finish bounded send and durable result; recover stale leases, external delivery at-least-once |
| Daily digest | API runner, check every 10 minutes during 06:00 UTC | Per-process single-flight; stop between recipients; existing enqueue/dedupe retained; reproducible financial cutoff remains R059 |
| Cosmetic countdown | API runner, per-order 1-second loop | Abort waits at shutdown; never executes orders; distributed ownership/restart display recovery and shared budgets remain R053/R054 |
| Expired sessions | API runner, every 6 hours | Single-flight cleanup drains before runner pool closes; future interval retries after restart |
| Telegram polling / heartbeat | Separate bot process; grammY polling, heartbeat every 30 seconds | Heartbeat interval clears when polling returns; coordinated signal drain and in-flight heartbeat completion are not implemented by this API change |
| Generic outbox / minute-slot scheduler | Preserved schema only; no active second dispatcher | Must not run beside the current runner/outbox during a future cutover |
| Private exchange reconciliation | None; not implemented | No exchange order execution or reconciliation is enabled |

The deployment runs one API runner and one polling bot. DB atomicity protects
settlement under overlapping processes, but it does not elect one global owner
for every cosmetic/notification job. No horizontal-scaling claim follows.
