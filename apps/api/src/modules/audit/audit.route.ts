import { schema } from "@buy-crypto-dip-bot/db";
import { desc } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../../db.js";

export const auditRoutes = new Hono().get("/", async (c) => {
  const db = getDb();
  const list = await db
    .select()
    .from(schema.auditEvents)
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(100);
  return c.json(list);
});
