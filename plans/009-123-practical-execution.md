# ExecPlan 009 — Practical execution of backlog R001–R123

> Recovery update, 2026-09-12: [plan 010](010-recovery-and-project-status.md) resumes the four final review findings. [Project status](../docs/23_PROJECT_STATUS.md) owns the current gate verdict and [the master backlog](../tasks/00_MASTER_PLAN.md) owns ticket states. The records below describe the older local source, not newer remote main.

Date: 2026-08-02\
Status: **in progress**\
Current gate: **Gate 1 NO-GO; `DRY_RUN` only**

## Goal

Turn the research backlog in `plans/008-123-task-night-research-loop.md` into
reviewable production work in dependency order. A ticket is counted as done
only when its acceptance outcome exists and the smallest relevant verification
has passed. Research, a document, or a scaffold alone does not count as an
implemented runtime outcome.

The backlog contains external outcomes that cannot be manufactured inside this
repository: customer interviews, qualified legal review, Bybit/Broker approval,
and a future live-pilot decision. This plan prepares their evidence and gates,
but keeps them open until the named external party actually completes them.

## Working-tree boundary

This execution starts from `main` at `cedc6df` with extensive pre-existing,
uncommitted Gate 1, Safety Ledger, test-harness, documentation, and research
changes. Those changes are preserved as one shared in-progress program. Each
batch is kept narrow and its touched paths are recorded here so unrelated user
work is not overwritten.

## Non-negotiable safety boundaries

- `DRY_RUN` remains the only executable mode until an independent Gate 1 GO.
- No private Bybit credential storage, signing, or order submission is added
  while Gate 1 is NO-GO.
- No futures, leverage, martingale, withdrawals, transfers, or meme coins.
- No secret values in source, migrations, logs, fixtures, or evidence.
- No deletion or truncation endpoint for audit history.
- Database ownership, authentication, order/risk, migration, and BFF changes
  receive targeted automated coverage even if broader checks are deferred.

## Delivery waves

### Wave 0 — one truth and one evidence identity

Tickets: R001–R003.

- Make this plan the current implementation record and retain dossier 18 as
  the normative Gate 1 NO-GO verdict.
- Record exact revision, catalog version, proof commands, and decision date in
  every future gate decision.
- Keep all private-adapter work mechanically blocked by the recorded verdict.

### Wave 1 — tenant catalog and fail-closed foundation

Tickets: R004–R012 and R018–R036.

- Close same-owner order/strategy integrity and null-strategy preflight.
- Converge Drizzle schema, journalled migrations, manual legacy decision, and
  clean-install/upgrade catalogs.
- Validate non-local configuration before bind; migrate before traffic and
  runner work; expose separate liveness and dependency-aware readiness.
- Harden session, browser, bot actor, audit, scheduling, and delivery evidence
  in dependency-sized batches.

### Wave 2 — independent Gate 1 proof

Tickets: R037–R041.

- Run the complete PostgreSQL 18 A/B, corruption, concurrency, restart,
  migration-failure, bot, runner, aggregate, and deployment-readiness matrix.
- Publish one immutable evidence manifest and request independent review.
- Change Gate 1 to GO only if every named blocker is closed.

### Wave 3 — current product/runtime truth

Tickets: R042–R063 and R083–R123 whose dependencies are satisfied.

- Harden public market-data validation, freshness, ledger terminology, risk
  evidence, claims, UX states, content, privacy, accessibility, performance,
  support, and research operations without implying live execution.
- External interview/legal outcomes remain open until actually performed.

### Wave 4 — Bybit Demo only after Gate 1 GO

Tickets: R064–R081.

- Implement the narrow user-provisioned Demo path only after Wave 2 records GO.
- Keep hosts allowlisted, permissions spot-trade-only, requests non-arbitrary,
  ambiguous submissions `UNKNOWN`, and fills evidence-driven.
- `LIVE` remains unavailable and disabled by construction.

### Wave 5 — explicitly later decisions

