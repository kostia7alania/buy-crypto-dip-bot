# Gate 1 implementation evidence

## Recovery verified on 2026-09-12

Source revision: `31212e159d8da7b5ccebb52b57f5b794db156ec2`.
Local branch: `codex/gate1-recovery-20260912`.
Catalog: `0014_bouncy_zuras`.
Decision: **Gate 1 remains NO-GO**. Current blockers are in
[project status](23_PROJECT_STATUS.md); the next sequence and all 123 tickets
are in [the master backlog](../tasks/00_MASTER_PLAN.md).

The source checkpoint preserves the existing unfinished package plus this
recovery. Its 253-file diff against `cedc6df` is not a claim that all that work
was newly implemented here. The four recovered findings are scoped below.
The final checks ran before this checkpoint; only documentation changed after
those source checks. The follow-up evidence commit changes documentation only.

The interrupted task was "Составить и выполнить 20 задач", local task id
`019fb904-e09c-7672-acae-ad417f4a95ae`. Its 2026-08-10 final review left four
findings before the turn disconnected. All four are fixed in the source
revision above:

1. The canonical config allowlist can only be narrowed by deployment config.
   API creation/activation, public market/backtest inputs, Telegram onboarding
   and inputs, runner decisions and order completion cannot expand it from
   persisted data. Unsupported pending orders remain cancellable.
2. Public `/market` no longer queries global strategies. An unsupported symbol
   gets the same response before and after another user's legacy row exists.
3. Identity changes clear private Nuxt caches and pending writes, and remount
   account-owned dashboard panels.
4. Logout reinstalls one Telegram login widget/callback; a failed logout keeps
   the current account visible and reports the failure.

### Checks and their limits

Node `v26.7.0`, pnpm `11.0.0`.

| Check | Observed result |
| --- | --- |
| `pnpm check` | Passed: Gate boundary, 20/20 typecheck tasks, lint with 13 non-failing warnings, 341 package tests. Final test orchestration: 12/12 successful, 10 tasks cached. |
| Package test counts | API 146, bot 64, DB/PGlite 65, web 33, shared types 14, Bybit public adapter 11, risk 3, strategy 3, config 2. |
| `pnpm build` | Passed, 12/12 tasks successful, 9 cached. |
| PostgreSQL 18.4 contract lane | 7/7 passed on a fresh isolated `postgres:18-alpine` container, exact local catalog `0014`, including clean/upgrade equivalence. These cases are skipped in generic tests without `POSTGRES18_TEST_URL`. |
| Local browser | Fixture-backed real Nuxt page: A login, failed logout, successful logout, one recreated widget/callback, B login, late A response rejected. No A strategy or balance appeared under B. |
| Repository/document checks | Staged diff whitespace check passed; local Markdown links resolve; R001-R123 are unique and continuous. Credential-shaped scan reported no matches and `.env` remains ignored. |

Turbo reused unchanged package tasks from earlier runs in this recovery. No
forced fresh full-matrix or independent release review is claimed. Browser
identity and API responses were fixtures; actual Telegram login, private
`/start`, provider delivery and the complete R121 accessibility matrix remain
open. The temporary browser tab and local test server were closed. The PG18
container had no persistent mount and was stopped and removed.

Owner-local logs are under `/tmp/buy-crypto-dip-recovery-20260911`:
`check-final.log`, `build-final.log`, `postgres18-final.log`. The original
pre-edit package is preserved there in `before/`, `baseline.diff` and
`baseline-status.txt`. Temporary logs are supporting local evidence; the
committed source, tests and the commands below are the reproducible record.

```sh
pnpm check
pnpm build
# Supply an isolated PostgreSQL 18 URL through the environment, then:
pnpm --filter @buy-crypto-dip-bot/db test:postgres18
```

Main `becc46bb3b957c484324dbc3c517d5db7762be97` has a different `0002` tenancy/RLS
catalog. This evidence does not cover that source, a future merged catalog,
CI artifacts or a running deployment. Full A/B/race/restart/outbox proof and
operations rehearsal must run on the final integrated immutable revision.
No merge, push, deployment, provider account or private trading access occurred.

### Files changed during this recovery

Compared with the owner-local pre-edit backup (or `cedc6df` for files that were
clean), the recovery changed the following files. Other files in the source
checkpoint preserve the pre-existing work without additional recovery edits.

