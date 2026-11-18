import { describe, expect, it } from "vitest";
import type { AuditLog } from "../types.js";
import { describeAuditLog } from "./describe-audit-log.js";

const userId = "d159abe2-a0d3-428f-bcf7-c7ecdc7fb37d";
const strategyId = "d099051b-7106-4a67-8b9b-8189c844388c";
const orderId = "274a15a3-7bdb-4f24-a409-ad716bdcd8d6";
const record = {
  id: "43a05baf-5222-4446-9885-1b83f87fafe2",
  createdAt: "2026-01-01T12:00:00.000Z",
  schemaVersion: 1,
  scope: "USER",
  userId,
  actor: { kind: "SYSTEM", channel: "RUNNER" },
  correlationId: "test-correlation",
  payloadClass: "TENANT_FINANCIAL",
} as const;

const rejectedRecord = (reasonCodes: string[]): AuditLog => ({
  ...record,
  type: "RISK_DECISION_REJECTED",
  reasonCode: "RISK_POLICY_REJECTED",
  subject: { type: "STRATEGY", id: strategyId },
  payload: { mode: "DRY_RUN", policyVersion: "RISK_V1", reasonCodes },
});

describe("describeAuditLog", () => {
  it("describes approval for a simulated buy", () => {
    expect(
      describeAuditLog({
        ...record,
        type: "RISK_DECISION_APPROVED",
        reasonCode: "RISK_POLICY_APPROVED",
        subject: { type: "STRATEGY", id: strategyId },
        payload: {
          mode: "DRY_RUN",
          policyVersion: "RISK_V1",
          reasonCodes: [],
          orderId,
        },
      }),
    ).toEqual({
      label: "Signal approved",
      explanation: "The proposed simulated buy passed risk checks.",
    });
  });

  it("uses each recorded rejection reason even when older records lack provenance", () => {
    expect(
      describeAuditLog(
        rejectedRecord(["DAILY_LIMIT_EXCEEDED", "WEEKLY_LIMIT_EXCEEDED"]),
      ),
    ).toEqual({
      label: "Signal rejected",
      explanation:
        "The proposed buy would have exceeded the strategy’s daily limit. The proposed buy would have exceeded the strategy’s weekly limit.",
    });
  });

  it("refers to evidence for unrecognized codes without assigning a cause", () => {
    expect(
      describeAuditLog(rejectedRecord(["FUTURE_REASON", "constructor"])),
    ).toEqual({
      label: "Signal rejected",
      explanation: "See the audit record for an unrecognized reason code.",
    });
    expect(
      describeAuditLog(rejectedRecord(["SYMBOL_NOT_ALLOWED", "FUTURE_REASON"])),
    ).toEqual({
      label: "Signal rejected",
      explanation:
        "The trading pair was outside the allowed list. See the audit record for an unrecognized reason code.",
    });
  });

  it("does not infer a reason if the record has no reason codes", () => {
    expect(describeAuditLog(rejectedRecord([]))).toEqual({
      label: "Signal rejected",
      explanation: "A rejection was recorded without a reason code.",
    });
  });

  it("distinguishes scheduled from Telegram-requested simulated completion", () => {
    const completion = {
      ...record,
      type: "DRY_RUN_ORDER_COMPLETED",
      subject: { type: "ORDER", id: orderId },
      payload: { from: "PENDING", to: "COMPLETED", mode: "DRY_RUN" },
    } as const;

    expect(
      describeAuditLog({ ...completion, reasonCode: "SCHEDULE_DUE" }),
    ).toEqual({
      label: "Simulated order completed",
      explanation: "The simulator completed the order after it became due.",
    });
    expect(
      describeAuditLog({
        ...completion,
        reasonCode: "USER_FORCED_EXECUTION",
        actor: { kind: "USER", channel: "TELEGRAM", userId },
      }),
    ).toEqual({
      label: "Simulated order completed",
      explanation:
        "The simulator completed the order after a request in Telegram.",
    });
  });

  it("keeps other supported events visible with a readable label", () => {
    expect(
      describeAuditLog({
        ...record,
        type: "STRATEGY_CREATED",
        reasonCode: "OPERATOR_DEFAULT_SEED",
        subject: { type: "STRATEGY", id: strategyId },
        payloadClass: "TENANT_CONFIGURATION",
        payload: { symbol: "BTCUSDT", mode: "DRY_RUN" },
      }),
    ).toEqual({ label: "Strategy created" });
  });
});
