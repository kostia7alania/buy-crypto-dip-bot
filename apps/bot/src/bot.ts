import { schema } from "@buy-crypto-dip-bot/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { Bot } from "grammy";
import { getDb } from "./db.js";

export const createBot = (token: string) => {
  const bot = new Bot(token);

  bot.command("start", (ctx) => {
    const chatId = ctx.chat.id;
    const msg =
      `🤖 *DCA Guard Dev Bot Started*\n\n` +
      `Your Chat ID: \`${chatId}\`\n\n` +
      `To receive live notifications, configure this in your \`.env\` file:\n` +
      `\`TELEGRAM_CHAT_ID=${chatId}\``;

    return ctx.reply(msg, { parse_mode: "Markdown" });
  });

  bot.command("status", async (ctx) => {
    try {
      const db = getDb();

      // 1. Get active strategies count
      const activeStrategies = await db
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.enabled, true));

      // 2. Query today's orders & spent amount
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const ordersToday = await db
        .select()
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.status, "COMPLETED"),
            gte(schema.orders.createdAt, oneDayAgo),
          ),
        );

      const dailySpentResult = await db
        .select({
          sum: sql<string>`sum(cast(${schema.orders.quoteAmount} as numeric))`,
        })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.status, "COMPLETED"),
            gte(schema.orders.createdAt, oneDayAgo),
          ),
        );

      const spentToday = Number(dailySpentResult[0]?.sum ?? "0");

      const msg =
        `📊 *DCA Guard Status (Last 24h)*\n\n` +
        `• *Mode:* \`DRY_RUN\`\n` +
        `• *Live Trading:* \`Disabled\`\n` +
        `• *Active Strategies:* \`${activeStrategies.length}\`\n` +
        `• *Orders Executed (24h):* \`${ordersToday.length}\`\n` +
        `• *USDT Spent (24h):* \`${spentToday.toFixed(2)} USDT\``;

      return ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Failed to fetch status for bot command:", error);
      return ctx.reply(
        "❌ Failed to query database status. Is Postgres running?",
      );
    }
  });

  // Register command hints with Telegram
  bot.api
    .setMyCommands([
      { command: "start", description: "Start the bot & get chat ID" },
      { command: "status", description: "Show current trading statistics" },
    ])
    .catch((err) => {
      // Quietly log command registration failure (e.g. in tests or invalid token)
      console.warn(
        "Telegram command registration skipped/failed:",
        err.message,
      );
    });

  return bot;
};
