import { schema } from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { compareToBenchmarks } from "@buy-crypto-dip-bot/strategy-engine";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { logApiError } from "../../operational-log.js";
import {
  type AppEnv,
  requireTenantDb,
  requireUser,
} from "../auth/principal.middleware.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 200; // Bybit kline page size

// Compares actual dip-buying against naive calendar-DCA and buy-and-hold
// baselines over the same window and capital — the core "is buying the dip
// actually working?" answer. Always scoped to the caller: a benchmark computed
// over everyone's orders would be nobody's real result.
export const computePerformanceReport = async (
  db: Pick<ReturnType<typeof requireTenantDb>, "select">,
  userId: string,
) => {
  const completedBuys = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.userId, userId),
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
      const snapshot = await client.getKlines({
        symbol,
        interval: "D",
        limit: days,
      });
      closes = snapshot.candles.map((k) => k.close);
    } catch (error) {
      logApiError("PERFORMANCE_MARKET_FETCH_FAILED", error);
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
  return { positions };
};

export const performanceRoutes = new Hono<AppEnv>().get("/", async (c) => {
  try {
    return c.json(
      await computePerformanceReport(requireTenantDb(c), requireUser(c).userId),
    );
  } catch (error) {
    logApiError("PERFORMANCE_COMPUTE_FAILED", error, c.get("correlationId"));
    return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
  }
});
