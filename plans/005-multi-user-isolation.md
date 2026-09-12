# ExecPlan 005 — Gate 1: multi-user DRY_RUN isolation

> Current-status notice, 2026-09-12: this is the local user-ownership implementation history. [Project status](../docs/23_PROJECT_STATUS.md) supersedes all current-verdict statements below. Gate 1 remains NO-GO, and remote personal-tenant/RLS integration is pending.

## Status

**Historical implementation record.** This plan recorded a provisional pass on
2026-08-01. The independent PostgreSQL 18 review in
`docs/18_GATE1_TO_DEMO_RESEARCH.md` superseded that claim on 2026-08-02 and is
the normative verdict: **Gate 1 NO-GO**. Practical closure is tracked in
`plans/009-123-practical-execution.md`. Started 2026-07-31.

## Why this plan exists

`plans/004-multi-user-night-research.md` finished its 20-task research pass and
produced a dependency-ordered backlog in `docs/16_MULTI_USER_BYBIT_RESEARCH.md`.
That backlog names **I01–I10** as the next milestone and states plainly that no
private-credential work (I11+) may begin while Gate 1 has unresolved A/B
isolation failures.

This plan implements I01–I10. It touches `apps/api`, `apps/web`, `apps/bot`, and
`packages/db`, so `AGENTS.md` requires an ExecPlan before the code changes.

## The problem in one paragraph

Telegram Login shipped in `cedc6df`, so the product now has real user identity —
but identity stops at the Nuxt session cookie. Every BFF data handler calls the
API without reading that session; the API authenticates the *service* with one
shared `x-api-key` and then queries global tables; `orders` and `audit_events`
have no owner column at all; `strategies.user_id` is nullable and lookups are by
symbol alone; the bot resolves almost nothing to `ctx.from.id`; and the runner
sends every notification to one `TELEGRAM_CHAT_ID`. The product has a login
screen and no tenancy behind it. Adding a second user today would let either one
read, mutate, pause, and be notified about the other's trading.

## Scope

In scope — the ten tickets:

| Ticket | Work |
| --- | --- |
| I01 | Correct public copy that promises live Bybit-key trading |
| I02 | Persist revocable API sessions (hashed token, expiry, revocation) |
| I03 | Require the Nuxt session on every user-data BFF route |
| I04 | Expand the schema with nullable ownership columns and `api_sessions` |
| I05 | Backfill and verify legacy ownership |
| I06 | Contract ownership constraints (NOT NULL, FK, unique) |
| I07 | Central Hono user principal; scope every user route |
| I08 | Scope bot commands, onboarding, callbacks; per-user pause |
| I09 | Owner-aware runner, aggregates, and notifications |
| I10 | Multi-user DRY_RUN isolation test suite |

Explicitly **out of scope**, and blocked until this plan's exit criteria pass:

- any private Bybit credential storage, adapter, or order submission (I11–I18);
- enabling `LIVE` mode for anyone;
- the closed live pilot and Broker OAuth work (I19–I20).

## Safety boundaries

Inherited from ExecPlan 004 and `AGENTS.md`, restated because this plan writes
code rather than documents:

- `DRY_RUN` stays the default and the only supported execution mode.
- `liveTradingEnabled: false` stays hard-coded in the runner's RiskGuard call.
- No futures, leverage, martingale, withdrawals, transfers, or meme coins.
- No endpoint may delete or truncate audit history.
- No real exchange credential is created, requested, printed, or stored.
- The shared service `API_KEY` is never treated as end-user authorization.
- The pre-existing uncommitted Safety Ledger UI work stays untouched except for
  copy strings required by I01, so it remains independently reviewable.

## Migration strategy: expand → backfill → verify → contract

The database has live dry-run history. A single "add NOT NULL owner" migration
would either fail or silently destroy provenance, so ownership lands in four
separate steps:

1. **Expand** (I04) — add `user_id` as *nullable* to `orders` and
   `audit_events`, add `api_sessions`, add indexes. Purely additive; safe to
   deploy and roll back.
2. **Backfill** (I05) — derive each order's owner through its strategy, and each
   audit event's owner through its entity. Rows whose owner cannot be derived
   unambiguously are assigned to an **explicit operator user** named in an
   environment variable — never silently to "the first user in the table".
   Anything still ambiguous is quarantined and reported, not guessed.
3. **Verify** (I05) — a report that must show zero unresolved rows before the
   next step is allowed to run.
