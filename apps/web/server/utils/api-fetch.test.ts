import type { H3Event } from "h3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetchForEvent } from "./api-fetch.js";

const makeEvent = (requestId: string | undefined) => {
  const setHeader = vi.fn();
  const event = {
    context: {},
    node: {
      req: { headers: requestId ? { "x-request-id": requestId } : {} },
      res: { headersSent: false, setHeader },
    },
  } as unknown as H3Event;
  return { event, setHeader };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BFF correlation forwarding", () => {
  it("forwards and echoes one safe request id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("$fetch", fetchMock);
    const { event, setHeader } = makeEvent("request_12345678");

    await apiFetchForEvent(event, "/health");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8787/health",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-request-id": "request_12345678",
        }),
      }),
    );
    expect(setHeader).toHaveBeenCalledWith("x-request-id", "request_12345678");
  });

  it("replaces an injection-shaped request id before forwarding", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("$fetch", fetchMock);
    const { event } = makeEvent("bad value\r\nx-api-key: secret");

    await apiFetchForEvent(event, "/health");

    const options = fetchMock.mock.calls[0]?.[1] as {
      headers?: Record<string, string>;
    };
    expect(options.headers?.["x-request-id"]).toMatch(/^op_[a-f0-9]{32}$/);
    expect(JSON.stringify(options)).not.toContain("x-api-key: secret");
  });

  it("reuses a generated request id throughout one request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("$fetch", fetchMock);
    const { event, setHeader } = makeEvent(undefined);

    await apiFetchForEvent(event, "/health");
    await apiFetchForEvent(event, "/risk-status");

    const firstOptions = fetchMock.mock.calls[0]?.[1] as {
      headers?: Record<string, string>;
    };
    const secondOptions = fetchMock.mock.calls[1]?.[1] as {
      headers?: Record<string, string>;
    };
    expect(firstOptions.headers?.["x-request-id"]).toMatch(/^op_[a-f0-9]{32}$/);
    expect(secondOptions.headers?.["x-request-id"]).toBe(
      firstOptions.headers?.["x-request-id"],
    );
    expect(setHeader).toHaveBeenCalledTimes(1);
  });
});