Tickets: R013, R016, R082, R120 and any hosted/live pilot.

These require a separately recorded architecture, approval, or qualified
external decision and are not silently reclassified as implementation work.

## Progress log

### 2026-08-02 — practical execution opened

- Baseline confirmed: `main` at `cedc6df`, Node `v26.5.0`, pnpm `11.0.0`.
- Dossier 18 remains normative: Gate 1 NO-GO and private Bybit work blocked.
- First batch selected: R001–R009 and R018–R021.
- Pre-existing dirty worktree recorded and preserved.

### 2026-08-02 — foundation batch implemented

- R001 and R003: dossier 18 is the one normative NO-GO verdict; private Bybit
  work remains blocked. R002 awaits an immutable commit and independent reviewer.
- R004–R009: final tenant catalog, complete preflight, same-owner FK, declared
  schema, journalled contract authority, and PostgreSQL 18 catalog equivalence
  are implemented.
- R014 and R017: order-to-strategy reads are owner-qualified and non-DRY_RUN
  persisted execution state is rejected.
- R015: private-by-default API routing plus typed `requireUser` ownership makes
  omission of tenant context fail closed and review-detectable.
- R018–R020 and R022: runtime classification/service config fail closed; API
  migrates and initializes the runner before binding; BFF/bot require service
  auth outside local development.
- R019 validates non-local API, web, and bot configuration before traffic or
  background work, including URL protocols, PostgreSQL connection, service
  authentication, Telegram dependency, port, and DRY_RUN-only mode.
- R021 is partial: schema/database/runner readiness exists and non-local API
  startup requires Telegram configuration; deeper bot delivery freshness stays open.
- R023–R027: authoritative `me`, truthful logout failure, session lifecycle,
  replay prevention, `__Host-` cookie, and same-origin unsafe-method boundary
  are implemented, including durable login throttling and structured rejection
  audit.
- R029–R034: verified private-chat delivery binding, bot session kind, durable
  notification outbox, runner single-flight/pending uniqueness, and atomic
  state/evidence transitions are implemented for the covered paths.
- R036: a required PostgreSQL 18 CI lane now exists for clean install and real
  upgrade to the same catalog. Its last local proof ended at `0010`; the exact
  `0014` catalog, R037–R039 full matrix, and independent review remain open.
- The repository-wide `pnpm check` now passes after the foundation batch:
  typechecking, lint, and every workspace test task completed successfully.
  PostgreSQL 18 remains a separate required lane and is not inferred from the
  fast PGlite suite.

### 2026-08-02 — public truth and privacy batch implemented

- R083–R090: a dated phase/claims registry is now the publishing contract;
  public copy separates self-hosting from unavailable hosted SaaS, removes
  simulation-equivalence and absolute safety claims, explains Telegram
  eligibility/delivery truth, publishes the Safety Ledger glossary, and adds a
  dated "What works today" statement.
- R104 is partial: the nonexistent `$0` Offer was removed from structured data,
  but external rich-result validation still needs the deployed page.
- R105–R106: public pages now state what DRY_RUN cannot prove and why the
  current build must not receive withdrawal, transfer, margin, derivatives, or
  any other exchange credential.
- R109: GA4 is default-off, requires an actual configured measurement ID plus
  explicit consent, exposes an equally available withdrawal control, and
  declares a minimized page-traffic purpose before loading the third party.
- The web typecheck, 22 web tests, targeted Biome check, and `git diff --check`
  pass after this batch.

### 2026-08-02 — support, privacy, accessibility, and budgets batch

- R118: the public support page and private GitHub security-advisory policy now
  distinguish best-effort self-hosted support from nonexistent hosted SLA,
  status, on-call, and incident channels.
- R119: the public phase-aware privacy notice separates current session,
  consented analytics, and Telegram/outbox facts from unavailable hosted and
  exchange phases; it states retention/deletion gaps instead of inventing a
  promise. Defensive referrer, permissions, and content-type headers are set.
