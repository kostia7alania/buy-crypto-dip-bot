# Gate 1 Proof and Bybit Demo Readiness Research

> Historical proof/research snapshot. Several source blockers below were subsequently implemented. [Project status](23_PROJECT_STATUS.md) owns the current blocker list and NO-GO verdict; [implementation evidence](20_GATE1_IMPLEMENTATION_EVIDENCE.md) records later checks.

Date: 2026-08-02\
Status: completed research; Gate 1 NO-GO\
Scope: evidence review only; no private exchange access and no live trading

## Executive decision

The uncommitted Gate 1 implementation is materially safer than the baseline at commit cedc6df, but Gate 1 is not proved and must not be declared complete.

The normal-path API predicates worked in a real two-tenant PostgreSQL 18.4 rehearsal:

- user A and user B can each list their own BTCUSDT strategy;
- normal orders and audit events remain separated by user;
- user A receives 404 when guessing user B's strategy id;
- the expand/backfill/verify/contract sequence detects an unresolved legacy owner and refuses to contract;
- after an explicit legacy-owner decision, order owner NOT NULL and per-user symbol uniqueness are enforced.

Five blocking gaps keep the decision at NO-GO:

1. The contracted database accepts an order whose user_id is A while its strategy belongs to B.
2. The Drizzle source schema and migration metadata remain nullable and omit the manual contract constraints, so the declared source of truth disagrees with the contracted database.
3. Telegram /start accepts group chats and stores the group chat id as a user's notification destination.
4. The required automated PostgreSQL A-versus-B suite does not exist; tonight's successful checks were an independent ephemeral rehearsal, not a committed regression gate.
5. Production startup and deployment are not fail-closed around API_KEY and migrations.

I11 and all private Bybit credential/order work remain blocked. The next milestone is proof and hardening of Gate 1, not Bybit Demo implementation.

## Method and evidence baseline

### Repository

- Branch: main.
- HEAD: cedc6df.
- Runtime: Node.js v26.5.0 and pnpm 11.0.0.
- The Gate 1 implementation and Safety Ledger UI are extensive pre-existing uncommitted work.
- During the audit, a separate uncommitted PGlite test-utils harness appeared in the shared worktree. It was inspected but not edited by this pass; it currently exports a missing seed-tenants module and is not yet an executable A/B suite.
- This research pass added only this dossier and ExecPlan 006.
- No exchange credential was created, requested, stored, or used.
- No live or Demo order endpoint was called.

### Real database rehearsal

Docker Desktop was started only to create a disposable container:

- image: postgres:18-alpine;
- server: PostgreSQL 18.4;
- container: dipbot-gate1-proof-20260802;
- storage: tmpfs under /var/lib/postgresql;
- port: loopback-only 127.0.0.1:55432;
- no existing compose service or volume was used.

The automatic Drizzle migrations applied successfully. Two users, same-symbol strategies, owned and legacy orders, and tenant/operator audit events were then seeded.

The manual sequence produced these results:

| Step | Result |
| --- | --- |
| 001 backfill | Derived A's order and strategy audit owner; did not guess the ownerless legacy strategy |
| 002 verify before resolution | Reported one ownerless strategy and one ownerless order |
| 003 contract before resolution | Refused with an exception and rolled back |
| Explicit legacy decision | Assigned the legacy strategy to test operator A |
| 001 plus 002 rerun | All five must-be-zero categories became zero |
| 003 contract rerun | Applied NOT NULL, strategy FK, and per-user symbol unique index |
| Negative NOT NULL probe | Ownerless order insert was rejected |
| Negative uniqueness probe | Second A/BTCUSDT strategy was rejected |
| Cross-owner probe | A-owned order pointing at B-owned strategy was accepted |
| Tenant-audit probe | Strategy audit event with null user_id was accepted |
| RLS catalog probe | RLS and FORCE RLS were false on all tenant tables |

The successful cross-owner insert was then visible in A's GET /orders response with B's strategy id. The route did exactly what its user_id predicate says; the inconsistent relationship was admitted by the database.

### Authentication probes

