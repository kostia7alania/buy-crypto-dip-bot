export type BybitTicker = {
  symbol: string;
  lastPrice: string;
  highPrice24h: string;
  lowPrice24h: string;
};

export type BybitPublicClient = {
  getTicker(symbol: string): Promise<BybitTicker>;
};

export function createBybitPublicClient(): BybitPublicClient {
  return {
    async getTicker(symbol: string) {
      const url = new URL('https://api.bybit.com/v5/market/tickers');
      url.searchParams.set('category', 'spot');
      url.searchParams.set('symbol', symbol);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Bybit public ticker request failed: ${response.status}`);
      }

      const json = (await response.json()) as { result?: { list?: BybitTicker[] } };
      const ticker = json.result?.list?.[0];
      if (!ticker) {
        throw new Error(`Ticker not found for ${symbol}`);
      }

      return ticker;
    },
  };
}
