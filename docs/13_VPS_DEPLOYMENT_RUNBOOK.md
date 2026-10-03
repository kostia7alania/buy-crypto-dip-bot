# Production VPS release runbook

Updated: 2026-09-14. Source procedure only, not a completed deployment.
[Project status](23_PROJECT_STATUS.md) remains Gate 1 NO-GO.

## Release authority

The Deploy workflow runs checks, PostgreSQL 18 contracts and build before
publishing a commit-tagged, revision-labelled image. Deployment consumes its
immutable digest, never latest. It requires main, the production environment,
DEPLOY_ENABLED=true and GATE1_APPROVED=true. Leave the gates closed until the
integrated proof and destination rehearsal have been reviewed.

The server receives compose and scripts/deploy-release.sh from exactly the
workflow commit SHA. Its local .env stays private. The bootstrap script also
requires a 40-character REPO_REF and refuses to replace an existing shared
Traefik/VPN configuration. Bootstrap is a host preparation procedure, not a
command to run during local source validation.

## Before enabling a release

1. Record the current image IDs, source revision, PostgreSQL version and complete
   migration journals. Inventory unresolved owners and quarantine records.
2. Restore a fresh destination backup into an isolated database, including the
   roles needed by the rehearsal. Run the guarded migration and application
   contracts against the restore. Compare original audit fields, amounts and
   tenant ownership. A readable pg_restore list is not this rehearsal.
3. Verify source checks, A/B and restart/delivery proof, proxy/header trust,
   service secrets, bot heartbeat and exact DRY_RUN allowlist on both services.
   Set `NUXT_PUBLIC_TELEGRAM_BOT_USERNAME` to the username of the configured
   Telegram bot, without `@`, and configure this site's domain through BotFather.
   Production Compose rejects a missing/empty username before stopping writers;
   it does not verify that the username matches the token or that BotFather's
   domain setting is correct. Verify the real login flow after rollout.
4. Review the maintenance window, backup retention/off-host accessibility and
   forward-repair/restore decision with the actual destination inventory.

Unknown/mixed/modified journals and unjournalled application tables fail
closed. Unresolved strategy/order ownership needs a reviewed remediation;
never edit hashes or assign rows to the deploying user to make a migration pass.

## Implemented sequence

1. Validate the target SHA/digest and compose, then pull the image.
2. Save previous compose, private environment and actual container image IDs
   under .deploy. These files contain sensitive deployment configuration and
   retain restrictive permissions.
3. Stop API, bot and web writers. Start/check only PostgreSQL and create a
   custom-format backup. Check archive readability and retain it.
4. Run the one-shot migrate service. It uses the same guarded runner as API
   startup and the documented database CLI.
5. Install the target compose/digest and start services. API liveness allows
   bot startup; final /health/ready also checks the bot heartbeat.
6. Check the web root and HTTP-to-HTTPS redirect. Record successful release
   metadata. No automatic image pruning removes the previous recovery artifact.

API and bot share the reviewed symbol policy. An explicitly empty allowlist
remains empty. Compose fixes execution to DRY_RUN. The web service receives
neither the bot heartbeat secret nor the Telegram bot token.

## Failure behavior

Before DDL is attempted, failure can restart the existing containers. After a
migration attempt, the outcome is treated as potentially committed, including
client disconnects. Failure leaves application services stopped. Do not start
an old image against the new catalog just because its tag exists.

Choose a reviewed forward repair or a restore based on exact catalog and backup
evidence. No script restores over the database or deletes audit history
automatically. The .deploy previous image IDs and backup are inputs to recovery,
not proof that an old release is schema-compatible.

## Subsequent migrations

Use the guarded db:migrate command with an explicit POSTGRES_CONNECTION_STRING.
Only migrations/forward accepts new SQL after convergence. db:generate creates
custom SQL drafts; do not use automatic diffing against old root snapshots,
direct drizzle-kit migrate, or schema push. See
[the migration authority](../packages/db/migrations/README.md).

No VPS, provider, repository variable or production configuration was changed
by the September 14 implementation. Shell/compose and isolated fixture checks
are narrower than a deployment/restore rehearsal.
