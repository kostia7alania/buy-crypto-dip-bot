You are Codex running locally in this repository. Build a modern 2026 AI-first TypeScript monorepo from scratch.

Repository name:
`buy-crypto-dip-bot`

Product name:
`DCA Guard`

Product:
Risk-first crypto Dip-DCA automation system.

SEO focus:
AI Crypto DCA Bot for Buying the Dip.

Important:
This is not a profit-maximizing trading bot. It is a safety-first automation tool. Default mode is DRY_RUN. No real money should be touched in this task.

Use the latest checked Node Current version already fixed by this bootstrap:
- Node.js 26.4.0
- Do not downgrade Node.
- Do not add production downgrade notes.

Use the newest practical 2026 stack:
- Node.js 26.4.0
- pnpm 11 with workspace catalogs
- TypeScript strict
- pnpm workspaces
- Turborepo
- Hono for API
- Hono RPC-compatible route typing where useful
- hono-openapi where appropriate
- Valibot for runtime validation
- node:sqlite for local MVP persistence
- Nuxt 4 for SSR/SSG SEO pages, dashboard, and small BFF
- Tailwind CSS 4
- shadcn-vue / Reka UI style primitives
- grammY for Telegram bot
- Vitest 4 for tests
- Biome for formatting/checks
- Oxlint for fast lint
- tsdown for package builds

Avoid older/slower/default legacy choices:
- Do not use Express.
- Do not use NestJS.
- Do not use global controllers/services/models folders.
- Do not use Jest.
- Do not use ESLint + Prettier unless there is a strong documented reason.
- Do not use axios; use native fetch.
- Do not use sqlite3/better-sqlite3 for MVP; use node:sqlite.
- Do not use ts-node.
- Do not use old global utils/helpers dumping grounds.
- Do not use plain Vue SPA for SEO pages. Use Nuxt.

Architecture:
Use modern monorepo layout:

apps/
  api/
  web/
  bot/

packages/
  shared-types/
  strategy-engine/
  risk-engine/
  exchange-bybit/
  seo-keywords/
  config/
  test-utils/

docs/
tasks/
adr/

Backend folder style:
Use vertical slices and feature folders.
Do not create global controllers/services/models directories.
Route files should call feature modules, not exchange clients directly.

Web folder style:
Use Nuxt 4 with feature-sliced structure:
- app
- pages
- widgets
- features
- entities
- shared
- server/api for small BFF

SEO routes:
- /
- /crypto-dca-bot
- /buy-crypto-dip-bot
- /buy-the-dip-crypto-bot
- /bitcoin-dca-bot
- /crypto-dip-buying-bot
- /bybit-dca-bot
- /flash-crash-crypto-bot
- /crypto-risk-management-bot

Trading hard rules:
- No futures.
- No leverage.
- No martingale.
- No meme coins.
- No withdrawals.
- No live trading by default.
- No API keys committed.
- No secrets logged.
- Every signal/order/risk decision must be auditable.
- RiskGuard must approve every order-like action.
- LIVE_TRADING_ENABLED must default to false.

What to implement in this local Codex task:
1. Create the monorepo scaffold.
2. Add root package.json with Node 26.4.0 engine and pnpm 11 packageManager.
3. Add `.node-version` and `.nvmrc` with `26.4.0`.
4. Add pnpm-workspace.yaml with catalogs.
5. Add turbo.json.
6. Add tsconfig.base.json with strict settings.
7. Add biome.json.
8. Add oxlint.json.
9. Add apps/api with Hono:
   - GET /health
   - GET /version
10. Add apps/web with Nuxt 4:
   - SSR enabled
   - SEO landing page shell
   - keyword route cluster
   - dashboard shell
   - risk-first layout
   - small server/api BFF placeholder
   - no casino UI
11. Add apps/bot with grammY skeleton:
   - /start
   - /status
   - token not required unless bot is started
12. Add packages/shared-types:
   - Strategy
   - Signal
   - RiskDecision
   - DryRunOrder
13. Add packages/strategy-engine:
   - pure placeholder evaluateDipStrategy function
   - tests
14. Add packages/risk-engine:
   - RiskGuard
   - rejects live trading by default
   - tests
15. Add packages/exchange-bybit:
   - public placeholder client interface only
   - no real API keys
   - no private calls
16. Add packages/seo-keywords:
   - keyword metadata for SEO pages
17. Add local DB package or api/db using node:sqlite:
   - minimal schema placeholder
   - no external sqlite driver
18. Add .env.example:
   - LIVE_TRADING_ENABLED=false
   - DRY_RUN_DEFAULT=true
   - ALLOWLIST_SYMBOLS=BTCUSDT
   - MAX_DAILY_SPEND_USDT=20
   - MAX_WEEKLY_SPEND_USDT=100
19. Add .vscode:
   - settings.json
   - extensions.json
   - launch.json
20. Add docs:
   - docs/00_CONTEXT.md
   - docs/01_PRODUCT_SPEC.md
   - docs/02_ARCHITECTURE.md
   - docs/03_API_SPEC.md
   - docs/04_RISK_POLICY.md
   - docs/05_STRATEGY_DIP_DCA.md
   - docs/06_BYBIT_INTEGRATION.md
   - docs/07_TELEGRAM_BOT.md
   - docs/08_WEB_DASHBOARD_SEO.md
   - docs/09_SECURITY.md
   - docs/10_RUNBOOK.md
   - docs/11_AGENT_WORKFLOW.md
   - docs/12_SEO_KEYWORDS.md
21. Add tasks:
   - tasks/00_MASTER_PLAN.md
   - tasks/01_SCAFFOLD.md
   - tasks/02_MARKET_DATA.md
   - tasks/03_STRATEGY_ENGINE.md
   - tasks/04_RISK_ENGINE.md
   - tasks/05_DRY_RUN_ORDERS.md
   - tasks/06_TELEGRAM_BOT.md
   - tasks/07_WEB_DASHBOARD_SEO.md
   - tasks/08_LIVE_SPOT_SMALL_CAP.md
   - tasks/09_SEO_PAGES.md
   - tasks/10_AGENT_PARALLEL_WORKFLOW.md
22. Add adr:
   - adr/ADR_001_NODE_26_PNPM_11.md
   - adr/ADR_002_NUXT_4_FOR_SEO.md
   - adr/ADR_003_HONO_VALIBOT_NODE_SQLITE.md
   - adr/ADR_004_DRY_RUN_FIRST_NO_LIVE.md
   - adr/ADR_005_REPO_NAME.md
23. Add README.md with setup and commands.

Run these commands before finishing:
- pnpm install
- pnpm dev
- pnpm build
- pnpm test
- pnpm lint
- pnpm typecheck

Acceptance criteria:
- No real trading.
- No private Bybit integration yet.
- No secrets required.
- API compiles.
- Web compiles.
- Bot compiles.
- Tests pass.
- RiskGuard rejects live trading by default.
- Structure follows modern apps/packages monorepo.
- Nuxt SSR/SSG SEO pages exist.
- Docs explain next tasks.
- No legacy folder structure.


Local Codex workflow notes:
- Inspect the repository first.
- Read AGENTS.md, CODEX.md, docs/00_CONTEXT.md, docs/01_PRODUCT_SPEC.md, docs/02_ARCHITECTURE.md, docs/04_RISK_POLICY.md, and docs/11_AGENT_WORKFLOW.md.
- Produce a short plan before editing.
- Keep the first implementation scoped to scaffold + compile + tests.
- Do not touch real exchange APIs beyond public placeholder interfaces.
- Do not add secrets.
- Do not enable live trading.
