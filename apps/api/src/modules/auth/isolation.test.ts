import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";

// Negative tests from the Gate 1 matrix in docs/16_MULTI_USER_BYBIT_RESEARCH.md.
//
// These cover the checks that can be proved without a database: that access is
// refused *before* any query runs. The A-versus-B row-level cases (user A
// listing user B's orders, same-symbol independence, notification routing)
// need seeded tenants in PostgreSQL and are tracked as the remaining part of
// I10 — see plans/005-multi-user-isolation.md.
//
// Their value here is that a failure means the request reached the database at
// all, which is the failure that matters.

const PRIVATE_ROUTES = [
  "/strategies",
  "/orders",
  "/audit",
  "/pnl",
  "/performance",
] as const;

const PUBLIC_ROUTES = ["/health", "/version", "/risk/status"] as const;

const API_KEY = "test-service-key";
let previousApiKey: string | undefined;

describe("service authentication is necessary but not sufficient", () => {
  beforeEach(() => {
    previousApiKey = process.env.API_KEY;
    process.env.API_KEY = API_KEY;
  });

  afterEach(() => {
    if (previousApiKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = previousApiKey;
  });

  it.each(
    PRIVATE_ROUTES,
  )("refuses %s when a valid service key carries no user session", async (path) => {
    const res = await createApp().request(path, {
      headers: { "x-api-key": API_KEY },
    });
    // The whole point of the two-layer design: a leaked API key on its own
    // reads nobody's data.
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHENTICATED" });
  });

  it.each(
    PRIVATE_ROUTES,
  )("refuses %s when the service key itself is wrong", async (path) => {
    const res = await createApp().request(path, {
      headers: { "x-api-key": "wrong-key" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHORIZED" });
  });

  it("refuses a mutation carrying a valid service key but no session", async () => {
    const res = await createApp().request("/strategies", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({ symbol: "BTCUSDT" }),
    });
    expect(res.status).toBe(401);
  });

  it("refuses a strategy update carrying a valid service key but no session", async () => {
    const res = await createApp().request("/strategies/some-id", {
      method: "PATCH",
      headers: {
        "x-api-key": API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({ enabled: true }),
    });
    expect(res.status).toBe(401);
  });

  it.each(
    PUBLIC_ROUTES,
  )("still serves %s with only a service key", async (path) => {
    const res = await createApp().request(path, {
      headers: { "x-api-key": API_KEY },
    });
    expect(res.status).toBe(200);
  });
});

describe("forged and malformed session tokens", () => {
  it.each([
    ["an empty token", ""],
    ["a short token", "abc"],
    ["uppercase hex", "A".repeat(64)],
    ["non-hex characters", "z".repeat(64)],
    ["a well-formed but unknown token", "a1b2c3d4".repeat(8)],
    ["a SQL-shaped payload", "' OR 1=1 --"],
    [
      "a UUID that is not a session token",
      "11111111-2222-3333-4444-555555555555",
    ],
  ])("refuses %s", async (_label, token) => {
    const res = await createApp().request("/orders", {
      headers: { "x-user-session": token },
    });
    expect(res.status).toBe(401);
  });

  it("ignores a user id supplied by the caller", async () => {
    // The browser must never be able to assert who it is. Only the session
    // token decides, and there is none here.
    const res = await createApp().request("/orders", {
      headers: {
        "x-user-id": "11111111-2222-3333-4444-555555555555",
        "x-user": "admin",
      },
    });
    expect(res.status).toBe(401);
  });
});

describe("route privacy defaults", () => {
  it("keeps every user-data route private", async () => {
    const statuses = await Promise.all(
      PRIVATE_ROUTES.map(async (path) => {
        const res = await createApp().request(path);
        return [path, res.status] as const;
      }),
    );
    // Reads as a single assertion so a newly-public route fails loudly here
    // rather than quietly leaking in production.
    expect(Object.fromEntries(statuses)).toEqual({
      "/strategies": 401,
      "/orders": 401,
      "/audit": 401,
      "/pnl": 401,
      "/performance": 401,
    });
  });
});
