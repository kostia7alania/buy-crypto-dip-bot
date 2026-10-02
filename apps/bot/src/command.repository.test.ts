import { schema } from "@buy-crypto-dip-bot/db";
import type {
  TestDatabase,
  TwoTenantWorld,
} from "@buy-crypto-dip-bot/db/testing";
import { createTestDb, seedTwoTenants } from "@buy-crypto-dip-bot/db/testing";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyOwnedOnboardingStrategy,
  bindPrivateNotificationTarget,
  type MutableStrategyConfigField,
  toggleOwnedStrategy,
  updateOwnedStrategyConfig,
} from "./command.repository.js";

let harness: TestDatabase;
let world: TwoTenantWorld;
// PGlite and node-postgres yield structurally identical Drizzle databases with
// distinct nominal types; keep the cast at the test seam.
const db = () =>
  harness.db as unknown as Parameters<typeof bindPrivateNotificationTarget>[0];

beforeEach(async () => {
  harness = await createTestDb();
  world = await seedTwoTenants(harness.db);
}, 60_000);

afterEach(async () => {
  await harness?.close();
});

const userByTelegramId = async (telegramUserId: string) => {
  const [user] = await harness.db
    .select()
    .from(schema.users)
    .where(eq(schema.users.telegramUserId, telegramUserId));
  return user;
};

const strategyByOwnerAndSymbol = async (userId: string, symbol: string) => {
  const [strategy] = await harness.db
    .select()
    .from(schema.strategies)
    .where(
      and(
        eq(schema.strategies.userId, userId),
        eq(schema.strategies.symbol, symbol),
      ),
    );
  return strategy;
};

const eventsByAction = (action: string) =>
  harness.db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.action, action));

describe("bindPrivateNotificationTarget", () => {
  it("creates a user and its exact V1 binding event in one transaction", async () => {
    const correlationId = "telegram_update_51001";
    const result = await bindPrivateNotificationTarget(
      db(),
      {
        telegramUserId: "3000003",
        telegramChatId: "3000003",
        username: "carol",
        firstName: "Carol",
      },
      correlationId,
    );

    const user = await userByTelegramId("3000003");
    expect(user).toMatchObject({
      id: result.userId,
      telegramChatId: "3000003",
      username: "carol",
      firstName: "Carol",
    });
    expect(user?.notificationEnabledAt).toBeInstanceOf(Date);

    const events = await eventsByAction("NOTIFICATION_BINDING_VERIFIED");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      schemaVersion: 1,
      scope: "USER",
      userId: result.userId,
      actorKind: "USER",
      actorChannel: "TELEGRAM",
      actorUserId: result.userId,
      entityType: "user",
      entityId: result.userId,
      reasonCode: "PRIVATE_START_CONFIRMED",
      correlationId,
      payloadClass: "SECURITY",
      payload: {},
    });
  });

  it("refreshes only the matching Telegram identity", async () => {
    await bindPrivateNotificationTarget(
      db(),
      {
        telegramUserId: world.alice.telegramUserId,
        telegramChatId: "9000009",
        username: "alice-renamed",
        firstName: "Alice",
      },
      "telegram_update_51002",
    );

    const alice = await userByTelegramId(world.alice.telegramUserId);
    const bob = await userByTelegramId(world.bob.telegramUserId);
    expect(alice).toMatchObject({
      id: world.alice.userId,
      telegramChatId: "9000009",
      username: "alice-renamed",
    });
    expect(bob?.telegramChatId).toBe(world.bob.telegramChatId);
  });

  it("rolls the binding back when its audit event is invalid", async () => {
    const before = await userByTelegramId(world.alice.telegramUserId);

    await expect(
      bindPrivateNotificationTarget(
        db(),
        {
          telegramUserId: world.alice.telegramUserId,
          telegramChatId: "9000009",
          username: "changed-without-audit",
          firstName: "Changed",
        },
        "bad",
      ),
    ).rejects.toThrow("AUDIT_EVENT_INVALID");

    const after = await userByTelegramId(world.alice.telegramUserId);
    expect(after).toMatchObject({
      telegramChatId: before?.telegramChatId,
      notificationEnabledAt: before?.notificationEnabledAt,
      username: before?.username,
      firstName: before?.firstName,
    });
    expect(await eventsByAction("NOTIFICATION_BINDING_VERIFIED")).toHaveLength(
      0,
    );
  });
});

