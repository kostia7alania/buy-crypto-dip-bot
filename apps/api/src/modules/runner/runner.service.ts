import {
  orderExecutionDelaySeconds,
  strategyDefaults,
} from "@buy-crypto-dip-bot/config";
import {
  createPostgresConnection,
  runMigrations,
  schema,
} from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { evaluateRisk } from "@buy-crypto-dip-bot/risk-engine";
import { evaluateDipStrategy } from "@buy-crypto-dip-bot/strategy-engine";
import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { computePnlReport } from "../pnl/pnl.route.js";

let tickIntervalId: NodeJS.Timeout | null = null;
let dueOrdersIntervalId: NodeJS.Timeout | null = null;
let digestIntervalId: NodeJS.Timeout | null = null;

const RUN_INTERVAL_MS = 30000; // strategy evaluation cadence
const DUE_ORDERS_POLL_MS = 3000; // how often due PENDING orders are executed
const COUNTDOWN_STEP_S = 3; // how often the Telegram countdown message is edited
const COUNTDOWN_BAR_WIDTH = 10;
const DIGEST_UTC_HOUR = 6; // daily digest ~06:00 UTC (morning in EU/Asia)
const DIGEST_CHECK_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Heartbeat for /risk/status: lets the dashboard show whether the trading
// loop is actually alive instead of pretending.
let lastTickAt: Date | null = null;

export const getRunnerStatus = () => ({
  lastTickAt: lastTickAt ? lastTickAt.toISOString() : null,
  tickIntervalMs: RUN_INTERVAL_MS,
});

type Db = ReturnType<typeof createPostgresConnection>["db"];

interface StrategyConfigJson {
  thresholdPercent: number;
  maxDailySpendUsdt: number;
  maxWeeklySpendUsdt: number;
  cooldownMinutes: number;
  suggestedQuoteAmount: number;
}

// Seed default strategies only when the symbol is missing entirely.
// Existing rows are never touched: user settings from Telegram or the
// dashboard must survive restarts.
async function seedDefaultStrategyIfNeeded(db: Db) {
  const defaultSymbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

  for (const symbol of defaultSymbols) {
    const existing = await db
      .select()
      .from(schema.strategies)
      .where(eq(schema.strategies.symbol, symbol))
      .limit(1);

    if (existing.length === 0) {
      console.log(`Seeding default ${symbol} dry-run strategy...`);
      await db.insert(schema.strategies).values({
        name: `${symbol.replace("USDT", "")} Dip Buying Strategy`,
        symbol,
        mode: "DRY_RUN",
        enabled: true,
        config: { ...strategyDefaults },
      });
    }
  }
}

const buildPendingText = (
  strategyName: string,
  symbol: string,
  price: number,
  quoteAmount: number,
  secondsLeft: number,
) => {
  const total = orderExecutionDelaySeconds;
  const filled = Math.min(
    COUNTDOWN_BAR_WIDTH,
    Math.round(((total - secondsLeft) / total) * COUNTDOWN_BAR_WIDTH),
  );
  const bar = "▓".repeat(filled) + "░".repeat(COUNTDOWN_BAR_WIDTH - filled);
  return (
    `🚨 *Pending Buy Alert*\n\n` +
    `• *Strategy:* ${strategyName}\n` +
    `• *Symbol:* ${symbol}\n` +
    `• *Price:* $${price.toLocaleString()}\n` +
    `• *Amount:* ${quoteAmount} USDT\n` +
    `• *Status:* ⏳ Executing in *${secondsLeft}s*\n` +
    `\`${bar}\``
  );
};

