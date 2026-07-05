import type { Strategy, StrategyConfigData } from "./types.js";

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
