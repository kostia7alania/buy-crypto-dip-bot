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
2. [in progress] Independent bounded reviews identify remaining Gate 1 proof
   and the smallest working web/auth/onboarding flow.
3. [in progress] Implement truthful partial/unavailable portfolio reporting
   and a real runner process-restart proof identified by those observations.
   Use focused checks for security, data preservation and user-visible flow.
4. [in progress] Rehearse migration and recovery on an isolated restored database.
   Never migrate the actual database merely to discover whether it works.
5. [pending] Review evidence. Deploy only when applicable release conditions
   are satisfied; otherwise leave them closed and report the exact blocker.
6. [pending] Publish source, read back Actions and actual hosted state, then
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
- Fresh production backup restoration remains pending verified SSH identity.