// Executes every PENDING order whose execute_at has passed. DB-driven so
// orders survive restarts; the atomic status flip below also guards against
// double execution.
async function processDueOrders(db: Db) {
  const dueOrders = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.status, "PENDING"),
        or(
          lte(schema.orders.executeAt, new Date()),
          isNull(schema.orders.executeAt),
        ),
      ),
    );

  for (const order of dueOrders) {
    // Atomic claim: only proceed if we are the ones flipping PENDING -> COMPLETED
    const claimed = await db
      .update(schema.orders)
      .set({ status: "COMPLETED" })
      .where(
        and(
          eq(schema.orders.id, order.id),
          eq(schema.orders.status, "PENDING"),
        ),
      )
      .returning();
    if (claimed.length === 0) continue;

    await db.insert(schema.auditEvents).values({
      entityType: "order",
      entityId: order.id,
      action: "DRY_RUN_ORDER_COMPLETED",
      payload: { order: { ...order, status: "COMPLETED" } },
    });

    const [strategy] = await db
      .select()
      .from(schema.strategies)
      .where(eq(schema.strategies.id, order.strategyId ?? ""))
      .limit(1);
    const strategyName = strategy?.name ?? "Dip Buying Strategy";

    console.log(
      `🎉 [Dry-Run] Purchased ${order.quoteAmount} USDT of ${order.symbol} at ${order.price} (Strategy: ${strategyName})`,
    );

    if (order.tgMessageId) {
      const successText =
        `🎉 *Dry-Run Order Executed*\n\n` +
        `• *Strategy:* ${strategyName}\n` +
        `• *Symbol:* ${order.symbol}\n` +
        `• *Price:* $${Number(order.price).toLocaleString()}\n` +
        `• *Amount:* ${order.quoteAmount} USDT\n` +
        `• *Status:* Simulated Purchase`;
      await editTelegramMessage(order.tgMessageId, successText);
    }
  }
}

// Daily digest: one Telegram message each morning — what the bot did in the
// last 24h and where the simulated portfolio stands. The retention loop.
let lastDigestDay: string | null = null;

async function maybeSendDailyDigest(db: Db) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (now.getUTCHours() !== DIGEST_UTC_HOUR || lastDigestDay === today) return;
  lastDigestDay = today;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const buys = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.status, "COMPLETED"),
        eq(schema.orders.side, "BUY"),
        gte(schema.orders.createdAt, oneDayAgo),
      ),
    );
  const spent24h = buys.reduce((s, o) => s + Number(o.quoteAmount), 0);

  let pnlLine = "";
  try {
    const pnl = await computePnlReport(db);
    if (pnl.totals.spentUsdt > 0) {
      const sign = pnl.totals.pnlUsdt >= 0 ? "+" : "";
      pnlLine =
        `• *Portfolio:* \`${pnl.totals.spentUsdt.toFixed(2)} USDT\` invested, ` +
        `now \`${pnl.totals.currentValueUsdt.toFixed(2)}\` ` +
        `(\`${sign}${pnl.totals.pnlUsdt.toFixed(2)} / ${sign}${pnl.totals.pnlPercent.toFixed(2)}%\`)\n`;
    }
  } catch (error) {
    console.error("Digest: PnL computation failed:", error);
  }

  const bySymbol = new Map<string, number>();
  for (const o of buys) {
    bySymbol.set(o.symbol, (bySymbol.get(o.symbol) ?? 0) + 1);
  }
  const symbolsLine =
    bySymbol.size > 0
      ? `• *Dips caught:* ${[...bySymbol.entries()].map(([s, n]) => `${s}×${n}`).join(", ")}\n`
      : "";

  const msg =
    `☕️ *Morning digest*\n\n` +
    `• *Simulated buys (24h):* \`${buys.length}\`\n` +
    symbolsLine +
    `• *Spent (24h):* \`${spent24h.toFixed(2)} USDT\`\n` +
    pnlLine +
    `\nSee /pnl, /performance or /backtest for details.`;

  await sendTelegramAlert(msg);
  console.log("Daily digest sent.");
}

// Cosmetic live countdown in Telegram. Execution itself is DB-driven in
// processDueOrders — if this loop dies with the process, the order still runs.
async function runCountdownEdits(
  db: Db,
  orderId: string,
  messageId: number,
  executeAt: Date,
  textFor: (secondsLeft: number) => string,
) {
  try {
    while (true) {
      await sleep(COUNTDOWN_STEP_S * 1000);
      const secondsLeft = Math.max(
        0,
        Math.round((executeAt.getTime() - Date.now()) / 1000),
      );
      if (secondsLeft <= 0) return;

      // Stop if the order was cancelled or force-executed meanwhile
      const [currentOrder] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
        .limit(1);
      if (currentOrder?.status !== "PENDING") return;

      await editTelegramMessage(messageId, textFor(secondsLeft), orderId);
    }
  } catch (err) {
    console.error("Countdown edit loop failed:", err);
  }
}