4. **Contract** (I06) — only now apply `NOT NULL`, the foreign keys, and
   `UNIQUE (user_id, symbol)` on strategies.

Rollback for each step is the previous step's schema; steps 1 and 2 are
reversible without data loss, and step 4 is the only irreversible one, which is
why it runs last and behind a green verification report.

## Design decisions

### User identity reaches the API as a session token, not a user id

The BFF must never be able to *assert* a user id — that would make a forged
header a full tenant takeover. Instead:

- `POST /auth/telegram` verifies the widget payload (unchanged) and now also
  mints a random 32-byte session token, storing **only its SHA-256 hash** with
  an expiry.
- The BFF keeps that token inside the existing sealed, HTTP-only cookie. The
  browser never sees it.
- Every user-data API request carries the token in `x-user-session`. The API
  resolves it to a principal itself.
- The service `API_KEY` still gates the API, but it is now necessary and *not
  sufficient* for any user-data route.

This means a stolen `API_KEY` alone cannot read user data, which is exactly the
property the research's negative-test matrix demands.

### Deny by default

The principal middleware refuses user-data routes when no valid session is
present. Public routes — `/health`, `/version`, `/market`, `/backtest` — are
listed explicitly. New routes are private unless someone adds them to that list
on purpose.

### Not-found beats forbidden

Requesting another user's strategy or order returns `404`, not `403`. A `403`
confirms the row exists, which is itself a cross-tenant leak.

### The BFF stops swallowing errors

`strategies.get.ts` currently returns `[]` when the API call fails. After I03 a
logged-out or failed call must surface `401`, because an empty list rendered as
"you have no strategies" is a lie the dashboard should never tell.

## Verification

Gate 1 exits only when, per `docs/16_MULTI_USER_BYBIT_RESEARCH.md`:

- every user-data BFF/API route requires a revocable user session in addition to
  service auth;
- ownership constraints are non-null and legacy rows are explicitly resolved;
- bot commands, callbacks, runner aggregation, PnL/performance, and
  notifications are user-scoped;
- user A cannot list, infer, mutate, pause, receive, or aggregate user B data in
  automated negative tests;
- two seeded users can run the same symbol independently with separate caps,
  orders, audit, and chats;
- no private exchange credential or order submission code is reachable.

Plus the repository's own bar: `pnpm check` green, and new tests for every
security-sensitive path per `AGENTS.md`.

## Environment note

Docker and PostgreSQL were unavailable on the development machine throughout
this work. The 2026-07-31 pass treated that as a hard block on verification;
the 2026-08-01 pass removed it by running **PGlite** — PostgreSQL compiled to
WebAssembly — in process. Migrations, constraints and concurrency are therefore
exercised against real Postgres semantics with no server involved.

What that still does not cover: the specific rows in the production database.
Running the manual backfill/verify/contract sequence against a production-like
copy remains a prerequisite before deployment.

## Progress log

### 2026-07-31 — plan opened

- Confirmed research backlog I01–I10 as this plan's scope.
- Confirmed the four-step migration strategy against the current schema.
- Recorded the no-database limitation above.

### 2026-07-31 — I01 complete (truthful copy)

- Rewrote every claim that the product trades live with user Bybit keys.
  `ExchangeTradingPort.createSpotOrder()` is still `Promise<never>`, so the
  homepage FAQ ("Both", "Going live uses Bybit API keys…"), the Bybit landing
  page, and the paper-trading, risk-management, dip-buying, DCA and Bitcoin
  pages were all describing capability that does not exist.
- Live trading is now consistently described as planned and unavailable.
  Nothing was deleted from the roadmap narrative; it moved to future tense.
- Files: `apps/web/app/pages/{index,bybit-dca-bot,bitcoin-dca-bot,`
  `crypto-risk-management-bot,crypto-paper-trading-bot,crypto-dip-buying-bot,`
  `crypto-dca-bot}.vue`.

### 2026-07-31 — I02, I03, I07 complete (two-layer auth)

- `api_sessions` table added: random 32-byte token, **only its SHA-256 hash
  stored**, with expiry, revocation, and a last-used stamp.
- Session primitives live in `packages/db/src/session-token.ts` because both
  the API and the bot must agree byte-for-byte on hashing and usability. 27
  tests cover format rejection, expiry-at-boundary, and revocation precedence.
