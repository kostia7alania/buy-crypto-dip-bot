import {
  AUDIT_SCHEMA_VERSION,
  createCorrelationId,
} from "@buy-crypto-dip-bot/shared-types";
import { auditEventRow } from "./audit-event.js";
import { schema } from "./schema.js";
import type { TestDb } from "./testing-db.js";

// The world every isolation test runs against: two unrelated people who both
// use the product, and who both happen to trade BTCUSDT. If any query forgets
// its owner filter, one of them sees the other.

export interface SeededTenant {
  userId: string;
  telegramUserId: string;
  telegramChatId: string;
  /** Strategy on the symbol both tenants share. */
  sharedSymbolStrategyId: string;
  /** Strategy on a symbol only this tenant holds. */
  ownSymbolStrategyId: string;
  /** A COMPLETED buy, so aggregates have something to get wrong. */
  completedOrderId: string;
  /** A PENDING order, for callback-ownership tests. */
  pendingOrderId: string;
  auditEventId: string;
}

export interface TwoTenantWorld {
  alice: SeededTenant;
  bob: SeededTenant;
  /** The symbol both tenants own a strategy for. */
  sharedSymbol: string;
}

const STRATEGY_CONFIG = {
  thresholdPercent: 1,
  suggestedQuoteAmount: 20,
  maxDailySpendUsdt: 300,
  maxWeeklySpendUsdt: 1000,
  cooldownMinutes: 60,
};

interface TenantSpec {
  telegramUserId: string;
  username: string;
  ownSymbol: string;
  /** Distinct spend so an aggregate that mixes tenants is obvious in the total. */
  completedSpendUsdt: number;
  completedPrice: number;
}

const seedTenant = async (
  db: TestDb,
  spec: TenantSpec,
  sharedSymbol: string,
): Promise<SeededTenant> => {
  const [user] = await db
    .insert(schema.users)
    .values({
      telegramUserId: spec.telegramUserId,
      telegramChatId: spec.telegramUserId,
      username: spec.username,
      firstName: spec.username,
    })
    .returning();
  if (!user) throw new Error("failed to seed user");
  if (!user.telegramChatId) throw new Error("failed to seed notification chat");

  const [sharedStrategy] = await db
    .insert(schema.strategies)
    .values({
      userId: user.id,
      name: `${sharedSymbol} Dip Buying Strategy`,
      symbol: sharedSymbol,
      mode: "DRY_RUN",
      enabled: true,
      config: { ...STRATEGY_CONFIG },
    })
    .returning();
  if (!sharedStrategy) throw new Error("failed to seed shared strategy");

  const [ownStrategy] = await db
    .insert(schema.strategies)
    .values({
      userId: user.id,
      name: `${spec.ownSymbol} Dip Buying Strategy`,
      symbol: spec.ownSymbol,
      mode: "DRY_RUN",
      enabled: true,
      config: { ...STRATEGY_CONFIG },
    })
    .returning();
  if (!ownStrategy) throw new Error("failed to seed own strategy");

  const [completedOrder] = await db
    .insert(schema.orders)
    .values({
      userId: user.id,
      strategyId: sharedStrategy.id,
      symbol: sharedSymbol,
      mode: "DRY_RUN",
      side: "BUY",
      quoteAmount: String(spec.completedSpendUsdt),
      price: String(spec.completedPrice),
      status: "COMPLETED",
    })
    .returning();
  if (!completedOrder) throw new Error("failed to seed completed order");

  const pendingOrder = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(schema.orders)
      .values({
        userId: user.id,
        strategyId: sharedStrategy.id,
        evaluationKey: `test-evaluation:${user.id}`,
        symbol: sharedSymbol,
        mode: "DRY_RUN",
        side: "BUY",
        quoteAmount: String(spec.completedSpendUsdt),
        price: String(spec.completedPrice),
        status: "PENDING",
        executeAt: new Date(Date.now() + 60_000),
      })
      .returning();
    if (!order) throw new Error("failed to seed pending order");
    await tx.insert(schema.orderReservations).values({
      userId: user.id,
      strategyId: sharedStrategy.id,
      orderId: order.id,
      quoteAmount: String(spec.completedSpendUsdt),
      status: "ACTIVE",
      policyVersion: "TEST_POLICY",
      configRevision: "test-config-v1",
      strategyConfig: { ...STRATEGY_CONFIG },
      marketSnapshotKey: `test-market:${order.id}`,
      marketSnapshot: { source: "TEST", symbol: sharedSymbol },
      riskSnapshot: { source: "TEST" },
    });
    return order;
  });
  if (!pendingOrder) throw new Error("failed to seed pending order");

  const [auditEvent] = await db
    .insert(schema.auditEvents)
    .values(
      auditEventRow({
        schemaVersion: AUDIT_SCHEMA_VERSION,
        type: "RISK_DECISION_APPROVED",
        scope: "USER",
        userId: user.id,
        actor: { kind: "SYSTEM", channel: "RUNNER" },
        reasonCode: "RISK_POLICY_APPROVED",
        correlationId: createCorrelationId(),
        subject: { type: "STRATEGY", id: sharedStrategy.id },
        payloadClass: "TENANT_FINANCIAL",
        payload: {
          mode: "DRY_RUN",
          policyVersion: "RISK_V1",
          reasonCodes: [],
          orderId: completedOrder.id,
        },
      }),
    )
    .returning();
  if (!auditEvent) throw new Error("failed to seed audit event");

  return {
    userId: user.id,
    telegramUserId: user.telegramUserId,
    telegramChatId: user.telegramChatId,
    sharedSymbolStrategyId: sharedStrategy.id,
    ownSymbolStrategyId: ownStrategy.id,
    completedOrderId: completedOrder.id,
    pendingOrderId: pendingOrder.id,
    auditEventId: auditEvent.id,
  };
};

export const seedTwoTenants = async (db: TestDb): Promise<TwoTenantWorld> => {
  const sharedSymbol = "BTCUSDT";

  // Different spends and prices: if an aggregate accidentally sums both
  // tenants, the number is visibly wrong rather than coincidentally right.
  const alice = await seedTenant(
    db,
    {
      telegramUserId: "1000001",
      username: "alice",
      ownSymbol: "ETHUSDT",
      completedSpendUsdt: 100,
      completedPrice: 50_000,
    },
    sharedSymbol,
  );

  const bob = await seedTenant(
    db,
    {
      telegramUserId: "2000002",
      username: "bob",
      ownSymbol: "SOLUSDT",
      completedSpendUsdt: 700,
      completedPrice: 25_000,
    },
    sharedSymbol,
  );

  return { alice, bob, sharedSymbol };
};