export async function startRunner() {
  const connectionString =
    process.env.POSTGRES_CONNECTION_STRING ??
    "postgresql://postgres:local_password@localhost:5432/dipbot";

  console.log("Initializing database connection for background runner...");
  const { db, pool } = createPostgresConnection(connectionString);

  try {
    console.log("Running pending migrations...");
    await runMigrations(db);
    console.log("Database migrations completed successfully.");

    await seedDefaultStrategyIfNeeded(db);
  } catch (error) {
    console.error("Failed to run migrations on startup:", error);
    // Continue running anyway; database might be migrated already.
  }

  const client = createBybitPublicClient({ baseUrl: "https://api.bybit.com" });

  const tick = async () => {
    lastTickAt = new Date();
    try {
      // Find all active strategies
      const activeStrategies = await db
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.enabled, true));

      if (activeStrategies.length === 0) {
        console.log("No active strategies found in database.");
        return;
      }

      // Group strategies by symbol
      const symbols = Array.from(
        new Set(activeStrategies.map((s) => s.symbol)),
      );

      for (const symbol of symbols) {
        let ticker: import("@buy-crypto-dip-bot/exchange-core").MarketTicker;
        try {
          ticker = await client.getTicker(symbol);
        } catch (error) {
          console.error(`Failed to fetch ticker for ${symbol}:`, error);
          continue;
        }

        const strategiesForSymbol = activeStrategies.filter(
          (s) => s.symbol === symbol,
        );

        for (const strategy of strategiesForSymbol) {
          const config = strategy.config as unknown as StrategyConfigJson;
          const strategyContract = {
            id: strategy.id,
            name: strategy.name,
            symbol: strategy.symbol,
            mode: (strategy.mode === "LIVE" ? "LIVE" : "DRY_RUN") as
              | "LIVE"
              | "DRY_RUN",
            maxDailySpendUsdt: config.maxDailySpendUsdt,
            maxWeeklySpendUsdt: config.maxWeeklySpendUsdt,
            cooldownMinutes: config.cooldownMinutes,
          };

          // 1. Evaluate strategy
          const signal = evaluateDipStrategy({
            strategy: strategyContract,
            currentPrice: ticker.lastPrice,
            high24h: ticker.high24h ?? ticker.lastPrice,
            thresholdPercent: config.thresholdPercent,
            suggestedQuoteAmount: config.suggestedQuoteAmount,
            now: new Date().toISOString(),
          });

          // If no signal, log and skip
          if (signal.type === "NO_SIGNAL") {
            console.log(
              `[Strategy] No dip signal for strategy ${strategy.name}: Drop is ${signal.dropPercent.toFixed(2)}% (threshold ${config.thresholdPercent}%)`,
            );
            continue;
          }

          // 2. Fetch risk boundaries (spent USDT in last 24h and last 7 days)
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          const dailySpentResult = await db
            .select({
              sum: sql<string>`sum(cast(${schema.orders.quoteAmount} as numeric))`,
            })
            .from(schema.orders)
            .where(
              and(
                eq(schema.orders.strategyId, strategy.id),
                eq(schema.orders.status, "COMPLETED"),
                gte(schema.orders.createdAt, oneDayAgo),
              ),
            );

          const weeklySpentResult = await db
            .select({
              sum: sql<string>`sum(cast(${schema.orders.quoteAmount} as numeric))`,
            })
            .from(schema.orders)
            .where(
              and(
                eq(schema.orders.strategyId, strategy.id),
                eq(schema.orders.status, "COMPLETED"),
                gte(schema.orders.createdAt, oneWeekAgo),
              ),
            );

          const dailySpentUsdt = Number(dailySpentResult[0]?.sum ?? "0");
          const weeklySpentUsdt = Number(weeklySpentResult[0]?.sum ?? "0");

          // 3. Check for cooldown to avoid double-buying in the same dip.
          // PENDING orders count too — otherwise a second signal could
          // schedule a duplicate while the first is still counting down.
          const lastOrder = await db
            .select()
            .from(schema.orders)
            .where(
              and(
                eq(schema.orders.strategyId, strategy.id),
                or(
                  eq(schema.orders.status, "COMPLETED"),
                  eq(schema.orders.status, "PENDING"),
                ),
              ),
            )
            .orderBy(sql`${schema.orders.createdAt} DESC`)
            .limit(1);

          const [lastOrderRow] = lastOrder;
          if (lastOrderRow) {
            if (lastOrderRow.status === "PENDING") {
              console.log(
                `[Strategy] Pending order already scheduled for strategy ${strategy.name}, skipping.`,
              );
              continue;
            }
            const lastOrderTime = new Date(lastOrderRow.createdAt).getTime();
            const minutesSinceLastOrder =
              (Date.now() - lastOrderTime) / (60 * 1000);
            if (minutesSinceLastOrder < config.cooldownMinutes) {
              console.log(
                `[Strategy] Cooldown active for strategy ${strategy.name}. Minutes elapsed: ${minutesSinceLastOrder.toFixed(1)} / ${config.cooldownMinutes}`,
              );
              continue;
            }
          }

          // 4. Run through RiskGuard
          const decision = evaluateRisk(signal, strategyContract, {
            liveTradingEnabled: false, // always false for dry-run only safety
            allowedSymbols: Array.from(
              new Set([
                ...(process.env.ALLOWLIST_SYMBOLS ?? "BTCUSDT,ETHUSDT,SOLUSDT")
                  .split(",")
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean),
                ...activeStrategies.map((s) => s.symbol.toUpperCase()),
              ]),
            ),
            dailySpentUsdt,
            weeklySpentUsdt,
          });

          if (decision.status === "REJECTED") {
            console.warn(
              `[RiskGuard] Signal REJECTED for strategy ${strategy.name}: ${decision.reasonCodes.join(", ")}`,
            );

            // Cooldown/Throttle RiskGuard alerts to Telegram (once per 1 hour per strategy/reason combination)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentAlerts = await db
              .select()
              .from(schema.auditEvents)
              .where(
                and(
                  eq(schema.auditEvents.entityType, "strategy"),
                  eq(schema.auditEvents.entityId, strategy.id),
                  eq(schema.auditEvents.action, "SIGNAL_REJECTED"),
                  gte(schema.auditEvents.createdAt, oneHourAgo),
                ),
              );

            const hasRecentSimilarAlert = recentAlerts.some((alert) => {
              const payload = alert.payload as {
                decision?: { reasonCodes?: string[] };
              };
              const prevReasons = payload?.decision?.reasonCodes;
              if (!prevReasons) return false;
              return (
                prevReasons.length === decision.reasonCodes.length &&
                prevReasons.every((r) => decision.reasonCodes.includes(r))
              );
            });

            // Save Audit Event
            await db.insert(schema.auditEvents).values({
              entityType: "strategy",
              entityId: strategy.id,
              action: "SIGNAL_REJECTED",
              payload: {
                price: ticker.lastPrice,
                dropPercent: signal.dropPercent,
                decision,
              },
            });

            if (!hasRecentSimilarAlert) {
              sendTelegramAlert(
                `⚠️ *RiskGuard Alert*\n\n` +
                  `• *Strategy:* ${strategy.name}\n` +
                  `• *Symbol:* ${strategy.symbol}\n` +
                  `• *Price:* $${ticker.lastPrice.toLocaleString()}\n` +
                  `• *Action:* REJECTED\n` +
                  `• *Reasons:* ${decision.reasonCodes.join(", ")}`,
              ).catch((err) =>
                console.error("Failed to send telegram alert:", err),
              );
            } else {
              console.log(
                `[Runner] Suppressed duplicate Telegram risk alert for strategy ${strategy.name} (${decision.reasonCodes.join(", ")})`,
              );
            }
            continue;
          }

          // Save SIGNAL_APPROVED Audit Event
          await db.insert(schema.auditEvents).values({
            entityType: "strategy",
            entityId: strategy.id,
            action: "SIGNAL_APPROVED",
            payload: {
              price: ticker.lastPrice,
              dropPercent: signal.dropPercent,
              decision,
            },
          });

          // 5. Schedule a PENDING order; processDueOrders executes it once
          // execute_at passes, even across restarts.
          const executeAt = new Date(
            Date.now() + orderExecutionDelaySeconds * 1000,
          );
          const insertedOrders = await db
            .insert(schema.orders)
            .values({
              strategyId: strategy.id,
              symbol: strategy.symbol,
              mode: strategy.mode,
              side: "BUY",
              quoteAmount: String(config.suggestedQuoteAmount),
              price: String(ticker.lastPrice),
              status: "PENDING",
              executeAt,
            })
            .returning();

          const [order] = insertedOrders;
          if (order) {
            const textFor = (secondsLeft: number) =>
              buildPendingText(
                strategy.name,
                strategy.symbol,
                ticker.lastPrice,
                config.suggestedQuoteAmount,
                secondsLeft,
              );

            const alert = await sendTelegramAlertWithCancel(
              textFor(orderExecutionDelaySeconds),
              order.id,
            );

            if (alert?.messageId) {
              await db
                .update(schema.orders)
                .set({ tgMessageId: alert.messageId })
                .where(eq(schema.orders.id, order.id));

              // Fire-and-forget: cosmetic countdown edits
              runCountdownEdits(
                db,
                order.id,
                alert.messageId,
                executeAt,
                textFor,
              );
            }
          }
        }
      }
    } catch (err) {
      console.error("Error in background runner tick:", err);
    }
  };

  console.log(`Starting execution loop. Interval: ${RUN_INTERVAL_MS / 1000}s`);
  // Run first tick immediately
  tick();
  tickIntervalId = setInterval(tick, RUN_INTERVAL_MS);
  dueOrdersIntervalId = setInterval(() => {
    processDueOrders(db).catch((err) =>
      console.error("Error processing due orders:", err),
    );
  }, DUE_ORDERS_POLL_MS);
  digestIntervalId = setInterval(() => {
    maybeSendDailyDigest(db).catch((err) =>
      console.error("Error sending daily digest:", err),
    );
  }, DIGEST_CHECK_MS);

  // Close connection pool on process exit
  process.on("SIGTERM", async () => {
    if (tickIntervalId) clearInterval(tickIntervalId);
    if (dueOrdersIntervalId) clearInterval(dueOrdersIntervalId);
    if (digestIntervalId) clearInterval(digestIntervalId);
    await pool.end();
  });
}

