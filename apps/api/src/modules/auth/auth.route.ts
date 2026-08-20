import {
  ensureTelegramPrincipal,
  schema,
  withTenantContext,
} from "@buy-crypto-dip-bot/db";
import { Hono } from "hono";
import * as v from "valibot";
import { getDb } from "../../db.js";
import { requireInternalApiKey } from "./auth.middleware.js";
import {
  type TelegramLoginPayload,
  verifyTelegramLogin,
} from "./auth.service.js";

const telegramLoginSchema = v.object({
  id: v.number(),
  auth_date: v.number(),
  hash: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
  first_name: v.optional(v.string()),
  last_name: v.optional(v.string()),
  username: v.optional(v.string()),
  photo_url: v.optional(v.string()),
});

export const authRoutes = new Hono()
  .use("*", requireInternalApiKey)
  .post("/telegram", async (c) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return c.json({ error: "TELEGRAM_LOGIN_NOT_CONFIGURED" }, 503);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "INVALID_PAYLOAD" }, 400);
    }
    const parsed = v.safeParse(telegramLoginSchema, body);
    if (!parsed.success) {
      return c.json({ error: "INVALID_PAYLOAD" }, 400);
    }

    const payload: TelegramLoginPayload = parsed.output;
    const verdict = verifyTelegramLogin(payload, botToken);
    if (!verdict.ok) {
      return c.json({ error: verdict.reason }, 401);
    }

    try {
      const db = getDb();
      const telegramUserId = String(payload.id);
      const principal = await ensureTelegramPrincipal(db, {
        id: telegramUserId,
        verifiedAt: new Date(payload.auth_date * 1000),
        privateChatId: telegramUserId,
        username: payload.username ?? null,
        firstName: payload.first_name ?? null,
        lastName: payload.last_name ?? null,
        photoUrl: payload.photo_url ?? null,
      });

      await withTenantContext(
        db,
        { userId: principal.userId, tenantId: principal.tenantId },
        async (tenantDb) => {
          await tenantDb.insert(schema.auditEvents).values({
            tenantId: principal.tenantId,
            actorUserId: principal.userId,
            entityType: "user",
            entityId: principal.userId,
            action: "USER_WEB_LOGIN",
            payload: {
              provider: "telegram",
              telegramUserId,
              username: payload.username ?? null,
            },
          });
        },
      );

      return c.json({
        user: {
          id: principal.userId,
          tenantId: principal.tenantId,
          telegramUserId: principal.subject,
          username: payload.username ?? null,
          firstName: payload.first_name ?? null,
        },
      });
    } catch (error) {
      console.error("Telegram login failed:", error);
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  });