- `POST /auth/telegram` now mints a session; `POST /auth/logout` revokes it.
  Neither returns the token to the browser — it lives in the sealed cookie.
- `userPrincipalMiddleware` resolves `x-user-session` to a principal and is
  **deny-by-default**: `PUBLIC_PATH_PREFIXES` is an explicit six-entry list and
  anything else is private. A prefix cannot accidentally match a longer route
  (`/riskier` is not `/risk`), which is covered by tests.
- The BFF `requireCaller` gate replaced every silent `return []` fallback.
  An unreachable API now surfaces `502` instead of rendering as "you have no
  strategies", which was a lie the dashboard should never tell.
- `SESSION_SECRET` is now mandatory in production instead of falling back to an
  ephemeral secret that logged everyone out on each restart.

### 2026-07-31 — I04 complete (expand)

- Nullable `user_id` on `orders` and `audit_events`, `api_sessions`, and five
  indexes. Migration `0002_left_pride.sql` reviewed: additive only — no drop,
  no `NOT NULL` on existing data, no data loss.

### 2026-07-31 — I07 complete (scoped routes)

- `strategies`, `orders`, `audit`, `pnl`, `performance` all filter by the
  principal. Uniqueness moved from global `symbol` to `(user_id, symbol)`, so
  two users may each run BTCUSDT.
- Non-owned ids return `404`, not `403`: a `403` confirms the row exists.
- `computePnlReport(db, userId)` takes a **mandatory** owner argument with no
  default. This immediately paid for itself — the compiler flagged the daily
  digest as an unscoped caller.

### 2026-07-31 — I08 complete (bot ownership)

- `resolveCaller`/`requireCaller` map `ctx.from.id` to a user for every command
  that touches user data. Group and channel chats are refused: a shared room
  has no single accountable owner.
- Symbol-only lookups in `/set_threshold`, `/set_amount`, `/set_limit`,
  `/toggle`, `/settings`, `/status` and the onboarding wizard are now scoped to
  the caller. Previously whoever finished the wizard second silently took over
  the first person's strategy for that coin.
- `cancel_order` / `buy_now` callbacks now require the order's owner to be the
  callback actor, **and** use an atomic `PENDING`-guarded state transition, so
  a replayed or double-tapped callback cannot double-book a purchase.
- `/pause_all` and `/resume_all` are per-user. A cross-tenant kill switch is a
  denial-of-service button, not a safety feature.
- The bot mints short-lived (5-minute) sessions to call user-scoped API routes
  as the caller. This does not weaken the "service key alone is insufficient"
  property: the bot must still name a specific user who has talked to it.

### 2026-07-31 — I09 complete (owner-aware runner)

- The tick loop inner-joins strategies to their owner; an ownerless strategy is
  skipped rather than run against a global default.
- `user_id` is stamped on every order and audit event the runner writes.
- Spend-cap queries filter by owner as well as strategy id.
- Telegram helpers now take an explicit `chatId`. `TELEGRAM_CHAT_ID` is no
  longer a fallback for user events — silently redirecting one user's trading
  activity to the operator's chat would be a leak, not a degraded mode.
- The daily digest is per user, built only from that user's orders, and one
  user's failure no longer silences everyone else's.
- Default-strategy seeding is opt-in via `OPERATOR_TELEGRAM_USER_ID` and
  owner-scoped, instead of creating ownerless enabled rows.

### 2026-07-31 — I05/I06 delivered as gated manual migrations

- `packages/db/migrations/manual/` holds backfill, verification and contract
  scripts plus a README.
- These are deliberately **not** in the automatic migration folder:
  `runMigrations()` runs at runner boot, and an ownership rewrite of live
  trading history must not happen silently on a restart.
- The backfill derives owners only from relationships that already exist and
  never guesses. Ownerless strategies are reported, not assigned.
- The contract script re-checks the verification conditions itself and raises
  rather than proceeding, so skipping step 2 fails loudly.

### 2026-07-31 — signed-out dashboard state

Enforcing I03 had a user-facing consequence worth naming: the widgets used to
render whatever the global fallback returned, so a signed-out visitor saw data.
Now the API refuses them, and without a gate those panels would render empty —
"you have no orders" rather than "sign in". The dashboard therefore splits:

- `RiskGuardWidget` and `BacktestWidget` stay visible signed-out; they use
  public routes and need no account.
