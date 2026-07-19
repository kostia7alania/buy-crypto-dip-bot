import { schema } from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { and, eq, gte, sql } from "drizzle-orm";
import { Bot } from "grammy";
import { getDb } from "./db.js";
import { registerOnboardingWizard, startKeyboard } from "./onboarding.js";

export const createBot = (token: string) => {
  const bot = new Bot(token);

  registerOnboardingWizard(bot);

  bot.command("start", async (ctx) => {
    const chatId = ctx.chat.id;

    // Register/refresh the user keyed by Telegram id — the same identity
    // the web dashboard will authenticate with (Telegram Login / initData).
    try {
      const db = getDb();
      await db
        .insert(schema.users)
        .values({
          telegramUserId: String(ctx.from?.id ?? chatId),
          telegramChatId: String(chatId),
          username: ctx.from?.username ?? null,
          firstName: ctx.from?.first_name ?? null,
        })
        .onConflictDoUpdate({
          target: schema.users.telegramUserId,
          set: {
            telegramChatId: String(chatId),
            username: ctx.from?.username ?? null,
            firstName: ctx.from?.first_name ?? null,
          },
        });
    } catch (err) {
      console.error("Failed to register user on /start:", err);
    }

    const msg =
      `🤖 *Buy Crypto Dip Bot Started*\n\n` +
      `I watch for price dips and simulate buys in \`DRY_RUN\` mode — ` +
      `no real money is ever spent by default.\n\n` +
      `Tap the button below to set up your first dip strategy in ` +
      `three quick steps.\n\n` +
      `Your Chat ID: \`${chatId}\`\n` +
      `For notifications, set in \`.env\`: \`TELEGRAM_CHAT_ID=${chatId}\``;

    return ctx.reply(msg, {
      parse_mode: "Markdown",
      reply_markup: startKeyboard(),
    });
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
        `📊 *Buy Crypto Dip Bot Status (Last 24h)*\n\n` +
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
      const strategiesList = await db.select().from(schema.strategies);
      if (strategiesList.length === 0) {
        return ctx.reply("❌ No strategies found in database.");
      }

      let msg = `⚙️ *Buy Crypto Dip Bot Settings*\n\n`;
      for (const strategy of strategiesList) {
        const config = strategy.config as any;
        msg +=
          `• *${strategy.symbol}* (${strategy.name})\n` +
          `  └ Status: ${strategy.enabled ? "🟢 *Enabled*" : "🔴 *Disabled*"}\n` +
          `  └ Dip Threshold: \`${config.thresholdPercent}%\`\n` +
          `  └ Buy Amount: \`${config.suggestedQuoteAmount} USDT\`\n` +
          `  └ Daily Spend Limit: \`${config.maxDailySpendUsdt} USDT\`\n\n`;
      }

      msg +=
        `*How to update settings:*\n` +
        `• \`/set_threshold <symbol> <percent>\` - e.g. \`/set_threshold ETHUSDT 1.5\`\n` +
        `• \`/set_amount <symbol> <usdt>\` - e.g. \`/set_amount SOLUSDT 50\`\n` +
        `• \`/set_limit <symbol> <usdt>\` - e.g. \`/set_limit BTCUSDT 100\`\n` +
        `• \`/toggle <symbol>\` - Toggle strategy status`;

      return ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      return ctx.reply("❌ Failed to read settings from database.");
    }
  });

  // Replay the strategy over real history: /backtest [symbol] [days] [threshold%] [amount]
  bot.command("backtest", async (ctx) => {
    const parts = ctx.match?.trim().split(/\s+/).filter(Boolean) ?? [];
    const symbol = (parts[0] ?? "BTCUSDT").toUpperCase();
    const days = Number(parts[1] ?? 30);
    const threshold = Number(parts[2] ?? 1.5);
    const amount = Number(parts[3] ?? 20);

    if (
      [days, threshold, amount].some((n) => Number.isNaN(n)) ||
      days < 7 ||
      days > 120
    ) {
      return ctx.reply(
        "❌ Usage: `/backtest [symbol] [days 7-120] [threshold%] [amount]`\nExample: `/backtest ETHUSDT 60 2 50`",
        { parse_mode: "Markdown" },
      );
    }

    let progress: Awaited<ReturnType<typeof ctx.reply>> | null = null;
    try {
      progress = await ctx.reply(
        `⏳ Replaying ${days} days of ${symbol} history...`,
      );
    } catch {
      /* non-fatal */
    }

    try {
      const apiUrl = process.env.API_URL ?? "http://localhost:8787";
      const apiKey = process.env.API_KEY;
      const qs = new URLSearchParams({
        symbol,
        days: String(days),
        threshold: String(threshold),
        amount: String(amount),
      });
      const response = await fetch(`${apiUrl}/backtest?${qs}`, {
        headers: apiKey ? { "x-api-key": apiKey } : {},
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const d = (await response.json()) as {
        tradeCount: number;
        spentUsdt: number;
        valueUsdt: number;
        pnlUsdt: number;
        pnlPercent: number;
        benchmarks: {
          actual: { pnlPercent: number };
          calendarDca: { pnlPercent: number };
          hold: { pnlPercent: number };
        } | null;
      };

      const sign = (n: number) => (n >= 0 ? "+" : "");
      let msg =
        `🧪 *Backtest: ${symbol}, last ${days} days*\n` +
        `_dip ≥ ${threshold}%, ${amount} USDT per buy_\n\n` +
        `• *Buys:* \`${d.tradeCount}\`\n` +
        `• *Invested:* \`${d.spentUsdt.toFixed(2)} USDT\`\n` +
        `• *End value:* \`${d.valueUsdt.toFixed(2)} USDT\`\n` +
        `• *Result:* \`${sign(d.pnlUsdt)}${d.pnlUsdt.toFixed(2)} USDT (${sign(d.pnlPercent)}${d.pnlPercent.toFixed(2)}%)\`\n`;

      if (d.benchmarks) {
        const b = d.benchmarks;
        msg +=
          `\n*Same budget, same window:*\n` +
          `• This strategy: \`${sign(b.actual.pnlPercent)}${b.actual.pnlPercent.toFixed(2)}%\`\n` +
          `• Calendar DCA: \`${sign(b.calendarDca.pnlPercent)}${b.calendarDca.pnlPercent.toFixed(2)}%\`\n` +
          `• Buy & hold: \`${sign(b.hold.pnlPercent)}${b.hold.pnlPercent.toFixed(2)}%\`\n`;
        const beatsDca = b.actual.pnlPercent > b.calendarDca.pnlPercent;
        const beatsHold = b.actual.pnlPercent > b.hold.pnlPercent;
        msg +=
          beatsDca && beatsHold
            ? `\n✅ Dip-buying beat both benchmarks here.`
            : !beatsDca && !beatsHold
              ? `\n🔻 Dip-buying lagged both benchmarks here.`
              : `\n➖ Mixed: beat ${beatsDca ? "calendar DCA" : "buy & hold"}, lagged the other.`;
      }
      msg += `\n\n_Past performance ≠ future results._`;

      if (progress) {
        await ctx.api
          .deleteMessage(ctx.chat.id, progress.message_id)
          .catch(() => {});
      }
      return ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Backtest command failed:", error);
      if (progress) {
        await ctx.api
          .deleteMessage(ctx.chat.id, progress.message_id)
          .catch(() => {});
      }
      return ctx.reply(
        `❌ Backtest failed for *${symbol}*. Check the symbol and try again.`,
        { parse_mode: "Markdown" },
      );
    }
  });

  // Kill switch: instantly pause every strategy (audited).
  bot.command("pause_all", async (ctx) => {
    try {
      const db = getDb();
      const updated = await db
        .update(schema.strategies)
        .set({ enabled: false })
        .returning();
      await db.insert(schema.auditEvents).values({
        entityType: "strategy",
        entityId: "ALL",
        action: "ALL_STRATEGIES_PAUSED",
        payload: { count: updated.length, via: "telegram" },
      });
      return ctx.reply(
        `⏸ *All strategies paused* (${updated.length}).\nNo new orders will be created. Resume with /resume_all`,
        { parse_mode: "Markdown" },
      );
    } catch (error) {
      console.error("Failed to pause all strategies:", error);
      return ctx.reply("❌ Failed to pause strategies.");
    }
  });

  bot.command("resume_all", async (ctx) => {
    try {
      const db = getDb();
      const updated = await db
        .update(schema.strategies)
        .set({ enabled: true })
        .returning();
      await db.insert(schema.auditEvents).values({
        entityType: "strategy",
        entityId: "ALL",
        action: "ALL_STRATEGIES_RESUMED",
        payload: { count: updated.length, via: "telegram" },
      });
      return ctx.reply(`▶️ *All strategies resumed* (${updated.length}).`, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error("Failed to resume strategies:", error);
      return ctx.reply("❌ Failed to resume strategies.");
    }
  });

  bot.command("performance", async (ctx) => {
    try {
      const apiUrl = process.env.API_URL ?? "http://localhost:8787";
      const apiKey = process.env.API_KEY;
      const response = await fetch(`${apiUrl}/performance`, {
        headers: apiKey ? { "x-api-key": apiKey } : {},
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = (await response.json()) as {
        positions: Array<{
          symbol: string;
          actual: { pnlPercent: number };
          calendarDca: { pnlPercent: number };
          hold: { pnlPercent: number };
        }>;
      };
      if (data.positions.length === 0) {
        return ctx.reply(
          "📭 No simulated purchases yet — the comparison appears after the first executed dry-run order.",
        );
      }
      const sign = (n: number) => (n >= 0 ? "+" : "");
      const p2 = (n: number) => `${sign(n)}${n.toFixed(2)}%`;
      let msg = `📊 *Strategy vs Benchmarks*\n_Same capital, same window_\n\n`;
      for (const p of data.positions) {
        const won =
          p.actual.pnlPercent >= p.calendarDca.pnlPercent &&
          p.actual.pnlPercent >= p.hold.pnlPercent;
        msg +=
          `${won ? "🏆" : "•"} *${p.symbol}*\n` +
          `  └ Dip buying: \`${p2(p.actual.pnlPercent)}\`\n` +
          `  └ Calendar DCA: \`${p2(p.calendarDca.pnlPercent)}\`\n` +
          `  └ Buy & hold: \`${p2(p.hold.pnlPercent)}\`\n\n`;
      }
      return ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Failed to fetch performance:", error);
      return ctx.reply("❌ Failed to fetch performance from the API.");
    }
  });

  bot.command("pnl", async (ctx) => {
    try {
      const apiUrl = process.env.API_URL ?? "http://localhost:8787";
      const apiKey = process.env.API_KEY;
      const response = await fetch(`${apiUrl}/pnl`, {
        headers: apiKey ? { "x-api-key": apiKey } : {},
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = (await response.json()) as {
        positions: Array<{
          symbol: string;
          orders: number;
          spentUsdt: number;
          avgBuyPrice: number;
          currentPrice: number;
          pnlUsdt: number;
          pnlPercent: number;
        }>;
        totals: {
          spentUsdt: number;
          pnlUsdt: number;
          pnlPercent: number;
        } | null;
      };

      if (!data.totals || data.positions.length === 0) {
        return ctx.reply(
          "📭 No simulated purchases yet — PnL appears after the first executed dry-run order.",
        );
      }

      const sign = (n: number) => (n >= 0 ? "+" : "");
      let msg = `💼 *Simulated Portfolio PnL*\n\n`;
      for (const p of data.positions) {
        msg +=
          `• *${p.symbol}* (${p.orders} buys)\n` +
          `  └ Invested: \`${p.spentUsdt.toFixed(2)} USDT\`\n` +
          `  └ Avg buy: \`$${p.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}\` → now \`$${p.currentPrice.toLocaleString()}\`\n` +
          `  └ PnL: \`${sign(p.pnlUsdt)}${p.pnlUsdt.toFixed(2)} USDT (${sign(p.pnlPercent)}${p.pnlPercent.toFixed(2)}%)\`\n\n`;
      }
      msg += `*Total:* \`${sign(data.totals.pnlUsdt)}${data.totals.pnlUsdt.toFixed(2)} USDT (${sign(data.totals.pnlPercent)}${data.totals.pnlPercent.toFixed(2)}%)\` on \`${data.totals.spentUsdt.toFixed(2)} USDT\``;

      return ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Failed to fetch PnL:", error);
      return ctx.reply("❌ Failed to fetch PnL from the API.");
    }
  });

  bot.command("price", async (ctx) => {
    const symbol = ctx.match?.trim().toUpperCase() || "BTCUSDT";
    try {
      const client = createBybitPublicClient({
        baseUrl: "https://api.bybit.com",
      });
      const ticker = await client.getTicker(symbol);
      const dropPercent = ticker.high24h
        ? ((ticker.high24h - ticker.lastPrice) / ticker.high24h) * 100
        : null;

      const msg =
        `💲 *${symbol}*\n\n` +
        `• *Price:* \`$${ticker.lastPrice.toLocaleString()}\`\n` +
        `• *24h High:* \`$${(ticker.high24h ?? ticker.lastPrice).toLocaleString()}\`\n` +
        `• *24h Low:* \`$${(ticker.low24h ?? ticker.lastPrice).toLocaleString()}\`\n` +
        (dropPercent !== null
          ? `• *Drop from 24h high:* \`${dropPercent.toFixed(2)}%\``
          : "");

      return ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (error) {
      console.error(`Failed to fetch price for ${symbol}:`, error);
      return ctx.reply(
        `❌ Could not fetch price for *${symbol}*. Is the symbol correct? (e.g. /price ETHUSDT)`,
        { parse_mode: "Markdown" },
      );
    }
  });

  bot.command("set_threshold", async (ctx) => {
    const parts = ctx.match?.trim().split(/\s+/) ?? [];
    const firstPart = parts[0];
    const secondPart = parts[1];
    if (!firstPart || !secondPart) {
      return ctx.reply(
        "❌ Usage: `/set_threshold <symbol> <percent>`\nExample: `/set_threshold ETHUSDT 1.5`",
        { parse_mode: "Markdown" },
      );
    }
    const symbol = firstPart.toUpperCase();
    const val = parseFloat(secondPart);

    if (Number.isNaN(val) || val < 0 || val > 100) {
      return ctx.reply(
        "❌ Please provide a valid percentage between 0 and 100.",
      );
    }

    try {
      const db = getDb();
      const existing = await db
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.symbol, symbol))
        .limit(1);
      const [strategy] = existing;
      if (!strategy) {
        return ctx.reply(`❌ Strategy for symbol *${symbol}* not found.`, {
          parse_mode: "Markdown",
        });
      }

      const newConfig = {
        ...(strategy.config as any),
        thresholdPercent: val,
      };

      await db
        .update(schema.strategies)
        .set({ config: newConfig })
        .where(eq(schema.strategies.id, strategy.id));

      return ctx.reply(
        `✅ Dip threshold for *${symbol}* updated to *${val}%*`,
        {
          parse_mode: "Markdown",
        },
      );
    } catch (error) {
      console.error(error);
      return ctx.reply("❌ Failed to update threshold.");
    }
  });

  bot.command("set_amount", async (ctx) => {
    const parts = ctx.match?.trim().split(/\s+/) ?? [];
    const firstPart = parts[0];
    const secondPart = parts[1];
    if (!firstPart || !secondPart) {
      return ctx.reply(
        "❌ Usage: `/set_amount <symbol> <usdt>`\nExample: `/set_amount SOLUSDT 50`",
        { parse_mode: "Markdown" },
      );
    }
    const symbol = firstPart.toUpperCase();
    const val = parseFloat(secondPart);

    if (Number.isNaN(val) || val < 1) {
      return ctx.reply("❌ Please provide a valid amount greater than 1.");
    }

    try {
      const db = getDb();
      const existing = await db
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.symbol, symbol))
        .limit(1);
      const [strategy] = existing;
      if (!strategy) {
        return ctx.reply(`❌ Strategy for symbol *${symbol}* not found.`, {
          parse_mode: "Markdown",
        });
      }

      const newConfig = {
        ...(strategy.config as any),
        suggestedQuoteAmount: val,
      };

      await db
        .update(schema.strategies)
        .set({ config: newConfig })
        .where(eq(schema.strategies.id, strategy.id));

      return ctx.reply(
        `✅ Buy amount for *${symbol}* updated to *${val} USDT*`,
        {
          parse_mode: "Markdown",
        },
      );
    } catch (error) {
      console.error(error);
      return ctx.reply("❌ Failed to update buy amount.");
    }
  });

  bot.command("set_limit", async (ctx) => {
    const parts = ctx.match?.trim().split(/\s+/) ?? [];
    const firstPart = parts[0];
    const secondPart = parts[1];
    if (!firstPart || !secondPart) {
      return ctx.reply(
        "❌ Usage: `/set_limit <symbol> <usdt>`\nExample: `/set_limit BTCUSDT 100`",
        { parse_mode: "Markdown" },
      );
    }
    const symbol = firstPart.toUpperCase();
    const val = parseFloat(secondPart);

    if (Number.isNaN(val) || val < 1) {
      return ctx.reply("❌ Please provide a valid limit greater than 1.");
    }

    try {
      const db = getDb();
      const existing = await db
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.symbol, symbol))
        .limit(1);
      const [strategy] = existing;
      if (!strategy) {
        return ctx.reply(`❌ Strategy for symbol *${symbol}* not found.`, {
          parse_mode: "Markdown",
        });
      }

      const newConfig = {
        ...(strategy.config as any),
        maxDailySpendUsdt: val,
      };

      await db
        .update(schema.strategies)
        .set({ config: newConfig })
        .where(eq(schema.strategies.id, strategy.id));

      return ctx.reply(
        `✅ Daily spend limit for *${symbol}* updated to *${val} USDT*`,
        {
          parse_mode: "Markdown",
        },
      );
    } catch (error) {
      console.error(error);
      return ctx.reply("❌ Failed to update daily limit.");
    }
  });

  bot.command("toggle", async (ctx) => {
    const symbol = ctx.match?.trim().toUpperCase();
    if (!symbol) {
      return ctx.reply(
        "❌ Usage: `/toggle <symbol>`\nExample: `/toggle ETHUSDT`",
        { parse_mode: "Markdown" },
      );
    }

    try {
      const db = getDb();
      const existing = await db
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.symbol, symbol))
        .limit(1);
      const [strategy] = existing;
      if (!strategy) {
        return ctx.reply(`❌ Strategy for symbol *${symbol}* not found.`, {
          parse_mode: "Markdown",
        });
      }

      const nextStatus = !strategy.enabled;

      await db
        .update(schema.strategies)
        .set({ enabled: nextStatus })
        .where(eq(schema.strategies.id, strategy.id));

      return ctx.reply(
        `✅ Strategy for *${symbol}* updated to: ${nextStatus ? "🟢 *Enabled*" : "🔴 *Disabled*"}`,
        {
          parse_mode: "Markdown",
        },
      );
    } catch (error) {
      console.error(error);
      return ctx.reply("❌ Failed to toggle strategy status.");
    }
  });

  const handleAddPair = async (ctx: any, symbol: string) => {
    let loadingMsg: any;
    try {
      loadingMsg = await ctx.reply(
        `⏳ Validating <b>${symbol}</b> on Bybit Spot server...`,
        { parse_mode: "HTML" },
      );
      await ctx.replyWithChatAction("typing");
    } catch (err) {
      console.error("Failed to send loading status:", err);
    }

    try {
      // Call Hono API server
      const apiUrl = process.env.API_URL ?? "http://localhost:8787";
      const apiKey = process.env.API_KEY;
      const response = await fetch(`${apiUrl}/strategies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify({ symbol }),
      });

      if (loadingMsg) {
        await ctx.api
          .deleteMessage(ctx.chat.id, loadingMsg.message_id)
          .catch(() => {});
      }

      if (!response.ok) {
        const errData = (await response.json()) as { error?: string };
        const errCode = errData.error ?? "UNKNOWN_ERROR";

        switch (errCode) {
          case "INVALID_SYMBOL_FORMAT":
            return ctx.reply(
              "❌ Invalid symbol format. Please use uppercase letters and numbers (e.g. LTCUSDT).",
            );
          case "STRATEGY_ALREADY_EXISTS":
            return ctx.reply(
              `❌ Strategy for <b>${symbol}</b> already exists.`,
              {
                parse_mode: "HTML",
              },
            );
          case "SYMBOL_NOT_FOUND_ON_EXCHANGE":
            return ctx.reply(
              `❌ Symbol <b>${symbol}</b> was not found on Bybit Spot market.`,
              { parse_mode: "HTML" },
            );
          default:
            return ctx.reply(`❌ Failed to add strategy. Error: ${errCode}`);
        }
      }

      const data = (await response.json()) as {
        success: boolean;
        strategy: {
          id: string;
          name: string;
          symbol: string;
          mode: string;
        };
      };

      return ctx.reply(
        `<b>✅ Strategy Added Successfully</b>\n\n` +
          `• <b>Name:</b> ${data.strategy.name}\n` +
          `• <b>Symbol:</b> ${data.strategy.symbol}\n` +
          `• <b>Mode:</b> ${data.strategy.mode}\n\n` +
          `Default parameters configured: threshold 1.0%, buy amount 20 USDT, daily limit 300 USDT.`,
        { parse_mode: "HTML" },
      );
    } catch (error) {
      console.error("Failed to add strategy via API:", error);
      if (loadingMsg) {
        await ctx.api
          .deleteMessage(ctx.chat.id, loadingMsg.message_id)
          .catch(() => {});
      }
      return ctx.reply(
        "❌ Failed to contact the API server to validate the symbol.",
      );
    }
  };

  bot.command("add_pair", async (ctx) => {
    const symbol = ctx.match?.trim().toUpperCase();
    if (!symbol) {
      return ctx.reply(
        "Please reply to this message with the ticker symbol you want to add (e.g. LTCUSDT):",
        {
          reply_markup: { force_reply: true },
        },
      );
    }

    return handleAddPair(ctx, symbol);
  });

  bot.callbackQuery(/^cancel_order:(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    if (!orderId) return ctx.answerCallbackQuery("❌ Order ID missing.");

    try {
      const db = getDb();
      const [order] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
        .limit(1);

      if (!order) {
        return ctx.answerCallbackQuery("❌ Order not found.");
      }

      if (order.status === "COMPLETED") {
        return ctx.answerCallbackQuery("⚠️ Too late! Order already executed.");
      }
      if (order.status === "CANCELLED") {
        return ctx.answerCallbackQuery("ℹ️ Order already cancelled.");
      }

      // Update order status to CANCELLED
      await db
        .update(schema.orders)
        .set({ status: "CANCELLED" })
        .where(eq(schema.orders.id, orderId));

      await db.insert(schema.auditEvents).values({
        entityType: "order",
        entityId: order.id,
        action: "DRY_RUN_ORDER_CANCELLED",
        payload: { order: { ...order, status: "CANCELLED" } },
      });

      await ctx.answerCallbackQuery("❌ Order cancelled successfully!");
      return ctx.editMessageText(
        `❌ *Dry-Run Order Cancelled*\n\n` +
          `• *Symbol:* ${order.symbol}\n` +
          `• *Amount:* ${order.quoteAmount} USDT\n` +
          `• *Status:* Cancelled by user`,
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      console.error("Failed to cancel order:", err);
      return ctx.answerCallbackQuery("❌ Failed to cancel order.");
    }
  });

  bot.callbackQuery(/^buy_now:(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    if (!orderId) return ctx.answerCallbackQuery("❌ Order ID missing.");

    try {
      const db = getDb();
      const [order] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
        .limit(1);

      if (!order) {
        return ctx.answerCallbackQuery("❌ Order not found.");
      }

      if (order.status === "COMPLETED") {
        return ctx.answerCallbackQuery("ℹ️ Order already executed.");
      }
      if (order.status === "CANCELLED") {
        return ctx.answerCallbackQuery("⚠️ Too late! Order already cancelled.");
      }

      // Update order status to COMPLETED
      await db
        .update(schema.orders)
        .set({ status: "COMPLETED" })
        .where(eq(schema.orders.id, orderId));

      // Fetch strategy details for the text
      const [strategy] = await db
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.id, order.strategyId ?? ""))
        .limit(1);

      const strategyName = strategy?.name ?? "Dip Buying Strategy";

      await db.insert(schema.auditEvents).values({
        entityType: "order",
        entityId: order.id,
        action: "DRY_RUN_ORDER_COMPLETED",
        payload: { order: { ...order, status: "COMPLETED" } },
      });

      await ctx.answerCallbackQuery("⚡ Order executed now!");
      return ctx.editMessageText(
        `🎉 *Dry-Run Order Executed*\n\n` +
          `• *Strategy:* ${strategyName}\n` +
          `• *Symbol:* ${order.symbol}\n` +
          `• *Price:* $${Number(order.price).toLocaleString()}\n` +
          `• *Amount:* ${order.quoteAmount} USDT\n` +
          `• *Status:* Simulated Purchase (Force Executed)`,
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      console.error("Failed to execute order:", err);
      return ctx.answerCallbackQuery("❌ Failed to execute order.");
    }
  });

  bot.on("message", async (ctx) => {
    const replyTo = ctx.message.reply_to_message;
    if (
      replyTo?.text?.includes("reply to this message with the ticker symbol")
    ) {
      const symbol = ctx.message.text?.trim().toUpperCase();
      if (!symbol) return ctx.reply("❌ Please enter a valid symbol.");
      return handleAddPair(ctx, symbol);
    }

    return ctx.reply(
      `👋 Hello! I am the Buy Crypto Dip Bot.\n\n` +
        `I only respond to commands. Please use:\n` +
        `• /start - Get your Chat ID and start instructions\n` +
        `• /status - View real-time DCA trading stats\n` +
        `• /settings - Show and edit configurations\n` +
        `• /add_pair - Add a custom coin (e.g. LTCUSDT)`,
    );
  });

  // Register command hints with Telegram
  bot.api
    .setMyCommands([
      { command: "start", description: "Start & set up a dip strategy" },
      { command: "pnl", description: "Simulated portfolio PnL" },
      {
        command: "backtest",
        description:
          "Replay strategy over history (e.g. /backtest ETHUSDT 60 2 50)",
      },
      { command: "performance", description: "Dip strategy vs benchmarks" },
      {
        command: "pause_all",
        description: "Kill switch: pause all strategies",
      },
      { command: "resume_all", description: "Resume all strategies" },
      {
        command: "price",
        description: "Current price & dip % (e.g. /price ETHUSDT)",
      },
      { command: "status", description: "Show current trading statistics" },
      { command: "settings", description: "Show and edit configurations" },
      { command: "toggle", description: "Enable/disable strategy execution" },
      { command: "add_pair", description: "Add a custom coin (e.g. LTCUSDT)" },
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
