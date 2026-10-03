import { schema } from "@buy-crypto-dip-bot/db";
import {
  type PerformancePosition,
  type PerformanceReport,
  reportAssumptions,
} from "@buy-crypto-dip-bot/shared-types";
import { compareToBenchmarks } from "@buy-crypto-dip-bot/strategy-engine";
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
  reportMarketIssue,
  reportStatus,
} from "../market-data/report-snapshot.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 200; // Bybit kline page size

// Daily-close illustrations use the same total capital, not matched cash flows.
// An incomplete historical window cannot establish a benchmark comparison.
export const computePerformanceReport = async (
  db: Pick<ReturnType<typeof requireTenantDb>, "select">,
  userId: string,
  market = createReportMarketSnapshot(),
): Promise<PerformanceReport> => {
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
    if (
      !Number.isFinite(spent) ||
      spent <= 0 ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new Error("PERFORMANCE_INVALID_ORDER_ECONOMICS");
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

  const positions: PerformancePosition[] = [];
  const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
  for (const [symbol, acc] of bySymbol) {
    const { ticker, issue } = await market.getTicker(symbol);
    const firstDay = Math.floor(acc.firstMs / DAY_MS) * DAY_MS;
    const days = (today - firstDay) / DAY_MS;
    const position: PerformancePosition = {
      symbol,
      orders: acc.n,
      spentUsdt: acc.spent,
      currentPrice: ticker?.lastPrice ?? null,
      actual: null,
      calendarDca: null,
      hold: null,
      issue,
      quote: ticker ? marketSource(ticker, "BYBIT_SPOT_TICKER_V5") : null,
      history: null,
      window: {
        requestedFrom: new Date(acc.firstMs).toISOString(),
        from: null,
        through: null,
        candles: 0,
      },
    };
    positions.push(position);
    if (!ticker) continue;
    if (days < 1 || days > MAX_DAYS) {
      position.issue = "INCOMPLETE_HISTORY";
      continue;
    }
    try {
      const snapshot = await market.getKlines({
        symbol,
        interval: "D",
        limit: days,
        end: today - 1,
      });
      position.history = marketSource(snapshot, "BYBIT_SPOT_KLINE_V5");
      const firstCandle = snapshot.candles[0];
      const lastCandle = snapshot.candles.at(-1);
      position.window = {
        requestedFrom: position.window.requestedFrom,
        from: firstCandle ? new Date(firstCandle.openTime).toISOString() : null,
        through: lastCandle
          ? new Date(lastCandle.openTime + DAY_MS).toISOString()
          : null,
        candles: snapshot.candles.length,
      };
      if (!isFreshForReport(snapshot) || !isFreshForReport(ticker)) {
        position.issue = "STALE_MARKET";
        continue;
      }
      if (
        snapshot.candles.length !== days ||
        snapshot.candles.some(
          (candle, index) =>
            candle.openTime !== firstDay + index * DAY_MS ||
            !Number.isFinite(candle.close) ||
            candle.close <= 0,
        )
      ) {
        position.issue = "INCOMPLETE_HISTORY";
        continue;
      }
      const benchmark = compareToBenchmarks({
        spentUsdt: acc.spent,
        actualQty: acc.qty,
        currentPrice: ticker.lastPrice,
        closes: snapshot.candles.map((candle) => candle.close),
      });
      if (!benchmark) {
        position.issue = "INCOMPLETE_HISTORY";
        continue;
      }
      Object.assign(position, benchmark);
    } catch (error) {
      logApiError("PERFORMANCE_MARKET_FETCH_FAILED", error);
      position.issue = reportMarketIssue(error);
    }
  }

  positions.sort((a, b) => b.spentUsdt - a.spentUsdt);
  return finalizePerformanceReport(positions);
};

export const finalizePerformanceReport = (
  collected: PerformancePosition[],
  asOf = Date.now(),
): PerformanceReport => {
  const positions = collected.map((position): PerformancePosition => {
    const staleQuote =
      position.quote !== null && !isFreshForReport(position.quote, asOf);
    const staleHistory =
      position.history !== null && !isFreshForReport(position.history, asOf);
    if (!staleQuote && !staleHistory) return position;
    return {
      ...position,
      currentPrice: staleQuote ? null : position.currentPrice,
      actual: null,
      calendarDca: null,
      hold: null,
      issue: "STALE_MARKET",
    };
  });
  return {
    status: reportStatus(
      positions.length,
      positions.filter((p) => p.issue === null).length,
    ),
    generatedAt: new Date(asOf).toISOString(),
    assumptions: reportAssumptions,
    method: "DAILY_CLOSE_EQUAL_CAPITAL_V1",
    positions,
  };
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
