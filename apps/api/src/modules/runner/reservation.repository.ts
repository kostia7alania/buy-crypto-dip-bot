import { createHash } from "node:crypto";
import { getAllowedSymbols } from "@buy-crypto-dip-bot/config";
import {
  auditEventRow,
  type createPostgresConnection,
  schema,
  withPersonalTenant,
} from "@buy-crypto-dip-bot/db";
import type { MarketTicker } from "@buy-crypto-dip-bot/exchange-core";
import { evaluateRisk } from "@buy-crypto-dip-bot/risk-engine";
import {
  AUDIT_SCHEMA_VERSION,
  type RiskDecision,
  type Signal,
} from "@buy-crypto-dip-bot/shared-types";
import { evaluateDipStrategy } from "@buy-crypto-dip-bot/strategy-engine";
import { and, desc, eq, gte, sql } from "drizzle-orm";

type Db = ReturnType<typeof createPostgresConnection>["db"];

const RISK_POLICY_VERSION = "RISK_V1";

export interface StrategyConfigSnapshot {
  thresholdPercent: number;
  maxDailySpendUsdt: number;
  maxWeeklySpendUsdt: number;
  cooldownMinutes: number;
  suggestedQuoteAmount: number;
}

interface ReserveDryRunOrderInput {
  userId: string;
  strategyId: string;
  ticker: MarketTicker;
  executeAt: Date;
  correlationId: string;
  now?: Date;
}

type LockedStrategy = typeof schema.strategies.$inferSelect;

export type ReserveDryRunOrderOutcome =
  | {
      outcome: "SKIPPED";
      reason:
        | "NOT_ACTIVE"
        | "INVALID_CONFIG"
        | "NO_SIGNAL"
        | "PENDING"
        | "DUPLICATE"
        | "COOLDOWN";
    }
  | {
      outcome: "REJECTED";
      strategy: LockedStrategy;
      reasonCodes: string[];
      shouldNotify: boolean;
    }
  | {
      outcome: "RESERVED";
      strategy: LockedStrategy;
      config: StrategyConfigSnapshot;
      signal: Signal;
      decision: RiskDecision;
      order: typeof schema.orders.$inferSelect;
      reservation: typeof schema.orderReservations.$inferSelect;
    };

const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const parseStrategyConfig = (value: unknown): StrategyConfigSnapshot | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const config = value as Record<string, unknown>;
  const parsed = {
    thresholdPercent: Number(config.thresholdPercent),
    maxDailySpendUsdt: Number(config.maxDailySpendUsdt),
    maxWeeklySpendUsdt: Number(config.maxWeeklySpendUsdt),
    cooldownMinutes: Number(config.cooldownMinutes),
    suggestedQuoteAmount: Number(config.suggestedQuoteAmount),
  };
  if (
    !Object.values(parsed).every(Number.isFinite) ||
    parsed.thresholdPercent < 0 ||
    parsed.maxDailySpendUsdt < 0 ||
    parsed.maxWeeklySpendUsdt < 0 ||
    parsed.cooldownMinutes < 0 ||
    parsed.suggestedQuoteAmount <= 0
  ) {
    return null;
  }
  return parsed;
};

const marketSnapshotFor = (ticker: MarketTicker) => ({
  source: "BYBIT_SPOT_TICKER_V5",
  symbol: ticker.symbol,
  sourceAt: ticker.sourceAt,
  receivedAt: ticker.receivedAt,
  ageMs: ticker.ageMs,
  ttlMs: ticker.ttlMs,
  lastPrice: ticker.lastPrice,
  high24h: ticker.high24h ?? null,
  low24h: ticker.low24h ?? null,
});