- The owned panels (PnL, performance, strategies, ledger, audit) render only
  when a session exists, with a dashed-keyline sign-in panel otherwise, per the
  design system's empty-state rule.
- `isUnauthenticated()` in `app/shared/lib/http-error/` lets any caller tell a
  `401` apart from a `502`, so an API outage never reads as "please sign in".

### 2026-07-31 — I10 partially complete

- 127 tests pass, up from 20 at the start of the pass.
- Covered without a database: service key necessary-but-not-sufficient across
  every private route and both mutations, forged/malformed/unknown session
  tokens, caller-supplied identity headers being ignored, route privacy
  defaults, and the bot's group-chat refusal.
- **Not yet covered:** the row-level A-versus-B matrix — user A listing user
  B's orders/audit/PnL, same-symbol independence with separate caps, forged
  callback against a real order, and per-user notification routing. These need
  two seeded tenants in PostgreSQL, which was unavailable this pass.

### 2026-07-31 — verification

- `pnpm check` exits 0: typecheck green across all 20 tasks, 127 tests pass
  (190 after the 2026-08-01 integration pass).
- `pnpm lint` reports 23 warnings — **the same 23 that existed before this
  pass**. No new warnings were introduced.
- The pre-existing Safety Ledger UI work was left untouched apart from the
  copy strings I01 required, so it remains independently reviewable.

### 2026-08-01 — the database problem, solved

The previous pass ended blocked: Docker was down, so the A-versus-B matrix
could not run and Gate 1 could not be declared. Docker is still down. The block
turned out to be avoidable rather than real.

**PGlite** is PostgreSQL compiled to WebAssembly, and Drizzle ships a driver for
it. Tests now get genuine Postgres — constraints, transactions, `RAISE`, unique
indexes, real concurrency — in process, with no server and no Docker. That
matters specifically here, because a chunk of this milestone's safety is
enforced by SQL rather than by TypeScript, and a mocked database would happily
"pass" tests that a real one rejects.

The harness lives at `@buy-crypto-dip-bot/db/testing` — a separate export path,
so PGlite is never reachable from production code. `seedTwoTenants()` builds the
world every isolation test runs against: two unrelated people, both trading
BTCUSDT, with deliberately different spends (100 vs 700) so a leaked aggregate
reads visibly wrong rather than coincidentally right.

### 2026-08-01 — I10 complete: the A-versus-B matrix runs

`apps/api/src/modules/auth/tenant-isolation.test.ts` drives the real Hono app,
the real session middleware and a real database. Only the Bybit HTTP client is
stubbed, because a test that reached the exchange would be measuring the network
rather than tenancy.

Proven, not asserted:

- Alice's `/strategies`, `/orders` and `/audit` contain no row of Bob's, and the
  two tenants' id sets are disjoint.
- Patching Bob's real strategy id as Alice returns `404` — not `403` — and Bob's
  row is unchanged afterwards.
- Both tenants hold their own BTCUSDT strategy; `STRATEGY_ALREADY_EXISTS` is a
  per-user fact, and Alice can add a symbol Bob already owns.
- Alice's PnL totals 100 and Bob's 700. A global aggregate would say 800.
- Logout kills a token on the very next request, with no grace window, and does
  not disturb other sessions.
- Only a token's hash is ever stored.

**These tests were then verified by mutation.** Deleting the owner filter from
`/orders` failed 2 tests; deleting it from the PnL aggregate and from the
strategy PATCH ownership check failed 4 more. An isolation test that cannot fail
is worthless, so this step is the one that makes the rest of the claim credible.

### 2026-08-01 — I05/I06 promoted from reviewed to executed

`packages/db/src/ownership-migration.test.ts` runs the three manual scripts
against a database seeded to look like the product before ownership existed.

- The backfill derives order owners through strategies, and audit owners through
  strategy, order and user entities. Install-wide events (`entity_id = 'ALL'`)
  stay unowned. A second run changes nothing.
- An ownerless strategy is left alone rather than assigned to anyone.
- The verification query counts each failure category: ownerless strategies,
  orphaned orders, duplicate `(user_id, symbol)` pairs.
- The contract script **raises** on dirty data — proven twice, for ownerless
  strategies and ownerless orders — and on clean data applies `NOT NULL`, the
  FK and the unique index. After it runs, a duplicate `(user_id, symbol)` insert
  is rejected by the database while two different users keep their own BTCUSDT.

The committed migrations are also now executed rather than only read
(`migrations.test.ts`), including a test proving the `api_sessions` foreign key
is real.

