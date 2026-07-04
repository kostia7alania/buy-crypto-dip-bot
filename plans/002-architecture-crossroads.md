# ExecPlan 002 — Lean Core Dry-Run Trading Loop

This plan pivots to a lean, single-tenant MVP focused on building the core business logic (fetching prices, evaluating strategies/risk, and creating dry-run orders) before adding secondary complexities like user accounts, multi-tenancy, or SaaS billing.

## 1. Scope of the Lean MVP

Our goal is to build a fully working local loop that does the following:
1.  **Local Database:** Run a local PostgreSQL instance via Docker Compose.
2.  **Drizzle Setup:** Wire the concrete Drizzle PG adapter to connect to this database and run migrations.
3.  **The Runner Loop:** A background service in `apps/api` that runs periodically (e.g. every 30 seconds) to fetch BTCUSDT prices from Bybit, run the strategy and risk engine, and save dry-run orders/audit logs to the database.
4.  **Web Dashboard:** The Nuxt dashboard fetches these real orders and audit logs from the database (via BFF) and displays them.
5.  **Telegram Bot:** Sends messages to your `@dca_guard_dev_bot` when an order is created or a limit is breached.

---

## 2. Proposed Changes

### Component 1: Local Postgres Setup (Root)

#### [NEW] `docker-compose.yml`
Define a lightweight local Postgres service:

```yaml
version: '3.8'
services:
  db:
    image: postgres:16-alpine
    container_name: dca-guard-db
    ports:
      - '5432:5432'
    environment:
      POSTGRES_DB: dcaguard
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: local_password
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

### Component 2: Database Connection & Migrations (`packages/db`)

We will replace the mock placeholders in `packages/db` with a concrete Postgres Drizzle adapter.

#### [MODIFY] [adapters.ts](file:///Users/kostiabazrov/Documents/apps/pet/buy-crypto-dip-bot/packages/db/src/adapters.ts)
Implement the actual Drizzle PG connection logic using the `pg` package:

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { schema } from "./schema.js";

export const createPostgresConnection = (connectionString: string) => {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, pool };
};
```

---

### Component 3: The Trading Loop Engine (`apps/api`)

Create a background runner in the Hono API app.

#### [NEW] `apps/api/src/modules/runner/runner.service.ts`
Implement a simple interval loop:
1.  Fetch current ticker (BTCUSDT) from Bybit.
2.  Run `strategy-engine`'s `evaluateDipStrategy` (threshold e.g. 5%).
3.  If buy signal generated, fetch today's spent USDT from the DB.
4.  Run `risk-engine`'s `evaluateRisk`.
5.  If approved, insert a new `DRY_RUN` order into the database, write an audit event, and send a notification.

---

### Component 4: Nuxt Dashboard Integration (`apps/web`)

Modify Nuxt API routes to query the Postgres database instead of returning static stubs.

#### [MODIFY] `apps/web/server/api/orders.get.ts`
Retrieve dry-run orders from Postgres.

#### [MODIFY] `apps/web/server/api/audit.get.ts`
Retrieve audit event logs from Postgres.

---

### Component 5: Telegram Bot Command Handler (`apps/bot`)

Configure the grammY bot to connect to the database to show real stats on `/status` (e.g. total dry-run orders placed today) and send live trading notifications.

---

## 3. Verification Plan

### Automated Verification
- Run `docker compose up -d` to start local PG.
- Run `pnpm check` to verify types, lint, and tests.

### Manual Verification
- Send `/status` to `@dca_guard_dev_bot` and see real-time database totals.
- Open the dashboard at `http://localhost:3000` to view the list of executed dry-run purchases.
