# Gate 1 implementation evidence — practical batch 1

Date: 2026-08-10\
Base revision: `cedc6df` on `main`\
Working tree: dirty, implementation not yet committed\
Target catalog: `0014_bouncy_zuras`\
Decision: **Gate 1 remains NO-GO pending an immutable revision and the full-matrix rerun**\
Reviewer: pending independent review

## Closed implementation blockers

- The database rejects `orders(user_id=A, strategy_id=B)` through a composite
  same-owner foreign key.
- Drizzle schema, journalled migrations, clean install, and the documented
  legacy backfill/contract upgrade now converge on one catalog.
- `strategies.user_id`, `orders.user_id`, and `orders.strategy_id` are required;
  non-`DRY_RUN` persisted strategy/order modes are rejected.
- One strategy can have only one `PENDING` order. A same-process single-flight
  guard and the database partial unique index cover overlapping ticks and
  multiple workers respectively.
- API startup validates non-local configuration, completes migrations and
  runner initialization before binding, and exposes separate liveness and
  schema-aware readiness.
- Web BFF and Telegram bot calls refuse missing service authentication outside
  local development. `/auth/me` resolves the live API session rather than
  trusting sealed-cookie identity data.
- Telegram Login presentations are five-minute, one-use records stored only as
  SHA-256 fingerprints. Web sessions have absolute and idle limits, inventory,
  revoke-one/revoke-all, and a seven-day cleanup grace period.
- Telegram Login source and verified-user abuse windows are PostgreSQL-backed
  and keyed only by domain-separated HMACs. A block returns the exact persisted
  countdown through `Retry-After` and an immutable structured V1 rejection.
- Unsafe BFF methods enforce the configured same-origin boundary; non-local
  cookies use the `__Host-` contract.
- Web login no longer creates a notification destination. Only a successful
  private `/start` establishes `telegram_chat_id` plus
  `notification_enabled_at`; runner/digest delivery checks both.
- Strategy/order state transitions added in this batch commit their immutable
  audit evidence in the same database transaction.
- Session logout, revoke-one, revoke-all, Telegram command leases, default
  strategy seeding, and due-order claims now use the same atomic state/evidence
  boundary. Expired sessions are cleaned on a bounded schedule without deleting
  audit history.
- Audit V1 has one shared runtime contract and one database row builder. The
  catalog rejects unknown action/reason/payload classes. Migration `0013`
  prevents every audit update or deletion, including legacy V0; remediation is
  append-only and preserves the original row.
- Telegram notifications use a durable tenant-owned outbox with explicit
  requested, sending, delivered, retry, failed, skipped, and dead-worker lease
  recovery states. Logs no longer count a queued or failed request as sent.
- Readiness distinguishes liveness from database, schema, runner, and bot
  freshness. The bot reports a heartbeat authenticated by both the service key
  and a distinct bot-only secret, then becomes stale after the documented
  window. Production Compose does not pass the bot secret or Telegram token to
  the web BFF.
- The notification outbox stores a classified versioned template plus bounded
  render inputs and audit correlation instead of durable plaintext financial
  messages. Legacy queued plaintext is skipped during `0014`; rendering escapes
  untrusted fields and has a correlation-only safe fallback.
- A mechanical Gate 1 boundary check rejects private Bybit credentials,
  signing/order paths, and non-`DRY_RUN` runtime/catalog drift.

## Reproducible checks run in this batch

The current integration commands used Node `v26.7.0` and pnpm `11.0.0`.

| Check | Result |
| --- | --- |
| `pnpm --filter @buy-crypto-dip-bot/db typecheck` | pass |
| `pnpm --filter @buy-crypto-dip-bot/api typecheck` | pass |
| `pnpm --filter @buy-crypto-dip-bot/bot typecheck` | pass |
| `pnpm --filter @buy-crypto-dip-bot/web typecheck` | pass |
| DB/PGlite package suite | 64 passed before one old ownership case hit the 5-second timeout under parallel load; its isolated rerun passed 19/19 |
| API package suite | 140 passed |
| Bot package suite | 62 passed |
| Web package suite | 33 passed |
| Shared audit/log contract suite | 14 passed |
| Public Bybit adapter contract suite | 11 passed |
| Risk and strategy engine suites | 3 passed each |
| PostgreSQL 18.4 clean-install/real-upgrade contract lane | 7/7 passed through exact catalog `0014`; clean and upgraded catalogs identical |
| `pnpm check` (Gate boundary, typecheck, lint, tests) | Gate boundary, 20/20 typecheck tasks, and lint passed; first test run stopped on the single 5.109-second DB timeout recorded above; final warm-cache rerun pending |
| `pnpm --filter @buy-crypto-dip-bot/web build` | passed in the preceding public-surface batch; not rerun after the latest dashboard/accessibility changes |
| `pnpm lint` | pass with pre-existing non-failing warnings |
| `git diff --check` | pass at handoff |
| R026 shared audit contract | 10 targeted tests passed |
| R026 PGlite migration contract | 12 targeted tests passed |
| R026 API auth/repository/integration/readiness | 49 targeted tests passed |
| R026 BFF source-HMAC/Retry-After parsing | 4 targeted tests passed |

The current PostgreSQL lane used an isolated `postgres:18-alpine` container
running PostgreSQL `18.4` and bound only to loopback. It passed seven catalog,
ownership, V0/V1 envelope, and immutability cases through exact migration
`0014`; clean install and the real legacy-upgrade path ended at an identical
catalog. The container was stopped and automatically removed after the run.
PGlite success was not treated as a substitute.

## Why this is not a GO yet

- The exact implementation does not yet have an immutable commit identity.
- The final A/B API, BFF, bot, runner, aggregate, concurrency, restart, and
  outbox matrix still needs one independent run against the exact committed
  revision; the PostgreSQL 18 catalog lane alone is not that full matrix.
- Complete operational incident, restore, and backup evidence still needs the
  remaining Gate 1 operations batch.
- No private Bybit credential, signing, Demo order, Broker OAuth, or live-order
  work is authorized while this record says NO-GO.
