import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import type {
  ExchangeMarketDataPort,
  MarketDataFreshness,
  MarketTicker,
} from "@buy-crypto-dip-bot/exchange-core";
import type {
  ReportIssue,
  ReportMarketSource,
  ReportStatus,
} from "@buy-crypto-dip-bot/shared-types";

export const reportStatus = (total: number, available: number): ReportStatus =>
  total === 0
    ? "EMPTY"
    : available === total
      ? "COMPLETE"
      : available === 0
        ? "UNAVAILABLE"
        : "PARTIAL";

export const marketSource = (
  snapshot: MarketDataFreshness,
  source: ReportMarketSource["source"],
): ReportMarketSource => ({
  source,
  sourceAt: snapshot.sourceAt,
  receivedAt: snapshot.receivedAt,
  ttlMs: snapshot.ttlMs,
});

export const isFreshForReport = (
  snapshot: Pick<MarketDataFreshness, "sourceAt" | "ttlMs">,
  asOf = Date.now(),
): boolean => {
  const age = asOf - Date.parse(snapshot.sourceAt);
  return (
    Number.isFinite(age) &&
    Number.isFinite(snapshot.ttlMs) &&
    snapshot.ttlMs > 0 &&
    age <= snapshot.ttlMs &&
    age >= -5_000
  );
};

export const reportMarketIssue = (error: unknown): ReportIssue =>
  error instanceof Error && "code" in error && error.code === "STALE_RESPONSE"
    ? "STALE_MARKET"
    : "MARKET_UNAVAILABLE";

type QuoteResult =
  | { ticker: MarketTicker; issue: null }
  | { ticker: null; issue: ReportIssue };

// Request-owned promises share both successful quotes and provider failures.
export const createReportMarketSnapshot = (
  client: ExchangeMarketDataPort = createBybitPublicClient({
    baseUrl: "https://api.bybit.com",
  }),
) => {
  const tickers = new Map<string, Promise<MarketTicker>>();
  return {
    async getTicker(symbol: string): Promise<QuoteResult> {
      try {
        let pending = tickers.get(symbol);
        if (!pending) {
          pending = client.getTicker(symbol);
          tickers.set(symbol, pending);
        }
        const ticker = await pending;
        if (!isFreshForReport(ticker)) {
          return { ticker: null, issue: "STALE_MARKET" };
        }
        return { ticker, issue: null };
      } catch (error) {
        return { ticker: null, issue: reportMarketIssue(error) };
      }
    },
    getKlines: client.getKlines.bind(client),
  };
};