export const reserveDryRunOrder = async (
  db: Db,
  input: ReserveDryRunOrderInput,
): Promise<ReserveDryRunOrderOutcome> => {
  const now = input.now ?? new Date();

  return withPersonalTenant(db, input.userId, async (tx) => {
    // The strategy row is the reservation mutex. Every process sees the
    // preceding commit before it totals spend or creates another hold.
    const [strategy] = await tx
      .select()
      .from(schema.strategies)
      .where(
        and(
          eq(schema.strategies.id, input.strategyId),
          eq(schema.strategies.userId, input.userId),
        ),
      )
      .limit(1)
      .for("update");
    if (!strategy?.enabled) {
      return { outcome: "SKIPPED", reason: "NOT_ACTIVE" };
    }

    const marketSnapshot = marketSnapshotFor(input.ticker);
    const marketSnapshotKey = `bybit-ticker-v1:${digest(marketSnapshot)}`;
    const config = parseStrategyConfig(strategy.config);
    if (!config) {
      return { outcome: "SKIPPED", reason: "INVALID_CONFIG" };
    }

    const strategyConfig = {
      ...config,
      symbol: strategy.symbol,
      mode: strategy.mode,
    };
    const configRevision = `sha256:${digest(strategyConfig)}`;
    const evaluationKey = `evaluation-v1:${digest({
      strategyId: strategy.id,
      configRevision,
      marketSnapshotKey,
    })}`;
    const strategyContract = {
      id: strategy.id,
      name: strategy.name,
      symbol: strategy.symbol,
      mode: strategy.mode === "LIVE" ? ("LIVE" as const) : ("DRY_RUN" as const),
      maxDailySpendUsdt: config.maxDailySpendUsdt,
      maxWeeklySpendUsdt: config.maxWeeklySpendUsdt,
      cooldownMinutes: config.cooldownMinutes,
    };
    const signal = {
      ...evaluateDipStrategy({
        strategy: strategyContract,
        currentPrice: input.ticker.lastPrice,
        high24h: input.ticker.high24h ?? input.ticker.lastPrice,
        thresholdPercent: config.thresholdPercent,
        suggestedQuoteAmount: config.suggestedQuoteAmount,
        now: input.ticker.sourceAt,
      }),
      id: evaluationKey,
    };
    if (signal.type === "NO_SIGNAL") {
      return { outcome: "SKIPPED", reason: "NO_SIGNAL" };
    }

    const [activeReservation] = await tx
      .select({
        amount: sql<string>`coalesce(sum(cast(${schema.orderReservations.quoteAmount} as numeric)), 0)`,
      })
      .from(schema.orderReservations)
      .where(
        and(
          eq(schema.orderReservations.userId, input.userId),
          eq(schema.orderReservations.strategyId, strategy.id),
          eq(schema.orderReservations.status, "ACTIVE"),
        ),
      );
    const activeReservedUsdt = Number(activeReservation?.amount ?? "0");
    if (activeReservedUsdt > 0) {
      return { outcome: "SKIPPED", reason: "PENDING" };
    }

    const [lastCompletedOrder] = await tx
      .select({ createdAt: schema.orders.createdAt })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.userId, input.userId),
          eq(schema.orders.strategyId, strategy.id),
          eq(schema.orders.status, "COMPLETED"),
        ),
      )
      .orderBy(desc(schema.orders.createdAt))
      .limit(1);
    if (
      lastCompletedOrder &&
      now.getTime() - lastCompletedOrder.createdAt.getTime() <
        config.cooldownMinutes * 60_000
    ) {
      return { outcome: "SKIPPED", reason: "COOLDOWN" };
    }

    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const completedSince = async (cutoff: Date) => {
      const [result] = await tx
        .select({
          amount: sql<string>`coalesce(sum(cast(${schema.orders.quoteAmount} as numeric)), 0)`,
        })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.userId, input.userId),
            eq(schema.orders.strategyId, strategy.id),
            eq(schema.orders.status, "COMPLETED"),
            gte(schema.orders.createdAt, cutoff),
          ),
        );
      return Number(result?.amount ?? "0");
    };
    const [dailyCompletedUsdt, weeklyCompletedUsdt] = await Promise.all([
      completedSince(oneDayAgo),
      completedSince(oneWeekAgo),
    ]);
    const dailyCommittedUsdt = dailyCompletedUsdt + activeReservedUsdt;
    const weeklyCommittedUsdt = weeklyCompletedUsdt + activeReservedUsdt;
    const decision = evaluateRisk(signal, strategyContract, {
      liveTradingEnabled: false,
      allowedSymbols: getAllowedSymbols(process.env.ALLOWLIST_SYMBOLS),
      dailySpentUsdt: dailyCommittedUsdt,
      weeklySpentUsdt: weeklyCommittedUsdt,
    });
    const riskSnapshot = {
      dailyCompletedUsdt,
      weeklyCompletedUsdt,
      activeReservedUsdt,
      dailyCommittedUsdt,
      weeklyCommittedUsdt,
      proposedQuoteAmountUsdt: signal.suggestedQuoteAmount,
      decision: decision.snapshot,
    };

    if (decision.status === "REJECTED") {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const recentAlerts = await tx
        .select({ payload: schema.auditEvents.payload })
        .from(schema.auditEvents)
        .where(
          and(
            eq(schema.auditEvents.userId, input.userId),
            eq(schema.auditEvents.entityType, "strategy"),
            eq(schema.auditEvents.entityId, strategy.id),
            eq(schema.auditEvents.action, "RISK_DECISION_REJECTED"),
            gte(schema.auditEvents.createdAt, oneHourAgo),
          ),
        );
      const hasRecentSimilarAlert = recentAlerts.some((event) => {
        const previous = (event.payload as { reasonCodes?: unknown })
          .reasonCodes;
        return (
          Array.isArray(previous) &&
          previous.length === decision.reasonCodes.length &&
          previous.every((reason) =>
            decision.reasonCodes.includes(String(reason)),
          )
        );
      });
      await tx.insert(schema.auditEvents).values(
        auditEventRow({
          schemaVersion: AUDIT_SCHEMA_VERSION,
          type: "RISK_DECISION_REJECTED",
          scope: "USER",
          userId: input.userId,
          actor: { kind: "SYSTEM", channel: "RUNNER" },
          reasonCode: "RISK_POLICY_REJECTED",
          correlationId: input.correlationId,
          subject: { type: "STRATEGY", id: strategy.id },
          payloadClass: "TENANT_FINANCIAL",
          payload: {
            mode: "DRY_RUN",
            policyVersion: RISK_POLICY_VERSION,
            reasonCodes: decision.reasonCodes,
          },
        }),
      );
      return {
        outcome: "REJECTED",
        strategy,
        reasonCodes: decision.reasonCodes,
        shouldNotify: !hasRecentSimilarAlert,
      };
    }

    const [order] = await tx
      .insert(schema.orders)
      .values({
        userId: input.userId,
        strategyId: strategy.id,
        evaluationKey,
        symbol: strategy.symbol,
        mode: strategy.mode,
        side: "BUY",
        quoteAmount: String(config.suggestedQuoteAmount),
        price: String(input.ticker.lastPrice),
        status: "PENDING",
        executeAt: input.executeAt,
      })
      .onConflictDoNothing()
      .returning();
    if (!order) {
      return { outcome: "SKIPPED", reason: "DUPLICATE" };
    }

    const [reservation] = await tx
      .insert(schema.orderReservations)
      .values({
        userId: input.userId,
        strategyId: strategy.id,
        orderId: order.id,
        quoteAmount: String(config.suggestedQuoteAmount),
        status: "ACTIVE",
        policyVersion: RISK_POLICY_VERSION,
        configRevision,
        strategyConfig,
        marketSnapshotKey,
        marketSnapshot,
        riskSnapshot,
      })
      .returning();
    if (!reservation) throw new Error("ORDER_RESERVATION_INSERT_FAILED");

    await tx.insert(schema.auditEvents).values(
      auditEventRow({
        schemaVersion: AUDIT_SCHEMA_VERSION,
        type: "RISK_DECISION_APPROVED",
        scope: "USER",
        userId: input.userId,
        actor: { kind: "SYSTEM", channel: "RUNNER" },
        reasonCode: "RISK_POLICY_APPROVED",
        correlationId: input.correlationId,
        subject: { type: "STRATEGY", id: strategy.id },
        payloadClass: "TENANT_FINANCIAL",
        payload: {
          mode: "DRY_RUN",
          policyVersion: RISK_POLICY_VERSION,
          reasonCodes: [],
          orderId: order.id,
        },
      }),
    );

    return {
      outcome: "RESERVED",
      strategy,
      config,
      signal,
      decision,
      order,
      reservation,
    };
  });
};
