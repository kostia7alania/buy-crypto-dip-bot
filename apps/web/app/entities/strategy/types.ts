export interface StrategyConfigData {
  thresholdPercent: number;
  suggestedQuoteAmount: number;
  maxDailySpendUsdt: number;
  maxWeeklySpendUsdt: number;
  cooldownMinutes: number;
}

export interface Strategy {
  id: string;
  name: string;
  symbol: string;
  enabled: boolean;
  mode: string;
  config: StrategyConfigData;
}
