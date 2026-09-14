import { getAllowedSymbols, isAllowedSymbol } from "@buy-crypto-dip-bot/config";
import {
  auditEventRow,
  schema,
  withPersonalTenant,
} from "@buy-crypto-dip-bot/db";
import {
  AUDIT_SCHEMA_VERSION,
  createCorrelationId,
} from "@buy-crypto-dip-bot/shared-types";
import { and, eq, inArray } from "drizzle-orm";
import type { getDb } from "./db.js";

type Db = ReturnType<typeof getDb>;

export type OrderClaimOutcome =
  | { outcome: "CLAIMED"; order: typeof schema.orders.$inferSelect }
  | { outcome: "NOT_FOUND" }
  | { outcome: "SYMBOL_NOT_ALLOWED" }
  | { outcome: "ALREADY_SETTLED"; status: string };

/**
 * Atomically moves one of the caller's own PENDING orders to a terminal state.
 *
 * Two properties matter here and neither is optional:
 *
 *  - **Ownership is part of the query.** A callback carries only an order id,
 *    and Telegram will happily deliver a forwarded or replayed one. Looking up
 *    by id alone let anybody cancel or force-execute anybody's order.
 *  - **The transition is a conditional UPDATE**, not read-then-write. The
 *    runner's own executor is racing this, as is a double-tapped button, and
 *    exactly one of them may win.
 *
 * `NOT_FOUND` deliberately covers both "no such order" and "not yours", so the
 * response cannot be used to discover that an id exists.
 */
export const claimOwnedPendingOrder = async (
  db: Db,
  orderId: string,
  callerId: string,
  nextStatus: "CANCELLED" | "COMPLETED",
  correlationId: string = createCorrelationId(),
): Promise<OrderClaimOutcome> => {
  const [existing] = await db
    .select()
    .from(schema.orders)
    .where(
      and(eq(schema.orders.id, orderId), eq(schema.orders.userId, callerId)),
    )
    .limit(1);

  if (!existing) return { outcome: "NOT_FOUND" };
  if (existing.status !== "PENDING") {
    return { outcome: "ALREADY_SETTLED", status: existing.status };
  }
  if (
    nextStatus === "COMPLETED" &&
    !isAllowedSymbol(existing.symbol, process.env.ALLOWLIST_SYMBOLS)
  ) {
    return { outcome: "SYMBOL_NOT_ALLOWED" };
  }

  const row = await withPersonalTenant(db, callerId, async (tx) => {
    const [claimed] = await tx
      .update(schema.orders)
      .set({ status: nextStatus })
      .where(
        and(
          eq(schema.orders.id, orderId),
          eq(schema.orders.userId, callerId),
          eq(schema.orders.status, "PENDING"),
          eq(schema.orders.mode, "DRY_RUN"),
          nextStatus === "COMPLETED"
            ? inArray(
                schema.orders.symbol,
                getAllowedSymbols(process.env.ALLOWLIST_SYMBOLS),
              )
            : undefined,
        ),
      )
      .returning();
    if (!claimed) return null;

    await tx.insert(schema.auditEvents).values(
      auditEventRow(
        nextStatus === "COMPLETED"
          ? {
              schemaVersion: AUDIT_SCHEMA_VERSION,
              type: "DRY_RUN_ORDER_COMPLETED",
              scope: "USER",
              userId: callerId,
              actor: { kind: "USER", channel: "TELEGRAM", userId: callerId },
              reasonCode: "USER_FORCED_EXECUTION",
              correlationId,
              subject: { type: "ORDER", id: claimed.id },
              payloadClass: "TENANT_FINANCIAL",
              payload: {
                from: "PENDING",
                to: "COMPLETED",
                mode: "DRY_RUN",
              },
            }
          : {
              schemaVersion: AUDIT_SCHEMA_VERSION,
              type: "DRY_RUN_ORDER_CANCELLED",
              scope: "USER",
              userId: callerId,
              actor: { kind: "USER", channel: "TELEGRAM", userId: callerId },
              reasonCode: "USER_CANCELLED",
              correlationId,
              subject: { type: "ORDER", id: claimed.id },
              payloadClass: "TENANT_FINANCIAL",
              payload: {
                from: "PENDING",
                to: "CANCELLED",
                mode: "DRY_RUN",
              },
            },
      ),
    );
    return claimed;
  });
  if (!row) {
    // Lost the race between the read above and this update.
    return { outcome: "ALREADY_SETTLED", status: "PENDING" };
  }

  return { outcome: "CLAIMED", order: row };
};

/**
 * Enables or disables every strategy belonging to one caller.
 *
 * Scoped on purpose: a kill switch that reached other tenants would be a
 * denial-of-service button rather than a safety feature.
 */
export const setEnabledForCaller = async (
  db: Db,
  callerId: string,
  enabled: boolean,
  correlationId: string = createCorrelationId(),
): Promise<number> => {
  return withPersonalTenant(db, callerId, async (tx) => {
    const updated = await tx
      .update(schema.strategies)
      .set({ enabled })
      .where(eq(schema.strategies.userId, callerId))
      .returning();

    await tx.insert(schema.auditEvents).values(
      auditEventRow(
        enabled
          ? {
              schemaVersion: AUDIT_SCHEMA_VERSION,
              type: "STRATEGIES_BULK_RESUMED",
              scope: "USER",
              userId: callerId,
              actor: { kind: "USER", channel: "TELEGRAM", userId: callerId },
              reasonCode: "USER_REQUESTED",
              correlationId,
              subject: { type: "USER", id: callerId },
              payloadClass: "TENANT_CONFIGURATION",
              payload: { affectedCount: updated.length },
            }
          : {
              schemaVersion: AUDIT_SCHEMA_VERSION,
              type: "STRATEGIES_BULK_PAUSED",
              scope: "USER",
              userId: callerId,
              actor: { kind: "USER", channel: "TELEGRAM", userId: callerId },
              reasonCode: "USER_KILL_SWITCH",
              correlationId,
              subject: { type: "USER", id: callerId },
              payloadClass: "TENANT_CONFIGURATION",
              payload: { affectedCount: updated.length },
            },
      ),
    );

    return updated.length;
  });
};

/** One caller's strategy for a symbol, or null. Never another tenant's. */
export const findOwnedStrategyBySymbol = async (
  db: Db,
  callerId: string,
  symbol: string,
) => {
  const [strategy] = await db
    .select()
    .from(schema.strategies)
    .where(
      and(
        eq(schema.strategies.userId, callerId),
        eq(schema.strategies.symbol, symbol),
      ),
    )
    .limit(1);
  return strategy ?? null;
};
