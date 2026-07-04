import { schema } from "@buy-crypto-dip-bot/db";
import { desc } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../../db.js";

export const ordersRoutes = new Hono()
  .get("/", async (c) => {
    const db = getDb();
    const list = await db
      .select()
      .from(schema.orders)
      .orderBy(desc(schema.orders.createdAt))
      .limit(100);
    return c.json(list);
  })
  .post("/clear", async (c) => {
    // Helper endpoint to reset local workspace for testing
    const db = getDb();
    await db.delete(schema.orders);
    await db.delete(schema.auditEvents);
    return c.json({ ok: true });
  });
