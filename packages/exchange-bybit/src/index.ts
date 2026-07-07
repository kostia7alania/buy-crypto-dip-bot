import type {
  Candle,
  ExchangeMarketDataPort,
  KlineQuery,
  MarketTicker,
} from "@buy-crypto-dip-bot/exchange-core";
export interface BybitPublicClientOptions {
  baseUrl: string;
}
export const createBybitPublicClient = (
  options: BybitPublicClientOptions,
): ExchangeMarketDataPort => ({
  async getTicker(symbol: string): Promise<MarketTicker> {
    const url = new URL("/v5/market/tickers", options.baseUrl);
    url.searchParams.set("category", "spot");
    url.searchParams.set("symbol", symbol);
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Bybit ticker request failed: ${response.status}`);
    const data = (await response.json()) as {
      result?: {
        list?: Array<{
          symbol: string;
          lastPrice: string;
          highPrice24h?: string;
          lowPrice24h?: string;
        }>;
      };
    };
    const item = data.result?.list?.[0];
    if (!item) throw new Error(`Bybit ticker not found for ${symbol}`);
    return {
      symbol: item.symbol,
      lastPrice: Number(item.lastPrice),
      high24h: Number(item.highPrice24h),
      low24h: Number(item.lowPrice24h),
      receivedAt: new Date().toISOString(),
    };
  },

  async getKlines(query: KlineQuery): Promise<Candle[]> {
    const url = new URL("/v5/market/kline", options.baseUrl);
    url.searchParams.set("category", "spot");
    url.searchParams.set("symbol", query.symbol);
    url.searchParams.set("interval", query.interval);
    url.searchParams.set("limit", String(query.limit ?? 200));
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Bybit kline request failed: ${response.status}`);
    const data = (await response.json()) as {
      // Each row: [startTime, open, high, low, close, volume, turnover]
      result?: { list?: string[][] };
    };
    const list = data.result?.list ?? [];
    // Bybit returns newest-first; return chronological order.
    return list
      .map((row) => ({
        openTime: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
      }))
      .reverse();
  },
});
