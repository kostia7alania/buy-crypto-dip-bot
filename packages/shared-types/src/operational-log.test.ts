import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOperationalErrorLogRecord,
  logOperationalError,
  normalizeCorrelationId,
} from "./operational-log.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("operational logging", () => {
  it("never serializes raw error messages, stacks, causes, or enumerable data", () => {
    const error = Object.assign(
      new Error(
        "postgres://admin:secret@db.internal/trading?ssl=true signed_hash=abc",
        { cause: { apiKey: "api-secret" } },
      ),
      {
        code: "ECONNREFUSED",
        requestBody: { quoteAmount: 5000, token: "session-secret" },
      },
    );

    const record = buildOperationalErrorLogRecord({
      service: "api",
      event: "session_resolve_failed",
      correlationId: "request_12345678",
      error,
    });
    const serialized = JSON.stringify(record);

    expect(record).toMatchObject({
      service: "API",
      event: "SESSION_RESOLVE_FAILED",
      correlationId: "request_12345678",
      errorCode: "ECONNREFUSED",
    });
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("postgres://");
    expect(serialized).not.toContain("quoteAmount");
    expect(serialized).not.toContain("requestBody");
    expect(serialized).not.toContain("stack");
    expect(serialized).not.toContain("cause");
  });

  it("rejects attacker-controlled codes and correlation identifiers", () => {
    const record = buildOperationalErrorLogRecord({
      service: "api\nsecret",
      event: "bad event https://secret.invalid",
      correlationId: "\nset-cookie: credential=secret",
      error: { code: "https://secret.invalid/?token=value" },
    });

    expect(record.service).toBe("UNKNOWN_SERVICE");
    expect(record.event).toBe("UNKNOWN_EVENT");
    expect(record.errorCode).toBe("UNKNOWN_ERROR");
    expect(record.correlationId).toMatch(/^op_[a-f0-9]{32}$/);
  });

  it("emits one JSON record and returns the correlation id", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const correlationId = logOperationalError({
      service: "web",
      event: "upstream_failed",
      correlationId: "request_abcdefgh",
      error: new Error("session=secret"),
    });

    expect(correlationId).toBe("request_abcdefgh");
    expect(consoleError).toHaveBeenCalledOnce();
    const serialized = String(consoleError.mock.calls[0]?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      service: "WEB",
      event: "UPSTREAM_FAILED",
      correlationId: "request_abcdefgh",
      errorCode: "UNKNOWN_ERROR",
    });
    expect(serialized).not.toContain("session=secret");
  });

  it("preserves only syntactically safe inbound correlation ids", () => {
    expect(normalizeCorrelationId("request_12345678")).toBe("request_12345678");
    expect(normalizeCorrelationId("short")).toMatch(/^op_[a-f0-9]{32}$/);
  });
});
