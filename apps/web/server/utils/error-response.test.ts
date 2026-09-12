import { describe, expect, it } from "vitest";
import { buildSafeErrorResponse } from "./error-response.js";

describe("safe Nitro error responses", () => {
  it("replaces unknown error details with a controlled 500 response", () => {
    const response = buildSafeErrorResponse(
      new Error("database password=never-log-this"),
      "request_12345678",
    );

    expect(response).toEqual({
      statusCode: 500,
      statusMessage: "INTERNAL_SERVER_ERROR",
      body: {
        error: true,
        statusCode: 500,
        statusMessage: "INTERNAL_SERVER_ERROR",
        message: "INTERNAL_SERVER_ERROR",
        correlationId: "request_12345678",
      },
    });
    expect(JSON.stringify(response)).not.toContain("never-log-this");
  });

  it("preserves a controlled client-error code", () => {
    expect(
      buildSafeErrorResponse(
        { statusCode: 403, statusMessage: "ORIGIN_REJECTED" },
        "request_12345678",
      ),
    ).toMatchObject({ statusCode: 403, statusMessage: "ORIGIN_REJECTED" });
  });

  it("does not execute hostile error getters", () => {
    const hostileError = Object.defineProperties(
      {},
      {
        statusCode: {
          get: () => {
            throw new Error("secret status getter");
          },
        },
        statusMessage: {
          get: () => {
            throw new Error("secret message getter");
          },
        },
      },
    );

    expect(() =>
      buildSafeErrorResponse(hostileError, "request_12345678"),
    ).not.toThrow();
    expect(
      buildSafeErrorResponse(hostileError, "request_12345678").statusMessage,
    ).toBe("INTERNAL_SERVER_ERROR");
  });
});
