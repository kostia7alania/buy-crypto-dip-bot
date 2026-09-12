import { schema } from "@buy-crypto-dip-bot/db";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../../db.js";
import { type AppEnv, requireUser } from "../auth/principal.middleware.js";

export const ordersRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const user = requireUser(c);
  const db = getDb();
  const list = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.userId, user.userId))
    .orderBy(desc(schema.orders.createdAt))
    .limit(100);
  return c.json(list);
});
