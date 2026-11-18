import { auditEventFromRow, schema } from "@buy-crypto-dip-bot/db";
import type { LatestRiskDecisionReport } from "@buy-crypto-dip-bot/shared-types";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import {
  type AppEnv,
  requireTenantDb,
  requireUser,
} from "../auth/principal.middleware.js";

export const listAuditHistory = async (
  db: Pick<ReturnType<typeof requireTenantDb>, "select">,
  userId: string,
) => {
  // Only the caller's own events. Operator-level events carry a null user_id
  // and are deliberately excluded rather than shown to everyone — this feed is
  // a tenant view, not an admin console.
  const list = await db
    .select()
    .from(schema.auditEvents)
    .where(
      and(
        eq(schema.auditEvents.scope, "USER"),
        eq(schema.auditEvents.userId, userId),
        eq(schema.auditEvents.schemaVersion, 1),
      ),
    )
    .orderBy(desc(schema.auditEvents.createdAt), desc(schema.auditEvents.id))
    .limit(100);
  const audit = list.flatMap((row) => {
    const event = auditEventFromRow(row);
    return event
      ? [{ id: row.id, createdAt: row.createdAt.toISOString(), ...event }]
      : [];
  });
  return { audit, auditOmitted: list.length - audit.length };
};

export const auditRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const { audit } = await listAuditHistory(
      requireTenantDb(c),
      requireUser(c).userId,
    );
    return c.json(audit);
  })
  .get("/decisions/latest", async (c) => {
    const db = requireTenantDb(c);
    const userId = requireUser(c).userId;
    const [row] = await db
      .select()
      .from(schema.auditEvents)
      .where(
        and(
          eq(schema.auditEvents.userId, userId),
          eq(schema.auditEvents.scope, "USER"),
          eq(schema.auditEvents.schemaVersion, 1),
          inArray(schema.auditEvents.action, [
            "RISK_DECISION_APPROVED",
            "RISK_DECISION_REJECTED",
          ]),
        ),
      )
      .orderBy(desc(schema.auditEvents.createdAt), desc(schema.auditEvents.id))
      .limit(1);
    if (!row)
      return c.json({ decision: null } satisfies LatestRiskDecisionReport);
    const event = auditEventFromRow(row);
    if (
      event?.type !== "RISK_DECISION_APPROVED" &&
      event?.type !== "RISK_DECISION_REJECTED"
    ) {
      return c.json({ error: "RISK_DECISION_UNAVAILABLE" }, 503);
    }
    let symbol: string | null = null;
    if (event.type === "RISK_DECISION_REJECTED") {
      symbol = event.payload.provenance?.strategyConfig.symbol ?? null;
    } else {
      const [order] = await db
        .select({ symbol: schema.orders.symbol })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.userId, userId),
            eq(schema.orders.strategyId, event.subject.id),
            eq(schema.orders.id, event.payload.orderId),
          ),
        )
        .limit(1);
      if (order && /^[A-Z0-9]{3,20}$/.test(order.symbol)) symbol = order.symbol;
    }
    return c.json({
      decision: {
        type: event.type,
        createdAt: row.createdAt.toISOString(),
        symbol,
        reasonCodes: event.payload.reasonCodes,
      },
    } satisfies LatestRiskDecisionReport);
  });
