import { orderExecutionDelaySeconds } from "@buy-crypto-dip-bot/config";
import { type DatabaseClient, schema } from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { evaluateRisk } from "@buy-crypto-dip-bot/risk-engine";
import { evaluateDipStrategy } from "@buy-crypto-dip-bot/strategy-engine";
import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "../../db.js";
import { buildPendingText } from "./countdown.js";

let tickIntervalId: NodeJS.Timeout | null = null;
let dueOrdersIntervalId: NodeJS.Timeout | null = null;
let tickRunning = false;

const RUN_INTERVAL_MS = 30000; // strategy evaluation cadence
const DUE_ORDERS_POLL_MS = 3000; // how often due PENDING orders are executed

// Heartbeat for /risk/status: lets the dashboard show whether the trading
// loop is actually alive instead of pretending.
let lastTickAt: Date | null = null;

export const getRunnerStatus = () => ({
  lastTickAt: lastTickAt ? lastTickAt.toISOString() : null,
  tickIntervalMs: process.env.RUNNER_ENABLED === "true" ? RUN_INTERVAL_MS : 0,
});

type Db = DatabaseClient;

interface StrategyConfigJson {
  thresholdPercent: number;
  maxDailySpendUsdt: number;
  maxWeeklySpendUsdt: number;
  cooldownMinutes: number;
  suggestedQuoteAmount: number;
}

const minuteSlot = (date: Date) => date.toISOString().slice(0, 16);

const getTenantChatId = async (db: Db, tenantId: string) => {
  const [destination] = await db
    .select({ chatId: schema.telegramDestinations.chatId })
    .from(schema.telegramDestinations)
    .innerJoin(
      schema.tenants,
      eq(
        schema.telegramDestinations.userId,
        schema.tenants.personalOwnerUserId,
      ),
    )
    .where(
      and(
        eq(schema.tenants.id, tenantId),
        eq(schema.telegramDestinations.enabled, true),
        eq(schema.telegramDestinations.chatType, "private"),
      ),
    )
    .orderBy(sql`${schema.telegramDestinations.updatedAt} DESC`)
    .limit(1);

  return destination?.chatId ?? null;
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
        eq(schema.orders.mode, "DRY_RUN"),
        or(
          lte(schema.orders.executeAt, new Date()),
          isNull(schema.orders.executeAt),
        ),
      ),
    );

  for (const order of dueOrders) {
    const transition = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(schema.orders)
        .set({ status: "COMPLETED" })
        .where(
          and(
            eq(schema.orders.id, order.id),
            eq(schema.orders.tenantId, order.tenantId),
            eq(schema.orders.status, "PENDING"),
            eq(schema.orders.mode, "DRY_RUN"),
          ),
        )
        .returning();
      if (!claimed) return null;

      await tx.insert(schema.auditEvents).values({
        tenantId: claimed.tenantId,
        eventKey: `runner-order-final:${claimed.id}:COMPLETED`,
        entityType: "order",
        entityId: claimed.id,
        action: "DRY_RUN_ORDER_COMPLETED",
        payload: { order: claimed },
      });

      const [strategy] = await tx
        .select({ name: schema.strategies.name })
        .from(schema.strategies)
        .where(
          and(
            eq(schema.strategies.id, claimed.strategyId ?? ""),
            eq(schema.strategies.tenantId, claimed.tenantId),
          ),
        )
        .limit(1);

      return {
        order: claimed,
        strategyName: strategy?.name ?? "Dip Buying Strategy",
      };
    });
    if (!transition) continue;

    const { order: completedOrder, strategyName } = transition;

    console.log(
      `🎉 [Dry-Run] Purchased ${completedOrder.quoteAmount} USDT of ${completedOrder.symbol} at ${completedOrder.price} (Strategy: ${strategyName})`,
    );

    if (completedOrder.tgMessageId && completedOrder.tgChatId) {
      const successText =
        `🎉 *Dry-Run Order Executed*\n\n` +
        `• *Strategy:* ${strategyName}\n` +
        `• *Symbol:* ${completedOrder.symbol}\n` +
        `• *Price:* $${Number(completedOrder.price).toLocaleString()}\n` +
        `• *Amount:* ${completedOrder.quoteAmount} USDT\n` +
        `• *Status:* Simulated Purchase`;
      await editTelegramMessage(
        completedOrder.tgChatId,
        completedOrder.tgMessageId,
        successText,
      );
    }
  }
}

