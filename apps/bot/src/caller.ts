import {
  createSessionToken,
  hashSessionToken,
  schema,
} from "@buy-crypto-dip-bot/db";
import { createCorrelationId } from "@buy-crypto-dip-bot/shared-types";
import { eq } from "drizzle-orm";
import type { Context } from "grammy";
import { getDb } from "./db.js";

export interface BotCaller {
  id: string;
  telegramUserId: string;
  telegramChatId: string;
}

/** The subset of an update that decides whether it may act on user data. */
export interface CallerContextShape {
  from?: { id: number } | undefined;
  chat?: { type: string } | undefined;
}

export const hasVerifiedNotificationBinding = (user: {
  telegramChatId: string | null;
  notificationEnabledAt: Date | null;
}): boolean => Boolean(user.telegramChatId && user.notificationEnabledAt);

/**
 * Whether an update can be attributed to exactly one accountable person.
 *
 * Group and channel chats are refused outright: a shared chat has no single
 * owner, so a mutation issued there could not be attributed to anyone, and
 * anyone else in the room could trigger it. Updates with no `from` (channel
 * posts) have no actor at all.
 *
 * Pure, so the rule can be tested without a database or a Telegram server.
 */
export const isEligibleCallerContext = (ctx: CallerContextShape): boolean => {
  if (!ctx.from?.id) return false;
  if (ctx.chat && ctx.chat.type !== "private") return false;
  return true;
};

/**
 * Resolves the Telegram account behind an update to a row in `users`.
 *
 * Returns null when the update is not attributable (see above) or when the
 * person has never sent /start.
 */
export const resolveCaller = async (
  ctx: Context,
): Promise<BotCaller | null> => {
  if (!isEligibleCallerContext(ctx)) return null;
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return null;

  const db = getDb();
  const [user] = await db
    .select({
      id: schema.users.id,
      telegramUserId: schema.users.telegramUserId,
      telegramChatId: schema.users.telegramChatId,
      notificationEnabledAt: schema.users.notificationEnabledAt,
    })
    .from(schema.users)
    .where(eq(schema.users.telegramUserId, String(telegramUserId)))
    .limit(1);

  if (!user || !hasVerifiedNotificationBinding(user) || !user.telegramChatId) {
    return null;
  }
  return {
    id: user.id,
    telegramUserId: user.telegramUserId,
    telegramChatId: user.telegramChatId,
  };
};

const NOT_REGISTERED =
  "👋 Send /start first so I know who you are — then this command will work.";

const NOT_PRIVATE =
  "🔒 This command only works in a direct chat with me, so your settings stay yours.";

/**
 * Resolves the caller or answers the user explaining why not.
 *
 * Every command that reads or writes user-owned rows goes through this. The
 * return type forces the caller to handle the null case, which is why there is
 * no "current user" global anywhere in this app.
 */
export const requireCaller = async (
  ctx: Context,
): Promise<BotCaller | null> => {
  if (ctx.chat && ctx.chat.type !== "private") {
    await ctx.reply(NOT_PRIVATE);
    return null;
  }
  if (!ctx.from?.id) return null;

  const caller = await resolveCaller(ctx);
  if (!caller) {
    await ctx.reply(NOT_REGISTERED);
    return null;
  }
  return caller;
};

/**
 * Same, for callback queries, where the answer goes in the toast rather than a
 * new message.
 */
export const requireCallbackCaller = async (
  ctx: Context,
): Promise<BotCaller | null> => {
  const caller = await resolveCaller(ctx);
  if (!caller) {
    await ctx.answerCallbackQuery("Send /start first so I know who you are.");
    return null;
  }
  return caller;
};

// Long enough for one command's round trip, short enough that an accumulated
// pile of bot-minted tokens is worthless within minutes. Web logins get the
// full 30-day TTL; a bot command has no reason to.
export const BOT_SESSION_TTL_MS = 5 * 60 * 1000;

/**
 * A short-lived API session token for a resolved caller, so bot commands can
 * read user-scoped API routes as that user rather than as an anonymous service.
 *
 * The bot mints these directly because it *is* an identity authority here: it
 * holds the bot token and Telegram has already authenticated `ctx.from.id`.
 * Crucially this does not weaken the API's rule that a service key alone is
 * insufficient — the bot must still name a specific user, and it can only do so
 * for someone who has actually talked to it.
 */
export const getSessionTokenFor = async (
  caller: BotCaller,
  correlationId: string = createCorrelationId(),
  db = getDb(),
): Promise<string> => {
  const token = createSessionToken();

  await db.insert(schema.apiSessions).values({
    userId: caller.id,
    tokenHash: hashSessionToken(token),
    kind: "BOT_COMMAND",
    correlationId,
    expiresAt: new Date(Date.now() + BOT_SESSION_TTL_MS),
  });

  return token;
};
