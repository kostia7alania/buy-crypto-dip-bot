import { createPostgresConnection } from "@buy-crypto-dip-bot/db";
import { resolveApiRuntimeConfig } from "./runtime-config.js";

let dbInstance: ReturnType<typeof createPostgresConnection> | null = null;
let closePromise: Promise<void> | null = null;

export function getDb() {
  if (closePromise) throw new Error("API_DATABASE_CLOSED");
  if (!dbInstance) {
    dbInstance = createPostgresConnection(
      resolveApiRuntimeConfig().postgresConnectionString,
    );
  }
  return dbInstance.db;
}

export function closeDb(): Promise<void> {
  closePromise ??= dbInstance?.pool.end() ?? Promise.resolve();
  return closePromise;
}
