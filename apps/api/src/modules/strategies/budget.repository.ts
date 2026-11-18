import type { TenantTransaction } from "@buy-crypto-dip-bot/db";
import type { StrategyBudgetReport } from "@buy-crypto-dip-bot/shared-types";
import { sql } from "drizzle-orm";

const remaining = (
  cap: unknown,
  completed: string | null,
  reserved: number,
) => {
  // Older configurations can contain numeric strings, as accepted by the runner.
  if (typeof cap !== "number" && !(typeof cap === "string" && cap.trim())) {
    return null;
  }
  if (completed === null) return null;
  const limit = Number(cap);
  const committed = Number(completed) + reserved;
  if (!Number.isFinite(limit) || limit < 0 || !Number.isFinite(committed)) {
    return null;
  }
  const balance = limit - committed;
  return Number.isFinite(balance) ? Math.max(0, balance) : null;
};

export const readStrategyBudget = async (
  db: Pick<TenantTransaction, "execute">,
  userId: string,
): Promise<StrategyBudgetReport> => {
  // Aggregate independently: joining every hold to every completion for a
  // strategy would multiply spend. All windows and rows use one database clock.
  const { rows } = await db.execute<{
    as_of_ms: string;
    strategy_id: string | null;
    symbol: string;
    daily_cap: unknown;
    weekly_cap: unknown;
    daily_completed: string | null;
    weekly_completed: string | null;
    active_reserved: string;
  }>(sql`
    WITH clock AS (
      SELECT date_trunc('milliseconds', transaction_timestamp() AT TIME ZONE 'UTC') AS as_of
    ), completed AS (
      SELECT o.strategy_id,
        sum(o.quote_amount) FILTER (WHERE coalesce(r.resolved_at, o.created_at)
          >= clock.as_of - interval '24 hours') AS daily,
        sum(o.quote_amount) AS weekly,
        bool_or(o.quote_amount < 0 AND coalesce(r.resolved_at, o.created_at)
          >= clock.as_of - interval '24 hours') AS invalid_daily,
        bool_or(o.quote_amount < 0) AS invalid_weekly
      FROM orders o CROSS JOIN clock
      LEFT JOIN order_reservations r ON r.order_id = o.id AND r.user_id = o.user_id
        AND r.status = 'CONSUMED'
      WHERE o.user_id = ${userId} AND o.status = 'COMPLETED'
        AND coalesce(r.resolved_at, o.created_at) >= clock.as_of - interval '7 days'
      GROUP BY o.strategy_id
    ), active AS (
      SELECT strategy_id, sum(quote_amount) AS reserved
      FROM order_reservations WHERE user_id = ${userId} AND status = 'ACTIVE'
      GROUP BY strategy_id
    )
    SELECT extract(epoch FROM clock.as_of) * 1000 AS as_of_ms,
      s.id AS strategy_id, s.symbol,
      s.config->'maxDailySpendUsdt' AS daily_cap, s.config->'maxWeeklySpendUsdt' AS weekly_cap,
      CASE WHEN completed.invalid_daily THEN NULL ELSE coalesce(completed.daily, 0) END AS daily_completed,
      CASE WHEN completed.invalid_weekly THEN NULL ELSE coalesce(completed.weekly, 0) END AS weekly_completed,
      coalesce(active.reserved, 0) AS active_reserved
    FROM clock LEFT JOIN strategies s ON s.user_id = ${userId}
    LEFT JOIN completed ON completed.strategy_id = s.id
    LEFT JOIN active ON active.strategy_id = s.id
    ORDER BY s.symbol
  `);
  const first = rows[0];
  if (!first) throw new Error("STRATEGY_BUDGET_CLOCK_MISSING");
  return {
    asOf: new Date(Number(first.as_of_ms)).toISOString(),
    strategies: rows.flatMap((row) => {
      if (row.strategy_id === null) return [];
      const reserved = Number(row.active_reserved);
      if (!Number.isFinite(reserved))
        throw new Error("STRATEGY_BUDGET_AMOUNT_OUT_OF_RANGE");
      return [
        {
          strategyId: row.strategy_id,
          symbol: row.symbol,
          dailyRemainingUsdt: remaining(
            row.daily_cap,
            row.daily_completed,
            reserved,
          ),
          weeklyRemainingUsdt: remaining(
            row.weekly_cap,
            row.weekly_completed,
            reserved,
          ),
          activeReservedUsdt: reserved,
        },
      ];
    }),
  };
};
