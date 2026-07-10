import type { BacktestParams, BacktestReport } from "./types.js";

export const runBacktest = (params: BacktestParams) =>
  $fetch<BacktestReport>("/api/backtest", { query: params });
