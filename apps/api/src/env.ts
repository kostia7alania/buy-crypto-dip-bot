import * as v from 'valibot';

const EnvSchema = v.object({
  API_PORT: v.optional(v.pipe(v.string(), v.transform(Number)), '8787'),
  API_HOST: v.optional(v.string(), '127.0.0.1'),
  LIVE_TRADING_ENABLED: v.optional(v.picklist(['true', 'false']), 'false'),
  ALLOWLIST_SYMBOLS: v.optional(v.string(), 'BTCUSDT'),
  MAX_DAILY_SPEND_USDT: v.optional(v.pipe(v.string(), v.transform(Number)), '20'),
  MAX_WEEKLY_SPEND_USDT: v.optional(v.pipe(v.string(), v.transform(Number)), '100'),
});

export type ApiEnv = v.InferOutput<typeof EnvSchema> & {
  allowlistSymbols: string[];
  liveTradingEnabled: boolean;
};

export function readApiEnv(source: NodeJS.ProcessEnv): ApiEnv {
  const parsed = v.parse(EnvSchema, source);
  return {
    ...parsed,
    allowlistSymbols: parsed.ALLOWLIST_SYMBOLS.split(',').map((symbol) => symbol.trim()).filter(Boolean),
    liveTradingEnabled: parsed.LIVE_TRADING_ENABLED === 'true',
  };
}
