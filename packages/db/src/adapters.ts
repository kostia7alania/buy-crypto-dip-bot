import { Socket } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  migrateKnownHistory,
  verifyKnownHistory,
} from "./migration-history.js";
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

export const probePostgresConnection = async (
  connectionString: string,
): Promise<boolean> => {
  const socket = new Socket();
  const client = new pg.Client({
    connectionString,
    stream: () => socket,
    connectionTimeoutMillis: 1_000,
    query_timeout: 1_000,
    statement_timeout: 1_000,
  });
  let failed = false;
  let available = false;
  // An idle socket error must fail this probe, not terminate the API process.
  client.on("error", () => {
    failed = true;
  });
  // Own the transport so the total budget also bounds connection cleanup.
  const deadline = setTimeout(() => {
    failed = true;
    socket.destroy();
  }, 2_000);
  try {
    await client.connect();
    // pg supports a per-query timeout; its older type package omits the field.
    const query = { text: "SELECT 1", query_timeout: 1_000 };
    await client.query(query);
    available = true;
  } catch {
    failed = true;
  } finally {
    await client.end().catch(() => {
      failed = true;
    });
    clearTimeout(deadline);
  }
  return available && !failed;
};

const resolveMigrationsFolder = () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // In production the app is bundled, so the relative path from this file no
  // longer points at packages/db/migrations — the image sets
  // DB_MIGRATIONS_DIR to the copied migrations folder instead.
  return (
    process.env.DB_MIGRATIONS_DIR ?? path.resolve(__dirname, "../migrations")
  );
};

export const runMigrations = async (
  db: DatabaseConnection["db"],
): Promise<void> => migrateKnownHistory(db, resolveMigrationsFolder());

export const verifyRuntimeDatabase = async (
  db: DatabaseConnection["db"],
): Promise<void> => verifyKnownHistory(db, resolveMigrationsFolder());
