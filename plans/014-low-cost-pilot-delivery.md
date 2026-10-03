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
| Telegram polling / heartbeat | Separate bot process; grammY polling, heartbeat every 30 seconds after polling setup | Bot signal owner stops polling immediately, drains the accepted batch before stop acknowledgement/pool close, and aborts/awaits single-flight heartbeat; total 25-second deadline, Docker grace 30 seconds |
| Generic outbox / minute-slot scheduler | Preserved schema only; no active second dispatcher | Must not run beside the current runner/outbox during a future cutover |
| Private exchange reconciliation | None; not implemented | No exchange order execution or reconciliation is enabled |

The deployment runs one API runner and one polling bot. DB atomicity protects
settlement under overlapping processes, but it does not elect one global owner
for every cosmetic/notification job. No horizontal-scaling claim follows.

## Polling bot shutdown follow-up

The 05:30 MSK heartbeat resumed independent R056 work with clean main at
`3c8175dc782a36d41de316f707ceb7e6e8a1136f`. Existing API changes are not repeated.
That baseline bot had no signal drain, never closed its DB pool, and cleared the
heartbeat interval without aborting or awaiting its current request.

Installed grammY 1.44 source confirms `stop()` does not wait for middleware and
sends a final update acknowledgement using its captured offset. The new runtime
stops polling immediately but defers this signal-less acknowledgement until the
accepted batch successfully drains. Polling failure or the total 25-second
deadline refuses the acknowledgement; the deadline exits 1. Successful drain
aborts/awaits heartbeat and closes the pool before exit 0. Docker grants 30 seconds.
The captured offset is intentionally unchanged: already-drained batch-tail
updates can replay. This is not exactly-once processing or provider delivery.

Initialization is explicitly abortable. Command-hint registration moved out of
the factory's detached request into an awaited, cancellable five-second startup
step; failures remain nonfatal. Heartbeat starts only after polling setup and
has a five-second request deadline, single-flight guard and abortable stop.
The original polling promise is drained directly, without a shutdown/finally
cycle. Independent read-only review found no blocking lifecycle defect.

Concrete local evidence, October 3 around 05:53 MSK:

- Five runtime regressions cover accepted-batch ordering, a stalled handler,
  polling failure, setup interruption and initialization cancellation. The
  heartbeat regression covers stalled IO, retry cadence and idempotent stop.
- A real child process used production command handlers, runtime and DB helpers,
  installed grammY HTTP transport redirected to loopback, and disposable native
  PostgreSQL 18. A private `/start` upsert waited on a real users-row lock when
  SIGTERM arrived. No reply, acknowledgement or early exit occurred while held.
  Unlocking completed both batch commands, two security audit events, replies,
  final acknowledgement, pool close and exit 0 (336 ms including 300 ms hold).
- Keeping that lock held produced `BOT_SHUTDOWN_TIMED_OUT`, exit 1 at 25,020 ms,
  no reply or final acknowledgement and no graceful-pool-close claim. PostgreSQL
  rolled back the interrupted transaction; the two earlier audit events remained
  unchanged. No bot connections remained after each child exited.
- SIGINT during stalled `getMe` exited 0 in 9 ms with no polling/heartbeat.
  SIGTERM during command registration exited 0 in 7 ms. SIGTERM during grammY's
  `deleteWebhook` setup aborts its retry wait and deliberately reports exit 1
  (9 ms); no polling/heartbeat or update acknowledgement started.
- Earlier probe errors were fixture-specific: native fetch rejects grammY's
  polyfill signal, and raw `getMe` takes a signal without a payload. Those probes
  were corrected before the final real-transport run. The first probe also
  exposed the pre-existing detached command registration using a synthetic
  invalid token; it was removed from construction before the final loopback run.
  No real identity or Telegram delivery is established by these checks.
- Local proof scripts are `/tmp/dipbot-pilot-proof-20261003/bot-drain-child.mjs`
  and `bot-drain-proof.mjs`; they require their disposable fixture database.
- Final `pnpm check` passed: Gate 1 boundary/release checks and lint reran, bot
  typecheck and all 73 bot tests reran; unchanged package checks reused Turbo
  cache. `pnpm build` passed 12/12 tasks with the changed bot freshly bundled.
  Existing lint/build warnings remain; no new dependency or warning was added.