describe("applyOwnedOnboardingStrategy", () => {
  it("updates and audits only the caller's matching strategy", async () => {
    const correlationId = "telegram_update_51005";
    const bobBefore = await strategyByOwnerAndSymbol(
      world.bob.userId,
      world.sharedSymbol,
    );

    const result = await applyOwnedOnboardingStrategy(
      db(),
      world.alice.userId,
      {
        symbol: world.sharedSymbol,
        thresholdPercent: 3,
        amountUsdt: 50,
      },
      correlationId,
    );

    expect(result).toEqual({
      outcome: "UPDATED",
      strategyId: world.alice.sharedSymbolStrategyId,
    });
    const aliceAfter = await strategyByOwnerAndSymbol(
      world.alice.userId,
      world.sharedSymbol,
    );
    expect(aliceAfter).toMatchObject({
      id: world.alice.sharedSymbolStrategyId,
      userId: world.alice.userId,
      enabled: true,
      config: {
        thresholdPercent: 3,
        suggestedQuoteAmount: 50,
        maxDailySpendUsdt: 300,
        maxWeeklySpendUsdt: 1000,
        cooldownMinutes: 60,
      },
    });
    expect(
      await strategyByOwnerAndSymbol(world.bob.userId, world.sharedSymbol),
    ).toEqual(bobBefore);

    const events = await eventsByAction("STRATEGY_UPDATED");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      schemaVersion: 1,
      scope: "USER",
      userId: world.alice.userId,
      actorKind: "USER",
      actorChannel: "TELEGRAM",
      actorUserId: world.alice.userId,
      entityType: "strategy",
      entityId: world.alice.sharedSymbolStrategyId,
      reasonCode: "ONBOARDING_APPLIED",
      correlationId,
      payloadClass: "TENANT_CONFIGURATION",
      payload: {
        fields: ["enabled", "thresholdPercent", "suggestedQuoteAmount"],
      },
    });
  });

  it("creates a caller-owned DRY_RUN strategy with defaults and V1 audit", async () => {
    const symbol = "SOLUSDT";
    const correlationId = "telegram_update_51006";
    const bobBefore = await strategyByOwnerAndSymbol(world.bob.userId, symbol);

    const result = await applyOwnedOnboardingStrategy(
      db(),
      world.alice.userId,
      { symbol, thresholdPercent: 5, amountUsdt: 100 },
      correlationId,
    );

    const created = await strategyByOwnerAndSymbol(world.alice.userId, symbol);
    expect(result).toEqual({ outcome: "CREATED", strategyId: created?.id });
    expect(created).toMatchObject({
      userId: world.alice.userId,
      name: "SOLUSDT Dip Buying Strategy",
      symbol,
      mode: "DRY_RUN",
      enabled: false,
      config: {
        thresholdPercent: 5,
        suggestedQuoteAmount: 100,
        maxDailySpendUsdt: 100,
        maxWeeklySpendUsdt: 500,
        cooldownMinutes: 60,
      },
    });
    expect(await strategyByOwnerAndSymbol(world.bob.userId, symbol)).toEqual(
      bobBefore,
    );

    const events = await eventsByAction("STRATEGY_CREATED");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      schemaVersion: 1,
      scope: "USER",
      userId: world.alice.userId,
      actorKind: "USER",
      actorChannel: "TELEGRAM",
      actorUserId: world.alice.userId,
      entityType: "strategy",
      entityId: created?.id,
      reasonCode: "ONBOARDING_APPLIED",
      correlationId,
      payloadClass: "TENANT_CONFIGURATION",
      payload: { symbol, mode: "DRY_RUN" },
    });
  });

  it("rolls both create and update back when the V1 audit is invalid", async () => {
    const aliceBefore = await strategyByOwnerAndSymbol(
      world.alice.userId,
      world.sharedSymbol,
    );

    await expect(
      applyOwnedOnboardingStrategy(
        db(),
        world.alice.userId,
        {
          symbol: world.sharedSymbol,
          thresholdPercent: 5,
          amountUsdt: 100,
        },
        "bad",
      ),
    ).rejects.toThrow("AUDIT_EVENT_INVALID");
    await expect(
      applyOwnedOnboardingStrategy(
        db(),
        world.alice.userId,
        { symbol: "SOLUSDT", thresholdPercent: 5, amountUsdt: 100 },
        "bad",
      ),
    ).rejects.toThrow("AUDIT_EVENT_INVALID");

    expect(
      await strategyByOwnerAndSymbol(world.alice.userId, world.sharedSymbol),
    ).toEqual(aliceBefore);
    expect(
      await strategyByOwnerAndSymbol(world.alice.userId, "SOLUSDT"),
    ).toBeUndefined();
    expect(await eventsByAction("STRATEGY_UPDATED")).toHaveLength(0);
    expect(await eventsByAction("STRATEGY_CREATED")).toHaveLength(0);
  });
});

