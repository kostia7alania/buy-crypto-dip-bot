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
