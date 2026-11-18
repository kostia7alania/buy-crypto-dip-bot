import type {
  LatestRiskDecisionReport,
  PerformanceReport,
  PnlReport,
  ReportIssue,
  StrategyBudgetReport,
} from "@buy-crypto-dip-bot/shared-types";
import * as v from "valibot";
import { escapeTelegramHtml } from "./telegram-format.js";

const assumptions = "DRY_RUN. Fees and slippage are not modelled.";
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
const issueLabel = (issue: ReportIssue | null) =>
  issue === "INCOMPLETE_HISTORY"
    ? "complete closed-day history unavailable (up to 200 days)"
    : issue === "STALE_MARKET"
      ? "stale market data"
      : "market data unavailable";

export const renderPnlReport = (report: PnlReport): string => {
  const lines = ["<b>Simulated Portfolio PnL</b>", assumptions];
  if (report.status === "EMPTY")
    return [...lines, "No simulated purchases yet."].join("\n");
  if (report.status !== "COMPLETE")
    lines.push("Incomplete valuation. Total PnL is unavailable.");
  for (const position of report.positions) {
    lines.push(
      `\n<b>${escapeTelegramHtml(position.symbol)}</b> (${position.orders} buys)`,
      `Recorded spend: ${position.spentUsdt.toFixed(2)} USDT`,
      `Average buy price: $${position.avgBuyPrice.toFixed(2)}`,
      position.currentPrice === null
        ? "Quoted price: unavailable"
        : `Quoted price: $${position.currentPrice.toFixed(2)}`,
    );
    if (position.pnlUsdt === null || position.pnlPercent === null) {
      lines.push(`Valuation unavailable: ${issueLabel(position.issue)}.`);
    } else {
      lines.push(
        `PnL: ${signed(position.pnlUsdt)} USDT (${signed(position.pnlPercent)}%)`,
      );
    }
    if (position.quote)
      lines.push(`Quote as of ${escapeTelegramHtml(position.quote.sourceAt)}`);
  }
  const { totals } = report;
  lines.push(`\nTotal recorded spend: ${totals.spentUsdt.toFixed(2)} USDT`);
  if (totals.pnlUsdt !== null && totals.pnlPercent !== null) {
    lines.push(
      `Total PnL: ${signed(totals.pnlUsdt)} USDT (${signed(totals.pnlPercent)}%)`,
    );
  }
  return lines.join("\n");
};

export const renderPerformanceReport = (report: PerformanceReport): string => {
  const lines = [
    "<b>Strategy vs Benchmarks</b>",
    assumptions,
    "Equal-capital daily-close illustrations, not matched cash flows.",
  ];
  if (report.status === "EMPTY")
    return [...lines, "No simulated purchases yet."].join("\n");
  if (report.status !== "COMPLETE")
    lines.push("Incomplete comparison. Missing data is not a zero return.");
  for (const position of report.positions) {
    lines.push(
      `\n<b>${escapeTelegramHtml(position.symbol)}</b>`,
      `Recorded spend: ${position.spentUsdt.toFixed(2)} USDT`,
    );
    if (!position.actual || !position.calendarDca || !position.hold) {
      lines.push(`Not comparable: ${issueLabel(position.issue)}.`);
    } else {
      lines.push(
        `Dip buying: ${signed(position.actual.pnlPercent)}%`,
        `Calendar DCA: ${signed(position.calendarDca.pnlPercent)}%`,
        `Buy &amp; hold: ${signed(position.hold.pnlPercent)}%`,
      );
    }
    if (position.window.from && position.window.through) {
      lines.push(
        `Daily-close window: ${escapeTelegramHtml(position.window.from)} to ${escapeTelegramHtml(position.window.through)} (end exclusive)`,
      );
    }
    if (position.quote)
      lines.push(`Quote as of ${escapeTelegramHtml(position.quote.sourceAt)}`);
  }
  return lines.join("\n");
};

const budgetAmount = v.pipe(v.number(), v.finite(), v.minValue(0));
const recordedTimestamp = v.pipe(
  v.string(),
  v.isoTimestamp(),
  v.check((value) => Number.isFinite(Date.parse(value))),
);
const formatUtcTimestamp = (value: string) =>
  `${new Date(value).toISOString().slice(0, 19).replace("T", " ")} UTC`;

