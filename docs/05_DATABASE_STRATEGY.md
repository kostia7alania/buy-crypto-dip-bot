# Database Strategy

PostgreSQL everywhere: production runtime and local development (via
`docker compose up -d`). The Drizzle schema in `packages/db` defines
first-class `users`, `strategies`, `orders`, and `audit_events` tables.

SQLite was dropped (2026-07): a single engine removes adapter drift between
dev and prod. See ADR 002.

Key columns:

- `users.telegram_user_id` — identity anchor shared by the bot and the web
  dashboard (Telegram Login / Mini App initData resolve to the same id).
- `orders.execute_at` — pending orders are executed by the runner when due;
  DB-driven so they survive process restarts.
- `orders.tg_message_id` — lets the runner finalize the Telegram alert
  message even after a restart.
