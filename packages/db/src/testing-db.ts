import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { schema } from "./schema.js";

// A real PostgreSQL, in process.
//
// PGlite is Postgres compiled to WebAssembly, so tests get genuine Postgres
// semantics — constraints, transactions, RAISE, unique indexes — without
// Docker or a running server. That matters here specifically: the tenant
// isolation this repo depends on is enforced partly by SQL constraints, and a
// mocked database would happily "pass" tests that a real one would reject.
//
// Each call gets its own fresh in-memory database, so tests never share state.

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export interface TestDatabase {
  db: TestDb;
  /** Escape hatch for raw SQL — used to exercise the manual migration scripts. */
  exec: (sql: string) => Promise<unknown>;
  close: () => Promise<void>;
}

const migrationsFolder = () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // packages/db/src -> packages/db/migrations
  return path.resolve(here, "../migrations");
};

/**
 * Creates an empty database with every committed migration applied.
 *
 * Running the real migration files (rather than pushing the schema) means the
 * migrations themselves are under test: a migration that cannot actually run
 * fails here instead of on a production deploy.
 */
export const createTestDb = async (): Promise<TestDatabase> => {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: migrationsFolder() });

  return {
    db,
    exec: (sql: string) => client.exec(sql),
    close: () => client.close(),
  };
};

/**
 * Same, but without migrations — for tests that need to build a legacy-shaped
 * database by hand before exercising a backfill.
 */
export const createEmptyTestDb = async (): Promise<TestDatabase> => {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  return {
    db,
    exec: (sql: string) => client.exec(sql),
    close: () => client.close(),
  };
};
