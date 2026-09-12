import { getAllowedSymbols, isAllowedSymbol } from "@buy-crypto-dip-bot/config";
import { schema } from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { and, eq, gte, sql } from "drizzle-orm";
import { Bot } from "grammy";
import {
  type BotCaller,
  getSessionTokenFor,
  requireCallbackCaller,
  requireCaller,
} from "./caller.js";
import {
  bindPrivateNotificationTarget,
  toggleOwnedStrategy,
  updateOwnedStrategyConfig,
} from "./command.repository.js";
import { getDb } from "./db.js";
import { registerOnboardingWizard, startKeyboard } from "./onboarding.js";
import {
  botCorrelationId,
  logBotError,
  logBotEvent,
} from "./operational-log.js";
import {
  claimOwnedPendingOrder,
  setEnabledForCaller,
} from "./order.repository.js";
import { fetchServiceApi } from "./runtime-config.js";
import {
  escapeTelegramHtml,
  escapeTelegramMarkdown,
} from "./telegram-format.js";

// Calls a user-scoped API route as the given caller. The service key proves
// the request came from the bot; the session token names the human it is for.
const fetchAsUser = async (
  caller: BotCaller,
  path: string,
  updateId: number,
  init: RequestInit = {},
) => {
  const correlationId = botCorrelationId(updateId);
  const token = await getSessionTokenFor(caller, correlationId);
  try {
    return await fetchServiceApi(path, {
      ...init,
      headers: {
        ...init.headers,
        "x-user-session": token,
        "x-request-id": correlationId,
      },
    });
  } finally {
    // A bot credential is a one-request lease. Revoking it through the API
    // records the same command correlation and actor provenance atomically;
    // a failed cleanup remains bounded by BOT_SESSION_TTL_MS.
    try {
      const revocation = await fetchServiceApi("/auth/logout", {
        method: "POST",
        headers: {
          "x-user-session": token,
          "x-request-id": correlationId,
        },
      });
      if (!revocation.ok) {
        logBotEvent("BOT_SESSION_REVOCATION_RETRY_REQUIRED", "WARN", updateId);
      }
    } catch (error) {
      logBotError("BOT_SESSION_REVOCATION_FAILED", error, updateId);
    }
  }
};

