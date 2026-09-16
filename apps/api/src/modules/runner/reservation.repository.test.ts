import { schema } from "@buy-crypto-dip-bot/db";
import type { TestDatabase } from "@buy-crypto-dip-bot/db/testing";
import { createTestDb } from "@buy-crypto-dip-bot/db/testing";
import type { MarketTicker } from "@buy-crypto-dip-bot/exchange-core";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reserveDryRunOrder } from "./reservation.repository.js";

let harness: TestDatabase;
let userId: string;
let strategyId: string;

const NOW = new Date("2026-09-16T01:00:00.000Z");
const CONFIG = {
  thresholdPercent: 1,
  suggestedQuoteAmount: 20,
  maxDailySpendUsdt: 100,
  maxWeeklySpendUsdt: 500,
  cooldownMinutes: 0,
};

const db = () =>
  harness.db as unknown as Parameters<typeof reserveDryRunOrder>[0];

const ticker = (sourceAt = "2026-09-16T00:59:55.000Z"): MarketTicker => ({
  symbol: "BTCUSDT",
  lastPrice: 90,
  high24h: 100,
  low24h: 80,
  sourceAt,
  receivedAt: "2026-09-16T01:00:00.000Z",
  ageMs: 5_000,
  ttlMs: 30_000,
});

const reserve = (correlationId = "reservation_test_1234", market = ticker()) =>
  reserveDryRunOrder(db(), {
    userId,
    strategyId,
    ticker: market,
    executeAt: new Date("2026-09-16T01:00:15.000Z"),
    correlationId,
    now: NOW,
  });

beforeEach(async () => {
  harness = await createTestDb();
  const [user] = await harness.db
    .insert(schema.users)
    .values({ telegramUserId: "reservation-test-user" })
    .returning({ id: schema.users.id });
  if (!user) throw new Error("test user insert failed");
  userId = user.id;
  const [strategy] = await harness.db
    .insert(schema.strategies)
    .values({
      userId,
      name: "Reservation BTC",
      symbol: "BTCUSDT",
      mode: "DRY_RUN",
      enabled: true,
      config: { ...CONFIG },
    })
    .returning({ id: schema.strategies.id });
  if (!strategy) throw new Error("test strategy insert failed");
  strategyId = strategy.id;
});

afterEach(async () => {
  await harness?.close();
});

describe("dry-run reservation", () => {
  it("commits one pending order with immutable config and market evidence", async () => {
    const result = await reserve();
    expect(result.outcome).toBe("RESERVED");
    if (result.outcome !== "RESERVED") return;

    expect(result.order.evaluationKey).toBe(result.signal.id);
    expect(result.reservation).toMatchObject({
      orderId: result.order.id,
      userId,
      strategyId,
      quoteAmount: "20",
      status: "ACTIVE",
      policyVersion: "RISK_V1",
    });
    expect(result.reservation.configRevision).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.reservation.marketSnapshotKey).toMatch(
      /^bybit-ticker-v1:[0-9a-f]{64}$/,
    );

    await harness.db
      .update(schema.strategies)
      .set({ config: { ...CONFIG, maxDailySpendUsdt: 10 } })
      .where(eq(schema.strategies.id, strategyId));
    const [persisted] = await harness.db
      .select()
      .from(schema.orderReservations)
      .where(eq(schema.orderReservations.id, result.reservation.id));
    expect(persisted?.strategyConfig).toMatchObject({
      maxDailySpendUsdt: 100,
      suggestedQuoteAmount: 20,
    });
  });

  it("rolls order, hold and evidence back together on audit failure", async () => {
    await expect(reserve("bad")).rejects.toThrow(
      "AUDIT_EVENT_INVALID:CORRELATION_ID",
    );

    expect(await harness.db.select().from(schema.orders)).toHaveLength(0);
    expect(
      await harness.db.select().from(schema.orderReservations),
    ).toHaveLength(0);
  });

  it("suppresses the same evaluated market/config snapshot after release", async () => {
    const first = await reserve();
    expect(first.outcome).toBe("RESERVED");
    if (first.outcome !== "RESERVED") return;

    await harness.db
      .update(schema.orders)
      .set({ status: "CANCELLED" })
      .where(eq(schema.orders.id, first.order.id));
    await expect(reserve()).resolves.toEqual({
      outcome: "SKIPPED",
      reason: "DUPLICATE",
    });

    const [reservation] = await harness.db
      .select({ status: schema.orderReservations.status })
      .from(schema.orderReservations)
      .where(eq(schema.orderReservations.id, first.reservation.id));
    expect(reservation?.status).toBe("RELEASED");
  });

  it("rejects a reservation that would exceed completed rolling spend", async () => {
    await harness.db.insert(schema.orders).values({
      userId,
      strategyId,
      symbol: "BTCUSDT",
      mode: "DRY_RUN",
      side: "BUY",
      quoteAmount: "90",
      price: "95",
      status: "COMPLETED",
      createdAt: new Date("2026-09-16T00:30:00.000Z"),
    });

    const result = await reserve(
      "reservation_limit_1234",
      ticker("2026-09-16T00:59:56.000Z"),
    );
    expect(result).toMatchObject({
      outcome: "REJECTED",
      reasonCodes: ["DAILY_LIMIT_EXCEEDED"],
    });
    expect(
      await harness.db.select().from(schema.orderReservations),
    ).toHaveLength(0);
  });
});
