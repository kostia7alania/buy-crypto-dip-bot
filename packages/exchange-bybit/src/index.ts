import type {
  Candle,
  ExchangeMarketDataPort,
  KlineQuery,
  KlineSnapshot,
  MarketTicker,
} from "@buy-crypto-dip-bot/exchange-core";
import * as v from "valibot";

const DEFAULT_MARKET_DATA_TTL_MS = 30_000;
const MAX_FUTURE_SKEW_MS = 5_000;
const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const INTEGER_PATTERN = /^(?:0|[1-9]\d*)$/;

const responseEnvelopeSchema = v.object({
  retCode: v.number(),
  retMsg: v.string(),
  time: v.pipe(v.number(), v.integer(), v.minValue(1)),
});

const tickerResponseSchema = v.object({
  retCode: v.number(),
  retMsg: v.string(),
  time: v.pipe(v.number(), v.integer(), v.minValue(1)),
  result: v.object({
    category: v.literal("spot"),
    list: v.array(
      v.object({
        symbol: v.string(),
        lastPrice: v.string(),
        highPrice24h: v.string(),
        lowPrice24h: v.string(),
      }),
    ),
  }),
});

const klineResponseSchema = v.object({
  retCode: v.number(),
  retMsg: v.string(),
  time: v.pipe(v.number(), v.integer(), v.minValue(1)),
  result: v.object({
    category: v.literal("spot"),
    symbol: v.string(),
    list: v.array(v.array(v.string())),
  }),
});

export type BybitPublicDataErrorCode =
  | "HTTP_STATUS"
  | "INVALID_JSON"
  | "INVALID_RESPONSE"
  | "UPSTREAM_REJECTED"
  | "EMPTY_RESULT"
  | "SYMBOL_MISMATCH"
  | "INVALID_NUMBER"
  | "INVALID_CANDLE"
  | "TRANSPORT_ERROR"
  | "FUTURE_RESPONSE"
  | "STALE_RESPONSE";

export class BybitPublicDataError extends Error {
  readonly code: BybitPublicDataErrorCode;

  constructor(code: BybitPublicDataErrorCode) {
    super(`BYBIT_PUBLIC_DATA_${code}`);
    this.name = "BybitPublicDataError";
    this.code = code;
  }
}

export interface BybitPublicClientOptions {
  baseUrl: string;
  marketDataTtlMs?: number;
  fetchFn?: typeof globalThis.fetch;
  now?: () => number;
}

const positiveDecimal = (value: string): number => {
  if (!DECIMAL_PATTERN.test(value)) {
    throw new BybitPublicDataError("INVALID_NUMBER");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BybitPublicDataError("INVALID_NUMBER");
  }
  return parsed;
};

const positiveInteger = (value: string): number => {
  if (!INTEGER_PATTERN.test(value)) {
    throw new BybitPublicDataError("INVALID_NUMBER");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new BybitPublicDataError("INVALID_NUMBER");
  }
  return parsed;
};

const responseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    throw new BybitPublicDataError("INVALID_JSON");
  }
};

const request = async (
  fetchFn: typeof globalThis.fetch,
  url: URL,
): Promise<Response> => {
  try {
    return await fetchFn(url);
  } catch {
    throw new BybitPublicDataError("TRANSPORT_ERROR");
  }
};

const freshness = (sourceTime: number, receivedTime: number, ttlMs: number) => {
  if (sourceTime > receivedTime + MAX_FUTURE_SKEW_MS) {
    throw new BybitPublicDataError("FUTURE_RESPONSE");
  }
  const ageMs = Math.max(0, receivedTime - sourceTime);
  if (ageMs > ttlMs) {
    throw new BybitPublicDataError("STALE_RESPONSE");
  }
  return {
    sourceAt: new Date(sourceTime).toISOString(),
    receivedAt: new Date(receivedTime).toISOString(),
    ageMs,
    ttlMs,
  };
};

