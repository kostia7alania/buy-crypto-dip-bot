# Tenant integration research and decisions

Researched and implemented: 2026-09-14. Baselines: recovery `d183fa2` and
fetched main `becc46bb3b957c484324dbc3c517d5db7762be97`.

## Decision for this project

Keep the recovery runtime's opaque sessions, replay protection, CSRF boundary,
reviewed-symbol policy, immutable audit and typed notification outbox. Add
main's personal tenant foundation, restricted database role, dashboard snapshot
and immutable release flow. Converge both real migration histories using
explicit forward SQL on the current PostgreSQL/Node/VPS stack. The separate
Supabase/Cloudflare cutover remains a later stage.

The immediate risk is the incompatible database history. Both branches contain
a migration numbered 0002, but they create different ownership models and
constraints. A source merge cannot establish which SQL has already run on a
destination database. Renumbering cannot establish that its data satisfies a
migration's preconditions either. Source lineage, actual catalog and runtime
authority must be verified separately.

No new dependency was needed. The implementation uses installed Drizzle ORM
0.45.2, Drizzle Kit 0.31, PostgreSQL 18, Hono and Nuxt 4. An ORM upgrade or hosting
move would add variables without removing the data-preservation problem.
This document records the research, concrete choices and their limits. Command
results belong to the dated appendix in the implementation evidence document.

## Database authority: findings from primary sources

PostgreSQL RLS restricts ordinary row access after it is enabled. Missing
applicable policies deny access. Superusers and BYPASSRLS roles remain outside
that protection; table owners normally bypass it unless FORCE is enabled.
Testing an owner-filtered query as postgres therefore does not prove RLS. The
integration tests execute unqualified reads and forbidden writes as the actual
restricted role. Table-level operations and integrity checks have additional
rules, so ownership foreign keys and application authorization remain necessary.
[PostgreSQL 18 RLS](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)

