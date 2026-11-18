import type { AuditLog } from "../types.js";

const labels: Record<AuditLog["type"], string> = {
  AUTH_LOGIN_SUCCEEDED: "Signed in",
  AUTH_LOGIN_REJECTED: "Sign-in rejected",
  SESSION_REVOKED: "Session revoked",
  NOTIFICATION_BINDING_VERIFIED: "Telegram notifications verified",
  STRATEGY_CREATED: "Strategy created",
  STRATEGY_UPDATED: "Strategy updated",
  STRATEGIES_BULK_PAUSED: "Strategies paused",
  STRATEGIES_BULK_RESUMED: "Strategies resumed",
  RISK_DECISION_REJECTED: "Signal rejected",
  RISK_DECISION_APPROVED: "Signal approved",
  PENDING_ORDER_DUPLICATE_SUPPRESSED: "Duplicate simulated order skipped",
  DRY_RUN_ORDER_COMPLETED: "Simulated order completed",
  DRY_RUN_ORDER_CANCELLED: "Simulated order canceled",
};

const rejectionReasons = new Map<string, string>([
  [
    "LIVE_TRADING_DISABLED",
    "The strategy required live trading, which was disabled.",
  ],
  ["SYMBOL_NOT_ALLOWED", "The trading pair was outside the allowed list."],
  ["NON_POSITIVE_QUOTE_AMOUNT", "The proposed buy amount was zero or less."],
  [
    "DAILY_LIMIT_EXCEEDED",
    "The proposed buy would have exceeded the strategy’s daily limit.",
  ],
  [
    "WEEKLY_LIMIT_EXCEEDED",
    "The proposed buy would have exceeded the strategy’s weekly limit.",
  ],
  ["NO_BUY_SIGNAL", "The strategy did not generate a buy signal."],
]);

const completionReasons = new Map<string, string>([
  ["SCHEDULE_DUE", "The simulator completed the order after it became due."],
  [
    "USER_FORCED_EXECUTION",
    "The simulator completed the order after a request in Telegram.",
  ],
]);

interface AuditDescription {
  label: string;
  explanation?: string;
}

export const describeAuditLog = (log: AuditLog): AuditDescription => {
  const label = labels[log.type];
  switch (log.type) {
    case "RISK_DECISION_APPROVED":
      return {
        label,
        explanation: "The proposed simulated buy passed risk checks.",
      };
    case "RISK_DECISION_REJECTED": {
      const reasons = new Set(
        log.payload.reasonCodes.map(
          (code) =>
            rejectionReasons.get(code) ??
            "See the audit record for an unrecognized reason code.",
        ),
      );
      return {
        label,
        explanation:
          [...reasons].join(" ") ||
          "A rejection was recorded without a reason code.",
      };
    }
    case "DRY_RUN_ORDER_COMPLETED":
      return {
        label,
        explanation:
          completionReasons.get(log.reasonCode) ??
          "See the audit record for the completion reason.",
      };
    default:
      return { label };
  }
};