describe("updateOwnedStrategyConfig", () => {
  it.each<{
    field: MutableStrategyConfigField;
    value: number;
  }>([
    { field: "thresholdPercent", value: 2.5 },
    { field: "suggestedQuoteAmount", value: 75 },
    { field: "maxDailySpendUsdt", value: 450 },
  ])("updates and audits only $field", async ({ field, value }) => {
    const bobBefore = await strategyByOwnerAndSymbol(
      world.bob.userId,
      world.sharedSymbol,
    );
    const correlationId = `telegram_update_${field}`;

    const result = await updateOwnedStrategyConfig(
      db(),
      world.alice.userId,
      world.sharedSymbol,
      field,
      value,
      correlationId,
    );

    expect(result).toEqual({
      outcome: "UPDATED",
      strategyId: world.alice.sharedSymbolStrategyId,
    });
    const aliceAfter = await strategyByOwnerAndSymbol(
      world.alice.userId,
      world.sharedSymbol,
    );
    const bobAfter = await strategyByOwnerAndSymbol(
      world.bob.userId,
      world.sharedSymbol,
    );
    expect(aliceAfter?.config).toMatchObject({ [field]: value });
    expect(bobAfter?.config).toEqual(bobBefore?.config);

    const events = await eventsByAction("STRATEGY_UPDATED");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      schemaVersion: 1,
      scope: "USER",
      userId: world.alice.userId,
      actorKind: "USER",
      actorChannel: "TELEGRAM",
      actorUserId: world.alice.userId,
      entityType: "strategy",
      entityId: world.alice.sharedSymbolStrategyId,
      reasonCode: "USER_REQUESTED",
      correlationId,
      payloadClass: "TENANT_CONFIGURATION",
      payload: { fields: [field] },
    });
  });

  it("does not reveal or mutate a symbol owned only by another tenant", async () => {
    const bobBefore = await strategyByOwnerAndSymbol(
      world.bob.userId,
      "SOLUSDT",
    );

    const result = await updateOwnedStrategyConfig(
      db(),
      world.alice.userId,
      "SOLUSDT",
      "thresholdPercent",
      9,
      "telegram_update_51003",
    );

    expect(result).toEqual({ outcome: "NOT_FOUND" });
    expect(await strategyByOwnerAndSymbol(world.bob.userId, "SOLUSDT")).toEqual(
      bobBefore,
    );
    expect(await eventsByAction("STRATEGY_UPDATED")).toHaveLength(0);
  });

  it("rolls the config mutation back when its audit event is invalid", async () => {
    const before = await strategyByOwnerAndSymbol(
      world.alice.userId,
      world.sharedSymbol,
    );

    await expect(
      updateOwnedStrategyConfig(
        db(),
        world.alice.userId,
        world.sharedSymbol,
        "thresholdPercent",
        8,
        "bad",
      ),
    ).rejects.toThrow("AUDIT_EVENT_INVALID");

    const after = await strategyByOwnerAndSymbol(
      world.alice.userId,
      world.sharedSymbol,
    );
    expect(after?.config).toEqual(before?.config);
    expect(await eventsByAction("STRATEGY_UPDATED")).toHaveLength(0);
  });
});

