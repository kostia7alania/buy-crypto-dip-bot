import { describe, expect, it } from "vitest";
import { isTrustedRequestOrigin, resolveAllowedWebOrigin } from "./csrf.js";

describe("BFF request-origin boundary", () => {
  it("allows safe reads without an Origin header", () => {
    expect(
      isTrustedRequestOrigin({
        method: "GET",
        allowedOrigin: "https://buy-crypto-dip-bot.com",
      }),
    ).toBe(true);
  });

  it("allows a same-origin unsafe request", () => {
    expect(
      isTrustedRequestOrigin({
        method: "POST",
        origin: "https://buy-crypto-dip-bot.com",
        allowedOrigin: "https://buy-crypto-dip-bot.com",
      }),
    ).toBe(true);
  });

  it("rejects missing, malformed, and cross-origin unsafe requests", () => {
    const allowedOrigin = "https://buy-crypto-dip-bot.com";
    expect(isTrustedRequestOrigin({ method: "POST", allowedOrigin })).toBe(
      false,
    );
    expect(
      isTrustedRequestOrigin({
        method: "PATCH",
        origin: "not-a-url",
        allowedOrigin,
      }),
    ).toBe(false);
    expect(
      isTrustedRequestOrigin({
        method: "POST",
        origin: "https://attacker.example",
        allowedOrigin,
      }),
    ).toBe(false);
  });

  it("uses a valid same-origin Referer when Origin is absent", () => {
    expect(
      isTrustedRequestOrigin({
        method: "POST",
        referer: "https://buy-crypto-dip-bot.com/dashboard",
        allowedOrigin: "https://buy-crypto-dip-bot.com",
      }),
    ).toBe(true);
  });

  it("does not trust a request Host as the non-local policy", () => {
    expect(
      resolveAllowedWebOrigin("https://attacker.example", {
        APP_RUNTIME: "non-local",
      }),
    ).toBe("https://buy-crypto-dip-bot.com");
  });
});