async function sendTelegramAlert(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });
    if (!response.ok) {
      console.error(`Telegram alert failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Failed to send Telegram alert:", error);
  }
}

const orderKeyboard = (orderId: string) => ({
  inline_keyboard: [
    [
      { text: "Cancel ❌", callback_data: `cancel_order:${orderId}` },
      { text: "Buy Now ⚡", callback_data: `buy_now:${orderId}` },
    ],
  ],
});

async function sendTelegramAlertWithCancel(
  message: string,
  orderId: string,
): Promise<{ messageId: number } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
        reply_markup: orderKeyboard(orderId),
      }),
    });
    if (response.ok) {
      const data = (await response.json()) as {
        result?: { message_id: number };
      };
      return { messageId: data.result?.message_id ?? 0 };
    }
    console.error(`Telegram cancel alert failed: ${response.statusText}`);
  } catch (error) {
    console.error("Failed to send Telegram cancel alert:", error);
  }
  return null;
}

async function editTelegramMessage(
  messageId: number,
  newText: string,
  // When provided, keeps the Cancel/Buy Now buttons attached — Telegram
  // drops reply_markup on every edit unless it is sent again.
  keepButtonsForOrderId?: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId || !messageId) return;

  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: newText,
        parse_mode: "Markdown",
        ...(keepButtonsForOrderId
          ? { reply_markup: orderKeyboard(keepButtonsForOrderId) }
          : {}),
      }),
    });
    if (!response.ok) {
      console.error(`Telegram message edit failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Failed to edit Telegram message:", error);
  }
}
