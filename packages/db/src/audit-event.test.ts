import { describe, expect, it } from "vitest";
import { auditEventFromRow, auditEventRow } from "./audit-event.js";

const userId = "10000000-0000-4000-8000-000000000001";
const strategyId = "20000000-0000-4000-8000-000000000001";

describe("audit event database adapter", () => {
  it("round-trips an exact V1 event", () => {
    const event = {
      schemaVersion: 1,
      type: "STRATEGY_CREATED",
      scope: "USER",
      userId,
      actor: { kind: "USER", channel: "WEB", userId },
      reasonCode: "USER_REQUESTED",
      correlationId: "request_12345678",
      subject: { type: "STRATEGY", id: strategyId },
      payloadClass: "TENANT_CONFIGURATION",
      payload: { symbol: "BTCUSDT", mode: "DRY_RUN" },
    } as const;

    expect(auditEventFromRow(auditEventRow(event))).toEqual(event);
  });

  it("keeps legacy and malformed V1 rows opaque", () => {
    const row = auditEventRow({
      schemaVersion: 1,
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

    expect(auditEventFromRow({ ...row, schemaVersion: 0 })).toBeNull();
    expect(
      auditEventFromRow({
        ...row,
        payload: { ...row.payload, token: "secret" },
      }),
    ).toBeNull();
  });
});
