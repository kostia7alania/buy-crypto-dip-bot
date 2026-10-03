import { describe, expect, it } from "vitest";
import {
  AUDIT_SCHEMA_VERSION,
  type AuditEventV1,
  assertAuditEventV1,
} from "./audit.js";

const userId = "10000000-0000-4000-8000-000000000001";
const strategyId = "20000000-0000-4000-8000-000000000001";

const valid = (): AuditEventV1 => ({
  schemaVersion: AUDIT_SCHEMA_VERSION,
  type: "STRATEGY_CREATED",
  scope: "USER",
  userId,
  actor: { kind: "USER", channel: "WEB", userId },
  reasonCode: "USER_REQUESTED",
  correlationId: "request_12345678",
  subject: { type: "STRATEGY", id: strategyId },
  payloadClass: "TENANT_CONFIGURATION",
  payload: { symbol: "BTCUSDT", mode: "DRY_RUN" },
});

const rejected = () =>
  ({
    ...valid(),
    type: "RISK_DECISION_REJECTED",
    scope: "USER",
    userId,
    actor: { kind: "SYSTEM", channel: "RUNNER" },
    reasonCode: "RISK_POLICY_REJECTED",
    payloadClass: "TENANT_FINANCIAL",
    payload: {
      mode: "DRY_RUN",
      policyVersion: "RISK_V1",
      reasonCodes: ["DAILY_LIMIT_EXCEEDED"],
      provenance: {
        evaluationKey: `evaluation-v1:${"a".repeat(64)}`,
        configRevision: `sha256:${"b".repeat(64)}`,
        marketSnapshotKey: `bybit-ticker-v2:${"c".repeat(64)}`,
        strategyConfig: {
          symbol: "BTCUSDT",
          mode: "DRY_RUN",
          thresholdPercent: 1,
          suggestedQuoteAmount: 20,
          maxDailySpendUsdt: 10,
          maxWeeklySpendUsdt: 500,
          cooldownMinutes: 0,
        },
        marketSnapshot: {
          source: "BYBIT_SPOT_TICKER_V5",
          symbol: "BTCUSDT",
          sourceAt: "2026-10-02T12:00:00.000Z",
          receivedAt: "2026-10-02T12:00:05.000Z",
          evaluatedAt: "2026-10-02T12:00:05.000Z",
          lastPrice: 90,
          high24h: 100,
          low24h: null,
          ageMs: 5_000,
          ttlMs: 30_000,
          ageAtEvaluationMs: 5_000,
        },
        riskSnapshot: {
          dailyCompletedUsdt: 0,
          weeklyCompletedUsdt: 0,
          activeReservedUsdt: 0,
          dailyCommittedUsdt: 0,
          weeklyCommittedUsdt: 0,
          proposedQuoteAmountUsdt: 20,
          decision: {
            signalId: `evaluation-v1:${"a".repeat(64)}`,
            strategyId,
            symbol: "BTCUSDT",
            mode: "DRY_RUN",
            dailySpentUsdt: 0,
            weeklySpentUsdt: 0,
            liveTradingEnabled: false,
          },
        },
      },
    },
  }) satisfies AuditEventV1;

