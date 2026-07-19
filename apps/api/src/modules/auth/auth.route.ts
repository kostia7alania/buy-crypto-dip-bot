import { schema } from "@buy-crypto-dip-bot/db";
import { Hono } from "hono";
import * as v from "valibot";
import { getDb } from "../../db.js";
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

export const authRoutes = new Hono().post("/telegram", async (c) => {
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
    const [user] = await db
      .insert(schema.users)
      .values({
        telegramUserId,
        // For a private chat the chat id equals the user id; the bot's
        // /start handler overwrites it with the real chat id if it differs.
        telegramChatId: telegramUserId,
        username: payload.username ?? null,
        firstName: payload.first_name ?? null,
      })
      .onConflictDoUpdate({
        target: schema.users.telegramUserId,
        set: {
          username: payload.username ?? null,
          firstName: payload.first_name ?? null,
        },
      })
      .returning();
    if (!user) throw new Error("upsert returned no row");

    await db.insert(schema.auditEvents).values({
      entityType: "user",
      entityId: user.id,
      action: "USER_WEB_LOGIN",
      payload: { telegramUserId, username: payload.username ?? null },
    });

    return c.json({
      user: {
        id: user.id,
        telegramUserId: user.telegramUserId,
        username: user.username,
        firstName: user.firstName,
      },
    });
  } catch (error) {
    console.error("Telegram login failed:", error);
    return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
  }
});
