import { schema } from "@buy-crypto-dip-bot/db";
import type {
  TestDatabase,
  TwoTenantWorld,
} from "@buy-crypto-dip-bot/db/testing";
import { createTestDb, seedTwoTenants } from "@buy-crypto-dip-bot/db/testing";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimOwnedPendingOrder,
  findOwnedStrategyBySymbol,
  setEnabledForCaller,
} from "./order.repository.js";

// Telegram callbacks carry nothing but an order id, and Telegram will happily
// deliver a forwarded or replayed one. These run against a real Postgres with
// two tenants, because the guarantees being tested are ownership and atomicity
// — neither of which a mocked database can honestly demonstrate.

let harness: TestDatabase;
let world: TwoTenantWorld;
// PGlite and node-postgres yield structurally identical Drizzle databases with
// distinct nominal types; one cast at the seam keeps the tests themselves typed.
const db = () =>
  harness.db as unknown as Parameters<typeof claimOwnedPendingOrder>[0];

beforeEach(async () => {
  harness = await createTestDb();
  world = await seedTwoTenants(harness.db);
}, 60_000);

afterEach(async () => {
  vi.unstubAllEnvs();
  await harness?.close();
});

const statusOf = async (orderId: string) => {
  const [row] = await harness.db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId));
  return row?.status;
};

const reservationStatusOf = async (orderId: string) => {
  const [row] = await harness.db
    .select({ status: schema.orderReservations.status })
    .from(schema.orderReservations)
    .where(eq(schema.orderReservations.orderId, orderId));
  return row?.status;
};

describe("claimOwnedPendingOrder", () => {
  it("blocks buy-now after a symbol leaves policy while preserving cancellation", async () => {
    vi.stubEnv("ALLOWLIST_SYMBOLS", "ETHUSDT");
    expect(
      await claimOwnedPendingOrder(
        db(),
        world.alice.pendingOrderId,
        world.alice.userId,
        "COMPLETED",
      ),
    ).toEqual({ outcome: "SYMBOL_NOT_ALLOWED" });
    expect(await statusOf(world.alice.pendingOrderId)).toBe("PENDING");
    expect(
      (
        await claimOwnedPendingOrder(
          db(),
          world.alice.pendingOrderId,
          world.alice.userId,
          "CANCELLED",
        )
      ).outcome,
    ).toBe("CLAIMED");
    expect(await statusOf(world.alice.pendingOrderId)).toBe("CANCELLED");
    expect(await reservationStatusOf(world.alice.pendingOrderId)).toBe(
      "RELEASED",
    );
    const events = await harness.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.entityId, world.alice.pendingOrderId));
    expect(events.map((event) => event.action)).not.toContain(
      "DRY_RUN_ORDER_COMPLETED",
    );
    expect(events.map((event) => event.action)).toContain(
      "DRY_RUN_ORDER_CANCELLED",
    );
  });

  it("cancels the caller's own pending order", async () => {
    const result = await claimOwnedPendingOrder(
      db(),
      world.alice.pendingOrderId,
      world.alice.userId,
      "CANCELLED",
    );

    expect(result.outcome).toBe("CLAIMED");
    expect(await statusOf(world.alice.pendingOrderId)).toBe("CANCELLED");
    expect(await reservationStatusOf(world.alice.pendingOrderId)).toBe(
      "RELEASED",
    );
    const events = await harness.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.entityId, world.alice.pendingOrderId));
    expect(events.map((event) => event.action)).toContain(
      "DRY_RUN_ORDER_CANCELLED",
    );
  });

  it("refuses another tenant's order and leaves it untouched", async () => {
    const result = await claimOwnedPendingOrder(
      db(),
      world.bob.pendingOrderId,
      world.alice.userId,
      "CANCELLED",
    );

    expect(result.outcome).toBe("NOT_FOUND");
    // Bob's order must be exactly as it was.
    expect(await statusOf(world.bob.pendingOrderId)).toBe("PENDING");
    expect(await reservationStatusOf(world.bob.pendingOrderId)).toBe("ACTIVE");
  });

  it("reports another tenant's order as NOT_FOUND, never as forbidden", async () => {
    // "Forbidden" would confirm the id is real, which is itself a leak.
    const mine = await claimOwnedPendingOrder(
      db(),
      "99999999-0000-4000-8000-000000000099",
      world.alice.userId,
      "CANCELLED",
    );
    const theirs = await claimOwnedPendingOrder(
      db(),
      world.bob.pendingOrderId,
      world.alice.userId,
      "CANCELLED",
    );

    expect(theirs).toEqual(mine);
  });

  it("force-executes the caller's own pending order", async () => {
    const result = await claimOwnedPendingOrder(
      db(),
      world.alice.pendingOrderId,
      world.alice.userId,
      "COMPLETED",
    );

    expect(result.outcome).toBe("CLAIMED");
    expect(await statusOf(world.alice.pendingOrderId)).toBe("COMPLETED");
    expect(await reservationStatusOf(world.alice.pendingOrderId)).toBe(
      "CONSUMED",
    );
  });

  it("refuses a second tap rather than booking the purchase twice", async () => {
    await claimOwnedPendingOrder(
      db(),
      world.alice.pendingOrderId,
      world.alice.userId,
      "COMPLETED",
    );
    const second = await claimOwnedPendingOrder(
      db(),
      world.alice.pendingOrderId,
      world.alice.userId,
      "COMPLETED",
    );

    expect(second).toEqual({ outcome: "ALREADY_SETTLED", status: "COMPLETED" });
  });

  it("lets exactly one of two concurrent claims win", async () => {
    // The real race: the button tapped twice, or tapped while the runner's
    // executor is settling the same row.
    const [a, b] = await Promise.all([
      claimOwnedPendingOrder(
        db(),
        world.alice.pendingOrderId,
        world.alice.userId,
        "COMPLETED",
      ),
      claimOwnedPendingOrder(
        db(),
        world.alice.pendingOrderId,
        world.alice.userId,
        "CANCELLED",
      ),
    ]);

    const claimed = [a, b].filter((r) => r.outcome === "CLAIMED");
    expect(claimed).toHaveLength(1);
    const terminalStatus = await statusOf(world.alice.pendingOrderId);
    expect(await reservationStatusOf(world.alice.pendingOrderId)).toBe(
      terminalStatus === "COMPLETED" ? "CONSUMED" : "RELEASED",
    );
  });

  it("will not cancel an order that already completed", async () => {
    const result = await claimOwnedPendingOrder(
      db(),
      world.alice.completedOrderId,
      world.alice.userId,
      "CANCELLED",
    );

    expect(result).toEqual({ outcome: "ALREADY_SETTLED", status: "COMPLETED" });
    expect(await statusOf(world.alice.completedOrderId)).toBe("COMPLETED");
  });

  it("returns NOT_FOUND for an id that does not exist at all", async () => {
    const result = await claimOwnedPendingOrder(
      db(),
      "99999999-0000-4000-8000-000000000099",
      world.alice.userId,
      "CANCELLED",
    );
    expect(result).toEqual({ outcome: "NOT_FOUND" });
  });
});