export const createBybitPublicClient = (
  options: BybitPublicClientOptions,
): ExchangeMarketDataPort => {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const ttlMs = options.marketDataTtlMs ?? DEFAULT_MARKET_DATA_TTL_MS;
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new BybitPublicDataError("INVALID_NUMBER");
  }

  return {
    async getTicker(symbol: string): Promise<MarketTicker> {
      const url = new URL("/v5/market/tickers", options.baseUrl);
      url.searchParams.set("category", "spot");
      url.searchParams.set("symbol", symbol);
      const response = await request(fetchFn, url);
      if (!response.ok) throw new BybitPublicDataError("HTTP_STATUS");
      const body = await responseJson(response);
      const envelope = v.safeParse(responseEnvelopeSchema, body);
      if (!envelope.success) {
        throw new BybitPublicDataError("INVALID_RESPONSE");
      }
      if (envelope.output.retCode !== 0) {
        throw new BybitPublicDataError("UPSTREAM_REJECTED");
      }
      const parsed = v.safeParse(tickerResponseSchema, body);
      if (!parsed.success) {
        throw new BybitPublicDataError("INVALID_RESPONSE");
      }
      const item = parsed.output.result.list[0];
      if (!item) throw new BybitPublicDataError("EMPTY_RESULT");
      if (item.symbol !== symbol) {
        throw new BybitPublicDataError("SYMBOL_MISMATCH");
      }
      const receivedTime = now();
      const lastPrice = positiveDecimal(item.lastPrice);
      const high24h = positiveDecimal(item.highPrice24h);
      const low24h = positiveDecimal(item.lowPrice24h);
      if (high24h < lastPrice || low24h > lastPrice || low24h > high24h) {
        throw new BybitPublicDataError("INVALID_RESPONSE");
      }
      return {
        symbol: item.symbol,
        lastPrice,
        high24h,
        low24h,
        ...freshness(parsed.output.time, receivedTime, ttlMs),
      };
    },

    async getKlines(query: KlineQuery): Promise<KlineSnapshot> {
      const url = new URL("/v5/market/kline", options.baseUrl);
      url.searchParams.set("category", "spot");
      url.searchParams.set("symbol", query.symbol);
      url.searchParams.set("interval", query.interval);
      url.searchParams.set("limit", String(query.limit ?? 200));
      if (query.end !== undefined) {
        url.searchParams.set("end", String(query.end));
      }
      const response = await request(fetchFn, url);
      if (!response.ok) throw new BybitPublicDataError("HTTP_STATUS");
      const body = await responseJson(response);
      const envelope = v.safeParse(responseEnvelopeSchema, body);
      if (!envelope.success) {
        throw new BybitPublicDataError("INVALID_RESPONSE");
      }
      if (envelope.output.retCode !== 0) {
        throw new BybitPublicDataError("UPSTREAM_REJECTED");
      }
      const parsed = v.safeParse(klineResponseSchema, body);
      if (!parsed.success) {
        throw new BybitPublicDataError("INVALID_RESPONSE");
      }
      if (parsed.output.result.symbol !== query.symbol) {
        throw new BybitPublicDataError("SYMBOL_MISMATCH");
      }
      const snapshotFreshness = freshness(parsed.output.time, now(), ttlMs);

      const candles = parsed.output.result.list.map((row): Candle => {
        if (row.length < 5) {
          throw new BybitPublicDataError("INVALID_RESPONSE");
        }
        const openTime = positiveInteger(row[0] as string);
        if (
          openTime > parsed.output.time + MAX_FUTURE_SKEW_MS ||
          (query.end !== undefined && openTime > query.end)
        ) {
          throw new BybitPublicDataError("INVALID_CANDLE");
        }
        const open = positiveDecimal(row[1] as string);
        const high = positiveDecimal(row[2] as string);
        const low = positiveDecimal(row[3] as string);
        const close = positiveDecimal(row[4] as string);
        if (
          high < Math.max(open, low, close) ||
          low > Math.min(open, high, close)
        ) {
          throw new BybitPublicDataError("INVALID_CANDLE");
        }
        return { openTime, open, high, low, close };
      });

      candles.sort((left, right) => left.openTime - right.openTime);
      for (let index = 1; index < candles.length; index += 1) {
        if (candles[index]?.openTime === candles[index - 1]?.openTime) {
          throw new BybitPublicDataError("INVALID_CANDLE");
        }
      }
      return { candles, ...snapshotFreshness };
    },
  };
};
