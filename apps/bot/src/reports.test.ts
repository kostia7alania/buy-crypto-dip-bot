import {
  type PerformanceReport,
  type PnlReport,
  reportAssumptions,
} from "@buy-crypto-dip-bot/shared-types";
import { describe, expect, it } from "vitest";
import {
  renderLatestRiskDecision,
  renderPerformanceReport,
  renderPnlReport,
  renderStrategyBudgetReport,
} from "./reports.js";

describe("incomplete Telegram reports", () => {
  it("renders unknown PnL without dropping holdings, coercing null to zero or claiming an empty portfolio", () => {
    const report: PnlReport = {
      status: "UNAVAILABLE",
      generatedAt: "2026-10-02T00:00:00Z",
      assumptions: reportAssumptions,
      totals: {
        spentUsdt: 100,
        currentValueUsdt: null,
        pnlUsdt: null,
        pnlPercent: null,
      },
      positions: [
        {
          symbol: "BTCUSDT",
          orders: 1,
          spentUsdt: 100,
          baseQty: 1,
          avgBuyPrice: 100,
          currentPrice: null,
          currentValueUsdt: null,
          pnlUsdt: null,
          pnlPercent: null,
          issue: "MARKET_UNAVAILABLE",
          quote: null,
        },
      ],
    };
    const text = renderPnlReport(report);
    expect(text).toContain("Total recorded spend: 100.00 USDT");
    expect(text).toContain("Total PnL is unavailable");
    expect(text).toContain("BTCUSDT");
    expect(text).toContain("Average buy price: $100.00");
    expect(text).toContain("Quoted price: unavailable");
    expect(text).toContain("DRY_RUN. Fees and slippage are not modelled.");
    expect(text).not.toMatch(/No simulated|\+0\.00|NaN|null/);
  });

  it("does not announce a winning or empty strategy when the benchmark is unavailable", () => {
    const report: PerformanceReport = {
      status: "UNAVAILABLE",
      generatedAt: "2026-10-02T00:00:00Z",
      assumptions: reportAssumptions,
      method: "DAILY_CLOSE_EQUAL_CAPITAL_V1",
      positions: [
        {
          symbol: "ETHUSDT",
          orders: 1,
          spentUsdt: 100,
          currentPrice: null,
          actual: null,
          calendarDca: null,
          hold: null,
          issue: "STALE_MARKET",
          quote: null,
          history: null,
          window: {
            requestedFrom: "2026-10-01T00:00:00Z",
            from: null,
            through: null,
            candles: 0,
          },
        },
      ],
    };
    const text = renderPerformanceReport(report);
    expect(text).toContain("ETHUSDT");
    expect(text).toContain("Not comparable: stale market data");
    expect(text).toContain("Recorded spend: 100.00 USDT");
    expect(text).not.toMatch(/No simulated|won|\+0\.00|NaN/);
  });
});

describe("simulation evidence formatting", () => {
  it("keeps budget replies within Telegram's message limit", () => {
    const messages = renderStrategyBudgetReport({
      asOf: "2026-11-18T10:00:23.000Z",
      strategies: Array.from({ length: 70 }, (_, index) => ({
        strategyId: String(index),
        symbol: `PAIR<${index}>`,
        dailyRemainingUsdt: 40,
        weeklyRemainingUsdt: 100,
        activeReservedUsdt: 20,
      })),
    });
    expect(messages.length).toBeGreaterThan(1);
    for (const message of messages) {
      expect(message.length).toBeLessThanOrEqual(4096);
      expect(message).toContain("As of 2026-11-18 10:00:23 UTC");
    }
    expect(messages.join("\n")).toContain("PAIR&lt;69&gt;");
  });

  it("preserves unknown pair and reason without implying a completed buy", () => {
    const base = {
      createdAt: "2026-11-18T10:00:23.000Z",
      symbol: null,
      reasonCodes: [],
    };
    expect(
      renderLatestRiskDecision({
        decision: { type: "RISK_DECISION_APPROVED", ...base },
      }),
    ).toContain("Approved a simulated buy — Pair unavailable");
    expect(
      renderLatestRiskDecision({
        decision: { type: "RISK_DECISION_REJECTED", ...base },
      }),
    ).toContain("Reason unavailable in the record.");
  });
});
