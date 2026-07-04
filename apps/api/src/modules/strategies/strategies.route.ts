import { schema } from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import { getDb } from "../../db.js";

const addStrategySchema = v.object({
  symbol: v.pipe(v.string(), v.regex(/^[A-Z0-9]{3,20}$/)),
});

export const strategiesRoutes = new Hono().post("/", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = v.safeParse(addStrategySchema, body);
    if (!parsed.success) {
      return c.json({ error: "INVALID_SYMBOL_FORMAT" }, 400);
    }

    const symbol = parsed.output.symbol.toUpperCase();
    const db = getDb();

    // 1. Check if strategy already exists
    const existing = await db
      .select()
      .from(schema.strategies)
      .where(eq(schema.strategies.symbol, symbol))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: "STRATEGY_ALREADY_EXISTS" }, 400);
    }

    // 2. Validate token on Bybit Spot
    const client = createBybitPublicClient({
      baseUrl: "https://api.bybit.com",
    });
    try {
      const ticker = await client.getTicker(symbol);
      if (!ticker?.lastPrice) {
        return c.json({ error: "SYMBOL_NOT_FOUND_ON_EXCHANGE" }, 400);
      }
    } catch (_error) {
      return c.json({ error: "SYMBOL_NOT_FOUND_ON_EXCHANGE" }, 400);
    }

    // 3. Create default strategy
    const [newStrategy] = await db
      .insert(schema.strategies)
      .values({
        name: `${symbol} Dip Buying Strategy`,
        symbol,
        mode: "DRY_RUN",
        config: {
          thresholdPercent: 1.0,
          suggestedQuoteAmount: 20,
          maxDailySpendUsdt: 300,
          maxWeeklySpendUsdt: 1000,
          cooldownMinutes: 60,
        },
      })
      .returning();

    return c.json({ success: true, strategy: newStrategy });
  } catch (error: any) {
    console.error("Failed to add strategy:", error);
    return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
  }
});