- R121 is partial: a keyboard skip link and focusable main landmark were added,
  and the static audit is recorded; browser accessibility tree, contrast,
  screen-reader, forced-colors, zoom, and keyboard flow evidence remains open.
- R122 is partial: production build transfer baselines, route/third-party
  budgets, no-JS policy, and a measurement procedure are recorded. Chrome
  DevTools MCP was unavailable, so no CWV value is claimed.
- R123: design-system owner/version, governed component inventory, canonical
  status semantics, non-color requirements, review checklist, and exception
  register are now explicit.
- Repository-wide `pnpm check` and the final Nuxt production build pass after
  this batch; build-only sourcemap warnings remain non-failing.

### 2026-08-02 — strategy and ledger truth batch

- R091: all landing pages share an available primary CTA to the dry-run console
  and a secondary in-page explanation; no hosted/live CTA is presented.
- R094: strategy edit mode now previews per-buy/cooldown constrained maximum
  order counts and USDT outlay for rolling 24h/7d before save, with explicit
  units, DRY_RUN mode, and non-forecast limitations.
- R097: the order ledger now separates local source, persisted mode, and local
  status; only `COMPLETED` is labeled Simulated, and loading, unauthorized/error,
  empty, queued, canceled, simulated, unknown, and freshness evidence differ.
- R100: pause/activate disables duplicate submission, exposes pending,
  confirmed, and failed states, and explains that pause stops new evaluation
  without silently canceling an existing pending DRY_RUN order.
- R108 is partial: comparison copy is now neutral about DCA/grid failure modes,
  but dated source presentation still needs the canonical content map.
- Repository-wide `pnpm check`, the Nuxt production build, and
  `git diff --check` pass after this batch. The build reports only the existing
  non-failing sourcemap warnings.

### 2026-08-02 — R026 login abuse boundary implemented

- Preserve the existing five-minute, one-use Telegram presentation contract.
- Before parsing or signature work, consume a durable source window keyed only
  by an HMAC pseudonym produced by the trusted BFF; after signature verification,
  consume a separately namespaced HMAC of the verified Telegram identity.
- Source policy is 10 attempts per fixed 60-second window; verified-user
  policy is 5. The first excess attempt blocks that key for 300 seconds, all
  state transitions serialize in PostgreSQL, and `Retry-After` is the ceiling
  of the remaining database-backed block duration.
- A throttled request emits the V1 `AUTH_LOGIN_REJECTED/RATE_LIMITED` event with
  only limiter kind and retry seconds. Raw IPs, Telegram payloads, signatures,
  service keys, bot tokens, and derived abuse keys stay out of audit and logs.
- Shared audit tests (10), PGlite migration tests (12), focused API tests (49),
  BFF utility tests (4), and all four affected workspace typechecks pass.

### 2026-08-10 — 20-outcome MVP night wave

This wave counts runtime or user outcomes, not generated tasks and not test
commands. Tests remain supporting evidence only. External outcomes are never
synthetically marked complete.

