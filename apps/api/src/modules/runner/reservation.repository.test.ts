import { auditEventFromRow, schema } from "@buy-crypto-dip-bot/db";
import type { TestDatabase } from "@buy-crypto-dip-bot/db/testing";
import { createTestDb } from "@buy-crypto-dip-bot/db/testing";
import type { MarketTicker } from "@buy-crypto-dip-bot/exchange-core";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimDueDryRunOrder } from "./order.repository.js";
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

const reserve = (
  correlationId = "reservation_test_1234",
  market = ticker(),
  now = NOW,
) =>
  reserveDryRunOrder(db(), {
    userId,
    strategyId,
    ticker: market,
    executeAt: new Date(now.getTime() + 15_000),
    correlationId,
    now,
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
  vi.useRealTimers();
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
      /^bybit-ticker-v2:[0-9a-f]{64}$/,
    );
    expect(result.reservation.marketSnapshot).toMatchObject({
      receivedAt: ticker().receivedAt,
      ageMs: 5_000,
      evaluatedAt: NOW.toISOString(),
      ageAtEvaluationMs: 5_000,
    });

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

  it("retains rejected decision provenance after edits without orders or holds, suppressing only hourly notifications", async () => {
    const rejectedConfig = { ...CONFIG, maxDailySpendUsdt: 10 };
    await harness.db
      .update(schema.strategies)
      .set({ config: rejectedConfig })
      .where(eq(schema.strategies.id, strategyId));
    await expect(reserve()).resolves.toMatchObject({
      outcome: "REJECTED",
      reasonCodes: ["DAILY_LIMIT_EXCEEDED"],
      shouldNotify: true,
    });
    const [original] = await harness.db.select().from(schema.auditEvents);
    if (!original) throw new Error("test rejection audit missing");
    const event = auditEventFromRow(original);
    if (event?.type !== "RISK_DECISION_REJECTED" || !event.payload.provenance) {
      throw new Error("test rejection provenance missing from V1 read-back");
    }
    const provenance = event.payload.provenance;
    expect(event.payload).toEqual({
      mode: "DRY_RUN",
      policyVersion: "RISK_V1",
      reasonCodes: ["DAILY_LIMIT_EXCEEDED"],
      provenance: {
        evaluationKey: expect.stringMatching(/^evaluation-v1:[0-9a-f]{64}$/),
        configRevision: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        marketSnapshotKey: expect.stringMatching(
          /^bybit-ticker-v2:[0-9a-f]{64}$/,
        ),
        strategyConfig: {
          ...rejectedConfig,
          symbol: "BTCUSDT",
          mode: "DRY_RUN",
        },
        marketSnapshot: {
          ...ticker(),
          source: "BYBIT_SPOT_TICKER_V5",
          evaluatedAt: NOW.toISOString(),
          ageAtEvaluationMs: 5_000,
        },
        riskSnapshot: {
          dailyCompletedUsdt: 0,
          weeklyCompletedUsdt: 0,
          activeReservedUsdt: 0,
          dailyCommittedUsdt: 0,
          weeklyCommittedUsdt: 0,
          proposedQuoteAmountUsdt: 20,
          decision: {
            signalId: provenance.evaluationKey,
            strategyId,
            symbol: "BTCUSDT",
            mode: "DRY_RUN",
            dailySpentUsdt: 0,
            weeklySpentUsdt: 0,
            liveTradingEnabled: false,
          },
        },
      },
    });
    const [size] = await harness.db
      .select({
        bytes: sql<number>`octet_length(${schema.auditEvents.payload}::text)`,
      })
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.id, original.id));
    expect(size?.bytes).toBeLessThanOrEqual(8192);

    const editedConfig = { ...rejectedConfig, suggestedQuoteAmount: 25 };
    await harness.db
      .update(schema.strategies)
      .set({ config: editedConfig })
      .where(eq(schema.strategies.id, strategyId));
    await expect(
      reserve("reservation_rejected_edit", { ...ticker(), lastPrice: 85 }),
    ).resolves.toMatchObject({ outcome: "REJECTED", shouldNotify: false });
    const audits = await harness.db
      .select()
      .from(schema.auditEvents)
      .orderBy(schema.auditEvents.createdAt);
    expect(audits).toHaveLength(2);
    expect(audits[0]).toEqual(original);
    const edited = audits[1];
    if (!edited) throw new Error("test second rejection audit missing");
    expect(edited.payload).toMatchObject({
      provenance: {
        configRevision: expect.not.stringMatching(provenance.configRevision),
        evaluationKey: expect.not.stringMatching(provenance.evaluationKey),
        strategyConfig: editedConfig,
        marketSnapshot: { lastPrice: 85 },
        riskSnapshot: { proposedQuoteAmountUsdt: 25 },
      },
    });

    const afterHour = new Date(edited.createdAt.getTime() + 60 * 60 * 1000 + 1);
    await expect(
      reserve(
        "reservation_rejected_after_hour",
        {
          ...ticker(afterHour.toISOString()),
          receivedAt: afterHour.toISOString(),
          ageMs: 0,
        },
        afterHour,
      ),
    ).resolves.toMatchObject({ outcome: "REJECTED", shouldNotify: true });
    expect(await harness.db.select().from(schema.auditEvents)).toHaveLength(3);
    expect(await harness.db.select().from(schema.orders)).toHaveLength(0);
    expect(
      await harness.db.select().from(schema.orderReservations),
    ).toHaveLength(0);
  });

  it("suppresses the same source snapshot after release despite a different receipt time", async () => {
    const first = await reserve();
    expect(first.outcome).toBe("RESERVED");
    if (first.outcome !== "RESERVED") return;

    await harness.db
      .update(schema.orders)
      .set({ status: "CANCELLED" })
      .where(eq(schema.orders.id, first.order.id));
    await expect(
      reserve(
        "reservation_replay_1234",
        {
          ...ticker(),
          receivedAt: new Date(NOW.getTime() + 1).toISOString(),
          ageMs: 5_001,
        },
        new Date(NOW.getTime() + 1),
      ),
    ).resolves.toEqual({
      outcome: "SKIPPED",
      reason: "DUPLICATE",
    });

    const [reservation] = await harness.db
      .select({ status: schema.orderReservations.status })
      .from(schema.orderReservations)
      .where(eq(schema.orderReservations.id, first.reservation.id));
    expect(reservation?.status).toBe("RELEASED");

    expect(
      (
        await reserve(
          "reservation_new_source_1234",
          ticker("2026-09-16T00:59:56.000Z"),
        )
      ).outcome,
    ).toBe("RESERVED");
  });

  it("rejects a ticker that expires while waiting for the transaction lock", async () => {
    const locked = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const blocker = harness.db.transaction(async (tx) => {
      await tx
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.id, strategyId))
        .for("update");
      locked.resolve();
      await release.promise;
    });
    await locked.promise;

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    try {
      const pending = reserveDryRunOrder(db(), {
        userId,
        strategyId,
        ticker: ticker(),
        executeAt: new Date(NOW.getTime() + 15_000),
        correlationId: "reservation_expired_wait_1234",
      });
      vi.setSystemTime(new Date(NOW.getTime() + 30_000));
      release.resolve();
      await expect(pending).resolves.toEqual({
        outcome: "SKIPPED",
        reason: "STALE_MARKET",
      });
      expect(await harness.db.select().from(schema.orders)).toHaveLength(0);
      expect(
        await harness.db.select().from(schema.orderReservations),
      ).toHaveLength(0);
      expect(await harness.db.select().from(schema.auditEvents)).toHaveLength(
        0,
      );
    } finally {
      release.resolve();
      await blocker;
    }
  });

  it("preserves legacy completed-order cooldown and spend without a reservation", async () => {
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

    await harness.db
      .update(schema.strategies)
      .set({ config: { ...CONFIG, cooldownMinutes: 60 } })
      .where(eq(schema.strategies.id, strategyId));
    await expect(reserve()).resolves.toEqual({
      outcome: "SKIPPED",
      reason: "COOLDOWN",
    });
    await harness.db
      .update(schema.strategies)
      .set({ config: { ...CONFIG } })
      .where(eq(schema.strategies.id, strategyId));

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

  it("charges recovered holds at settlement for cooldown and rolling daily/weekly budgets", async () => {
    const config = {
      ...CONFIG,
      maxDailySpendUsdt: 20,
      maxWeeklySpendUsdt: 20,
      cooldownMinutes: 60,
    };
    await harness.db
      .update(schema.strategies)
      .set({ config })
      .where(eq(schema.strategies.id, strategyId));
    const createdAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const order = await harness.db.transaction(async (tx) => {
      const [pending] = await tx
        .insert(schema.orders)
        .values({
          userId,
          strategyId,
          symbol: "BTCUSDT",
          mode: "DRY_RUN",
          side: "BUY",
          quoteAmount: "20",
          price: "90",
          status: "PENDING",
          createdAt,
          executeAt: new Date(createdAt.getTime() + 15_000),
        })
        .returning();
      if (!pending) throw new Error("test pending order insert failed");
      await tx.insert(schema.orderReservations).values({
        userId,
        strategyId,
        orderId: pending.id,
        quoteAmount: "20",
        status: "ACTIVE",
        policyVersion: "RISK_V1",
        configRevision: "recovery-test-config",
        strategyConfig: config,
        marketSnapshotKey: "recovery-test-market",
        marketSnapshot: { ...ticker() },
        riskSnapshot: {},
        createdAt,
      });
      return pending;
    });
    expect(
      (await claimDueDryRunOrder(db(), order.id, "reservation_recovery_1234"))
        ?.status,
    ).toBe("COMPLETED");
    const [consumed] = await harness.db
      .select()
      .from(schema.orderReservations)
      .where(eq(schema.orderReservations.orderId, order.id));
    if (!consumed?.resolvedAt) throw new Error("test hold was not consumed");
    const resolvedAt = consumed.resolvedAt;
    const reserveAfter = (elapsedMs: number) => {
      const now = new Date(resolvedAt.getTime() + elapsedMs);
      return reserve(
        "reservation_after_recovery_1234",
        {
          ...ticker(now.toISOString()),
          receivedAt: now.toISOString(),
          ageMs: 0,
        },
        now,
      );
    };

    await expect(reserveAfter(1_000)).resolves.toEqual({
      outcome: "SKIPPED",
      reason: "COOLDOWN",
    });
    await harness.db
      .update(schema.strategies)
      .set({ config: { ...config, cooldownMinutes: 0 } })
      .where(eq(schema.strategies.id, strategyId));
    await expect(reserveAfter(1_000)).resolves.toMatchObject({
      outcome: "REJECTED",
      reasonCodes: ["DAILY_LIMIT_EXCEEDED", "WEEKLY_LIMIT_EXCEEDED"],
    });
    await expect(reserveAfter(25 * 60 * 60 * 1000)).resolves.toMatchObject({
      outcome: "REJECTED",
      reasonCodes: ["WEEKLY_LIMIT_EXCEEDED"],
    });
    await expect(reserveAfter(8 * 24 * 60 * 60 * 1000)).resolves.toMatchObject({
      outcome: "RESERVED",
    });
  });
});
