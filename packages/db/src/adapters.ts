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
  const migrationsFolder = path.resolve(__dirname, "../migrations");
  await migrate(db, { migrationsFolder });
};
