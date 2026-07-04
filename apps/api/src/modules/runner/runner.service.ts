import {
  createPostgresConnection,
  runMigrations,
  schema,
} from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { evaluateRisk } from "@buy-crypto-dip-bot/risk-engine";
import { evaluateDipStrategy } from "@buy-crypto-dip-bot/strategy-engine";
import { and, eq, gte, sql } from "drizzle-orm";

let intervalId: NodeJS.Timeout | null = null;
const RUN_INTERVAL_MS = 30000; // 30 seconds

// Simple helper to seed a default strategy if none exist
async function seedDefaultStrategyIfNeeded(
  db: ReturnType<typeof createPostgresConnection>["db"],
) {
  const existing = await db.select().from(schema.strategies).limit(1);
  if (existing.length === 0) {
    console.log("Seeding default BTCUSDT dry-run strategy...");
    await db.insert(schema.strategies).values({
      name: "BTC Dip Buying Strategy",
      symbol: "BTCUSDT",
      mode: "DRY_RUN",
      enabled: true,
      config: {
        thresholdPercent: 0.0, // 0% to trigger immediately for testing
        maxDailySpendUsdt: 100.0,
        maxWeeklySpendUsdt: 500.0,
        cooldownMinutes: 1, // small cooldown for testing
        suggestedQuoteAmount: 20.0,
      },
    });
  } else {
    // Update existing strategy threshold to 0.0% so it triggers immediately
    const [firstStrategy] = existing;
    if (firstStrategy) {
      await db
        .update(schema.strategies)
        .set({
          config: {
            thresholdPercent: 0.0,
            maxDailySpendUsdt: 100.0,
            maxWeeklySpendUsdt: 500.0,
            cooldownMinutes: 1,
            suggestedQuoteAmount: 20.0,
          },
        })
        .where(eq(schema.strategies.id, firstStrategy.id));
    }
  }
}

export async function startRunner() {
  const connectionString =
    process.env.POSTGRES_CONNECTION_STRING ??
    "postgresql://postgres:local_password@localhost:5432/dcaguard";

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
          const config = strategy.config as {
            thresholdPercent: number;
            maxDailySpendUsdt: number;
            maxWeeklySpendUsdt: number;
            cooldownMinutes: number;
            suggestedQuoteAmount: number;
          };

          // 1. Evaluate strategy
          const signal = evaluateDipStrategy({
            strategy: {
              id: strategy.id,
              name: strategy.name,
              symbol: strategy.symbol as "BTCUSDT",
              mode: strategy.mode as "DRY_RUN" | "LIVE",
              maxDailySpendUsdt: config.maxDailySpendUsdt,
              maxWeeklySpendUsdt: config.maxWeeklySpendUsdt,
              cooldownMinutes: config.cooldownMinutes,
            },
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

          // 3. Check for cooldown to avoid double-buying in the same dip
          const lastOrder = await db
            .select()
            .from(schema.orders)
            .where(
              and(
                eq(schema.orders.strategyId, strategy.id),
                eq(schema.orders.status, "COMPLETED"),
              ),
            )
            .orderBy(sql`${schema.orders.createdAt} DESC`)
            .limit(1);

          const [lastOrderRow] = lastOrder;
          if (lastOrderRow) {
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
          const decision = evaluateRisk(
            signal,
            {
              id: strategy.id,
              name: strategy.name,
              symbol: strategy.symbol as "BTCUSDT",
              mode: strategy.mode as "DRY_RUN" | "LIVE",
              maxDailySpendUsdt: config.maxDailySpendUsdt,
              maxWeeklySpendUsdt: config.maxWeeklySpendUsdt,
              cooldownMinutes: config.cooldownMinutes,
            },
            {
              liveTradingEnabled: false, // always false for dry-run only safety
              allowedSymbols: ["BTCUSDT"],
              dailySpentUsdt,
              weeklySpentUsdt,
            },
          );

          // Save Audit Event
          await db.insert(schema.auditEvents).values({
            entityType: "strategy",
            entityId: strategy.id,
            action:
              decision.status === "APPROVED"
                ? "SIGNAL_APPROVED"
                : "SIGNAL_REJECTED",
            payload: {
              price: ticker.lastPrice,
              dropPercent: signal.dropPercent,
              decision,
            },
          });

          if (decision.status === "REJECTED") {
            console.warn(
              `[RiskGuard] Signal REJECTED for strategy ${strategy.name}: ${decision.reasonCodes.join(", ")}`,
            );
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
            continue;
          }

          // 5. Place Dry-Run Order
          const insertedOrders = await db
            .insert(schema.orders)
            .values({
              strategyId: strategy.id,
              symbol: strategy.symbol,
              mode: strategy.mode,
              side: "BUY",
              quoteAmount: String(config.suggestedQuoteAmount),
              price: String(ticker.lastPrice),
              status: "COMPLETED", // directly completed since it is a dry run simulation
            })
            .returning();

          const [order] = insertedOrders;
          if (order) {
            await db.insert(schema.auditEvents).values({
              entityType: "order",
              entityId: order.id,
              action: "DRY_RUN_ORDER_COMPLETED",
              payload: { order },
            });

            console.log(
              `🎉 [Dry-Run] Purchased ${config.suggestedQuoteAmount} USDT of ${strategy.symbol} at ${ticker.lastPrice} (Strategy: ${strategy.name})`,
            );

            sendTelegramAlert(
              `🎉 *Dry-Run Order Executed*\n\n` +
                `• *Strategy:* ${strategy.name}\n` +
                `• *Symbol:* ${strategy.symbol}\n` +
                `• *Price:* $${ticker.lastPrice.toLocaleString()}\n` +
                `• *Amount:* ${config.suggestedQuoteAmount} USDT\n` +
                `• *Status:* Simulated Purchase`,
            ).catch((err) =>
              console.error("Failed to send telegram alert:", err),
            );
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
  intervalId = setInterval(tick, RUN_INTERVAL_MS);

  // Close connection pool on process exit
  process.on("SIGTERM", async () => {
    if (intervalId) clearInterval(intervalId);
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
