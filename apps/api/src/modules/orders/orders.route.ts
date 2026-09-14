import { schema } from "@buy-crypto-dip-bot/db";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import {
  type AppEnv,
  requireTenantDb,
  requireUser,
} from "../auth/principal.middleware.js";

export const listOrders = (
  db: Pick<ReturnType<typeof requireTenantDb>, "select">,
  userId: string,
) => {
  return db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.userId, userId))
    .orderBy(desc(schema.orders.createdAt))
    .limit(100);
};

export const ordersRoutes = new Hono<AppEnv>().get("/", async (c) => {
  return c.json(await listOrders(requireTenantDb(c), requireUser(c).userId));
});