- The exact same fresh, correctly signed Telegram Login payload was posted twice.
- Both requests returned 200 and issued a session.
- PostgreSQL contained two sessions for that one replayed payload.
- With NODE_ENV=production and API_KEY absent, GET /version returned 200. The API does not fail startup or fail closed when the required service secret is missing.

Tokens used in the rehearsal were synthetic and were not printed.

## Current trust flow

The intended normal path is sound in shape:

1. Telegram signs a browser login payload.
2. Nuxt forwards it to Hono using the service API key.
3. Hono verifies the Telegram signature, creates a user, and mints a random API session.
4. Nuxt seals the API session token in an HTTP-only cookie.
5. User-data BFF requests forward both service authentication and the opaque user session.
6. Hono resolves the user principal centrally and scopes application queries.

The remaining alternate paths are what keep Gate 1 open:

- the bot directly queries and mutates PostgreSQL for many commands;
- /start writes a notification destination without the private-chat guard;
- runner order transitions and audit writes are separate operations;
- manual database constraints are not represented in the Drizzle source;
- API traffic can begin before migration success is known;
- no database-level tenant policy catches a missed application predicate.

## I01-I10 traceability

| Ticket | Implementation evidence | Proof status | Decision |
| --- | --- | --- | --- |
| I01 truthful copy | Public pages changed from live-key promises to planned/unavailable language | Static diff inspected | Substantially complete |
| I02 revocable API sessions | api_sessions, SHA-256 token hash, expiry, revocation | Pure tests pass; real issue/resolve used | Partial: lifecycle gaps remain |
| I03 authenticated BFF | requireCaller and apiFetchAs used by owned data routes | Static route audit | Partial: CSRF and stale-session gaps |
| I04 schema expansion | 0002 is additive and applied on PostgreSQL 18.4 | Rehearsed | Complete as expand only |
| I05 legacy backfill/verify | Manual scripts derive without guessing and report unresolved rows | Rehearsed fail and success paths | Good, but runbook missing |
| I06 ownership contract | NOT NULL, strategy FK, per-user symbol unique index | Rehearsed | Incomplete: cross-owner invariant and schema drift |
| I07 Hono principal | Central deny-by-default middleware and owner predicates | Normal A/B reads passed; foreign PATCH returned 404 | Good normal path; production API_KEY fail-open |
| I08 bot isolation | Most commands/callbacks scope by Telegram actor | Static audit | Incomplete: group /start notification leak and thin tests |
| I09 runner isolation | Owner propagated into strategies, orders, audits, caps, and chats | Static audit | Incomplete: inconsistent relationships and non-transactional evidence |
| I10 integration suite | Unit-level pre-database negatives exist | No committed two-tenant PostgreSQL suite | Blocking |

## Findings

### Blocking

#### B1. Orders do not enforce the same owner as their strategy

Evidence:

- packages/db/migrations/manual/003_contract_ownership.sql adds separate user and strategy foreign keys.
- It does not add a composite foreign key from orders(user_id, strategy_id) to strategies(user_id, id).
- PostgreSQL 18.4 accepted the cross-owner test row after the contract.
- apps/api/src/modules/runner/runner.service.ts later looks up a due order's strategy by strategy id alone.

Impact:

- corrupted, migrated, or future buggy data can join one tenant's order to another tenant's strategy;
- A's order response can reveal B's strategy id;
- runner notifications can include B's strategy name in A's message;
- database claims of structural tenant safety are false.

Required proof:

- unique constraint on strategies(user_id, id);
- composite foreign key on orders(user_id, strategy_id);
- migration verification for every existing pair;
- negative insert test that must fail;
- source schema and generated metadata match the contracted database.

#### B2. Drizzle source and manual contract diverge

Evidence:

- packages/db/src/schema.ts still declares strategies.userId, orders.userId, and orders.strategyId as nullable.
- It does not declare the contract's strategy foreign key or per-user symbol unique index.
- migration snapshot 0002 represents only the expand phase.
- manual migration 003 changes the database outside the generated migration journal.

Impact:

- TypeScript continues to permit states production PostgreSQL rejects;
- future generated migrations can misread or undo the intended contract;
- a fresh environment using only automatic migrations never reaches Gate 1;
- runtime and source-of-truth reviews reach different conclusions.

