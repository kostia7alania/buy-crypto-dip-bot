import { schema } from "@buy-crypto-dip-bot/db";
import {
  type PnlPosition,
  type PnlReport,
  reportAssumptions,
} from "@buy-crypto-dip-bot/shared-types";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { logApiError } from "../../operational-log.js";
import {
  type AppEnv,
  requireTenantDb,
  requireUser,
} from "../auth/principal.middleware.js";
import {
  createReportMarketSnapshot,
  isFreshForReport,
  marketSource,
  reportStatus,
} from "../market-data/report-snapshot.js";

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
  market = createReportMarketSnapshot(),
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
    if (
      !Number.isFinite(spent) ||
      spent <= 0 ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new Error("PNL_INVALID_ORDER_ECONOMICS");
    }
    const acc = bySymbol.get(order.symbol) ?? { spent: 0, qty: 0, n: 0 };
    acc.spent += spent;
    acc.qty += spent / price;
    acc.n += 1;
    bySymbol.set(order.symbol, acc);
  }

  const positions: PnlPosition[] = [];
  for (const [symbol, acc] of bySymbol) {
    const { ticker, issue } = await market.getTicker(symbol);
    const currentPrice = ticker?.lastPrice ?? null;
    const currentValue = currentPrice === null ? null : acc.qty * currentPrice;
    const pnl = currentValue === null ? null : currentValue - acc.spent;
    positions.push({
      symbol,
      orders: acc.n,
      spentUsdt: acc.spent,
      baseQty: acc.qty,
      avgBuyPrice: acc.spent / acc.qty,
      currentPrice,
      currentValueUsdt: currentValue,
      pnlUsdt: pnl,
      pnlPercent: pnl === null ? null : (pnl / acc.spent) * 100,
      issue,
      quote: ticker ? marketSource(ticker, "BYBIT_SPOT_TICKER_V5") : null,
    });
  }

  positions.sort((a, b) => b.spentUsdt - a.spentUsdt);
  return finalizePnlReport(positions);
}

export function finalizePnlReport(
  collected: PnlPosition[],
  asOf = Date.now(),
): PnlReport {
  const positions = collected.map(
    (position): PnlPosition =>
      position.quote && !isFreshForReport(position.quote, asOf)
        ? {
            ...position,
            currentPrice: null,
            currentValueUsdt: null,
            pnlUsdt: null,
            pnlPercent: null,
            issue: "STALE_MARKET",
          }
        : position,
  );
  const totalSpent = positions.reduce((s, p) => s + p.spentUsdt, 0);
  const status = reportStatus(
    positions.length,
    positions.filter((p) => p.issue === null).length,
  );
  // Partial sums are not a portfolio valuation, even when some quotes exist.
  const totalValue = positions.reduce<number | null>(
    (sum, position) =>
      sum === null || position.currentValueUsdt === null
        ? null
        : sum + position.currentValueUsdt,
    0,
  );
  const totalPnl = totalValue === null ? null : totalValue - totalSpent;

  return {
    status,
    generatedAt: new Date(asOf).toISOString(),
    assumptions: reportAssumptions,
    positions,
    totals: {
      spentUsdt: totalSpent,
      currentValueUsdt: totalValue,
      pnlUsdt: totalPnl,
      pnlPercent:
        totalPnl === null
          ? null
          : totalSpent > 0
            ? (totalPnl / totalSpent) * 100
            : 0,
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