describe("setEnabledForCaller", () => {
  const enabledCount = async (userId: string) => {
    const rows = await harness.db
      .select()
      .from(schema.strategies)
      .where(eq(schema.strategies.userId, userId));
    return rows.filter((r) => r.enabled).length;
  };

  it("pauses only the caller's strategies", async () => {
    const bobBefore = await enabledCount(world.bob.userId);

    const count = await setEnabledForCaller(db(), world.alice.userId, false);

    expect(count).toBe(2);
    expect(await enabledCount(world.alice.userId)).toBe(0);
    // A kill switch that reached other tenants would be a DoS button.
    expect(await enabledCount(world.bob.userId)).toBe(bobBefore);
    expect(bobBefore).toBeGreaterThan(0);
  });

  it("resumes only the caller's strategies", async () => {
    await setEnabledForCaller(db(), world.alice.userId, false);
    await setEnabledForCaller(db(), world.bob.userId, false);

    await setEnabledForCaller(db(), world.alice.userId, true);

    expect(await enabledCount(world.alice.userId)).toBe(2);
    expect(await enabledCount(world.bob.userId)).toBe(0);
  });

  it("writes an owner-stamped audit event", async () => {
    await setEnabledForCaller(db(), world.alice.userId, false);

    const events = await harness.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.action, "STRATEGIES_BULK_PAUSED"));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      schemaVersion: 1,
      scope: "USER",
      userId: world.alice.userId,
      actorKind: "USER",
      actorChannel: "TELEGRAM",
      actorUserId: world.alice.userId,
      reasonCode: "USER_KILL_SWITCH",
      payloadClass: "TENANT_CONFIGURATION",
      payload: { affectedCount: 2 },
    });
  });
});

describe("findOwnedStrategyBySymbol", () => {
  it("finds the caller's own strategy for a shared symbol", async () => {
    const found = await findOwnedStrategyBySymbol(
      db(),
      world.alice.userId,
      world.sharedSymbol,
    );
    expect(found?.id).toBe(world.alice.sharedSymbolStrategyId);
  });

  it("never returns the other tenant's strategy for the same symbol", async () => {
    const found = await findOwnedStrategyBySymbol(
      db(),
      world.alice.userId,
      world.sharedSymbol,
    );
    // Both own BTCUSDT; a symbol-only lookup used to return whichever came
    // first, letting one user edit the other's coin.
    expect(found?.id).not.toBe(world.bob.sharedSymbolStrategyId);
  });

  it("returns null for a symbol the caller does not own", async () => {
    const found = await findOwnedStrategyBySymbol(
      db(),
      world.alice.userId,
      "SOLUSDT",
    );
    expect(found).toBeNull();
  });
});
