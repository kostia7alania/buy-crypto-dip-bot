import { randomBytes } from "node:crypto";
import {
  createPostgresConnection,
  runMigrations,
  schema,
} from "@buy-crypto-dip-bot/db";
import type { MarketTicker } from "@buy-crypto-dip-bot/exchange-core";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { claimDueDryRunOrder } from "./order.repository.js";
import { reserveDryRunOrder } from "./reservation.repository.js";

const testUrl = process.env.POSTGRES18_TEST_URL;
if (process.env.REQUIRE_POSTGRES18_TEST === "1" && !testUrl) {
  throw new Error("POSTGRES18_TEST_URL_REQUIRED");
}

const describePostgres18 = testUrl ? describe : describe.skip;
const databaseName = `dipbot_reservation_${process.pid}_${randomBytes(4).toString("hex")}`;
const connections: ReturnType<typeof createPostgresConnection>[] = [];
const closed = new Set<ReturnType<typeof createPostgresConnection>>();
let admin: ReturnType<typeof createPostgresConnection>;
let databaseUrl: string;
let userId: string;
let strategyId: string;

const connect = (url: string) => {
  const connection = createPostgresConnection(url);
  connections.push(connection);
  return connection;
};

const close = async (
  connection: ReturnType<typeof createPostgresConnection>,
) => {
  if (closed.has(connection)) return;
  await connection.pool.end();
  closed.add(connection);
};

const ticker: MarketTicker = {
  symbol: "BTCUSDT",
  lastPrice: 90,
  high24h: 100,
  low24h: 80,
  sourceAt: "2026-09-16T02:59:55.000Z",
  receivedAt: "2026-09-16T03:00:00.000Z",
  ageMs: 5_000,
  ttlMs: 30_000,
};

describePostgres18("PostgreSQL 18 reservation concurrency and restart", () => {
  beforeAll(async () => {
    admin = connect(testUrl as string);
    const version = await admin.pool.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );
    expect(Number(version.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(
      180_000,
    );
    expect(Number(version.rows[0]?.server_version_num)).toBeLessThan(190_000);
    await admin.pool.query(`CREATE DATABASE "${databaseName}"`);
    const url = new URL(testUrl as string);
    url.pathname = `/${databaseName}`;
    databaseUrl = url.toString();

    const setup = connect(databaseUrl);
    await runMigrations(setup.db);
    const [user] = await setup.db
      .insert(schema.users)
      .values({ telegramUserId: "pg18-reservation-user" })
      .returning({ id: schema.users.id });
    if (!user) throw new Error("PG18_TEST_USER_INSERT_FAILED");
    userId = user.id;
    const [strategy] = await setup.db
      .insert(schema.strategies)
      .values({
        userId,
        name: "PG18 BTC reservation",
        symbol: "BTCUSDT",
        mode: "DRY_RUN",
        enabled: true,
        config: {
          thresholdPercent: 1,
          suggestedQuoteAmount: 20,
          maxDailySpendUsdt: 100,
          maxWeeklySpendUsdt: 500,
          cooldownMinutes: 0,
        },
      })
      .returning({ id: schema.strategies.id });
    if (!strategy) throw new Error("PG18_TEST_STRATEGY_INSERT_FAILED");
    strategyId = strategy.id;
    await close(setup);
  }, 60_000);

  afterAll(async () => {
    for (const connection of connections) {
      if (connection !== admin) await close(connection);
    }
    if (admin) {
      await admin.pool.query(
        `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
      );
      await close(admin);
    }
  });

  it("serializes competing reservations and settles the durable hold after restart", async () => {
    const firstProcess = connect(databaseUrl);
    const secondProcess = connect(databaseUrl);
    const input = {
      userId,
      strategyId,
      ticker,
      executeAt: new Date("2026-09-16T03:00:15.000Z"),
      now: new Date("2026-09-16T03:00:00.000Z"),
    };
    const outcomes = await Promise.all([
      reserveDryRunOrder(firstProcess.db, {
        ...input,
        correlationId: "pg18_reserve_first_1234",
      }),
      reserveDryRunOrder(secondProcess.db, {
        ...input,
        correlationId: "pg18_reserve_second_1234",
      }),
    ]);
    const winners = outcomes.filter(
      (outcome) => outcome.outcome === "RESERVED",
    );
    expect(winners).toHaveLength(1);
    expect(outcomes).toContainEqual({ outcome: "SKIPPED", reason: "PENDING" });
    const winner = winners[0];
    if (winner?.outcome !== "RESERVED") return;

    await Promise.all([close(firstProcess), close(secondProcess)]);

    const restartedProcess = connect(databaseUrl);
    const completed = await claimDueDryRunOrder(
      restartedProcess.db,
      winner.order.id,
      "pg18_restart_claim_1234",
      new Date("2026-09-16T03:00:16.000Z"),
    );
    expect(completed?.status).toBe("COMPLETED");

    const [reservation] = await restartedProcess.db
      .select()
      .from(schema.orderReservations)
      .where(eq(schema.orderReservations.orderId, winner.order.id));
    expect(reservation).toMatchObject({
      status: "CONSUMED",
      configRevision: winner.reservation.configRevision,
      marketSnapshotKey: winner.reservation.marketSnapshotKey,
    });
    expect(reservation?.resolvedAt).toBeInstanceOf(Date);

    const completionEvidence = await restartedProcess.db
      .select()
      .from(schema.auditEvents)
      .where(
        and(
          eq(schema.auditEvents.entityId, winner.order.id),
          eq(schema.auditEvents.action, "DRY_RUN_ORDER_COMPLETED"),
        ),
      );
    expect(completionEvidence).toHaveLength(1);
  }, 60_000);
});
