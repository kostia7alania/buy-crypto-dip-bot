import { createPostgresConnection } from "@buy-crypto-dip-bot/db";
import { resolveBotRuntimeConfig } from "./runtime-config.js";

let dbInstance: ReturnType<typeof createPostgresConnection> | null = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = createPostgresConnection(
      resolveBotRuntimeConfig().postgresConnectionString,
    );
  }
  return dbInstance.db;
}
