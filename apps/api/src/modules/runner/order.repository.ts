import { getAllowedSymbols } from "@buy-crypto-dip-bot/config";
import {
  auditEventRow,
  type createPostgresConnection,
  schema,
  withPersonalTenant,
} from "@buy-crypto-dip-bot/db";
import { AUDIT_SCHEMA_VERSION } from "@buy-crypto-dip-bot/shared-types";
import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";

type Db = ReturnType<typeof createPostgresConnection>["db"];

/**
 * Atomically claims one due DRY_RUN order and commits its immutable evidence.
 *
 * The due predicate is repeated inside the UPDATE: a list read can become
 * stale between workers, so the mutation itself is the only winning claim.
 */
export const claimDueDryRunOrder = async (
  db: Db,
  orderId: string,
  correlationId: string,
  now: Date = new Date(),
) => {
  // Internal scheduler discovery is privileged; the claim itself is owner-scoped.
  const [owner] = await db
    .select({ userId: schema.orders.userId })
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);
  if (!owner) return null;
  return withPersonalTenant(db, owner.userId, async (tx) => {
    const [claimed] = await tx
      .update(schema.orders)
      .set({ status: "COMPLETED" })
      .where(
        and(
          eq(schema.orders.id, orderId),
          eq(schema.orders.userId, owner.userId),
          eq(schema.orders.status, "PENDING"),
          eq(schema.orders.mode, "DRY_RUN"),
          inArray(
            schema.orders.symbol,
            getAllowedSymbols(process.env.ALLOWLIST_SYMBOLS),
          ),
          or(
            lte(schema.orders.executeAt, now),
            isNull(schema.orders.executeAt),
          ),
        ),
      )
      .returning();
    if (!claimed) return null;

    await tx.insert(schema.auditEvents).values(
      auditEventRow({
        schemaVersion: AUDIT_SCHEMA_VERSION,
        type: "DRY_RUN_ORDER_COMPLETED",
        scope: "USER",
        userId: claimed.userId,
        actor: { kind: "SYSTEM", channel: "RUNNER" },
        reasonCode: "SCHEDULE_DUE",
        correlationId,
        subject: { type: "ORDER", id: claimed.id },
        payloadClass: "TENANT_FINANCIAL",
        payload: { from: "PENDING", to: "COMPLETED", mode: "DRY_RUN" },
      }),
    );
    return claimed;
  });
};
