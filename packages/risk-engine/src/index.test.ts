import { describe, expect, it } from "vitest";
import {
  assertRiskApproved,
  createDefaultRiskGuard,
  evaluateRisk,
} from "./index.js";

const signal = {
  id: "sig",
  strategyId: "s1",
  symbol: "BTCUSDT",
  type: "BUY_SIGNAL" as const,
  reason: "ok",
  price: 100,
  dropPercent: 10,
  suggestedQuoteAmount: 20,
  createdAt: "now",
};

const liveStrategy = {
  id: "s1",
  name: "BTC dip",
  symbol: "BTCUSDT" as const,
  mode: "LIVE" as const,
  maxDailySpendUsdt: 20,
  maxWeeklySpendUsdt: 100,
  cooldownMinutes: 360,
};

describe("evaluateRisk", () => {
  it("rejects live trading by default", () => {
    const decision = evaluateRisk(signal, liveStrategy, {
      liveTradingEnabled: false,
      allowedSymbols: ["BTCUSDT"],
      dailySpentUsdt: 0,
      weeklySpentUsdt: 0,
    });

    expect(decision.status).toBe("REJECTED");
    expect(decision.reasonCodes).toContain("LIVE_TRADING_DISABLED");
  });

  it("keeps default guard in dry-run mode with auditable status", () => {
    expect(createDefaultRiskGuard().getStatus()).toEqual({
      liveTradingEnabled: false,
      mode: "DRY_RUN",
      allowedSymbols: ["BTCUSDT"],
      orderLikeActionsRequireApproval: true,
    });
  });

  it("throws before an order-like action when RiskGuard rejects it", () => {
    const decision = evaluateRisk(signal, liveStrategy, {
      liveTradingEnabled: false,
      allowedSymbols: ["BTCUSDT"],
      dailySpentUsdt: 0,
      weeklySpentUsdt: 0,
    });

    expect(() => assertRiskApproved(decision)).toThrow(
      "RiskGuard rejected order-like action",
    );
  });
});
