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

1. [in progress] Inspect the existing destination without reading user rows or
   exposing credentials. Identify source/image, capacity, schema lineage and
   readiness. GitHub already has VPS SSH secrets; local SSH target is absent.
2. [in progress] Independent bounded reviews identify remaining Gate 1 proof
   and the smallest working web/auth/onboarding flow.
3. [pending] Implement the concrete blockers justified by those observations.
   Use focused checks for security, data preservation and user-visible flow.
4. [pending] Rehearse migration and recovery on an isolated restored database.
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