#### Runtime, configuration and regressions

- [apps/api/src/modules/backtest/backtest.route.ts](../apps/api/src/modules/backtest/backtest.route.ts)
- [apps/api/src/modules/market-data/market-data.route.ts](../apps/api/src/modules/market-data/market-data.route.ts)
- [apps/api/src/modules/risk/risk.route.ts](../apps/api/src/modules/risk/risk.route.ts)
- [apps/api/src/modules/runner/order.repository.test.ts](../apps/api/src/modules/runner/order.repository.test.ts)
- [apps/api/src/modules/runner/order.repository.ts](../apps/api/src/modules/runner/order.repository.ts)
- [apps/api/src/modules/runner/runner.service.ts](../apps/api/src/modules/runner/runner.service.ts)
- [apps/api/src/modules/strategies/strategies.route.ts](../apps/api/src/modules/strategies/strategies.route.ts)
- [apps/api/src/modules/strategies/symbol-policy.test.ts](../apps/api/src/modules/strategies/symbol-policy.test.ts)
- [apps/bot/src/bot.ts](../apps/bot/src/bot.ts)
- [apps/bot/src/command.repository.ts](../apps/bot/src/command.repository.ts)
- [apps/bot/src/onboarding.test.ts](../apps/bot/src/onboarding.test.ts)
- [apps/bot/src/onboarding.ts](../apps/bot/src/onboarding.ts)
- [apps/bot/src/order.repository.test.ts](../apps/bot/src/order.repository.test.ts)
- [apps/bot/src/order.repository.ts](../apps/bot/src/order.repository.ts)
- [apps/web/app/pages/dashboard/index.vue](../apps/web/app/pages/dashboard/index.vue)
- [apps/web/app/widgets/telegram-login/ui/TelegramLoginWidget.vue](../apps/web/app/widgets/telegram-login/ui/TelegramLoginWidget.vue)
- [docker-compose.prod.yml](../docker-compose.prod.yml)
- [packages/config/src/index.test.ts](../packages/config/src/index.test.ts)
- [packages/config/src/index.ts](../packages/config/src/index.ts)
- [packages/risk-engine/src/index.test.ts](../packages/risk-engine/src/index.test.ts)
- [packages/risk-engine/src/index.ts](../packages/risk-engine/src/index.ts)

#### Documentation and backlog