| # | Backlog | Practical outcome | State |
| --- | --- | --- | --- |
| 1 | R025 | Complete observable session lifetime, inventory, revocation and cleanup | DONE |
| 2 | R026 | One-use Telegram Login plus durable pseudonymous abuse throttling | DONE |
| 3 | R028 | Correlated allowlist operational logging across API, bot and BFF | DONE |
| 4 | R029 | Private `/start` is the only notification eligibility binding | DONE |
| 5 | R030–R031 | Owner-scoped bot mutations and bounded correlated command sessions | DONE |
| 6 | R032 | Durable truthful notification delivery/outbox lifecycle | DONE |
| 7 | R033 | Single-flight scheduling plus one-pending-order database invariant | DONE |
| 8 | R034 | Atomic state transition and immutable V1 evidence | DONE |
| 9 | R012,R035 | All V0/V1 audit history append-only through catalog `0013` | DONE — exact PG18 `0014` proof passed |
| 10 | R021 | Bot-only heartbeat proof unavailable to the web BFF | DONE IN SOURCE |
| 11 | R002,R036,R039 | One exact catalog/revision/proof identity | PARTIAL — commit and final reviewer open |
| 12 | R042–R043 | Typed public market data with source/receipt time, TTL and stale rejection | DONE IN SOURCE — 3 review loops CLEAN |
| 13 | R060 | Typed minimal notification render inputs instead of full message snapshots | DONE — exact PG18 `0014` proof passed |
| 14 | R062 | Versioned escaped Telegram rendering with safe fallback evidence | DONE IN SOURCE |
| 15 | R092 | First-run bounded setup-to-evidence journey | DONE IN SOURCE |
| 16 | R121 | Complete stateful-finance accessibility behavior | PARTIAL |
| 17 | R052 | Distinct simulated versus future accepted/filled/unknown states | BLOCKED BY GATE 1/R050 |
| 18 | R047–R051 | Immutable decision snapshot/config/idempotency/reservation lifecycle | BLOCKED BY GATE 1 |
| 19 | R057–R058,R101 | Complete/fresh PnL and benchmark methodology | BLOCKED BY GATE 1 |
| 20 | R095–R096 | Human-readable decision detail with sanitized progressive disclosure | BLOCKED BY GATE 1/R047–R048 |

Current count for this 20-outcome wave is `14 DONE · 2 PARTIAL · 4 BLOCKED`.
The exact PostgreSQL 18 catalog lane passed through `0014`; the remaining
pre-Gate work in this wave is immutable proof identity/final review and R121
real-browser accessibility evidence. Private exchange work stays mechanically
blocked.

### 2026-08-10 — market truth, notification privacy and proof journey

- R021: non-local bot freshness now requires `API_KEY` plus a distinct
  32-character-or-longer bot heartbeat secret. Production Compose passes an
  explicit per-service environment allowlist, so the BFF receives neither that
  secret nor the Telegram bot token.
- R042–R043: official V5 ticker and kline envelopes are validated before use.
  Non-finite/negative/internally inconsistent values, symbol mismatch, stale or
  future responses, duplicate/future/cursor-violating candles, upstream errors,
  and transport failures have typed fail-closed outcomes. Ticker and kline
  snapshots carry source/receipt time, age and TTL.
- R060/R062: catalog `0014_bouncy_zuras` removes durable plaintext notification
  messages in favor of a classified versioned template, bounded typed inputs,
  and correlation. Legacy undelivered plaintext becomes `SKIPPED`; renderer and
  direct bot surfaces escape untrusted values and retain a safe fallback.
- R092: the dashboard composes existing widgets into bounded setup → decision
  evidence → limitations → local ledger. Unavailable runtime safety facts show
  `UNKNOWN`; no approved-pair claim is made before R070/R093.
- R121: the stateful dashboard uses one polite announcer for user outcomes,
  distinct loading/error/empty/data states, semantic lists and tables,
  keyboard-focusable regions, and forced-colors/reduced-motion fallbacks. Real
  Safari VoiceOver, 200% zoom, and complete keyboard traversal remain open.
- R036: an isolated PostgreSQL `18.4` run passed 7/7 exact-catalog cases through
  `0014`, including clean-install/real-upgrade equivalence, same-owner
  enforcement, V0 preservation, V1 envelope, and all-version audit immutability.

## Verification record

Evidence and exact outcomes are recorded in
`docs/20_GATE1_IMPLEMENTATION_EVIDENCE.md`. Final gate proof still requires the
exact committed revision and the remaining full matrix; it is not inferred
from either PGlite or catalog equivalence alone.

## Current ticket state

The reconciled R001-R123 index is maintained in
[the master backlog](../tasks/00_MASTER_PLAN.md). The 2026-08-10 wave counts
above are historical local outcomes, not the completion count for the full
program. Gate 1 remains NO-GO; the two source/catalog lines need integration.
