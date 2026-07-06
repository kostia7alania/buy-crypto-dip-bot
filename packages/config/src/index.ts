// Single source of truth for runtime defaults.
// Seeding, API handlers, and the runner must import from here instead of
// declaring their own copies.

export const strategyDefaults = {
  thresholdPercent: 1.0,
  suggestedQuoteAmount: 20,
  maxDailySpendUsdt: 100,
  maxWeeklySpendUsdt: 500,
  cooldownMinutes: 60,
} as const;

export const riskDefaults = {
  liveTradingEnabled: false,
  allowlistSymbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
} as const;

// Grace period between a BUY signal and dry-run execution during which the
// user can cancel or force the order from Telegram.
export const orderExecutionDelaySeconds = 15;
