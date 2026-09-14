# buy-crypto-dip-bot

Buy Crypto Dip Bot is a self-hosted, Telegram-oriented crypto dip simulator
with a Nuxt dashboard, RiskGuard and auditable local orders. `DRY_RUN` is the
only executable mode. It reads public Bybit spot data and accepts no private
exchange credentials.

## Start with the current state

- [Project status and release blockers](docs/23_PROJECT_STATUS.md), reviewed 2026-09-14.
- [Prioritized backlog and R001-R123 index](tasks/00_MASTER_PLAN.md).
- [Product model](docs/14_PRODUCT_STRATEGY.md) and [architecture](docs/02_ARCHITECTURE.md).
- [Cost-first target from main](docs/15_COST_FIRST_SAAS_STRATEGY.md).
- [Plans and historical evidence](PLANS.md).
- [Краткое введение на русском](README_FIRST_RU.md).

The recovery and cost-first histories now have guarded forward convergence.
Personal tenants/RLS, the private dashboard snapshot and immutable release
flow are integrated with the recovered session/audit/notification controls.
Read [the research and migration decisions](docs/24_TENANT_INTEGRATION_RESEARCH.md)
before upgrades. Local verification does not approve a public launch.
Gate 1 remains NO-GO.

## Workspace

| Area | Responsibility |
| --- | --- |
| `apps/api` | Hono API, market data, runner, owned orders, audit and reporting |
| `apps/web` | Nuxt 4 pages/dashboard and a small server-only BFF |
| `apps/bot` | Telegram commands, onboarding and notification interaction |
| `packages/config` | Strategy defaults and reviewed-symbol policy |
| `packages/strategy-engine`, `packages/risk-engine` | Signal and risk evaluation |
| `packages/exchange-core`, `packages/exchange-bybit` | Ports and public Bybit observations |
| `packages/db`, `packages/shared-types` | PostgreSQL/Drizzle and shared contracts |
| `packages/seo-keywords`, `packages/test-utils` | Page inventory and test support |

## Local quickstart

Use Node 26+ and pnpm 11. PostgreSQL 18 runs locally through Docker Compose;
SQLite is not supported. Preserve any existing `.env` when setting up.

```bash
nvm use
cp .env.example .env # first setup only; configure Telegram for bot/login
pnpm install
docker compose up -d
pnpm dev            # API :8787, web :3000, Telegram bot
```

API startup validates configuration and completes migrations before serving.
In this recovery checkout, operator seeding requires an existing user and
`OPERATOR_TELEGRAM_USER_ID`; otherwise it creates no strategies. Private bot
onboarding creates the caller's strategy. Web sign-in alone does not enable
notifications. The newer main provisions personal tenants; see the source
comparison before migrating existing data.

## Checks

```bash
pnpm check # DRY_RUN boundary, typecheck, lint, workspace tests
pnpm build
# Separate lane; use an isolated disposable PostgreSQL 18 database:
pnpm --filter @buy-crypto-dip-bot/db test:postgres18
```

The PostgreSQL lane requires `POSTGRES18_TEST_URL`; `pnpm check` can pass with
that optional lane skipped. Tests and build are necessary evidence, not a
substitute for account isolation, restore and deployment verification.

## Deployment

The repository contains a VPS/GHCR deployment workflow; `DEPLOY_ENABLED` is
its deployment switch. Cloudflare Workers and Supabase are the recorded
**target**, with cutover still pending. There is no available hosted tariff,
SLA, Demo order path or live trading mode.

See [the deployment runbook](docs/13_VPS_DEPLOYMENT_RUNBOOK.md) and current
status before any release. The working checkout and remote main currently
have different release workflows. Keep real credentials outside source and
browser bundles; SSH uses `VPS_SSH_KEY`, not a password secret.