### 2026-08-01 — bot ownership extracted and proven

The callback and kill-switch logic was inline in grammY handlers, which made it
untestable. It now lives in `apps/bot/src/order.repository.ts` and the handlers
call it, so the tested code is the code that runs.

`claimOwnedPendingOrder` is proven to refuse another tenant's order, to report
it identically to a non-existent id, to refuse a second tap rather than booking
a purchase twice, and — under two genuinely concurrent claims against real
Postgres — to let exactly one win. `setEnabledForCaller` pauses only the
caller's strategies and stamps the audit event with its owner.

### 2026-08-01 — digest proven per-tenant

`buildDigestForUser` is exported and tested: each tenant's spend line is their
own, another tenant's symbols never appear, the 24h window excludes older
orders, a user with no activity and no holdings gets no message at all, and a
user holding something stale still gets a portfolio line.

### 2026-08-02 — independent audit found three real defects

A parallel research pass (`plans/006-gate1-proof-night-research.md`,
`docs/17_GATE1_PROOF_AND_DEMO_READINESS.md`) audited this implementation and
raised three blocking findings. I verified each rather than accepting them.

**B3 — `/start` could redirect a user's alerts to a group. Confirmed and
fixed.** `/start` cannot use `requireCaller`, because it is the command that
creates the user — so it had no chat-type guard and wrote `ctx.chat.id`
straight into `users.telegram_chat_id`. That field was mostly cosmetic before
this milestone; I09 made it the delivery address for every order, risk and
digest notification, which turned a harmless write into a leak: typing `/start`
in a group would send that person's entire trading activity to the room. The
command now refuses non-private chats, and the obsolete `TELEGRAM_CHAT_ID`
instruction is gone from its reply.

**B1 — cross-owner orders are not structurally prevented. Confirmed.** The
contract adds separate foreign keys for `user_id` and `strategy_id` but nothing
ties them together, so a row can name an owner and a strategy belonging to
different people. A test now proves the database *accepts* this
(`ownership-migration.test.ts`), documenting the truth rather than the
intention. It is not reachable through the API — every query scopes by
`user_id` — but my earlier claim that the contract made cross-tenant leakage
"structurally impossible" was overstated, and is corrected below. Closing it
needs `UNIQUE (user_id, id)` on strategies plus a composite foreign key.

**B2 — the Drizzle schema and the manual contract diverge. Confirmed.** The
schema file still declares the ownership columns nullable, because the manual
migration changes the database outside the generated journal. The consequence
worth naming: a *fresh* install running only automatic migrations never reaches
the contracted state. Not fixed tonight.

## Gate 1 status: passed for the application layer, not for the schema

All six exit criteria now hold, five of them proven by tests that fail when the
protection is removed:

| Exit criterion | Status |
| --- | --- |
| Every user-data route requires a revocable session plus service auth | Proven |
| Ownership constraints non-null; legacy rows explicitly resolved | Proven |
| Bot, runner, aggregates and notifications user-scoped | Proven |
| A cannot list, infer, mutate, pause, receive or aggregate B's data | Proven |
| Two users run the same symbol independently | Proven |
| No private exchange credential or order code reachable | True by absence |

### What is still not proven, and one thing that is now disproven

1. **Disproven: structural cross-owner safety.** See B1 above. Isolation is
   enforced by every application query, and that is proven by mutation-tested
   integration tests — but the schema does not enforce it. Anyone reading this
   plan's earlier drafts should discard the phrase "structurally impossible".
2. **A fresh install does not reach the contracted state** (B2). Only databases
   that have had the manual sequence run against them are fully constrained.
3. **The BFF layer is covered by code, not by tests.** `requireCaller` gates
   every Nuxt handler and the API refuses them anyway, so the protection is
   doubled — but no integration test drives the Nuxt server itself.
4. **Telegram delivery is not exercised.** The digest's *content* is proven
   per-tenant; that the message physically reaches the owner's chat depends on a
   network call no test makes.

Items 1 and 2 must close before a second real user is invited, since they are
about the database being trustworthy on its own. Items 3 and 4 are additional
layers over protections already proven elsewhere.

### Still required before deploying this

Unchanged and still a prerequisite: run the manual backfill/verify/contract
sequence against a **production-like copy** of the real database. PGlite proves
the scripts are correct; it says nothing about the specific rows in production.
