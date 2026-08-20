import {
  createPostgresConnection,
  type DatabaseTransaction,
} from "@buy-crypto-dip-bot/db";

const connectionString =
  process.env.POSTGRES_CONNECTION_STRING ??
  "postgresql://postgres:local_password@localhost:5432/dipbot";

let dbInstance: ReturnType<typeof createPostgresConnection> | null = null;

export function getDb() {
  return getDbConnection().db;
}

export function getDbConnection() {
  if (!dbInstance) {
    dbInstance = createPostgresConnection(connectionString);
  }
  return dbInstance;
}

export async function closeDb() {
  if (!dbInstance) return;
  const connection = dbInstance;
  dbInstance = null;
  await connection.pool.end();
}

export type Db = ReturnType<typeof getDb>;
export type TenantDb = DatabaseTransaction;