No dependencies, command semantics, exchange path or release authorization changed.
R056 remains PARTIAL because distributed countdown ownership/recovery is separate.
Production variables were refreshed: only `DEPLOY_ENABLED=true`, production
environment variables empty. Trusted SSH identity, destination restore rehearsal,
actual provider flow and Gate 1 acceptance remain open. Stop autonomous edits at
07:00 MSK.

## Final readiness follow-up

At 06:35 MSK, clean main `9872498` was reproduced against a disposable PostgreSQL
18 and the actual API bundle with runner disabled: after stopping PostgreSQL,
`/health/ready` still returned 200 with `database: ready`. The migration success
flag is not current connectivity evidence. Add a bounded, shared on-demand DB
probe before successful readiness, retain process-only liveness and all auth
guards, and re-read lifecycle state after awaiting the probe. Short caching must
bound connection churn without claiming instantaneous outage detection. Verify
outage/recovery and blocked network behavior, then publish before 07:00 MSK.
No production access, migration, runner schedule or release approval changes.

Implemented an ephemeral PostgreSQL connectivity/query probe with one-second
connect/query limits and a two-second total deadline that destroys its owned
socket, including stalled cleanup. Success is decided after cleanup and error
events cannot terminate the process. No app pool or permanent connection is
added. The API shares an in-flight probe and caches either outcome for five
seconds; checks are request-driven, not another background scheduler. Readiness
is `no-store`, and a completed probe cannot restore readiness after shutdown.

Verified at about 06:43 MSK:

- The same real production-build API process and disposable PG18 changed
  `200 -> 503 -> 200` through actual DB stop/start after cache expiry. Liveness
  stayed 200, and unauthenticated `/strategies` stayed 401.
- Loopback PostgreSQL wire fixtures held connect, query and connection cleanup.
  They returned false after 1,003 ms, 1,004 ms and 2,001 ms respectively. The
  cleanup case reaches the query and succeeds there, then withholds socket
  closure, proving the total deadline includes cleanup.
- The first fixture incorrectly expected the global two-second deadline for
  connection setup; the earlier one-second connect deadline correctly won.
  The expectation was fixed before the final successful run. An initial API
  launch also failed while PG was not yet accepting connections; it was retried
  only after `pg_isready` succeeded. Neither failure is counted as passing proof.
- Three focused regressions cover single-flight/cache recovery, outage/liveness
  separation and shutdown during a successful probe. `pnpm check` and the full
  build passed. Changed API/DB tests reran; unchanged tests used Turbo cache.
- Independent read-only review found no concrete safety regression. Local manual
  script: `/tmp/dipbot-pilot-proof-20261003/readiness-proof.mjs`.

This proves recent connectivity/queryability only, not shared application-pool
health, current schema integrity, writability or runner progress. Five-second
cached observations plus probe latency are intentional; event-loop stalls can
delay any JavaScript deadline. Gate 1 remains NO-GO and no deployment is claimed.

## Owner-authorized continuation after the overnight deadline

On 2026-10-03 the owner explicitly asked to continue despite the elapsed
overnight deadline. This renews implementation/deployment work, not permission
for paid services, real trades, deleting data or bypassing authentication.

Fresh remote fetch still matches clean main `1b71c66`. The published website
returns 200, `/api/auth/me` returns an unauthenticated user, and private snapshot,
strategies, orders and risk endpoints return 401 with `private, no-store`.
The old dashboard labels that missing snapshot `API Offline`; this is not
evidence of an API outage. Its public runtime configuration has an empty
`telegramBotUsername`, so no login widget appears. Production Compose now
requires that value during the existing pre-stop config validation. The correct
username/token pairing and BotFather domain still need destination verification.

The saved GitHub CLI credential is invalid, but authenticated browser and GitHub
connector access work. Kamatera currently presents its login page; the owner was
asked to sign in there, not to transmit a password. Available local trusted SSH
records still do not establish the destination identity. No server or release
gate was changed while that access remains unresolved.

Targeted verification: existing release control-flow checks passed 4/4, lint
passed with existing warnings, and the DRY_RUN boundary check passed. Real
Docker Compose v5.1.4 in the existing default Colima profile rejected unset and
empty usernames and accepted a fixture username, without creating app services.
The temporarily started profile was stopped afterwards; neighboring profiles
were not changed. Independent read-only review found no new source-level P0/P1
for this bounded single-runner pilot. The privileged pool is not a demonstrated
tenant bypass in the inspected owner-qualified paths; ADR 009's credential
separation acceptance remains open, not silently waived.
