import { strategyDefaults } from "@buy-crypto-dip-bot/config";
import { createPostgresConnection, schema } from "@buy-crypto-dip-bot/db";
import { eq } from "drizzle-orm";
import { reserveDryRunOrder } from "./reservation.repository.js";
import { startRunner } from "./runner.service.js";

const connectionString = process.env.POSTGRES18_TEST_URL;
if (
  !connectionString ||
  !/^\/dipbot_runner_process_\d+_[a-f0-9]{8}$/.test(
    new URL(connectionString).pathname,
  )
) {
  throw new Error("ISOLATED_RUNNER_PROCESS_DATABASE_REQUIRED");
}

// A recovery test must never reach an exchange or Telegram, even on failure.
globalThis.fetch = async () => {
  process.stderr.write("RUNNER_PROCESS_UNEXPECTED_NETWORK_REQUEST\n");
  process.exit(1);
};

if (process.argv[2] === "reserve") {
  const { db } = createPostgresConnection(connectionString);
  const [user] = await db
    .insert(schema.users)
    .values({ telegramUserId: "pg18-runner-process-user" })
    .returning();
  if (!user) throw new Error("RUNNER_PROCESS_USER_INSERT_FAILED");
  const [strategy] = await db
    .insert(schema.strategies)
    .values({
      userId: user.id,
      name: "PG18 process recovery",
      symbol: "BTCUSDT",
      mode: "DRY_RUN",
      enabled: true,
      config: { ...strategyDefaults },
    })
    .returning();
  if (!strategy) throw new Error("RUNNER_PROCESS_STRATEGY_INSERT_FAILED");

  const now = new Date();
  const result = await reserveDryRunOrder(db, {
    userId: user.id,
    strategyId: strategy.id,
    ticker: {
      symbol: strategy.symbol,
      lastPrice: 90,
      high24h: 100,
      low24h: 80,
      sourceAt: now.toISOString(),
      receivedAt: now.toISOString(),
      ageMs: 0,
      ttlMs: 30_000,
    },
    executeAt: now,
    now,
    correlationId: "pg18_process_reserve_1234",
  });
  if (result.outcome !== "RESERVED") {
    throw new Error(`RUNNER_PROCESS_RESERVATION_${result.outcome}`);
  }

  // Keep recovery focused on the committed order, without fresh market signals.
  await db
    .update(schema.strategies)
    .set({ enabled: false })
    .where(eq(schema.strategies.id, strategy.id));
  process.send?.("reserve");
  // Leave the pool open and wait for SIGKILL, not a graceful disconnect.
  setInterval(() => {}, 60_000);
} else if (process.argv[2] === "runner") {
  // No order ID or in-memory reservation is supplied to the restarted runner.
  const runner = await startRunner({
    connectionString,
    enabled: true,
    databaseInitialization: "migrate",
  });
  process.once("SIGTERM", () => {
    void runner.stop().then(
      () => process.disconnect?.(),
      () => {
        process.stderr.write("RUNNER_PROCESS_DRAIN_FAILED\n");
        process.exitCode = 1;
        process.disconnect?.();
      },
    );
  });
  process.send?.("runner");
} else {
  throw new Error("RUNNER_PROCESS_MODE_REQUIRED");
}