Policies distinguish row visibility through USING from accepted writes through
WITH CHECK. Permissive policies can combine with OR: keeping an old broad
policy beside a new policy may preserve the original leak. The convergence SQL
replaces known policies. Foreign-key errors can reveal information even where
RLS blocks ordinary reads, which is another reason to retain owner-qualified
application lookups and the existing foreign-ID 404 behavior.
[PostgreSQL CREATE POLICY](https://www.postgresql.org/docs/18/sql-createpolicy.html)

SET LOCAL ends with the transaction. Ordinary SET may survive a request on a
pooled connection. The implemented helper sets both user and tenant locally,
changes to dipbot_app locally, and passes the same transaction to the operation.
The caller does not select the identity through a header. Tests reuse a pool of
size one across A, a failed foreign write and B, then verify the cleared context.
[PostgreSQL SET](https://www.postgresql.org/docs/18/sql-set.html)

node-postgres requires every statement of a transaction to use the same client.
Setting context with one pool.query call and issuing a later query independently
through the pool cannot satisfy that requirement. withPersonalTenant therefore
passes the transaction object to each reader/writer; Hono stores it in the
request context only while the transaction is active.
[node-postgres transactions](https://node-postgres.com/features/transactions)

Transaction-level advisory locks release on commit or rollback. This makes one
fixed application lock a suitable serialization point for startup migrations.
Ordinary table locks still govern DDL. The runner uses a five-second lock
timeout and a 120-second statement timeout. A timeout fails the attempt; it
never permits skipping the lock or recording an unapplied migration.
[PostgreSQL locking](https://www.postgresql.org/docs/18/explicit-locking.html)

ALTER TABLE operations have different locking requirements. NOT VALID and
later VALIDATE can help stage some constraints, but they are not a general
online-upgrade guarantee. For this pre-launch integration the release procedure
stops writers and takes a backup before DDL. Actual destination table sizes and
lock duration still require a rehearsal.
[PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html)

Drizzle supports custom SQL migrations. Its installed PostgreSQL migrator was
also inspected locally: it advances against the last applied timestamp and
does not validate the entire applied sequence against our two known histories.
That is a version-specific observation from installed source, not a claim about
future releases. Reviewed custom SQL is appropriate for this convergence and
for the policies/triggers not fully represented by old schema snapshots.
[Drizzle migration generation](https://orm.drizzle.team/docs/drizzle-kit-generate)

## Chosen migration mechanism

| Option | Decision |
| --- | --- |
| Renumber and replay both 0002 files | Rejected. Overlapping ownership backfills and DDL do not become compatible by changing a filename. |
| Relabel the old journal as the preferred branch | Rejected. It records execution that never happened and hides provenance. |
| Recreate the database | Rejected. Audit and ownership evidence are part of the product contract. |
| Upgrade the ORM first | Deferred. It leaves the existing data mapping unresolved. |
| Freeze histories and execute explicit forward bridges | Implemented and tested from clean, recovery and cost-first starting points. |

The guarded runner compares every applied hash and timestamp with an exact
known prefix. Empty and shared 0000/0001 histories follow recovery. Recognized
main histories follow the archived cost-first lineage. Missing, modified,
reordered or mixed entries fail before application-table writes. So do public
tables, views or sequences without an applied journal. A table name or the
largest migration number is never accepted as proof of a baseline.

Original SQL stays unchanged. The recovery history remains at the root through
0014. Main's exact original SQL and journal are under histories/cost-first.
A separate convergence marker records the actual source history and the hashes
of the two bridge files. It does not relabel the original Drizzle journal.
Once released, those bridge files are immutable as well.

The main-to-recovery bridge preserves original audit IDs, payloads, actions,
timestamps and actor fields while adding recovery metadata and constraints.
The shared tenant foundation fills provable personal tenants for strategies
and orders. Historical recovery audit can retain a null tenant column; its
owner still governs visibility, and the immutable row is not rewritten merely
to populate a new column.

A quarantine strategy or order without a provable personal owner fails the
preflight. There is no fallback to the deploying operator, current session or
default Telegram chat. Such data needs an explicit ownership decision and a
separate reviewed remediation. The negative fixture proves refusal leaves the
rows and original journal unchanged without half-created sessions or marker.
This supported refusal does not imply every historical database can upgrade
unattended.

The target retains a Telegram identity compatibility window. Main identities
that cannot be represented by the present Telegram runtime are refused rather
than guessed. New trusted user inserts provision their personal tenant, owner
membership and Telegram identity through an invoker trigger. Identity profile
fields are a compatibility snapshot. Before OIDC becomes active, its profile
update contract and canonical authority must be defined separately.

Subsequent SQL belongs in migrations/forward. Its journal records execution
after either convergence path. A real PG test creates a later SQL migration,
applies it exactly once to both lineages, rejects an edited applied file, and
proves a failed SQL statement rolls back DDL and journal together. The regular
db:migrate command uses the guarded runner. db:generate creates a custom SQL
draft instead of diffing against the obsolete 0014 snapshot.

Startup also checks critical RLS flags, restricted-role attributes and tenant
triggers. This is not a universal catalog-drift detector. The PG suite separately
compares columns, nullability, defaults, constraints, indexes, policies and
triggers across all three supported paths. Production catalog inspection is
still a release requirement.

## Runtime identity and remaining trust

The authority chain is sealed browser session, opaque API session token,
API-resolved user, database-resolved personal tenant. The service API key proves
the service caller, not the human user. Main's header-only identity boundary was
not carried into this runtime, and the browser never receives the service key.

Owned API routes enter one transaction with dipbot_app. This role cannot log in,
is not superuser and has no BYPASSRLS. Strategies/orders have tenant policies
and owner/tenant constraints. Audit reads require the owner and a matching
membership; append-only grants and the immutable trigger remain. Notification
outbox ownership also requires the matching tenant context.

The helper additionally protects bot strategy/configuration and order mutations,
runner default insertion, order reservation and due completion. Existing
conditional claims and atomic audit writes remain. Auth/bootstrap, session
lookup, scheduler discovery, delivery processing and some owner-qualified bot
reads still use the trusted privileged connection. Thus this proves RLS inside
designated transactions, not containment of arbitrary SQL through that pool.
Separate service credentials and the full integrated security matrix remain
part of release proof.

Supabase documents service-role RLS bypass and different direct/pooling modes.
Hyperdrive documents transaction pooling. Transaction-local context is a useful
foundation for those targets, but none of this proves that the current Node
application already runs on an edge runtime. The cutover requires its own
identity, connection and worker-entry tests.
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres),
[Hyperdrive pooling](https://developers.cloudflare.com/hyperdrive/concepts/connection-pooling/)

## One dashboard request and account transitions

The page owns one snapshot request. A single hook owns its timer, cancellation
and cache. Strategy, audit, order, PnL and performance widgets receive props;
mutations emit refresh requests. Existing visual layout and editing controls
remain. This removes the independent periodic widget readers without embedding
request coordination in presentation components.

The API snapshot reuses the owner-qualified readers within a read-only,
repeatable-read transaction. Database reads share a transaction view. Separate
public market observations are not claimed to come from one instant; common
market-snapshot provenance and partial/stale valuation remain N10 work.

Refresh waits 30 seconds after completion, or three seconds with a pending
order. Overlapping refresh requests coalesce. Hidden pages stop scheduling and
cancel the current request; a stale visible page refreshes. Page Visibility is
the direct signal here, whereas window focus alone does not establish that a
page is hidden. [MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)

AbortController can cancel fetch and response consumption. It is combined with
Nuxt cache invalidation on identity change, because cancellation alone is not
proof against a result already queued for application. The browser fixture
holds A's response across logout and login as B. A 401 clears signed-in state
and pauses private refresh. The BFF preserves upstream failure status instead
of presenting an outage as an empty successful portfolio.
[MDN AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)

Actual browser inspection found an integration race: the login widget and the
new hook both cleared the snapshot. The widget could cancel the new account's
first request after it started. Snapshot invalidation now has one owner, the
hook. The widget clears only older private keys. After a fresh reload, the
first fixture request returned success immediately; logout/re-login installed
one callback/widget, B saw B, and the delayed A response did not replace it.
These are real Nuxt/browser tests with mocked responses, not provider login.

Public SEO pages are prerendered. Dashboard is CSR, noindex and no-store; its
BFF response is private and varies by Cookie. Signed-out copy no longer
advertises a backtest immediately available without the required login.

## Migration-aware release and backup

The workflow verifies checks, PostgreSQL contracts and build before publishing
a revision-labelled image. Deployment uses its digest and downloads compose
and release script at the same commit SHA. It requires main, the production
environment, DEPLOY_ENABLED and GATE1_APPROVED. No actual repository variables
or production settings were changed here. Existing action version tags remain;
full-SHA action pinning is separate hardening, not a fabricated set of hashes.
[GitHub Actions security](https://docs.github.com/en/actions/reference/security/secure-use)

The release script validates/pulls first, preserves previous compose and actual
container image IDs, stops API/bot/web writers, then takes the database backup.
The one-shot guarded migration runs before new application services. API
liveness permits bot startup; final readiness also requires the bot heartbeat.
This avoids making bot startup depend on readiness which requires that bot.

pg_dump -Fc creates the archive. pg_restore --list checks readability, not a
successful restore. The archive alone also does not include cluster-wide roles.
The destination needs a restore into an isolated database plus application
contract checks, backup retention and off-host accessibility proof before GO.
[PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html)

After any migration attempt, the script treats the outcome as potentially
committed even if the client did not receive a reply. Failure stops application
services and requires reviewed forward repair or restoration. Starting an old
image automatically would be unsafe because its schema and audit writes may be
incompatible. No automatic restore overwrites the database, and audit history
is not deleted by the release flow.

## Preserved history and later work

Main's event ledger, generic outbox and evaluation-key columns survive with
original data. The active runtime keeps recovery's single-flight runner,
pending-order uniqueness, typed notification outbox and digest. Main's
minute-slot/generic dispatch paths are not activated in parallel. Scheduling
changes must be reviewed together with the outstanding reservation accounting
and decision-snapshot requirements, not conflated with database convergence.

The transactional outbox pattern commits durable work with state changes, but
delivery can repeat and consumers need idempotency. The current lifecycle
records requested, attempted and delivered outcomes; it does not claim
exactly-once Telegram delivery. [AWS transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)

The next bounded work is the complete integrated isolation/restart/outbox proof
and reservation accounting, then real destination restore/readiness and
Telegram checks. Cloudflare entries, Supabase OIDC/JWT, webhooks, Cron/Queues
and measured provider costs remain the platform stage. Private exchange work
remains outside Gate 1. Local checks and documentation updates do not change
Gate 1's NO-GO verdict.
