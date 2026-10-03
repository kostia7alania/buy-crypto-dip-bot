import { randomBytes } from "node:crypto";
import {
  createPostgresConnection,
  runMigrations,
  schema,
} from "@buy-crypto-dip-bot/db";
import { seedTwoTenants } from "@buy-crypto-dip-bot/db/testing";
import type { MarketTicker } from "@buy-crypto-dip-bot/exchange-core";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { claimOwnedPendingOrder } from "../../../../bot/src/order.repository.js";
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

describePostgres18("PostgreSQL 18 reservation connections", () => {
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
      // Pool.end can return before the server processes every socket close.
      await vi.waitFor(
        async () => {
          const result = await admin.pool.query<{ connections: number }>(
            "SELECT count(*)::int AS connections FROM pg_stat_activity WHERE datname = $1",
            [databaseName],
          );
          expect(result.rows[0]?.connections).toBe(0);
        },
        { timeout: 5_000, interval: 25 },
      );
      await admin.pool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await close(admin);
    }
  });

  it("serializes pools and settles on same-process reconnect", async () => {
    const firstConnection = connect(databaseUrl);
    const secondConnection = connect(databaseUrl);
    const input = {
      userId,
      strategyId,
      ticker,
      executeAt: new Date("2026-09-16T03:00:15.000Z"),
      now: new Date("2026-09-16T03:00:00.000Z"),
    };
    const outcomes = await Promise.all([
      reserveDryRunOrder(firstConnection.db, {
        ...input,
        correlationId: "pg18_reserve_first_1234",
      }),
      reserveDryRunOrder(secondConnection.db, {
        ...input,
        correlationId: "pg18_reserve_second_1234",
      }),
    ]);
    const winners = outcomes.filter(
      (outcome) => outcome.outcome === "RESERVED",
    );
    expect(winners).toHaveLength(1);
    expect(outcomes).toContainEqual({
      outcome: "SKIPPED",
      reason: "PENDING",
    });
    const winner = winners[0];
    if (winner?.outcome !== "RESERVED") return;

    await Promise.all([close(firstConnection), close(secondConnection)]);

    const reopenedConnection = connect(databaseUrl);
    const completed = await claimDueDryRunOrder(
      reopenedConnection.db,
      winner.order.id,
      "pg18_reopened_claim_1234",
      new Date("2026-09-16T03:00:16.000Z"),
    );
    expect(completed?.status).toBe("COMPLETED");

    const [reservation] = await reopenedConnection.db
      .select()
      .from(schema.orderReservations)
      .where(eq(schema.orderReservations.orderId, winner.order.id));
    expect(reservation).toMatchObject({
      status: "CONSUMED",
      configRevision: winner.reservation.configRevision,
      marketSnapshotKey: winner.reservation.marketSnapshotKey,
    });
    expect(reservation?.resolvedAt).toBeInstanceOf(Date);

    const completionEvidence = await reopenedConnection.db
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

  it("lets the real Telegram cancel callback and executor settle one owned hold exactly once", async () => {
    const observer = connect(databaseUrl);
    // The shared seed uses the same Drizzle operations on PGlite and node-postgres.
    const world = await seedTwoTenants(
      observer.db as unknown as Parameters<typeof seedTwoTenants>[0],
    );
    const actorConnection = (name: string) => {
      const url = new URL(databaseUrl);
      url.searchParams.set("application_name", name);
      return connect(url.toString());
    };
    const callbackName = "pg18_callback_race";
    const executorName = "pg18_executor_race";
    const callbackDb = actorConnection(callbackName).db;
    const executorDb = actorConnection(executorName).db;
    const orderId = world.alice.pendingOrderId;
    const readLedger = async (id: string) => {
      // One SQL snapshot observes state, hold and financial evidence together.
      const result = await observer.pool.query<{
        order: Record<string, unknown>;
        reservation: Record<string, unknown>;
        events: Record<string, unknown>[];
      }>(
        `SELECT to_jsonb(o) AS "order", to_jsonb(r) AS reservation,
           COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id)
             FROM audit_events e WHERE e.entity_id = o.id::text),
             '[]'::jsonb) AS events
         FROM orders o JOIN order_reservations r ON r.order_id = o.id
         WHERE o.id = $1`,
        [id],
      );
      const row = result.rows[0];
      if (!row) throw new Error("PG18_RACE_LEDGER_MISSING");
      return row;
    };
    const before = await readLedger(orderId);
    const foreignBefore = await readLedger(world.bob.pendingOrderId);
    expect(before).toMatchObject({
      order: { user_id: world.alice.userId, status: "PENDING" },
      reservation: { status: "ACTIVE", resolved_at: null },
      events: [],
    });
    const dueAt = new Date(Date.now() + 120_000);
    const callback = () =>
      claimOwnedPendingOrder(
        callbackDb,
        orderId,
        world.alice.userId,
        "CANCELLED",
        "pg18_callback_cancel_1234",
      );
    const executor = () =>
      claimDueDryRunOrder(executorDb, orderId, "pg18_executor_due_1234", dueAt);
    const lock = await observer.pool.connect();
    let race:
      | Promise<
          [
            PromiseSettledResult<Awaited<ReturnType<typeof callback>>>,
            PromiseSettledResult<Awaited<ReturnType<typeof executor>>>,
          ]
        >
      | undefined;
    try {
      await lock.query("BEGIN");
      await lock.query("SELECT id FROM orders WHERE id = $1 FOR UPDATE", [
        orderId,
      ]);
      race = Promise.allSettled([callback(), executor()]);
      await vi.waitFor(
        async () => {
          const result = await observer.pool.query<{ waiting: number }>(
            `SELECT count(DISTINCT application_name)::int AS waiting
             FROM pg_stat_activity
             WHERE datname = $1 AND application_name = ANY($2::text[])
               AND wait_event_type = 'Lock'
               AND lower(query) LIKE 'update "orders"%'
               AND cardinality(pg_blocking_pids(pid)) > 0`,
            [databaseName, [callbackName, executorName]],
          );
          expect(result.rows[0]?.waiting).toBe(2);
        },
        { timeout: 15_000, interval: 25 },
      );
      expect(await readLedger(orderId)).toEqual(before);
      expect(await readLedger(world.bob.pendingOrderId)).toEqual(foreignBefore);
      await lock.query("COMMIT");

      const [cancelled, executed] = await race;
      if (cancelled.status === "rejected") throw cancelled.reason;
      if (executed.status === "rejected") throw executed.reason;
      const callbackWon = cancelled.value.outcome === "CLAIMED";
      expect(Number(callbackWon) + Number(executed.value !== null)).toBe(1);
      const terminalStatus = callbackWon ? "CANCELLED" : "COMPLETED";
      if (callbackWon) {
        expect(cancelled.value).toMatchObject({
          order: { status: terminalStatus },
        });
        expect(executed.value).toBeNull();
      } else {
        expect(cancelled.value.outcome).toBe("ALREADY_SETTLED");
        expect(executed.value?.status).toBe(terminalStatus);
      }
      const settled = await readLedger(orderId);
      expect(settled.order).toEqual({
        ...before.order,
        status: terminalStatus,
      });
      expect(settled.reservation).toEqual({
        ...before.reservation,
        status: callbackWon ? "RELEASED" : "CONSUMED",
        resolved_at: expect.any(String),
      });
      expect(settled.events).toEqual([
        expect.objectContaining({
          user_id: world.alice.userId,
          entity_id: orderId,
          action: `DRY_RUN_ORDER_${terminalStatus}`,
          actor_channel: callbackWon ? "TELEGRAM" : "RUNNER",
          correlation_id: callbackWon
            ? "pg18_callback_cancel_1234"
            : "pg18_executor_due_1234",
          payload: { from: "PENDING", to: terminalStatus, mode: "DRY_RUN" },
        }),
      ]);
      expect((await callback()).outcome).toBe("ALREADY_SETTLED");
      expect(await executor()).toBeNull();
      expect(await readLedger(orderId)).toEqual(settled);
      expect(await readLedger(world.bob.pendingOrderId)).toEqual(foreignBefore);
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
      await race;
    }
  }, 60_000);
});
