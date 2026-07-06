# ADR 002: PostgreSQL Everywhere (SQLite Dropped)

Status: accepted (supersedes the original "Postgres prod / SQLite dev" split, 2026-07).

## Decision

PostgreSQL is the only database engine, for production and local development
alike. Local dev runs Postgres via `docker compose up -d`.

## Context

The original plan allowed SQLite for local/dev/test. After research we dropped
it: running Postgres locally in Docker is now the norm, and a single engine
eliminates a whole class of adapter drift (SQL dialect differences, missing
`jsonb`/`numeric` semantics, migration divergence) between dev and prod.

## Consequences

- `packages/db` ships a single Drizzle Postgres adapter; no dialect switching.
- Tests that need a database use the docker-compose Postgres.
- `LOCAL_SQLITE_PATH` and any SQLite placeholders are gone from env/config.
