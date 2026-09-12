import type { H3Event } from "h3";
import { afterEach, describe, expect, it, vi } from "vitest";

type TestErrorHandler = (
  error: unknown,
  event: H3Event,
) => void | Promise<void>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Nitro error boundary", () => {
  it("handles an unknown error without logging or returning its raw details", async () => {
    vi.stubGlobal(
      "defineNitroErrorHandler",
      (handler: TestErrorHandler) => handler,
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const setHeader = vi.fn();
    const end = vi.fn();
    const event = {
      _handled: false,
      context: {},
      node: {
        req: { headers: { "x-request-id": "request_12345678" } },
        res: {
          headersSent: false,
          writableEnded: false,
          statusCode: 200,
          statusMessage: "",
          setHeader,
          end,
        },
      },
    } as unknown as H3Event;
    const secret = "postgres://admin:password@database/internal";
    const error = Object.assign(new Error(secret), {
      code: "DATABASE_FAILED",
      unhandled: true,
    });
    const { default: errorHandler } = await import("./error-handler.js");

    await errorHandler(error, event, {
      defaultHandler: vi.fn(),
    });

    expect(event._handled).toBe(true);
    expect(event.node.res.statusCode).toBe(500);
    expect(event.node.res.statusMessage).toBe("INTERNAL_SERVER_ERROR");
    expect(setHeader).toHaveBeenCalledWith("x-request-id", "request_12345678");
    expect(end).toHaveBeenCalledWith(
      JSON.stringify({
        error: true,
        statusCode: 500,
        statusMessage: "INTERNAL_SERVER_ERROR",
        message: "INTERNAL_SERVER_ERROR",
        correlationId: "request_12345678",
      }),
    );

    const serializedLog = String(consoleError.mock.calls[0]?.[0]);
    expect(serializedLog).toContain('"event":"NITRO_REQUEST_FAILED"');
    expect(serializedLog).toContain('"errorCode":"DATABASE_FAILED"');
    expect(serializedLog).not.toContain(secret);
    expect(JSON.stringify(end.mock.calls)).not.toContain(secret);
  });
});
