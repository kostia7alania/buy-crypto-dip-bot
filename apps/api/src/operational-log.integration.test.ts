import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("API operational logging boundary", () => {
  it("preserves a safe inbound correlation id on responses", async () => {
    const response = await createApp().request("/health", {
      headers: { "x-request-id": "request_12345678" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("request_12345678");
  });

  it("replaces injection-shaped correlation ids", async () => {
    const response = await createApp().request("/health", {
      headers: { "x-request-id": "invalid value with spaces" },
    });

    expect(response.headers.get("x-request-id")).toMatch(/^op_[a-f0-9]{32}$/);
  });

  it("maps an uncaught secret-bearing error to a safe correlated 500", async () => {
    const app = createApp();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const sentinels = [
      "api-key-sentinel",
      "session-token-sentinel",
      "telegram-hash-sentinel",
      "postgres://admin:password-sentinel@db/dipbot",
      "quote-amount-987654",
      "chat-id-112233",
    ];

    app.get("/health/synthetic-log-failure", () => {
      throw Object.assign(new Error(sentinels.join(" ")), {
        code: "ECONNRESET",
        query: "select * from api_sessions where token_hash = $1",
        params: sentinels,
        request: {
          headers: { authorization: sentinels[0] },
          body: { hash: sentinels[2], amount: sentinels[4] },
        },
      });
    });

    const response = await app.request("/health/synthetic-log-failure", {
      headers: { "x-request-id": "request_sentinel_123" },
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "INTERNAL_SERVER_ERROR" });
    expect(response.headers.get("x-request-id")).toBe("request_sentinel_123");
    expect(consoleError).toHaveBeenCalledOnce();

    const serialized = consoleError.mock.calls.flat().map(String).join("\n");
    expect(JSON.parse(serialized)).toMatchObject({
      service: "API",
      event: "UNHANDLED_REQUEST_FAILED",
      correlationId: "request_sentinel_123",
      errorCode: "ECONNRESET",
    });
    for (const sentinel of sentinels) {
      expect(serialized).not.toContain(sentinel);
    }
    expect(serialized).not.toContain("token_hash");
    expect(serialized).not.toContain("authorization");
  });
});
