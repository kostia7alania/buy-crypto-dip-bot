import { describe, expect, it } from "vitest";
import { evaluateDipStrategy } from "./index.js";

const strategy = {
  id: "s1",
  name: "BTC dip",
  symbol: "BTCUSDT" as const,
  mode: "DRY_RUN" as const,
  maxDailySpendUsdt: 20,
  maxWeeklySpendUsdt: 100,
  cooldownMinutes: 360,
};

describe("evaluateDipStrategy", () => {
  it("creates buy signal when threshold is met", () => {
    const signal = evaluateDipStrategy({
      strategy,
      currentPrice: 90,
      high24h: 100,
      thresholdPercent: 10,
      suggestedQuoteAmount: 20,
      now: "2026-01-01T00:00:00Z",
    });

    expect(signal).toMatchObject({
      id: "signal-2026-01-01T00:00:00Z",
      type: "BUY_SIGNAL",
      dropPercent: 10,
      suggestedQuoteAmount: 20,
    });
  });

  it("creates deterministic no-signal placeholder below threshold", () => {
    const signal = evaluateDipStrategy({
      strategy,
      currentPrice: 96,
      high24h: 100,
      thresholdPercent: 10,
      suggestedQuoteAmount: 20,
      now: "2026-01-01T00:00:00Z",
    });

    expect(signal).toMatchObject({
      id: "signal-2026-01-01T00:00:00Z",
      type: "NO_SIGNAL",
      reason: "DROP_FROM_24H_HIGH_THRESHOLD_NOT_MET",
      suggestedQuoteAmount: 0,
    });
  });

  it("rejects invalid market input before creating a signal", () => {
    expect(() =>
      evaluateDipStrategy({
        strategy,
        currentPrice: 90,
        high24h: 0,
        thresholdPercent: 10,
        suggestedQuoteAmount: 20,
        now: "2026-01-01T00:00:00Z",
      }),
    ).toThrow("HIGH_24H_MUST_BE_POSITIVE");
  });
});
