import { createPostgresConnection } from "@buy-crypto-dip-bot/db";

const connectionString =
  process.env.POSTGRES_CONNECTION_STRING ??
  "postgresql://postgres:local_password@localhost:5432/dipbot";

let dbInstance: ReturnType<typeof createPostgresConnection> | null = null;
let closePromise: Promise<void> | null = null;

export function getDb() {
  if (closePromise) throw new Error("API_DATABASE_CLOSED");
  if (!dbInstance) {
    dbInstance = createPostgresConnection(connectionString);
  }
  return dbInstance.db;
}

export function closeDb(): Promise<void> {
  closePromise ??= dbInstance?.pool.end() ?? Promise.resolve();
  return closePromise;
}
