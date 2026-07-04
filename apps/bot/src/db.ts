import { createPostgresConnection } from "@buy-crypto-dip-bot/db";

const connectionString =
  process.env.POSTGRES_CONNECTION_STRING ??
  "postgresql://postgres:local_password@localhost:5432/dcaguard";

let dbInstance: ReturnType<typeof createPostgresConnection> | null = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = createPostgresConnection(connectionString);
  }
  return dbInstance.db;
}