export const latestRiskDecisionReportSchema = v.object({
  decision: v.nullable(
    v.object({
      type: v.picklist(["RISK_DECISION_APPROVED", "RISK_DECISION_REJECTED"]),
      createdAt: recordedTimestamp,
      symbol: v.nullable(v.string()),
      reasonCodes: v.array(v.string()),
    }),
  ),
});

const riskReasonLabels = new Map([
  ["LIVE_TRADING_DISABLED", "Live trading is disabled"],
  ["SYMBOL_NOT_ALLOWED", "Pair is outside the allowed list"],
  ["NON_POSITIVE_QUOTE_AMOUNT", "Buy amount must be positive"],
  ["DAILY_LIMIT_EXCEEDED", "Rolling 24h limit would be exceeded"],
  ["WEEKLY_LIMIT_EXCEEDED", "Rolling 7d limit would be exceeded"],
  ["NO_BUY_SIGNAL", "Buy signal was missing"],
]);

export const renderLatestRiskDecision = ({
  decision,
}: LatestRiskDecisionReport): string => {
  const header = "<b>Last recorded risk decision</b> (DRY_RUN)";
  if (!decision)
    return `${header}\nNo verified risk decision is available for your strategies yet.`;
  const reasons = new Set(
    decision.reasonCodes.map(
      (code) => riskReasonLabels.get(code) ?? "Other recorded reason",
    ),
  );
  const approved = decision.type === "RISK_DECISION_APPROVED";
  const result = approved
    ? "Approved a simulated buy"
    : "Rejected a simulated buy";
  const pair =
    decision.symbol === null
      ? "Pair unavailable"
      : escapeTelegramHtml(decision.symbol.slice(0, 64));
  const lines = [
    header,
    `${result} — ${pair}`,
    formatUtcTimestamp(decision.createdAt),
  ];
  if (!approved && reasons.size === 0)
    lines.push("Reason unavailable in the record.");
  for (const reason of reasons) lines.push(`• ${reason}`);
  return lines.join("\n");
};

export const strategyBudgetReportSchema = v.object({
  asOf: recordedTimestamp,
  strategies: v.array(
    v.object({
      strategyId: v.string(),
      symbol: v.string(),
      dailyRemainingUsdt: v.nullable(budgetAmount),
      weeklyRemainingUsdt: v.nullable(budgetAmount),
      activeReservedUsdt: budgetAmount,
    }),
  ),
});

const MAX_BUDGET_AGE_MS = 60_000;
export const isBudgetReportStale = (
  report: StrategyBudgetReport,
  now: number,
): boolean => Math.abs(now - Date.parse(report.asOf)) >= MAX_BUDGET_AGE_MS;

const budgetAmountFormatter = new Intl.NumberFormat("en-US", {
  useGrouping: false,
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
});

const formatBudgetAmount = (amount: number | null) =>
  amount === null
    ? "Unavailable"
    : `${budgetAmountFormatter.format(amount)} USDT`;

export const renderStrategyBudgetReport = (
  report: StrategyBudgetReport,
): string[] => {
  const intro = `<b>Simulated budget per strategy</b> (DRY_RUN)\nAs of ${formatUtcTimestamp(report.asOf)}`;
  if (!report.strategies.length)
    return [`${intro}\nNo strategies yet. Use /start to set one up.`];

  const header = `${intro}\nRemaining amounts account for completed simulated buys and pending holds.`;
  const messages: string[] = [];
  let message = header;
  for (const strategy of report.strategies) {
    const symbol =
      strategy.symbol.length > 64
        ? `${strategy.symbol.slice(0, 64)}…`
        : strategy.symbol;
    const block =
      `\n\n<b>${escapeTelegramHtml(symbol)}</b>\n` +
      `Remaining (rolling 24h) — ${formatBudgetAmount(strategy.dailyRemainingUsdt)}\n` +
      `Remaining (rolling 7d) — ${formatBudgetAmount(strategy.weeklyRemainingUsdt)}\n` +
      `Held for pending buys — ${formatBudgetAmount(strategy.activeReservedUsdt)}`;
    if (message.length + block.length > 4096) {
      messages.push(message);
      message = header;
    }
    message += block;
  }
  messages.push(message);
  return messages;
};