export async function startRunner() {
  if (process.env.RUNNER_ENABLED !== "true") {
    console.log("Background runner disabled (RUNNER_ENABLED is not true).");
    return;
  }
  if (tickIntervalId || dueOrdersIntervalId) return;

  const db = getDb();

  const client = createBybitPublicClient({ baseUrl: "https://api.bybit.com" });

  const tick = async () => {
    if (tickRunning) return;
    tickRunning = true;
    const now = new Date();
    try {
      // Find all active strategies
      const activeStrategies = await db
        .select()
        .from(schema.strategies)
        .where(
          and(
            eq(schema.strategies.enabled, true),
            eq(schema.strategies.mode, "DRY_RUN"),
          ),
        );

      if (activeStrategies.length === 0) {
        console.log("No active strategies found in database.");
        lastTickAt = new Date();
        return;
      }

      // Group strategies by symbol
      const symbols = Array.from(
        new Set(activeStrategies.map((s) => s.symbol)),
      );
      let marketDataObserved = false;

      for (const symbol of symbols) {
        let ticker: import("@buy-crypto-dip-bot/exchange-core").MarketTicker;
        try {
          ticker = await client.getTicker(symbol);
          marketDataObserved = true;
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
            now: now.toISOString(),
          });

          // If no signal, log and skip
          if (signal.type === "NO_SIGNAL") {
            console.log(
              `[Strategy] No dip signal for strategy ${strategy.name}: Drop is ${signal.dropPercent.toFixed(2)}% (threshold ${config.thresholdPercent}%)`,
            );
            continue;
          }

          const evaluationKey = `strategy:${strategy.id}:minute:${minuteSlot(now)}`;
          const [claimedEvaluation] = await db
            .insert(schema.eventLedger)
            .values({
              tenantId: strategy.tenantId,
              eventKey: evaluationKey,
              eventType: "STRATEGY_EVALUATION",
              payload: {
                strategyId: strategy.id,
                symbol: strategy.symbol,
                observedAt: now.toISOString(),
              },
            })
            .onConflictDoNothing()
            .returning({ id: schema.eventLedger.id });
          if (!claimedEvaluation) continue;

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
                eq(schema.orders.tenantId, strategy.tenantId),
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
                eq(schema.orders.tenantId, strategy.tenantId),
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
                eq(schema.orders.tenantId, strategy.tenantId),
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
                  eq(schema.auditEvents.tenantId, strategy.tenantId),
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
              tenantId: strategy.tenantId,
              eventKey: `${evaluationKey}:rejected`,
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
              const chatId = await getTenantChatId(db, strategy.tenantId);
              sendTelegramAlert(
                chatId,
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
            await db
              .update(schema.eventLedger)
              .set({ status: "COMPLETED", completedAt: new Date() })
              .where(eq(schema.eventLedger.id, claimedEvaluation.id));
            continue;
          }

          const executeAt = new Date(
            Date.now() + orderExecutionDelaySeconds * 1000,
          );
          const order = await db.transaction(async (tx) => {
            const [inserted] = await tx
              .insert(schema.orders)
              .values({
                tenantId: strategy.tenantId,
                strategyId: strategy.id,
                evaluationKey,
                symbol: strategy.symbol,
                mode: "DRY_RUN",
                side: "BUY",
                quoteAmount: String(config.suggestedQuoteAmount),
                price: String(ticker.lastPrice),
                status: "PENDING",
                executeAt,
              })
              .onConflictDoNothing()
              .returning();
            if (!inserted) return null;

            await tx.insert(schema.auditEvents).values({
              tenantId: strategy.tenantId,
              eventKey: `${evaluationKey}:approved`,
              entityType: "strategy",
              entityId: strategy.id,
              action: "SIGNAL_APPROVED",
              payload: {
                orderId: inserted.id,
                price: ticker.lastPrice,
                dropPercent: signal.dropPercent,
                decision,
              },
            });
            return inserted;
          });

          if (order) {
            const textFor = (secondsLeft: number) =>
              buildPendingText(
                strategy.name,
                strategy.symbol,
                ticker.lastPrice,
                config.suggestedQuoteAmount,
                secondsLeft,
              );

            const chatId = await getTenantChatId(db, strategy.tenantId);
            const alert = await sendTelegramAlertWithCancel(
              chatId,
              textFor(orderExecutionDelaySeconds),
              order.id,
            );

            if (alert?.messageId) {
              await db
                .update(schema.orders)
                .set({ tgChatId: chatId, tgMessageId: alert.messageId })
                .where(
                  and(
                    eq(schema.orders.id, order.id),
                    eq(schema.orders.tenantId, strategy.tenantId),
                  ),
                );
            }
          }
          await db
            .update(schema.eventLedger)
            .set({ status: "COMPLETED", completedAt: new Date() })
            .where(eq(schema.eventLedger.id, claimedEvaluation.id));
        }
      }
      if (!marketDataObserved) {
        throw new Error("RUNNER_MARKET_DATA_UNAVAILABLE");
      }
      lastTickAt = new Date();
    } catch (err) {
      console.error("Error in background runner tick:", err);
    } finally {
      tickRunning = false;
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
  process.once("SIGTERM", () => {
    if (tickIntervalId) clearInterval(tickIntervalId);
    if (dueOrdersIntervalId) clearInterval(dueOrdersIntervalId);
  });
}

async function sendTelegramAlert(
  chatId: string | null,
  message: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
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
  chatId: string | null,
  message: string,
  orderId: string,
): Promise<{ messageId: number } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
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
  chatId: string,
  messageId: number,
  newText: string,
  // When provided, keeps the Cancel/Buy Now buttons attached — Telegram
  // drops reply_markup on every edit unless it is sent again.
  keepButtonsForOrderId?: string,
): Promise<number | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId || !messageId) return null;

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
    if (response.ok) return null;

    if (response.status === 429) {
      const payload = (await response.json().catch(() => null)) as {
        parameters?: { retry_after?: number };
      } | null;
      const retryAfterSeconds = payload?.parameters?.retry_after ?? 1;
      console.warn(
        `Telegram countdown rate-limited; retrying after ${retryAfterSeconds}s`,
      );
      return retryAfterSeconds;
    }

    console.error(`Telegram message edit failed: ${response.statusText}`);
  } catch (error) {
    console.error("Failed to edit Telegram message:", error);
  }
  return null;
}