describe("toggleOwnedStrategy", () => {
  it("atomically toggles and audits only the caller's strategy", async () => {
    const correlationId = "telegram_update_51004";
    const bobBefore = await strategyByOwnerAndSymbol(
      world.bob.userId,
      world.sharedSymbol,
    );

    const result = await toggleOwnedStrategy(
      db(),
      world.alice.userId,
      world.sharedSymbol,
      correlationId,
    );

    expect(result).toEqual({
      outcome: "UPDATED",
      strategyId: world.alice.sharedSymbolStrategyId,
      enabled: false,
    });
    const aliceAfter = await strategyByOwnerAndSymbol(
      world.alice.userId,
      world.sharedSymbol,
    );
    const bobAfter = await strategyByOwnerAndSymbol(
      world.bob.userId,
      world.sharedSymbol,
    );
    expect(aliceAfter?.enabled).toBe(false);
    expect(bobAfter?.enabled).toBe(bobBefore?.enabled);

    const events = await eventsByAction("STRATEGY_UPDATED");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId: world.alice.userId,
      actorKind: "USER",
      actorChannel: "TELEGRAM",
      actorUserId: world.alice.userId,
      entityType: "strategy",
      entityId: world.alice.sharedSymbolStrategyId,
      reasonCode: "USER_REQUESTED",
      correlationId,
      payloadClass: "TENANT_CONFIGURATION",
      payload: { fields: ["enabled"], enabled: false },
    });
  });

  it("does not reapply a delivered toggle, even after a newer toggle", async () => {
    const original = await toggleOwnedStrategy(
      db(),
      world.alice.userId,
      world.sharedSymbol,
      "telegram_update_replay_1",
    );
    expect(original).toMatchObject({ enabled: false });
    expect(
      await toggleOwnedStrategy(
        db(),
        world.alice.userId,
        world.sharedSymbol,
        "telegram_update_replay_1",
      ),
    ).toEqual(original);
    expect(
      (await strategyByOwnerAndSymbol(world.alice.userId, world.sharedSymbol))
        ?.enabled,
    ).toBe(false);

    await toggleOwnedStrategy(
      db(),
      world.alice.userId,
      world.sharedSymbol,
      "telegram_update_replay_2",
    );
    expect(
      await toggleOwnedStrategy(
        db(),
        world.alice.userId,
        world.sharedSymbol,
        "telegram_update_replay_1",
      ),
    ).toEqual(original);
    expect(
      (await strategyByOwnerAndSymbol(world.alice.userId, world.sharedSymbol))
        ?.enabled,
    ).toBe(true);
    expect(await eventsByAction("STRATEGY_UPDATED")).toHaveLength(2);
  });

  it("rolls the toggle back when its audit event is invalid", async () => {
    await expect(
      toggleOwnedStrategy(db(), world.alice.userId, world.sharedSymbol, "bad"),
    ).rejects.toThrow("AUDIT_EVENT_INVALID");

    const strategy = await strategyByOwnerAndSymbol(
      world.alice.userId,
      world.sharedSymbol,
    );
    expect(strategy?.enabled).toBe(true);
    expect(await eventsByAction("STRATEGY_UPDATED")).toHaveLength(0);
  });
});
