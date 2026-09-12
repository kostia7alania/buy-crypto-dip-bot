import { auditEventFromRow, schema } from "@buy-crypto-dip-bot/db";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../../db.js";
import { type AppEnv, requireUser } from "../auth/principal.middleware.js";

export const auditRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const user = requireUser(c);
  const db = getDb();
  // Only the caller's own events. Operator-level events carry a null user_id
  // and are deliberately excluded rather than shown to everyone — this feed is
  // a tenant view, not an admin console.
  const list = await db
    .select()
    .from(schema.auditEvents)
    .where(
      and(
        eq(schema.auditEvents.scope, "USER"),
        eq(schema.auditEvents.userId, user.userId),
        eq(schema.auditEvents.schemaVersion, 1),
      ),
    )
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(100);
  return c.json(
    list.flatMap((row) => {
      const event = auditEventFromRow(row);
      return event
        ? [{ id: row.id, createdAt: row.createdAt.toISOString(), ...event }]
        : [];
    }),
  );
});
