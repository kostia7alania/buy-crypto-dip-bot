# Observability

Reviewed: 2026-09-12. Scope: local recovery source.

Operational events use the shared structured logging contract and correlation
IDs across API, BFF and bot. Error mapping avoids raw credentials, signed
payloads, database URLs and financial message bodies. This is implemented
logging; Pino/OpenTelemetry/Sentry are not current dependencies.

`GET /health` reports process liveness. `GET /health/ready` reports startup
DB/schema/runner readiness and required bot-heartbeat freshness. The recorded
schema version is `0014_bouncy_zuras`; bot freshness expires after 90 seconds.
A heartbeat needs the service key and a distinct bot secret outside local
development. The web container does not receive the bot secret or token.

The readiness snapshot is not proof of every runner tick, provider request,
notification delivery or recovery scenario. Durable outbox states, audit
correlation and operational checks provide the remaining evidence. Full
restore/incident rehearsal and runtime proof remain Gate 1 backlog items.
