import { schema, withTenantContext } from "@buy-crypto-dip-bot/db";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb, type TenantDb } from "../../db.js";
import {
  type ProtectedApiEnv,
  requireProtectedApiContext,
} from "../auth/auth.middleware.js";

export const listAuditEvents = (db: TenantDb, tenantId: string) =>
  db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.tenantId, tenantId))
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(100);

export const auditRoutes = new Hono<ProtectedApiEnv>()
  .use("*", requireProtectedApiContext)
  .get("/", async (c) => {
    const actor = c.get("tenantActor");
    try {
      const list = await withTenantContext(getDb(), actor, async (db) =>
        listAuditEvents(db, actor.tenantId),
      );
      return c.json(list);
    } catch (error) {
      console.error("Failed to list audit events:", error);
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  });
