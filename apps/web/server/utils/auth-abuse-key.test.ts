import type { H3Event } from "h3";
import { describe, expect, it } from "vitest";
import {
  telegramLoginRateLimitFrom,
  telegramLoginSourcePseudonym,
} from "./auth-abuse-key.js";

const eventFrom = (forwardedFor: string) =>
  ({
    context: {},
    node: {
      req: {
        headers: { "x-forwarded-for": forwardedFor },
        socket: { remoteAddress: "10.0.0.2" },
      },
    },
  }) as unknown as H3Event;

describe("telegramLoginSourcePseudonym", () => {
  it("derives a stable HMAC without exposing the raw address", () => {
    const event = eventFrom("203.0.113.7");
    const key = telegramLoginSourcePseudonym(event, "test-service-secret");

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).toBe(
      telegramLoginSourcePseudonym(event, "test-service-secret"),
    );
    expect(key).not.toContain("203.0.113.7");
    expect(key).not.toContain("test-service-secret");
  });

  it("separates different request sources", () => {
    const first = telegramLoginSourcePseudonym(
      eventFrom("203.0.113.7"),
      "test-service-secret",
    );
    const second = telegramLoginSourcePseudonym(
      eventFrom("203.0.113.8"),
      "test-service-secret",
    );

    expect(first).not.toBe(second);
  });
});

describe("telegramLoginRateLimitFrom", () => {
  it("preserves an exact matching Retry-After boundary", () => {
    expect(
      telegramLoginRateLimitFrom({
        status: 429,
        data: { error: "RATE_LIMITED", retryAfterSeconds: 177 },
        response: { headers: new Headers({ "retry-after": "177" }) },
      }),
    ).toEqual({ retryAfterSeconds: 177 });
  });

  it("rejects missing, non-integer, or inconsistent delays", () => {
    expect(
      telegramLoginRateLimitFrom({
        status: 429,
        data: { retryAfterSeconds: 177 },
        response: { headers: new Headers({ "retry-after": "176" }) },
      }),
    ).toBeNull();
    expect(
      telegramLoginRateLimitFrom({
        status: 429,
        data: { retryAfterSeconds: "177" },
        response: { headers: new Headers({ "retry-after": "177" }) },
      }),
    ).toBeNull();
  });
});
