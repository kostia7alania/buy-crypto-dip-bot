import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { isPublicPath, requireUser } from "./principal.middleware.js";

describe("isPublicPath", () => {
  it.each([
    "/health",
    "/version",
    "/market",
    "/market/ticker",
    "/backtest",
    "/risk",
    "/risk/status",
    "/auth/telegram",
    "/auth/logout",
  ])("treats %s as public", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each([
    "/strategies",
    "/strategies/abc-123",
    "/orders",
    "/audit",
    "/pnl",
    "/performance",
    "/auth/me",
  ])("treats %s as private", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });

  it("does not let a prefix match a longer unrelated segment", () => {
    // "/risky-business" must not inherit "/risk"'s public status.
    expect(isPublicPath("/riskier")).toBe(false);
    expect(isPublicPath("/marketing-site")).toBe(false);
    expect(isPublicPath("/healthcheck")).toBe(false);
  });

  it("treats an unknown new route as private by default", () => {
    expect(isPublicPath("/some-future-route")).toBe(false);
  });
});

describe("requireUser", () => {
  it("returns the principal when one is present", () => {
    const principal = {
      sessionId: "00000000-0000-4000-8000-000000000001",
      userId: "u1",
      sessionKind: "WEB" as const,
      telegramUserId: "42",
      telegramChatId: "42",
      username: "kostia",
      firstName: "Kostia",
    };
    expect(requireUser({ get: () => principal })).toBe(principal);
  });

  it("throws rather than returning undefined when the route is misconfigured", () => {
    expect(() => requireUser({ get: () => undefined })).toThrow(
      /without a user principal/,
    );
  });
});

describe("private routes without a session", () => {
  it.each([
    "/strategies",
    "/orders",
    "/audit",
    "/pnl",
    "/performance",
  ])("refuses GET %s with 401", async (path) => {
    const res = await createApp().request(path);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHENTICATED" });
  });

  it("refuses a mutation without a session", async () => {
    const res = await createApp().request("/strategies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "BTCUSDT" }),
    });
    expect(res.status).toBe(401);
  });

  it("refuses a garbage session token", async () => {
    const res = await createApp().request("/orders", {
      headers: { "x-user-session": "not-a-real-token" },
    });
    expect(res.status).toBe(401);
  });

  it("still serves public safety status without a session", async () => {
    const res = await createApp().request("/risk/status");
    expect(res.status).toBe(200);
  });

  it("refuses authoritative identity without a live session", async () => {
    const res = await createApp().request("/auth/me");
    expect(res.status).toBe(401);
  });
});
