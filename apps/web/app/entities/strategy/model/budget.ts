import type { StrategyBudgetReport } from "@buy-crypto-dip-bot/shared-types";

// A regular dashboard refresh runs every 30 seconds. Keep one refresh cycle of
// slack and treat invalid timestamps or substantial clock skew as unavailable.
const MAX_BUDGET_AGE_MS = 60_000;

export const getBudgetReadState = (
  report: StrategyBudgetReport | undefined,
  now: number,
  hasError: boolean,
) => {
  if (hasError || !report) return "unavailable";
  const asOf = Date.parse(report.asOf);
  if (!Number.isFinite(asOf) || asOf - now >= MAX_BUDGET_AGE_MS)
    return "unavailable";
  return now - asOf >= MAX_BUDGET_AGE_MS ? "stale" : "current";
};
