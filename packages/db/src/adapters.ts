import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { schema } from "./schema.js";

export type DatabaseRuntime = "production" | "local" | "test";
export type DatabaseDialect = "postgresql";

export interface DatabaseConnection {
  db: ReturnType<typeof drizzle<typeof schema>>;
  pool: pg.Pool;
}

export const createPostgresConnection = (
  connectionString: string,
): DatabaseConnection => {
  if (!connectionString) {
    throw new Error("POSTGRES_CONNECTION_STRING_REQUIRED");
  }

  const pool = new pg.Pool({
    connectionString,
  });

  const db = drizzle(pool, { schema });

  return { db, pool };
};

export const runMigrations = async (
  db: ReturnType<typeof drizzle<typeof schema>>,
): Promise<void> => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // In production the app is bundled, so the relative path from this file no
  // longer points at packages/db/migrations — the image sets
  // DB_MIGRATIONS_DIR to the copied migrations folder instead.
  const migrationsFolder =
    process.env.DB_MIGRATIONS_DIR ?? path.resolve(__dirname, "../migrations");
  await migrate(db, { migrationsFolder });
};
