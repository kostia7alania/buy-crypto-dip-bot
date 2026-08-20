import { schema, withTenantContext } from "@buy-crypto-dip-bot/db";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb, type TenantDb } from "../../db.js";
import {
  type ProtectedApiEnv,
  requireProtectedApiContext,
} from "../auth/auth.middleware.js";

export const listOrders = (db: TenantDb, tenantId: string) =>
  db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.tenantId, tenantId))
    .orderBy(desc(schema.orders.createdAt))
    .limit(100);

export const ordersRoutes = new Hono<ProtectedApiEnv>()
  .use("*", requireProtectedApiContext)
  .get("/", async (c) => {
    const actor = c.get("tenantActor");
    try {
      const list = await withTenantContext(getDb(), actor, async (db) =>
        listOrders(db, actor.tenantId),
      );
      return c.json(list);
    } catch (error) {
      console.error("Failed to list orders:", error);
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  });