Required proof:

- formalize the expand and contract states in a documented migration workflow;
- update the final Drizzle schema after the manual gate;
- generate or record a post-contract migration snapshot;
- prove a clean install and an upgrade converge to the same catalog.

#### B3. Telegram /start can route a user's alerts to a group

Evidence:

- apps/bot/src/caller.ts refuses group and channel contexts for owned commands.
- apps/bot/src/bot.ts registers /start before that guard and writes ctx.chat.id directly to users.telegram_chat_id.
- /start text still tells the user to configure the obsolete global TELEGRAM_CHAT_ID.

Impact:

- a user invoking /start in a group overwrites their notification target with the group id;
- later strategy, risk, order, or digest notifications can disclose that user's activity to the room;
- group refusal tests do not cover the registration path.

Required proof:

- /start must require a private chat before any user upsert;
- store notification eligibility or verified-private-chat state explicitly;
- web-only login must not imply the bot may message that id;
- integration test proves a group /start cannot create or mutate a user/chat binding.

#### B4. PostgreSQL A/B coverage is not a working regression gate

Evidence:

- an uncommitted PGlite harness began appearing during this audit, but its tenant seed module and A/B tests are absent;
- the current harness/typecheck is incomplete, so it does not yet provide a green regression gate;
- current isolation tests explicitly say row-level cases remain outstanding;
- callback ownership, runner routing, same-symbol independence, PnL/performance, and notification isolation are not exercised together.

Impact:

- a future missing predicate can pass all current tests;
- the successful ad-hoc rehearsal cannot protect CI or later refactors;
- Gate 1's own exit criterion is unmet.

Required proof:

- deterministic two-tenant fixture;
- API, BFF, bot, runner, aggregate, callback, session, and migration cases;
- CI PostgreSQL 18 service or an explicitly managed test database;
- failure output names the tenant boundary without printing sensitive data.

#### B5. Production startup and deployment are not fail-closed

Evidence:

- apps/api/src/app.ts skips service authentication whenever API_KEY is absent, independent of NODE_ENV or deployment topology.
- production without API_KEY served /version in the live code probe.
- apps/api/src/server.ts begins listening before startRunner applies migrations.
- startRunner logs migration failure and continues.
- the deployment workflow starts containers and checks docker compose ps, but does not wait for migration evidence or run Gate 1 probes.
- the production runbook does not include the manual ownership sequence.

Impact:

- a misconfigured non-local API is open;
- requests can race a fresh migration;
- a runner may operate against an unknown schema state;
- ordinary deployment never proves the manual contract happened.

Required proof:

- production startup refuses missing API_KEY, SESSION_SECRET, database URL, and required migration version;
- migrations complete before traffic and runner ticks;
- migration failure exits the process;
- deployment health includes schema version and Gate 1 readiness;
- runbook rehearses backup, manual ownership decision, verify, contract, and rollback/forward-fix.

### High priority

#### H1. Telegram Login is replayable for 24 hours

The verifier accepts a signed payload for up to 24 hours and stores no consumed-payload fingerprint. The real probe confirmed that one payload minted two independent sessions.

Use a short operational freshness window, a one-time consumed fingerprint with expiry, per-source and per-user login rate limits, and audit events for success, rejection, replay, and throttling. Telegram's official widget documentation requires integrity verification and recommends checking auth_date; replay policy remains an application responsibility.

#### H2. Session lifetime is absolute-only and overly broad

Web sessions and the cookie last 30 days. lastUsedAt is written but not used to enforce an idle timeout. There is no renewal timeout, active-session view, revoke-all, or security-event revocation.

OWASP recommends server-side idle and absolute expiry, with optional renewal for long sessions. A safer initial policy is a short idle window plus an explicit absolute limit, decided as a product requirement rather than copied blindly.

#### H3. Logout can report success while server revocation failed

The BFF catches an upstream revoke failure, logs it, clears the browser cookie, and returns success. A stolen API token can therefore remain valid for the rest of its 30-day lifetime while the user believes logout killed it.

