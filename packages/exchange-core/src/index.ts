export interface MarketTicker {
  symbol: string;
  lastPrice: number;
  high24h?: number;
  low24h?: number;
  receivedAt: string;
}
export interface Candle {
  openTime: number; // ms epoch
  open: number;
  high: number;
  low: number;
  close: number;
}
export interface KlineQuery {
  symbol: string;
  interval: string; // exchange-native, e.g. "D" for daily on Bybit
  limit?: number;
  // Only candles opening at or before this ms timestamp — the cursor for
  // paginating further back in history.
  end?: number;
}
export interface ExchangeMarketDataPort {
  getTicker(symbol: string): Promise<MarketTicker>;
  getKlines(query: KlineQuery): Promise<Candle[]>;
}
export interface ExchangeTradingPort {
  createSpotOrder(): Promise<never>;
}