- [PLANS.md](../PLANS.md)
- [README.md](../README.md)
- [README_FIRST_RU.md](../README_FIRST_RU.md)
- [adr/ADR_008_COST_FIRST_HYBRID_EDGE.md](../adr/ADR_008_COST_FIRST_HYBRID_EDGE.md)
- [adr/ADR_008_POST_GATE_RLS.md](../adr/ADR_008_POST_GATE_RLS.md)
- [docs/00_CONTEXT.md](../docs/00_CONTEXT.md)
- [docs/01_PRODUCT_SPEC.md](../docs/01_PRODUCT_SPEC.md)
- [docs/02_ARCHITECTURE.md](../docs/02_ARCHITECTURE.md)
- [docs/03_RUNTIME_DECISIONS.md](../docs/03_RUNTIME_DECISIONS.md)
- [docs/04_RISK_POLICY.md](../docs/04_RISK_POLICY.md)
- [docs/05_DATABASE_STRATEGY.md](../docs/05_DATABASE_STRATEGY.md)
- [docs/06_FSD_FRONTEND.md](../docs/06_FSD_FRONTEND.md)
- [docs/07_API_VERTICAL_SLICES.md](../docs/07_API_VERTICAL_SLICES.md)
- [docs/08_EXCHANGE_ADAPTERS.md](../docs/08_EXCHANGE_ADAPTERS.md)
- [docs/09_AGENT_WORKFLOW.md](../docs/09_AGENT_WORKFLOW.md)
- [docs/10_SECURITY.md](../docs/10_SECURITY.md)
- [docs/11_SEO_STRATEGY.md](../docs/11_SEO_STRATEGY.md)
- [docs/12_OBSERVABILITY.md](../docs/12_OBSERVABILITY.md)
- [docs/13_VPS_DEPLOYMENT_RUNBOOK.md](../docs/13_VPS_DEPLOYMENT_RUNBOOK.md)
- [docs/14_PRODUCT_STRATEGY.md](../docs/14_PRODUCT_STRATEGY.md)
- [docs/15_COST_FIRST_SAAS_STRATEGY.md](../docs/15_COST_FIRST_SAAS_STRATEGY.md)
- [docs/15_DESIGN_SYSTEM.md](../docs/15_DESIGN_SYSTEM.md)
- [docs/16_MULTI_USER_BYBIT_RESEARCH.md](../docs/16_MULTI_USER_BYBIT_RESEARCH.md)
- [docs/17_GATE1_PROOF_AND_DEMO_READINESS.md](../docs/17_GATE1_PROOF_AND_DEMO_READINESS.md)
- [docs/18_GATE1_TO_DEMO_RESEARCH.md](../docs/18_GATE1_TO_DEMO_RESEARCH.md)
- [docs/19_SESSION_SECURITY_POLICY.md](../docs/19_SESSION_SECURITY_POLICY.md)
- [docs/20_GATE1_IMPLEMENTATION_EVIDENCE.md](../docs/20_GATE1_IMPLEMENTATION_EVIDENCE.md)
- [docs/21_CLAIMS_REGISTRY.md](../docs/21_CLAIMS_REGISTRY.md)
- [docs/22_WEB_QUALITY_BUDGETS.md](../docs/22_WEB_QUALITY_BUDGETS.md)
- [docs/23_PROJECT_STATUS.md](../docs/23_PROJECT_STATUS.md)
- [plans/002-architecture-crossroads.md](../plans/002-architecture-crossroads.md)
- [plans/004-cost-first-multi-tenant-edge.md](../plans/004-cost-first-multi-tenant-edge.md)
- [plans/005-multi-user-isolation.md](../plans/005-multi-user-isolation.md)
- [plans/008-123-task-night-research-loop.md](../plans/008-123-task-night-research-loop.md)
- [plans/009-123-practical-execution.md](../plans/009-123-practical-execution.md)
- [plans/010-recovery-and-project-status.md](../plans/010-recovery-and-project-status.md)
- [tasks/00_MASTER_PLAN.md](../tasks/00_MASTER_PLAN.md)
- [tasks/01_SCAFFOLD.md](../tasks/01_SCAFFOLD.md)
- [tasks/02_MARKET_DATA.md](../tasks/02_MARKET_DATA.md)
- [tasks/03_STRATEGY_ENGINE.md](../tasks/03_STRATEGY_ENGINE.md)
- [tasks/04_RISK_ENGINE.md](../tasks/04_RISK_ENGINE.md)
- [tasks/05_DRY_RUN_ORDERS.md](../tasks/05_DRY_RUN_ORDERS.md)
- [tasks/06_TELEGRAM_BOT.md](../tasks/06_TELEGRAM_BOT.md)
- [tasks/07_WEB_DASHBOARD.md](../tasks/07_WEB_DASHBOARD.md)
- [tasks/08_LIVE_SPOT_SMALL_CAP.md](../tasks/08_LIVE_SPOT_SMALL_CAP.md)
- [tasks/09_SEO_PAGES.md](../tasks/09_SEO_PAGES.md)
- [tasks/10_AGENT_SKILLS.md](../tasks/10_AGENT_SKILLS.md)

The following August record is historical. Its "pending", "current" and test
counts refer to that earlier handoff and do not override the recovery above.

## Historical record: 2026-08-10 practical batch 1

Date: 2026-08-10\
Base revision: `cedc6df` on `main`\
Working tree: dirty, implementation not yet committed\
Target catalog: `0014_bouncy_zuras`\
Decision: **Gate 1 remains NO-GO pending an immutable revision and the full-matrix rerun**\
Reviewer: pending independent review

### Closed implementation blockers

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

### Reproducible checks run in this batch

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

### Why this is not a GO yet

- The exact implementation does not yet have an immutable commit identity.
- The final A/B API, BFF, bot, runner, aggregate, concurrency, restart, and
  outbox matrix still needs one independent run against the exact committed
  revision; the PostgreSQL 18 catalog lane alone is not that full matrix.
- Complete operational incident, restore, and backup evidence still needs the
  remaining Gate 1 operations batch.
- No private Bybit credential, signing, Demo order, Broker OAuth, or live-order
  work is authorized while this record says NO-GO.
