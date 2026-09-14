import { schema } from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { logApiError } from "../../operational-log.js";
import {
  type AppEnv,
  requireTenantDb,
  requireUser,
} from "../auth/principal.middleware.js";

export interface SymbolPnl {
  symbol: string;
  orders: number;
  spentUsdt: number;
  baseQty: number;
  avgBuyPrice: number;
  currentPrice: number;
  currentValueUsdt: number;
  pnlUsdt: number;
  pnlPercent: number;
}

export interface PnlReport {
  positions: SymbolPnl[];
  totals: {
    spentUsdt: number;
    currentValueUsdt: number;
    pnlUsdt: number;
    pnlPercent: number;
  };
}

type Db = Pick<ReturnType<typeof requireTenantDb>, "select">;

// Unrealized PnL of the simulated portfolio: what the dry-run purchases
// would be worth right now. Shared by the /pnl route and the daily digest.
//
// `userId` is mandatory and has no default on purpose. A financial aggregate
// with an optional owner is one forgotten argument away from showing one user
// another user's portfolio, so every caller has to say whose money this is.
export async function computePnlReport(
  db: Db,
  userId: string,
): Promise<PnlReport> {
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

  const bySymbol = new Map<string, { spent: number; qty: number; n: number }>();
  for (const order of completedBuys) {
    const spent = Number(order.quoteAmount);
    const price = Number(order.price);
    if (!Number.isFinite(spent) || !Number.isFinite(price) || price <= 0) {
      continue;
    }
    const acc = bySymbol.get(order.symbol) ?? { spent: 0, qty: 0, n: 0 };
    acc.spent += spent;
    acc.qty += spent / price;
    acc.n += 1;
    bySymbol.set(order.symbol, acc);
  }

  const client = createBybitPublicClient({
    baseUrl: "https://api.bybit.com",
  });

  const positions: SymbolPnl[] = [];
  for (const [symbol, acc] of bySymbol) {
    let currentPrice = 0;
    try {
      currentPrice = (await client.getTicker(symbol)).lastPrice;
    } catch (error) {
      logApiError("PNL_TICKER_FETCH_FAILED", error);
      continue;
    }
    const currentValue = acc.qty * currentPrice;
    positions.push({
      symbol,
      orders: acc.n,
      spentUsdt: acc.spent,
      baseQty: acc.qty,
      avgBuyPrice: acc.spent / acc.qty,
      currentPrice,
      currentValueUsdt: currentValue,
      pnlUsdt: currentValue - acc.spent,
      pnlPercent:
        acc.spent > 0 ? ((currentValue - acc.spent) / acc.spent) * 100 : 0,
    });
  }

  positions.sort((a, b) => b.spentUsdt - a.spentUsdt);

  const totalSpent = positions.reduce((s, p) => s + p.spentUsdt, 0);
  const totalValue = positions.reduce((s, p) => s + p.currentValueUsdt, 0);

  return {
    positions,
    totals: {
      spentUsdt: totalSpent,
      currentValueUsdt: totalValue,
      pnlUsdt: totalValue - totalSpent,
      pnlPercent:
        totalSpent > 0 ? ((totalValue - totalSpent) / totalSpent) * 100 : 0,
    },
  };
}

export const pnlRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const user = requireUser(c);
  try {
    return c.json(await computePnlReport(requireTenantDb(c), user.userId));
  } catch (error) {
    logApiError("PNL_COMPUTE_FAILED", error, c.get("correlationId"));
    return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
  }
});
