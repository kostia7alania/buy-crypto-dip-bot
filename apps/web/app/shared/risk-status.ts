export const riskStatus = {
  mode: "DRY_RUN",
  liveTradingEnabled: false,
  maxDailySpendUsdt: 20,
  maxWeeklySpendUsdt: 100,
  orderLikeActionsRequireApproval: true,
} as const;

export type RiskStatus = typeof riskStatus;
