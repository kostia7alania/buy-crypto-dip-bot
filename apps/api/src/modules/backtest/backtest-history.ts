import type {
  Candle,
  MarketDataFreshness,
} from "@buy-crypto-dip-bot/exchange-core";

const HOUR_MS = 60 * 60 * 1000;
const WARMUP_CANDLES = 24;

export type HistorySource = Pick<
  MarketDataFreshness,
  "sourceAt" | "receivedAt"
>;

export interface BacktestHistory {
  status: "COMPLETE" | "INCOMPLETE";
  issues: (
    | "SHORT_HISTORY"
    | "MISSING_HOURS"
    | "INVALID_CANDLES"
    | "IRREGULAR_TIMESTAMPS"
    | "UNCONFIRMED_CLOSE"
    | "STALE_HISTORY"
    | "UNKNOWN_SOURCE_TIME"
  )[];
  expectedCandles: number;
  receivedCandles: number;
  warmupCandles: number;
  replayCandles: number;
  inputStartAt: number | null;
  inputEndAt: number | null;
  replayStartAt: number | null;
  replayEndAt: number | null;
  missingHours: number;
  unconfirmedCandles: number;
}

const validTime = (time: number) =>
  Number.isSafeInteger(time) && time > 0 && time <= 8.64e15 - HOUR_MS;

export const describeBacktestHistory = (
  candles: Candle[],
  days: number,
  sources: HistorySource[],
): BacktestHistory => {
  const issues: BacktestHistory["issues"] = [];
  const expectedCandles = Math.trunc(days * 24 + 25);
  // Use the original page clocks, never the cache-read time. An open candle
  // does not acquire a final close merely because time passed in the cache.
  const observedAt = sources.length
    ? Math.min(
        ...sources.flatMap((source) => [
          Date.parse(source.sourceAt),
          Date.parse(source.receivedAt),
        ]),
      )
    : Number.NaN;
  const knownSourceTime = Number.isFinite(observedAt) && observedAt > 0;
  let missingHours = 0;
  let unconfirmedCandles = 0;
  let invalidCandles = false;
  let irregularTimestamps = false;

  for (const [index, candle] of candles.entries()) {
    if (
      ![candle.open, candle.high, candle.low, candle.close].every(
        (price) => Number.isFinite(price) && price > 0,
      ) ||
      candle.high < Math.max(candle.open, candle.low, candle.close) ||
      candle.low > Math.min(candle.open, candle.high, candle.close)
    ) {
      invalidCandles = true;
    }
    if (!validTime(candle.openTime) || candle.openTime % HOUR_MS !== 0) {
      irregularTimestamps = true;
    }
    const previous = candles[index - 1];
    if (previous) {
      const delta = candle.openTime - previous.openTime;
      if (delta <= 0 || delta % HOUR_MS !== 0) irregularTimestamps = true;
      else missingHours += delta / HOUR_MS - 1;
    }
    if (
      !knownSourceTime ||
      !validTime(candle.openTime) ||
      candle.openTime + HOUR_MS > observedAt
    ) {
      unconfirmedCandles++;
    }
  }

  const at = (index: number): number | null => {
    const time = candles[index]?.openTime;
    return time !== undefined && validTime(time) ? time : null;
  };
  const lastAt = at(candles.length - 1);
  if (candles.length < expectedCandles) issues.push("SHORT_HISTORY");
  if (missingHours > 0) issues.push("MISSING_HOURS");
  if (invalidCandles) issues.push("INVALID_CANDLES");
  if (irregularTimestamps) issues.push("IRREGULAR_TIMESTAMPS");
  if (!knownSourceTime) issues.push("UNKNOWN_SOURCE_TIME");
  if (unconfirmedCandles > 0) issues.push("UNCONFIRMED_CLOSE");
  if (
    knownSourceTime &&
    lastAt !== null &&
    lastAt < Math.floor(observedAt / HOUR_MS) * HOUR_MS - HOUR_MS
  ) {
    issues.push("STALE_HISTORY");
  }

  return {
    status: issues.length ? "INCOMPLETE" : "COMPLETE",
    issues,
    expectedCandles,
    receivedCandles: candles.length,
    warmupCandles: Math.min(WARMUP_CANDLES, candles.length),
    replayCandles: Math.max(0, candles.length - WARMUP_CANDLES),
    inputStartAt: at(0),
    inputEndAt: lastAt,
    replayStartAt: at(WARMUP_CANDLES),
    replayEndAt: candles.length > WARMUP_CANDLES ? lastAt : null,
    missingHours,
    unconfirmedCandles,
  };
};
