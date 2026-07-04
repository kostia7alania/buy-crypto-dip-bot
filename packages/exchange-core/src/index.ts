export interface MarketTicker {
  symbol: string;
  lastPrice: number;
  high24h?: number;
  low24h?: number;
  receivedAt: string;
}
export interface ExchangeMarketDataPort {
  getTicker(symbol: string): Promise<MarketTicker>;
}
export interface ExchangeTradingPort {
  createSpotOrder(): Promise<never>;
}
