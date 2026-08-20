import { ensureTelegramPrincipal } from "@buy-crypto-dip-bot/db";
import type { Context } from "grammy";
import { getDb } from "./db.js";

export interface BotPrincipal {
  userId: string;
  tenantId: string;
  telegramUserId: string;
  telegramChatId: string;
}

type RejectPrincipal = (message: string) => Promise<unknown>;

export const requirePrivatePrincipal = async (
  ctx: Context,
  reject: RejectPrincipal,
): Promise<BotPrincipal | null> => {
  if (
    ctx.chat?.type !== "private" ||
    !ctx.from ||
    ctx.from.is_bot ||
    ctx.chat.id !== ctx.from.id
  ) {
    await reject(
      "🔒 Personal bot actions are available only in a private chat.",
    );
    return null;
  }

  try {
    const principal = await ensureTelegramPrincipal(getDb(), {
      id: ctx.from.id,
      privateChatId: ctx.chat.id,
      verifiedAt: new Date(),
      username: ctx.from.username ?? null,
      firstName: ctx.from.first_name ?? null,
    });

    if (!principal.userId || !principal.tenantId) {
      throw new Error("TELEGRAM_PRINCIPAL_INCOMPLETE");
    }

    return {
      userId: principal.userId,
      tenantId: principal.tenantId,
      telegramUserId: String(ctx.from.id),
      telegramChatId: String(ctx.chat.id),
    };
  } catch (error) {
    console.error("Failed to resolve Telegram principal:", error);
    await reject(
      "❌ Could not verify your Telegram account. Try again shortly.",
    );
    return null;
  }
};

export const tenantApiHeaders = (
  principal: BotPrincipal,
): Record<string, string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_REQUIRED");
  }

  return {
    "x-api-key": apiKey,
    "x-dipbot-user-id": principal.userId,
    "x-dipbot-tenant-id": principal.tenantId,
  };
};
