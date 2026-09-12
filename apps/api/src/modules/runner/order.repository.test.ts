import { schema } from "@buy-crypto-dip-bot/db";
import type {
  TestDatabase,
  TwoTenantWorld,
} from "@buy-crypto-dip-bot/db/testing";
import { createTestDb, seedTwoTenants } from "@buy-crypto-dip-bot/db/testing";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { claimDueDryRunOrder } from "./order.repository.js";

let harness: TestDatabase;
let world: TwoTenantWorld;
const db = () =>
  harness.db as unknown as Parameters<typeof claimDueDryRunOrder>[0];
const dueAt = () => new Date(Date.now() + 120_000);

beforeEach(async () => {
  harness = await createTestDb();
  world = await seedTwoTenants(harness.db);
});

afterEach(async () => {
  await harness?.close();
});

describe("due-order atomic claim", () => {
  it("leaves an unsupported legacy order pending instead of simulating it", async () => {
    await harness.db
      .update(schema.orders)
      .set({ symbol: "PEPEUSDT" })
      .where(eq(schema.orders.id, world.alice.pendingOrderId));
    expect(
      await claimDueDryRunOrder(
        db(),
        world.alice.pendingOrderId,
        "blocked_symbol_1234",
        dueAt(),
      ),
    ).toBeNull();
    const [order] = await harness.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, world.alice.pendingOrderId));
    expect(order?.status).toBe("PENDING");
    const events = await harness.db
      .select()
      .from(schema.auditEvents)
      .where(
        and(
          eq(schema.auditEvents.entityId, world.alice.pendingOrderId),
          eq(schema.auditEvents.action, "DRY_RUN_ORDER_COMPLETED"),
        ),
      );
    expect(events).toHaveLength(0);
  });

  it("lets exactly one concurrent runner commit state and evidence", async () => {
    const [first, second] = await Promise.all([
      claimDueDryRunOrder(
        db(),
        world.alice.pendingOrderId,
        "runner_claim_first_1234",
        dueAt(),
      ),
      claimDueDryRunOrder(
        db(),
        world.alice.pendingOrderId,
        "runner_claim_second_1234",
        dueAt(),
      ),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);

    const [order] = await harness.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, world.alice.pendingOrderId));
    expect(order?.status).toBe("COMPLETED");

    const events = await harness.db
      .select()
      .from(schema.auditEvents)
      .where(
        and(
          eq(schema.auditEvents.entityId, world.alice.pendingOrderId),
          eq(schema.auditEvents.action, "DRY_RUN_ORDER_COMPLETED"),
        ),
      );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId: world.alice.userId,
      actorKind: "SYSTEM",
      actorChannel: "RUNNER",
      reasonCode: "SCHEDULE_DUE",
    });
  });

  it("does not claim a pending order before its durable due time", async () => {
    await expect(
      claimDueDryRunOrder(
        db(),
        world.alice.pendingOrderId,
        "runner_not_due_1234",
        new Date(),
      ),
    ).resolves.toBeNull();
  });

  it("rolls state back when immutable evidence is rejected", async () => {
    await expect(
      claimDueDryRunOrder(db(), world.alice.pendingOrderId, "bad", dueAt()),
    ).rejects.toThrow("AUDIT_EVENT_INVALID:CORRELATION_ID");

    const [order] = await harness.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, world.alice.pendingOrderId));
    expect(order?.status).toBe("PENDING");
  });
});
