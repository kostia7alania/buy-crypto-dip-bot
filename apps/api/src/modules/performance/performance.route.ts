import { schema, withTenantContext } from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { compareToBenchmarks } from "@buy-crypto-dip-bot/strategy-engine";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb, type TenantDb } from "../../db.js";
import {
  type ProtectedApiEnv,
  requireProtectedApiContext,
} from "../auth/auth.middleware.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 200;

export const computePerformanceReport = async (
  db: TenantDb,
  tenantId: string,
) => {
  const completedBuys = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.tenantId, tenantId),
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

  const client = createBybitPublicClient({ baseUrl: "https://api.bybit.com" });
  const positions = [];
  for (const [symbol, acc] of bySymbol) {
    try {
      const currentPrice = (await client.getTicker(symbol)).lastPrice;
      const days = Math.min(
        MAX_DAYS,
        Math.max(1, Math.ceil((Date.now() - acc.firstMs) / DAY_MS)),
      );
      const closes = (
        await client.getKlines({ symbol, interval: "D", limit: days })
      ).map((candle) => candle.close);
      const benchmark = compareToBenchmarks({
        spentUsdt: acc.spent,
        actualQty: acc.qty,
        currentPrice,
        closes,
      });
      if (benchmark) {
        positions.push({
          symbol,
          orders: acc.n,
          spentUsdt: acc.spent,
          currentPrice,
          ...benchmark,
        });
      }
    } catch (error) {
      console.error(`Performance: data fetch failed for ${symbol}:`, error);
    }
  }

  positions.sort((a, b) => b.spentUsdt - a.spentUsdt);
  return { positions };
};

export const performanceRoutes = new Hono<ProtectedApiEnv>()
  .use("*", requireProtectedApiContext)
  .get("/", async (c) => {
    const actor = c.get("tenantActor");
    try {
      const report = await withTenantContext(getDb(), actor, (db) =>
        computePerformanceReport(db, actor.tenantId),
      );
      return c.json(report);
    } catch (error) {
      console.error("Failed to compute performance:", error);
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  });
