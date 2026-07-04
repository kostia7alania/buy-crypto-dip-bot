# Database Strategy

PostgreSQL is the production database. The Drizzle schema in `packages/db`
defines first-class `strategies`, `orders`, and `audit_events` tables.

SQLite is allowed only through local/dev/test adapter placeholders. It is not a
production runtime and must not be wired to live trading or private exchange
actions.
