import { runMigrations } from "@buy-crypto-dip-bot/db";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { closeDb, getDbConnection } from "./db.js";
import { startRunner } from "./modules/runner/runner.service.js";

const port = Number(process.env.PORT ?? 8787);
const main = async () => {
  const connection = getDbConnection();

  console.log("Running pending database migrations before readiness...");
  await runMigrations(connection.db);
  console.log("Database migrations completed successfully.");

  serve({ fetch: createApp().fetch, port }, (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  });

  await startRunner();
};

process.once("SIGTERM", () => {
  void closeDb();
});

main().catch(async (error) => {
  console.error("API startup failed before readiness:", error);
  await closeDb().catch(() => {});
  process.exitCode = 1;
});