describe("audit event V1 contract", () => {
  it("accepts an exact typed envelope", () => {
    expect(() => assertAuditEventV1(valid())).not.toThrow();
  });

  it("accepts bounded rejected provenance and historical V1 rejections without it", () => {
    const event = rejected();
    expect(() => assertAuditEventV1(event)).not.toThrow();
    expect(
      new TextEncoder().encode(JSON.stringify(event.payload)).byteLength,
    ).toBeLessThan(8192);
    const { provenance: _, ...legacyPayload } = event.payload;
    expect(() =>
      assertAuditEventV1({ ...event, payload: legacyPayload }),
    ).not.toThrow();
  });

  it("rejects extra nested fields, malformed provenance and oversized rejection payloads", () => {
    const event = rejected();
    const provenance = event.payload.provenance;
    const unsafe = [
      { ...provenance, apiKey: "secret" },
      {
        ...provenance,
        strategyConfig: { ...provenance.strategyConfig, apiKey: "secret" },
      },
      {
        ...provenance,
        marketSnapshot: { ...provenance.marketSnapshot, rawFeed: [] },
      },
      {
        ...provenance,
        riskSnapshot: { ...provenance.riskSnapshot, token: "secret" },
      },
      {
        ...provenance,
        riskSnapshot: {
          ...provenance.riskSnapshot,
          decision: { ...provenance.riskSnapshot.decision, apiKey: "secret" },
        },
      },
      { ...provenance, evaluationKey: "not-a-snapshot-key" },
      {
        ...provenance,
        marketSnapshot: { ...provenance.marketSnapshot, lastPrice: Infinity },
      },
      {
        ...provenance,
        marketSnapshot: {
          ...provenance.marketSnapshot,
          sourceAt: "not-a-timestamp",
        },
      },
      {
        ...provenance,
        riskSnapshot: {
          ...provenance.riskSnapshot,
          decision: { ...provenance.riskSnapshot.decision, strategyId: userId },
        },
      },
      { ...provenance, marketSnapshot: undefined },
    ];
    for (const value of unsafe) {
      expect(() =>
        assertAuditEventV1({
          ...event,
          payload: { ...event.payload, provenance: value },
        }),
      ).toThrow(/^AUDIT_EVENT_INVALID:/);
    }
    expect(() =>
      assertAuditEventV1({
        ...event,
        payload: {
          ...event.payload,
          reasonCodes: Array(400).fill("DAILY_LIMIT_EXCEEDED"),
        },
      }),
    ).toThrow("AUDIT_EVENT_INVALID:PAYLOAD_SIZE");
  });

  it.each([
    ["unknown envelope key", { ...valid(), token: "session-secret" }],
    [
      "wrong owner actor",
      {
        ...valid(),
        actor: { kind: "USER", channel: "WEB", userId: strategyId },
      },
    ],
    ["unknown event", { ...valid(), type: "RAW_EVENT" }],
    [
      "unsafe payload key",
      {
        ...valid(),
        payload: { symbol: "BTCUSDT", mode: "DRY_RUN", apiKey: "secret" },
      },
    ],
    [
      "non-dry mode",
      { ...valid(), payload: { symbol: "BTCUSDT", mode: "LIVE" } },
    ],
    ["bad correlation", { ...valid(), correlationId: "bad\nheader: secret" }],
  ])("rejects %s", (_case, value) => {
    expect(() => assertAuditEventV1(value)).toThrow(/^AUDIT_EVENT_INVALID:/);
  });

  it("rejects raw Error and order payload classes", () => {
    const value = {
      ...valid(),
      type: "DRY_RUN_ORDER_COMPLETED",
      subject: { type: "ORDER", id: strategyId },
      actor: { kind: "SYSTEM", channel: "RUNNER" },
      reasonCode: "SCHEDULE_DUE",
      payloadClass: "TENANT_FINANCIAL",
      payload: {
        from: "PENDING",
        to: "COMPLETED",
        mode: "DRY_RUN",
        order: { price: 999, token: "secret" },
        error: new Error("postgres://user:secret@db"),
      },
    };
    expect(() => assertAuditEventV1(value)).toThrow(
      "AUDIT_EVENT_INVALID:PAYLOAD_KEYS",
    );
  });

  it("accepts a structured rate-limited login rejection", () => {
    const event: AuditEventV1 = {
      schemaVersion: AUDIT_SCHEMA_VERSION,
      type: "AUTH_LOGIN_REJECTED",
      scope: "SYSTEM",
      userId: null,
      actor: { kind: "ANONYMOUS", channel: "WEB" },
      reasonCode: "RATE_LIMITED",
      correlationId: "request_rate_limited",
      subject: {
        type: "USER",
        id: "00000000-0000-4000-8000-000000000000",
      },
      payloadClass: "SECURITY",
      payload: { limiter: "SOURCE", retryAfterSeconds: 300 },
    };

    expect(() => assertAuditEventV1(event)).not.toThrow();
  });

  it("rejects credential-shaped fields from rate-limit audit payloads", () => {
    const event = {
      schemaVersion: AUDIT_SCHEMA_VERSION,
      type: "AUTH_LOGIN_REJECTED",
      scope: "SYSTEM",
      userId: null,
      actor: { kind: "ANONYMOUS", channel: "WEB" },
      reasonCode: "RATE_LIMITED",
      correlationId: "request_rate_limited",
      subject: {
        type: "USER",
        id: "00000000-0000-4000-8000-000000000000",
      },
      payloadClass: "SECURITY",
      payload: {
        limiter: "USER",
        retryAfterSeconds: 300,
        abuseKey: "do-not-persist-in-audit",
      },
    };

    expect(() => assertAuditEventV1(event)).toThrow(
      "AUDIT_EVENT_INVALID:PAYLOAD_KEYS",
    );
  });
});
