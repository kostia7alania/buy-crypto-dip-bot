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

export const fetchStrategies = () => $fetch<Strategy[]>("/api/strategies");

export const updateStrategy = (
  id: string,
  payload: { enabled?: boolean; config?: StrategyConfigData },
) =>
  $fetch<{ success: boolean; strategy: Strategy }>("/api/strategies", {
    method: "PATCH",
    body: { id, ...payload },
  });

export const createStrategy = (symbol: string) =>
  $fetch<{ success: boolean; strategy: Strategy }>("/api/strategies", {
    method: "POST",
    body: { symbol },
  });
