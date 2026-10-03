import type {
  PerformanceReport,
  PnlReport,
  ReportIssue,
} from "@buy-crypto-dip-bot/shared-types";
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
