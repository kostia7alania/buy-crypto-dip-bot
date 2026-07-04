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

  bot.command("settings", async (ctx) => {
    try {
      const db = getDb();
      const existing = await db.select().from(schema.strategies).limit(1);
      const [strategy] = existing;
      if (!strategy) {
        return ctx.reply("❌ No strategies found in database.");
      }

      const config = strategy.config as any;
      const msg =
        `⚙️ *DCA Guard Settings*\n\n` +
        `• *Symbol:* \`${strategy.symbol}\`\n` +
        `• *Status:* ${strategy.enabled ? "🟢 *Enabled*" : "🔴 *Disabled*"}\n` +
        `• *Dip Threshold:* \`${config.thresholdPercent}%\`\n` +
        `• *Buy Amount:* \`${config.suggestedQuoteAmount} USDT\`\n` +
        `• *Daily Spend Limit:* \`${config.maxDailySpendUsdt} USDT\`\n\n` +
        `*How to update settings:*\n` +
        `• \`/set_threshold <percent>\` - e.g. \`/set_threshold 1.5\`\n` +
        `• \`/set_amount <usdt>\` - e.g. \`/set_amount 50\`\n` +
        `• \`/set_limit <usdt>\` - e.g. \`/set_limit 100\`\n` +
        `• \`/toggle\` - Toggle strategy status`;

      return ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      return ctx.reply("❌ Failed to read settings from database.");
    }
  });

  bot.command("set_threshold", async (ctx) => {
    const val = parseFloat(ctx.match?.trim() ?? "");
    if (isNaN(val) || val < 0 || val > 100) {
      return ctx.reply(
        "❌ Please provide a valid percentage (e.g. `/set_threshold 1.5`) between 0 and 100.",
      );
    }

    try {
      const db = getDb();
      const existing = await db.select().from(schema.strategies).limit(1);
      const [strategy] = existing;
      if (!strategy) return ctx.reply("❌ No strategies found.");

      const newConfig = {
        ...(strategy.config as any),
        thresholdPercent: val,
      };

      await db
        .update(schema.strategies)
        .set({ config: newConfig })
        .where(eq(schema.strategies.id, strategy.id));

      return ctx.reply(`✅ Dip threshold updated to *${val}%*`, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error(error);
      return ctx.reply("❌ Failed to update threshold.");
    }
  });

  bot.command("set_amount", async (ctx) => {
    const val = parseFloat(ctx.match?.trim() ?? "");
    if (isNaN(val) || val < 1) {
      return ctx.reply(
        "❌ Please provide a valid amount (e.g. `/set_amount 50`) greater than 1.",
      );
    }

    try {
      const db = getDb();
      const existing = await db.select().from(schema.strategies).limit(1);
      const [strategy] = existing;
      if (!strategy) return ctx.reply("❌ No strategies found.");

      const newConfig = {
        ...(strategy.config as any),
        suggestedQuoteAmount: val,
      };

      await db
        .update(schema.strategies)
        .set({ config: newConfig })
        .where(eq(schema.strategies.id, strategy.id));

      return ctx.reply(`✅ Buy amount updated to *${val} USDT*`, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error(error);
      return ctx.reply("❌ Failed to update buy amount.");
    }
  });

  bot.command("set_limit", async (ctx) => {
    const val = parseFloat(ctx.match?.trim() ?? "");
    if (isNaN(val) || val < 1) {
      return ctx.reply(
        "❌ Please provide a valid limit (e.g. `/set_limit 100`) greater than 1.",
      );
    }

    try {
      const db = getDb();
      const existing = await db.select().from(schema.strategies).limit(1);
      const [strategy] = existing;
      if (!strategy) return ctx.reply("❌ No strategies found.");

      const newConfig = {
        ...(strategy.config as any),
        maxDailySpendUsdt: val,
      };

      await db
        .update(schema.strategies)
        .set({ config: newConfig })
        .where(eq(schema.strategies.id, strategy.id));

      return ctx.reply(`✅ Daily spend limit updated to *${val} USDT*`, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error(error);
      return ctx.reply("❌ Failed to update daily limit.");
    }
  });

  bot.command("toggle", async (ctx) => {
    try {
      const db = getDb();
      const existing = await db.select().from(schema.strategies).limit(1);
      const [strategy] = existing;
      if (!strategy) return ctx.reply("❌ No strategies found.");

      const nextStatus = !strategy.enabled;

      await db
        .update(schema.strategies)
        .set({ enabled: nextStatus })
        .where(eq(schema.strategies.id, strategy.id));

      return ctx.reply(
        `✅ Strategy status updated to: ${nextStatus ? "🟢 *Enabled*" : "🔴 *Disabled*"}`,
        {
          parse_mode: "Markdown",
        },
      );
    } catch (error) {
      console.error(error);
      return ctx.reply("❌ Failed to toggle strategy status.");
    }
  });

  bot.on("message", (ctx) => {
    return ctx.reply(
      `👋 Hello! I am the DCA Guard Bot.\n\n` +
        `I only respond to commands. Please use:\n` +
        `• /start - Get your Chat ID and start instructions\n` +
        `• /status - View real-time DCA trading stats\n` +
        `• /settings - Show and edit configurations`,
    );
  });

  // Register command hints with Telegram
  bot.api
    .setMyCommands([
      { command: "start", description: "Start the bot & get chat ID" },
      { command: "status", description: "Show current trading statistics" },
      { command: "settings", description: "Show and edit configurations" },
      { command: "toggle", description: "Enable/disable strategy execution" },
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
