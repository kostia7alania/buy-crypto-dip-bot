import { schema } from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { compareToBenchmarks } from "@buy-crypto-dip-bot/strategy-engine";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../../db.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 200; // Bybit kline page size

// Compares actual dip-buying against naive calendar-DCA and buy-and-hold
// baselines over the same window and capital — the core "is buying the dip
// actually working?" answer.
export const performanceRoutes = new Hono().get("/", async (c) => {
  try {
    const db = getDb();
    const completedBuys = await db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.status, "COMPLETED"),
          eq(schema.orders.side, "BUY"),
        ),
      );

    const bySymbol = new Map<
      string,
      { spent: number; qty: number; n: number; firstMs: number }
    >();
    for (const order of completedBuys) {
      const spent = Number(order.quoteAmount);
      const price = Number(order.price);
      if (!Number.isFinite(spent) || !Number.isFinite(price) || price <= 0) {
        continue;
      }
      const acc = bySymbol.get(order.symbol) ?? {
        spent: 0,
        qty: 0,
        n: 0,
        firstMs: Date.now(),
      };
      acc.spent += spent;
      acc.qty += spent / price;
      acc.n += 1;
      acc.firstMs = Math.min(acc.firstMs, new Date(order.createdAt).getTime());
      bySymbol.set(order.symbol, acc);
    }

    const client = createBybitPublicClient({
      baseUrl: "https://api.bybit.com",
    });

    const positions = [];
    for (const [symbol, acc] of bySymbol) {
      let currentPrice = 0;
      let closes: number[] = [];
      try {
        currentPrice = (await client.getTicker(symbol)).lastPrice;
        const days = Math.min(
          MAX_DAYS,
          Math.max(1, Math.ceil((Date.now() - acc.firstMs) / DAY_MS)),
        );
        const candles = await client.getKlines({
          symbol,
          interval: "D",
          limit: days,
        });
        closes = candles.map((k) => k.close);
      } catch (error) {
        console.error(`Performance: data fetch failed for ${symbol}:`, error);
        continue;
      }

      const benchmark = compareToBenchmarks({
        spentUsdt: acc.spent,
        actualQty: acc.qty,
        currentPrice,
        closes,
      });
      if (!benchmark) continue;

      positions.push({
        symbol,
        orders: acc.n,
        spentUsdt: acc.spent,
        currentPrice,
        ...benchmark,
      });
    }

    positions.sort((a, b) => b.spentUsdt - a.spentUsdt);
    return c.json({ positions });
  } catch (error) {
    console.error("Failed to compute performance:", error);
    return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
  }
});
