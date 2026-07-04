import type {
  RiskDecision,
  Signal,
  StrategyConfig,
} from "@buy-crypto-dip-bot/shared-types";

export interface RiskGuardContext {
  liveTradingEnabled: boolean;
  allowedSymbols: readonly string[];
  dailySpentUsdt: number;
  weeklySpentUsdt: number;
}

export interface RiskGuardStatus {
  liveTradingEnabled: false;
  mode: "DRY_RUN";
  allowedSymbols: readonly ["BTCUSDT"];
  orderLikeActionsRequireApproval: true;
}

export const createDefaultRiskGuard = () => ({
  getStatus: (): RiskGuardStatus => ({
    liveTradingEnabled: false,
    mode: "DRY_RUN",
    allowedSymbols: ["BTCUSDT"],
    orderLikeActionsRequireApproval: true,
  }),
  evaluate: (
    signal: Signal,
    strategy: StrategyConfig,
    context: RiskGuardContext,
  ): RiskDecision => evaluateRisk(signal, strategy, context),
  assertApproved: assertRiskApproved,
});

export const assertRiskApproved = (decision: RiskDecision): void => {
  if (decision.status === "REJECTED") {
    throw new Error(
      `RiskGuard rejected order-like action: ${decision.reasonCodes.join(",")}`,
    );
  }
};

export const evaluateRisk = (
  signal: Signal,
  strategy: StrategyConfig,
  context: RiskGuardContext,
): RiskDecision => {
  const reasonCodes: string[] = [];

  if (strategy.mode === "LIVE" && !context.liveTradingEnabled) {
    reasonCodes.push("LIVE_TRADING_DISABLED");
  }

  if (!context.allowedSymbols.includes(signal.symbol)) {
    reasonCodes.push("SYMBOL_NOT_ALLOWED");
  }

  if (signal.suggestedQuoteAmount <= 0) {
    reasonCodes.push("NON_POSITIVE_QUOTE_AMOUNT");
  }

  if (
    context.dailySpentUsdt + signal.suggestedQuoteAmount >
    strategy.maxDailySpendUsdt
  ) {
    reasonCodes.push("DAILY_LIMIT_EXCEEDED");
  }

  if (
    context.weeklySpentUsdt + signal.suggestedQuoteAmount >
    strategy.maxWeeklySpendUsdt
  ) {
    reasonCodes.push("WEEKLY_LIMIT_EXCEEDED");
  }

  if (signal.type !== "BUY_SIGNAL") {
    reasonCodes.push("NO_BUY_SIGNAL");
  }

  return {
    status: reasonCodes.length === 0 ? "APPROVED" : "REJECTED",
    reasonCodes,
    snapshot: {
      signalId: signal.id,
      strategyId: strategy.id,
      symbol: signal.symbol,
      mode: strategy.mode,
      dailySpentUsdt: context.dailySpentUsdt,
      weeklySpentUsdt: context.weeklySpentUsdt,
      liveTradingEnabled: context.liveTradingEnabled,
    },
  };
};
