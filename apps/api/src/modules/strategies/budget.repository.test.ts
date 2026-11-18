import { schema } from "@buy-crypto-dip-bot/db";
import {
  createTestDb,
  type TestDatabase,
} from "@buy-crypto-dip-bot/db/testing";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { readStrategyBudget } from "./budget.repository.js";

let harness: TestDatabase;
let userId: string;
let strategyId: string;

beforeAll(async () => {
  harness = await createTestDb();
  const [user] = await harness.db
    .insert(schema.users)
    .values({ telegramUserId: "strategy-budget-test" })
    .returning();
  if (!user) throw new Error("test user missing");
  userId = user.id;
  const [strategy] = await harness.db
    .insert(schema.strategies)
    .values({
      userId,
      symbol: "BTCUSDT",
      name: "Paused strategy",
      enabled: false,
      config: { maxDailySpendUsdt: 100, maxWeeklySpendUsdt: "150" },
    })
    .returning();
  if (!strategy) throw new Error("test strategy missing");
  strategyId = strategy.id;
}, 60_000);

afterAll(async () => {
  await harness?.close();
});

it("uses inclusive rolling windows, settlement time and all outstanding holds", async () => {
  await harness.db.transaction(async (tx) => {
    const row = {
      userId,
      strategyId,
      symbol: "BTCUSDT",
      mode: "DRY_RUN",
      side: "BUY",
      price: "10",
    };
    const clock = sql`date_trunc('milliseconds', transaction_timestamp() AT TIME ZONE 'UTC')`;
    const day = 86_400_000;
    await tx.insert(schema.orders).values(
      [
        [day, 10],
        [day + 1, 20],
        [7 * day, 30],
        [7 * day + 1, 40],
      ].map(([age, amount]) => ({
        ...row,
        status: "COMPLETED",
        quoteAmount: String(amount),
        createdAt: sql`${clock} - ${age} * interval '1 millisecond'`,
      })),
    );
    const report = () =>
      readStrategyBudget(
        tx as unknown as Parameters<typeof readStrategyBudget>[0],
        userId,
      );
    const expected = {
      symbol: "BTCUSDT",
      strategyId,
      dailyRemainingUsdt: 90,
      weeklyRemainingUsdt: 90,
      activeReservedUsdt: 0,
    };
    expect((await report()).strategies).toEqual([expected]);

    const hold = async () => {
      const [order] = await tx
        .insert(schema.orders)
        .values({
          ...row,
          status: "PENDING",
          quoteAmount: "15",
          createdAt: sql`${clock} - interval '8 days'`,
        })
        .returning();
      if (!order) throw new Error("test order missing");
      await tx.insert(schema.orderReservations).values({
        userId,
        strategyId,
        orderId: order.id,
        quoteAmount: "15",
        policyVersion: "TEST",
        configRevision: "test",
        strategyConfig: {},
        marketSnapshotKey: "test",
        marketSnapshot: {},
        riskSnapshot: {},
        createdAt: sql`${clock} - interval '8 days'`,
      });
      return order.id;
    };
    const id = await hold();
    expect((await report()).strategies).toEqual([
      {
        ...expected,
        dailyRemainingUsdt: 75,
        weeklyRemainingUsdt: 75,
        activeReservedUsdt: 15,
      },
    ]);
    await tx
      .update(schema.orders)
      .set({ status: "CANCELLED" })
      .where(eq(schema.orders.id, id));
    expect((await report()).strategies).toEqual([expected]);
    const completedId = await hold();
    await tx
      .update(schema.orders)
      .set({ status: "COMPLETED" })
      .where(eq(schema.orders.id, completedId));
    expect((await report()).strategies).toEqual([
      { ...expected, dailyRemainingUsdt: 75, weeklyRemainingUsdt: 75 },
    ]);

    await tx
      .update(schema.strategies)
      .set({ config: { maxDailySpendUsdt: null, maxWeeklySpendUsdt: -1 } })
      .where(eq(schema.strategies.id, strategyId));
    expect((await report()).strategies).toEqual([
      { ...expected, dailyRemainingUsdt: null, weeklyRemainingUsdt: null },
    ]);
    await tx
      .update(schema.strategies)
      .set({
        config: { maxDailySpendUsdt: 100, maxWeeklySpendUsdt: "150" },
      })
      .where(eq(schema.strategies.id, strategyId));

    // A historical negative order must not credit a window, even when its
    // positive completions are greater than the negative amount.
    await tx.insert(schema.orders).values({
      ...row,
      status: "COMPLETED",
      quoteAmount: "-1",
      createdAt: sql`${clock} - interval '2 days'`,
    });
    expect((await report()).strategies).toEqual([
      { ...expected, dailyRemainingUsdt: 75, weeklyRemainingUsdt: null },
    ]);
    await tx.insert(schema.orders).values({
      ...row,
      status: "COMPLETED",
      quoteAmount: "-1",
      createdAt: clock,
    });
    expect((await report()).strategies).toEqual([
      { ...expected, dailyRemainingUsdt: null, weeklyRemainingUsdt: null },
    ]);
  });
});

it("timestamps an empty report", async () => {
  const [user] = await harness.db
    .insert(schema.users)
    .values({ telegramUserId: "budget-empty" })
    .returning();
  if (!user) throw new Error("test user missing");
  const report = await readStrategyBudget(
    harness.db as unknown as Parameters<typeof readStrategyBudget>[0],
    user.id,
  );
  expect(report.strategies).toEqual([]);
  expect(Number.isFinite(Date.parse(report.asOf))).toBe(true);
});