Logout must either confirm revocation, record a durable retry/revoke-all marker, or visibly report that secure logout did not complete. Cookie clearing is still necessary, but it is not equivalent to server invalidation.

#### H4. The browser-facing session can be stale

GET /api/auth/me returns the user embedded in the sealed cookie without asking whether the API session is expired or revoked. The dashboard can display signed-in state until the next owned-data request returns 401.

The me contract should resolve current server-side session state, clear stale cookies, and never treat cookie contents alone as active authorization.

#### H5. State-changing BFF routes have no explicit CSRF/origin control

Strategy create/update, login, and logout rely on SameSite=Lax and framework request parsing. There is no shared unsafe-method Origin/Referer validator or session-bound CSRF token.

OWASP treats SameSite as defense in depth for applications that do not satisfy its narrow sufficient conditions. At minimum, reject unexpected Origin/Referer on unsafe methods and require a same-origin custom header; a session-bound CSRF token is the stronger general contract.

#### H6. Session cookie misses the strongest host binding

The cookie is Secure in production, HTTP-only, and SameSite=Lax, which is a good baseline. It is named dipbot_session rather than using the __Host- prefix, and path is not explicit.

Use a __Host- name, Secure, no Domain, and Path=/ in production. Keep development behavior separately explicit.

#### H7. Error logging has no proven redaction boundary

Many BFF handlers log the complete upstream error object after apiFetchAs attached x-user-session. Login handlers log errors around a body containing Telegram identity and signature data. Telegram fetch URLs embed the bot token and catch blocks log raw errors.

It is not safe to assume third-party error shapes never contain request options, headers, URLs, or response bodies. Add a single sanitized error mapper and a sentinel test proving session tokens, API keys, bot tokens, Telegram login hashes, database URLs, and financial payloads never appear.

#### H8. Session lifecycle evidence is incomplete and cleanup is unused

Only USER_WEB_LOGIN is recorded. Logout, session issue/revoke/expiry, replay denial, authorization denial, and revoke-all are absent as structured events. deleteExpiredSessions exists but has no caller, and bot API reads create a new five-minute session row per command.

Define separate operational security events and product audit events. Purge expired session rows after a short investigation grace period; do not delete trading audit history.

#### H9. Strategy mutations are not consistently audited

Dashboard/API strategy creation and update do not insert an audit event. Several bot configuration commands update a strategy without recording the old/new safety settings. This breaks the requirement that risk-relevant configuration be explainable later.

Every configuration or enabled-state change must atomically store actor, channel, old value, new value, request id, and timestamp.

#### H10. Order transition and audit writes are not atomic

Runner and bot callbacks change order status first and insert the audit event afterward. A crash between those statements leaves a financial state transition without the required evidence. Notification updates are separate again.

Use one database transaction for the state claim and immutable transition event. Delivery can remain asynchronous, but delivery state needs its own auditable record.

#### H11. Nullable audit ownership has no semantic constraint

Operator-level audit events legitimately need no tenant. The current table also permits a strategy/order event with null user_id; the rehearsal inserted one successfully. Such an event disappears from every tenant feed.

Either separate operator events from tenant events or add a check/typed invariant that requires user_id for every tenant entity/action. Verification must reject tenant-shaped null-owner rows.

#### H12. RLS is absent and cannot be added naively

Application predicates are currently the primary control and worked for coherent rows. PostgreSQL reports RLS disabled on all tenant tables.

RLS can become defense in depth only after:

- a non-owner, non-BYPASSRLS runtime role exists;
- FORCE ROW LEVEL SECURITY is evaluated for owner access;
- tenant context is transaction-local and always cleared;
- direct SQL and pool-reuse tests prove no tenant context leaks;
- backup jobs explicitly avoid silently filtered dumps.

RLS is not a substitute for composite constraints or application authorization.

### Later but required before Demo

#### L1. Region and environment routing is hard-coded

The API, runner, PnL, and performance paths construct clients with https://api.bybit.com. Current Bybit guidance has region-specific mainnet domains, restrictions for US and Mainland China IPs, and a distinct EEA broker flow.

