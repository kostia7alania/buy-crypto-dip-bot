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

describe("audit event V1 contract", () => {
  it("accepts an exact typed envelope", () => {
    expect(() => assertAuditEventV1(valid())).not.toThrow();
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