export const createBot = (token: string) => {
  const bot = new Bot(token);

  bot.catch((failure) => {
    logBotError(
      "UPDATE_HANDLER_FAILED",
      failure.error,
      failure.ctx.update.update_id,
    );
  });

  registerOnboardingWizard(bot);

  bot.command("start", async (ctx) => {
    const chatId = ctx.chat.id;

    // `/start` cannot use requireCaller — it is the command that *creates* the
    // user. But it writes telegram_chat_id, which is now the delivery address
    // for every one of that user's order, risk and digest notifications. Doing
    // that from a group would silently redirect their entire trading activity
    // into a room full of other people, so registration is private-chat only.
    if (ctx.chat.type !== "private") {
      return ctx.reply(
        "🔒 Message me directly to set up — I keep each person's strategies and alerts private.",
      );
    }

    // Register/refresh the user keyed by Telegram id — the same identity
    // the web dashboard will authenticate with (Telegram Login / initData).
    try {
      await bindPrivateNotificationTarget(
        getDb(),
        {
          telegramUserId: String(ctx.from?.id ?? chatId),
          telegramChatId: String(chatId),
          username: ctx.from?.username ?? null,
          firstName: ctx.from?.first_name ?? null,
        },
        botCorrelationId(ctx.update.update_id),
      );
    } catch (err) {
      logBotError("START_REGISTRATION_FAILED", err, ctx.update.update_id);
      return ctx.reply(
        "❌ I could not securely enable notifications for this chat. Please try /start again.",
      );
    }

    const msg =
      `🤖 *Buy Crypto Dip Bot Started*\n\n` +
      `I watch for price dips and simulate buys in \`DRY_RUN\` mode — ` +
      `no real money is ever spent by default.\n\n` +
      `Tap the button below to set up your first dip strategy in ` +
      `three quick steps.\n\n` +
      `Alerts about your strategies come straight to this chat.`;

    return ctx.reply(msg, {
      parse_mode: "Markdown",
      reply_markup: startKeyboard(),
    });
  });

  bot.command("status", async (ctx) => {
    const caller = await requireCaller(ctx);
    if (!caller) return;

    try {
      const db = getDb();

      // 1. This caller's active strategies
      const activeStrategies = await db
        .select()
        .from(schema.strategies)
        .where(
          and(
            eq(schema.strategies.userId, caller.id),
            eq(schema.strategies.enabled, true),
          ),
        );

      // 2. This caller's orders & spend in the last 24h
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const ordersToday = await db
        .select()
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.userId, caller.id),
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
            eq(schema.orders.userId, caller.id),
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
      logBotError("STATUS_COMMAND_FAILED", error, ctx.update.update_id);
      return ctx.reply(
        "❌ Failed to query database status. Is Postgres running?",
      );
    }
  });

  bot.command("settings", async (ctx) => {
    const caller = await requireCaller(ctx);
    if (!caller) return;

    try {
      const db = getDb();
      const strategiesList = await db
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.userId, caller.id));
      if (strategiesList.length === 0) {
        return ctx.reply(
          "📭 You have no strategies yet. Use /start to set one up.",
        );
      }

      let msg = `⚙️ <b>Buy Crypto Dip Bot Settings</b>\n\n`;
      for (const strategy of strategiesList) {
        const config = strategy.config as {
          thresholdPercent?: unknown;
          suggestedQuoteAmount?: unknown;
          maxDailySpendUsdt?: unknown;
        };
        msg +=
          `• <b>${escapeTelegramHtml(strategy.symbol)}</b> (${escapeTelegramHtml(strategy.name)})\n` +
          `  └ Status: ${strategy.enabled ? "🟢 <b>Enabled</b>" : "🔴 <b>Disabled</b>"}\n` +
          `  └ Dip Threshold: <code>${escapeTelegramHtml(String(config.thresholdPercent))}%</code>\n` +
          `  └ Buy Amount: <code>${escapeTelegramHtml(String(config.suggestedQuoteAmount))} USDT</code>\n` +
          `  └ Daily Spend Limit: <code>${escapeTelegramHtml(String(config.maxDailySpendUsdt))} USDT</code>\n\n`;
      }

      msg +=
        `<b>How to update settings:</b>\n` +
        `• <code>/set_threshold &lt;symbol&gt; &lt;percent&gt;</code> - e.g. <code>/set_threshold ETHUSDT 1.5</code>\n` +
        `• <code>/set_amount &lt;symbol&gt; &lt;usdt&gt;</code> - e.g. <code>/set_amount SOLUSDT 50</code>\n` +
        `• <code>/set_limit &lt;symbol&gt; &lt;usdt&gt;</code> - e.g. <code>/set_limit BTCUSDT 100</code>\n` +
        `• <code>/toggle &lt;symbol&gt;</code> - Toggle strategy status`;

      return ctx.reply(msg, { parse_mode: "HTML" });
    } catch (error) {
      logBotError("SETTINGS_COMMAND_FAILED", error, ctx.update.update_id);
      return ctx.reply("❌ Failed to read settings from database.");
    }
  });

  // Replay the strategy over real history: /backtest [symbol] [days] [threshold%] [amount]
  bot.command("backtest", async (ctx) => {
    const parts = ctx.match?.trim().split(/\s+/).filter(Boolean) ?? [];
    const symbol = (parts[0] ?? "BTCUSDT").toUpperCase();
    if (!isAllowedSymbol(symbol, process.env.ALLOWLIST_SYMBOLS)) {
      return ctx.reply(
        `Pair not supported. Available pairs: ${getAllowedSymbols(process.env.ALLOWLIST_SYMBOLS).join(", ") || "none"}.`,
      );
    }
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
      const qs = new URLSearchParams({
        symbol,
        days: String(days),
        threshold: String(threshold),
        amount: String(amount),
      });
      const response = await fetchServiceApi(`/backtest?${qs}`, {
        headers: {
          "x-request-id": botCorrelationId(ctx.update.update_id),
        },
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
        `🧪 *Backtest: ${escapeTelegramMarkdown(symbol)}, last ${days} days*\n` +
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
      logBotError("BACKTEST_COMMAND_FAILED", error, ctx.update.update_id);
      if (progress) {
        await ctx.api
          .deleteMessage(ctx.chat.id, progress.message_id)
          .catch(() => {});
      }
      return ctx.reply(
        `❌ Backtest failed for *${escapeTelegramMarkdown(symbol)}*. Check the symbol and try again.`,
        { parse_mode: "Markdown" },
      );
    }
  });

  // Kill switch: instantly pause the caller's own strategies (audited).
  // Scoped to one user on purpose — a kill switch that stops other people's
  // bots would be a denial-of-service button, not a safety feature.
  bot.command("pause_all", async (ctx) => {
    const caller = await requireCaller(ctx);
    if (!caller) return;

    try {
      const count = await setEnabledForCaller(
        getDb(),
        caller.id,
        false,
        botCorrelationId(ctx.update.update_id),
      );
      return ctx.reply(
        `⏸ *Your strategies are paused* (${count}).\nNo new orders will be created. Resume with /resume_all`,
        { parse_mode: "Markdown" },
      );
    } catch (error) {
      logBotError("PAUSE_STRATEGIES_FAILED", error, ctx.update.update_id);
      return ctx.reply("❌ Failed to pause strategies.");
    }
  });

  bot.command("resume_all", async (ctx) => {
    const caller = await requireCaller(ctx);
    if (!caller) return;

    try {
      const count = await setEnabledForCaller(
        getDb(),
        caller.id,
        true,
        botCorrelationId(ctx.update.update_id),
      );
      return ctx.reply(`▶️ *Your strategies are resumed* (${count}).`, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logBotError("RESUME_STRATEGIES_FAILED", error, ctx.update.update_id);
      return ctx.reply("❌ Failed to resume strategies.");
    }
  });

  bot.command("performance", async (ctx) => {
    const caller = await requireCaller(ctx);
    if (!caller) return;

    try {
      const response = await fetchAsUser(
        caller,
        "/performance",
        ctx.update.update_id,
      );
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
          `${won ? "🏆" : "•"} *${escapeTelegramMarkdown(p.symbol)}*\n` +
          `  └ Dip buying: \`${p2(p.actual.pnlPercent)}\`\n` +
          `  └ Calendar DCA: \`${p2(p.calendarDca.pnlPercent)}\`\n` +
          `  └ Buy & hold: \`${p2(p.hold.pnlPercent)}\`\n\n`;
      }
      return ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (error) {
      logBotError("PERFORMANCE_COMMAND_FAILED", error, ctx.update.update_id);
      return ctx.reply("❌ Failed to fetch performance from the API.");
    }
  });

  bot.command("pnl", async (ctx) => {
    const caller = await requireCaller(ctx);
    if (!caller) return;

    try {
      const response = await fetchAsUser(caller, "/pnl", ctx.update.update_id);
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
          `• *${escapeTelegramMarkdown(p.symbol)}* (${p.orders} buys)\n` +
          `  └ Invested: \`${p.spentUsdt.toFixed(2)} USDT\`\n` +
          `  └ Avg buy: \`$${p.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}\` → now \`$${p.currentPrice.toLocaleString()}\`\n` +
          `  └ PnL: \`${sign(p.pnlUsdt)}${p.pnlUsdt.toFixed(2)} USDT (${sign(p.pnlPercent)}${p.pnlPercent.toFixed(2)}%)\`\n\n`;
      }
      msg += `*Total:* \`${sign(data.totals.pnlUsdt)}${data.totals.pnlUsdt.toFixed(2)} USDT (${sign(data.totals.pnlPercent)}${data.totals.pnlPercent.toFixed(2)}%)\` on \`${data.totals.spentUsdt.toFixed(2)} USDT\``;

      return ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (error) {
      logBotError("PNL_COMMAND_FAILED", error, ctx.update.update_id);
      return ctx.reply("❌ Failed to fetch PnL from the API.");
    }
  });

  bot.command("price", async (ctx) => {
    const symbol = ctx.match?.trim().toUpperCase() || "BTCUSDT";
    if (!isAllowedSymbol(symbol, process.env.ALLOWLIST_SYMBOLS)) {
      return ctx.reply(
        `Pair not supported. Available pairs: ${getAllowedSymbols(process.env.ALLOWLIST_SYMBOLS).join(", ") || "none"}.`,
      );
    }
    try {
      const client = createBybitPublicClient({
        baseUrl: "https://api.bybit.com",
      });
      const ticker = await client.getTicker(symbol);
      const dropPercent = ticker.high24h
        ? ((ticker.high24h - ticker.lastPrice) / ticker.high24h) * 100
        : null;

      const msg =
        `💲 *${escapeTelegramMarkdown(symbol)}*\n\n` +
        `• *Price:* \`$${ticker.lastPrice.toLocaleString()}\`\n` +
        `• *24h High:* \`$${(ticker.high24h ?? ticker.lastPrice).toLocaleString()}\`\n` +
        `• *24h Low:* \`$${(ticker.low24h ?? ticker.lastPrice).toLocaleString()}\`\n` +
        (dropPercent !== null
          ? `• *Drop from 24h high:* \`${dropPercent.toFixed(2)}%\``
          : "");

      return ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (error) {
      logBotError("PRICE_COMMAND_FAILED", error, ctx.update.update_id);
      return ctx.reply(
        `❌ Could not fetch price for *${escapeTelegramMarkdown(symbol)}*. Is the symbol correct? (e.g. /price ETHUSDT)`,
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

    const caller = await requireCaller(ctx);
    if (!caller) return;

    try {
      const result = await updateOwnedStrategyConfig(
        getDb(),
        caller.id,
        symbol,
        "thresholdPercent",
        val,
        botCorrelationId(ctx.update.update_id),
      );
      if (result.outcome === "NOT_FOUND") {
        return ctx.reply(
          `❌ Strategy for symbol *${escapeTelegramMarkdown(symbol)}* not found.`,
          {
            parse_mode: "Markdown",
          },
        );
      }

      return ctx.reply(
        `✅ Dip threshold for *${escapeTelegramMarkdown(symbol)}* updated to *${val}%*`,
        {
          parse_mode: "Markdown",
        },
      );
    } catch (error) {
      logBotError("THRESHOLD_UPDATE_FAILED", error, ctx.update.update_id);
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

    const caller = await requireCaller(ctx);
    if (!caller) return;

    try {
      const result = await updateOwnedStrategyConfig(
        getDb(),
        caller.id,
        symbol,
        "suggestedQuoteAmount",
        val,
        botCorrelationId(ctx.update.update_id),
      );
      if (result.outcome === "NOT_FOUND") {
        return ctx.reply(
          `❌ Strategy for symbol *${escapeTelegramMarkdown(symbol)}* not found.`,
          {
            parse_mode: "Markdown",
          },
        );
      }

      return ctx.reply(
        `✅ Buy amount for *${escapeTelegramMarkdown(symbol)}* updated to *${val} USDT*`,
        {
          parse_mode: "Markdown",
        },
      );
    } catch (error) {
      logBotError("BUY_AMOUNT_UPDATE_FAILED", error, ctx.update.update_id);
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

    const caller = await requireCaller(ctx);
    if (!caller) return;

    try {
      const result = await updateOwnedStrategyConfig(
        getDb(),
        caller.id,
        symbol,
        "maxDailySpendUsdt",
        val,
        botCorrelationId(ctx.update.update_id),
      );
      if (result.outcome === "NOT_FOUND") {
        return ctx.reply(
          `❌ Strategy for symbol *${escapeTelegramMarkdown(symbol)}* not found.`,
          {
            parse_mode: "Markdown",
          },
        );
      }

      return ctx.reply(
        `✅ Daily spend limit for *${escapeTelegramMarkdown(symbol)}* updated to *${val} USDT*`,
        {
          parse_mode: "Markdown",
        },
      );
    } catch (error) {
      logBotError("DAILY_LIMIT_UPDATE_FAILED", error, ctx.update.update_id);
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

    const caller = await requireCaller(ctx);
    if (!caller) return;

    try {
      const result = await toggleOwnedStrategy(
        getDb(),
        caller.id,
        symbol,
        botCorrelationId(ctx.update.update_id),
      );
      if (result.outcome === "NOT_FOUND") {
        return ctx.reply(
          `❌ Strategy for symbol *${escapeTelegramMarkdown(symbol)}* not found.`,
          {
            parse_mode: "Markdown",
          },
        );
      }

      return ctx.reply(
        `✅ Strategy for *${escapeTelegramMarkdown(symbol)}* updated to: ${result.enabled ? "🟢 *Enabled*" : "🔴 *Disabled*"}`,
        {
          parse_mode: "Markdown",
        },
      );
    } catch (error) {
      logBotError("STRATEGY_TOGGLE_FAILED", error, ctx.update.update_id);
      return ctx.reply("❌ Failed to toggle strategy status.");
    }
  });

  const handleAddPair = async (ctx: any, symbol: string, caller: BotCaller) => {
    if (!isAllowedSymbol(symbol, process.env.ALLOWLIST_SYMBOLS)) {
      return ctx.reply(
        `Pair not supported. Available pairs: ${getAllowedSymbols(process.env.ALLOWLIST_SYMBOLS).join(", ") || "none"}.`,
      );
    }
    let loadingMsg: any;
    try {
      loadingMsg = await ctx.reply(
        `⏳ Validating <b>${escapeTelegramHtml(symbol)}</b> on Bybit Spot server...`,
        { parse_mode: "HTML" },
      );
      await ctx.replyWithChatAction("typing");
    } catch (err) {
      logBotError("ADD_PAIR_LOADING_STATUS_FAILED", err, ctx.update.update_id);
    }

    try {
      // Call Hono API server as the caller, so the new strategy is created
      // under their ownership rather than as an ownerless global row.
      const response = await fetchAsUser(
        caller,
        "/strategies",
        ctx.update.update_id,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ symbol }),
        },
      );

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
              `❌ Strategy for <b>${escapeTelegramHtml(symbol)}</b> already exists.`,
              {
                parse_mode: "HTML",
              },
            );
          case "SYMBOL_NOT_FOUND_ON_EXCHANGE":
            return ctx.reply(
              `❌ Symbol <b>${escapeTelegramHtml(symbol)}</b> was not found on Bybit Spot market.`,
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
          `• <b>Name:</b> ${escapeTelegramHtml(data.strategy.name)}\n` +
          `• <b>Symbol:</b> ${escapeTelegramHtml(data.strategy.symbol)}\n` +
          `• <b>Mode:</b> ${escapeTelegramHtml(data.strategy.mode)}\n\n` +
          `Default parameters configured: threshold 1.0%, buy amount 20 USDT, daily limit 300 USDT.`,
        { parse_mode: "HTML" },
      );
    } catch (error) {
      logBotError("ADD_PAIR_FAILED", error, ctx.update.update_id);
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

    const caller = await requireCaller(ctx);
    if (!caller) return;

    return handleAddPair(ctx, symbol, caller);
  });

  bot.callbackQuery(/^cancel_order:(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    if (!orderId) return ctx.answerCallbackQuery("❌ Order ID missing.");

    const caller = await requireCallbackCaller(ctx);
    if (!caller) return;

    try {
      const db = getDb();
      const result = await claimOwnedPendingOrder(
        db,
        orderId,
        caller.id,
        "CANCELLED",
        botCorrelationId(ctx.update.update_id),
      );

      if (result.outcome === "NOT_FOUND") {
        return ctx.answerCallbackQuery("❌ Order not found.");
      }
      if (result.outcome === "SYMBOL_NOT_ALLOWED") {
        return ctx.answerCallbackQuery(
          "Pair is no longer supported. Cancel this order instead.",
        );
      }
      if (result.outcome === "ALREADY_SETTLED") {
        return ctx.answerCallbackQuery(
          result.status === "COMPLETED"
            ? "⚠️ Too late! Order already executed."
            : "ℹ️ Order already cancelled.",
        );
      }

      const order = result.order;
      await ctx.answerCallbackQuery("❌ Order cancelled successfully!");
      return ctx.editMessageText(
        `❌ <b>Dry-Run Order Cancelled</b>\n\n` +
          `• <b>Symbol:</b> ${escapeTelegramHtml(order.symbol)}\n` +
          `• <b>Amount:</b> ${order.quoteAmount} USDT\n` +
          `• <b>Status:</b> Cancelled by user`,
        { parse_mode: "HTML" },
      );
    } catch (err) {
      logBotError("ORDER_CANCEL_FAILED", err, ctx.update.update_id);
      return ctx.answerCallbackQuery("❌ Failed to cancel order.");
    }
  });

  bot.callbackQuery(/^buy_now:(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    if (!orderId) return ctx.answerCallbackQuery("❌ Order ID missing.");

    const caller = await requireCallbackCaller(ctx);
    if (!caller) return;

    try {
      const db = getDb();
      const result = await claimOwnedPendingOrder(
        db,
        orderId,
        caller.id,
        "COMPLETED",
        botCorrelationId(ctx.update.update_id),
      );

      if (result.outcome === "NOT_FOUND") {
        return ctx.answerCallbackQuery("❌ Order not found.");
      }
      if (result.outcome === "SYMBOL_NOT_ALLOWED") {
        return ctx.answerCallbackQuery(
          "Pair is no longer supported. Cancel this order instead.",
        );
      }
      if (result.outcome === "ALREADY_SETTLED") {
        return ctx.answerCallbackQuery(
          result.status === "CANCELLED"
            ? "⚠️ Too late! Order already cancelled."
            : "ℹ️ Order already executed.",
        );
      }

      const order = result.order;

      // Fetch strategy details for the text
      const [strategy] = await db
        .select()
        .from(schema.strategies)
        .where(
          and(
            eq(schema.strategies.id, order.strategyId ?? ""),
            eq(schema.strategies.userId, caller.id),
          ),
        )
        .limit(1);

      const strategyName = strategy?.name ?? "Dip Buying Strategy";

      await ctx.answerCallbackQuery("⚡ Order executed now!");
      return ctx.editMessageText(
        `🎉 <b>Dry-Run Order Executed</b>\n\n` +
          `• <b>Strategy:</b> ${escapeTelegramHtml(strategyName)}\n` +
          `• <b>Symbol:</b> ${escapeTelegramHtml(order.symbol)}\n` +
          `• <b>Price:</b> $${Number(order.price).toLocaleString()}\n` +
          `• <b>Amount:</b> ${order.quoteAmount} USDT\n` +
          `• <b>Status:</b> Simulated Purchase (Force Executed)`,
        { parse_mode: "HTML" },
      );
    } catch (err) {
      logBotError("ORDER_EXECUTE_FAILED", err, ctx.update.update_id);
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
      const caller = await requireCaller(ctx);
      if (!caller) return;
      return handleAddPair(ctx, symbol, caller);
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
      logBotError("COMMAND_REGISTRATION_FAILED", err);
    });

  return bot;
};