Demo uses https://api-demo.bybit.com and wss://stream-demo.bybit.com for private streams; public WebSocket data remains on mainnet and WebSocket Trade is unsupported. Environment and region must be typed configuration, never caller-provided URLs.

#### L2. Bybit Demo has a seven-day upstream order history

Official Demo documentation states that Demo orders are retained for seven days and rate limits are default/non-upgradable. The product's local append-only evidence and reconciliation checkpoints must therefore be authoritative beyond the upstream window.

#### L3. Deployment and environment docs are stale

.env.example, bootstrap instructions, /start output, and the VPS runbook still center TELEGRAM_CHAT_ID and omit OPERATOR_TELEGRAM_USER_ID, manual ownership migration, session cleanup, Gate 1 readiness, backup restore, and incident evidence.

#### L4. Health is process-oriented, not readiness-oriented

Current health output does not prove migration version, ownership contract, database writability, session storage, runner freshness, or notification routing. Before Demo, readiness must distinguish process alive, dependencies ready, and execution safe.

## PostgreSQL A-versus-B test design

### Fixed fixture

Create:

- user A and user B with verified private chat bindings;
- A/BTCUSDT and B/BTCUSDT strategies with different limits;
- one enabled and one disabled strategy per user;
- completed, pending, cancelled, and rejected orders for each;
- user-owned strategy/order audit events plus separate operator events;
- active, expired, revoked, malformed, and replayed sessions;
- one deliberately inconsistent cross-owner row attempted as a negative fixture.

The database starts from the oldest supported production schema, not the current schema, so migration behavior is part of every run.

### Forty required cases

| Area | Case | Expected |
| --- | --- | --- |
| Migration | Expand on legacy data | Additive; no owner guessed |
| Migration | Verify ownerless strategy/order | Non-zero and named |
| Migration | Contract with unresolved rows | Transaction aborts |
| Migration | Explicit resolution plus rerun | Idempotent success |
| Migration | Clean install versus upgrade | Identical final catalog |
| DB | Null strategy/order owner | Rejected after contract |
| DB | Duplicate user/symbol | Rejected |
| DB | A order with B strategy | Rejected by composite FK |
| DB | Tenant audit with null owner | Rejected |
| DB | Operator audit with null owner | Accepted only for allowed type |
| API auth | Missing service key in production | Startup fails |
| API auth | Valid service key only | User route 401 |
| API auth | Wrong service key plus valid session | 401 |
| API auth | Malformed/unknown session | 401 without database oracle |
| API auth | Expired/revoked session | 401 |
| API auth | Replayed Telegram payload | Second use rejected |
| API auth | Logout then reuse | Rejected immediately |
| API auth | Cookie user but dead API session | me clears session |
| API read | A lists each owned resource | No B row or id |
| API write | A guesses B strategy id | 404 and B unchanged |
| Aggregate | A PnL/performance | No B contribution |
| Same symbol | A and B both use BTCUSDT | Independent config and caps |
| BFF | Cross-site unsafe request | Rejected before API call |
| BFF | API outage | 502, never empty/zero financial state |
| BFF | Upstream error sentinel | No token or sensitive body in logs |
| Bot | Group /start | No user/chat mutation |
| Bot | Group owned command | Refused before query |
| Bot | A callback with B order id | Not found, B unchanged |
| Bot | Replayed callback | Exactly one transition |
| Bot | A pause/resume | B remains enabled state unchanged |
| Bot | Web-only user without verified chat | No notification attempt |
| Runner | Two workers claim due order | One completion only |
| Runner | Callback races executor | One terminal state and one event |
| Runner | Inconsistent owner relation | Quarantined, never notified |
| Runner | Per-user digest | Only that user's aggregates |
| Runner | One Telegram failure | Other users still processed |
| Audit | Strategy mutation | Old/new values and actor stored atomically |
| Audit | Order transition crash injection | State and event commit together or neither |
| Operations | Restore backup | All tenants and audit counts match |
| Safety | Private exchange adapter unreachable | DRY_RUN remains only supported mode |

## Composite constraints and RLS decision

The immediate database defense is relational integrity, not RLS:

1. Make strategies(user_id, id) unique.
2. Reference it from orders(user_id, strategy_id).
3. Require user_id on all tenant strategies and orders.
4. Encode tenant versus operator audit semantics.
5. Keep application owner predicates and A/B tests.

PostgreSQL explicitly supports foreign keys over groups of columns. That is the direct tool for ensuring an order and its strategy share an owner.

RLS is a later defense-in-depth experiment. PostgreSQL documents that table owners and BYPASSRLS roles bypass ordinary policies, while no-policy behavior becomes default-deny only after RLS is enabled. The current production connection uses the postgres superuser, so enabling policies alone would provide false confidence.

## Session, audit, and operations policy

### Sessions

- Use independent absolute, idle, and renewal limits.
- Store only token hash plus safe metadata.
- Record issue, renewal, revoke, expiry, replay rejection, and suspicious use.
- Provide list-active-sessions, revoke-one, and revoke-all.
- Expired/revoked session rows may be purged after an explicit investigation grace period.
- Never log the token, cookie, API key, Telegram hash, or bot token.

### Audit evidence

- Trading/risk/configuration evidence is append-only and has no HTTP delete/truncate path.
- Tenant events always have a tenant owner.
- Operator events use a separate type or table and cannot masquerade as tenant events.
- Status transitions and their evidence commit in one transaction.
- Store normalized facts and request/correlation ids, not raw secret-bearing upstream payloads.
- Retention must outlive Bybit Demo's seven-day order-history window.

### Backups and migration

- Take an encrypted backup immediately before ownership backfill/contract.
- Record row counts and checksums by tenant/table before and after.
- Restore into an isolated PostgreSQL 18 environment and run the same verification report.
- Confirm backup tooling is not accidentally filtered by future RLS.
- Prefer forward-fix after contract; document exact conditions for restore.
- Do not delete ambiguous audit history merely to make the migration green.

### Incidents

Minimum drills:

- suspected tenant leak;
- replayed login/session theft;
- API_KEY or Telegram bot-token exposure;
- migration partially attempted but rolled back;
- orphan/mismatched owner relation;
- Telegram notification delivered to an unexpected chat;
- duplicate or unaudited order transition;
- Bybit Demo outage or seven-day history gap.

## Bybit Demo readiness refresh

Current official constraints checked on 2026-08-02:

- Demo is an independent account with its own UID and Demo-created API key.
- REST base is https://api-demo.bybit.com.
- Private WebSocket base is wss://stream-demo.bybit.com.
- Public WebSocket market data remains on mainnet.
- WebSocket Trade is not supported in Demo, so initial submission must use REST.
- Demo orders are retained for seven days.
- Demo rate limits are default and cannot be upgraded.
- Demo on Testnet is explicitly discouraged.
- Mainnet routing is region-specific; EEA API access is described through the broker third-party connection model.
- Bybit's recent changelog continues to evolve regional hostnames and API behavior, so environment endpoints belong in checked configuration.

Demo implementation is still not authorized by Gate 1. When it becomes eligible, the adapter must fail closed on environment/UID/key mismatch and retain the existing spot-only contract: no leverage, derivatives, transfers, withdrawals, martingale, or unsupported assets.

## Gate 1 decision

### Passed evidence

- Default and reachable behavior remains DRY_RUN.
- No private Bybit adapter is present.
- Central Hono principal is deny-by-default for owned routes.
- Normal API A/B read isolation passed against PostgreSQL 18.4.
- Foreign strategy update returned 404.
- Legacy backfill does not guess.
- Contract refuses unresolved owners.
- Owner NOT NULL and per-user symbol uniqueness work after contract.
- Most API, bot, runner, PnL, and performance queries visibly include owner predicates.

### Blocking evidence

- Cross-owner order/strategy pair accepted.
- Drizzle source does not represent final contract.
- Group /start can establish a group notification destination.
- No automated full PostgreSQL A/B regression suite.
- Production API_KEY and migration startup are fail-open.

Decision: NO-GO for Gate 1 completion and NO-GO for I11/Bybit Demo implementation.

## Dependency-ordered proof and hardening backlog

| ID | Priority | Work | Depends on | Acceptance |
| --- | --- | --- | --- | --- |
| P01 | P0 | Add PostgreSQL 18 integration harness | — | Reproducible locally and in CI without using developer/prod data |
| P02 | P0 | Make final Drizzle schema match contract | P01 | Clean install and upgraded DB have identical catalog |
| P03 | P0 | Add composite order/strategy owner FK | P02 | A-order/B-strategy insert fails |
| P04 | P0 | Constrain tenant versus operator audit ownership | P02 | Tenant null owner fails; explicit operator event passes |
| P05 | P0 | Require private /start and verified chat binding | P01 | Group /start cannot mutate users; web-only login cannot receive bot alerts |
| P06 | P0 | Fail production startup without required secrets | — | Missing API_KEY/SESSION_SECRET/database URL exits non-zero |
| P07 | P0 | Gate traffic and runner on migration readiness | P01,P02,P06 | No listen/tick before migrations; failure exits |
| P08 | P0 | Commit API/BFF A/B matrix | P01-P04 | Reads, writes, aggregates, logout, and same-symbol tests pass |
| P09 | P0 | Commit bot/runner isolation and race matrix | P01,P03,P05 | Callback, chat, digest, notification, and race cases pass |
| P10 | P0 | Make order transitions and audit atomic | P01,P09 | Crash injection commits both or neither |
| P11 | P0 | Audit all risk-relevant strategy/session changes | P01,P04 | Actor/channel/old/new/request id present |
| P12 | P0 | Prevent Telegram Login replay and rate-limit auth | P01 | Same signed payload works once; excess attempts throttled |
| P13 | P1 | Add idle, absolute, renewal, active-session controls | P12 | Server-enforced expiry and revoke-one/all tests |
| P14 | P1 | Make logout and me reflect server revocation | P13 | False success impossible; stale cookie cleared |
| P15 | P1 | Add host-bound cookie and CSRF/origin controls | P14 | Unsafe cross-origin requests rejected |
| P16 | P1 | Centralize safe logging and redaction | P06 | Sentinel secrets absent from all captured logs |
| P17 | P1 | Operate session cleanup and evidence retention | P11,P13 | Expired sessions bounded; audit history preserved |
| P18 | P1 | Update deployment/runbook and restore drill | P02-P17 | Production-like upgrade, backup, restore, and readiness pass |
| P19 | P2 | Prototype RLS with non-owner runtime role | P08,P18 | Direct SQL and pool reuse A/B tests pass; backups complete |
| P20 | P0 gate | Independent Gate 1 rerun | P01-P18 | All forty cases green; only then authorize I11 research/implementation |

Recommended next implementation slice: P01-P07. Do not start P12-P19 before the structural database and startup invariants are green, and do not start any private Bybit work before P20.

## Verification summary

- Automatic migrations: passed against disposable PostgreSQL 18.4.
- Manual backfill/verify/contract refusal path: passed.
- Manual explicit-resolution and contract path: passed.
- Normal two-tenant Hono read isolation: passed.
- Cross-tenant strategy PATCH: returned 404 as required.
- Cross-owner relational negative: failed safely as a product gate because PostgreSQL accepted the invalid pair, confirming blocker B1.
- Telegram Login replay negative: failed safely as a product gate because the replay minted a second session, confirming H1.
- Production missing-API_KEY negative: failed safely as a product gate because the API served the request, confirming B5.
- git diff --check: passed.
- Full pnpm check: could not complete after concurrent uncommitted test-utils/dependency changes left the workspace install inconsistent. Nuxt and drizzle-orm links were missing, and test-utils referenced an absent seed-tenants module. These files were not modified by this research pass.

## Official sources

- Telegram Login Widget: https://core.telegram.org/widgets/login/
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- PostgreSQL 18 constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL 18 row security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Bybit Demo Trading Service: https://bybit-exchange.github.io/docs/v5/demo
- Bybit V5 Integration Guidance: https://bybit-exchange.github.io/docs/v5/guide
- Bybit V5 changelog: https://bybit-exchange.github.io/docs/changelog/v5
