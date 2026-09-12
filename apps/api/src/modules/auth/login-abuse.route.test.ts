import { schema } from "@buy-crypto-dip-bot/db";
import type { TestDatabase } from "@buy-crypto-dip-bot/db/testing";
import { createTestDb } from "@buy-crypto-dip-bot/db/testing";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "../../db.js";

let harness: TestDatabase;

vi.mock("../../db.js", () => ({
  getDb: () => harness.db as unknown as ReturnType<typeof getDb>,
}));

vi.mock("@buy-crypto-dip-bot/exchange-bybit", () => ({
  createBybitPublicClient: () => ({
    getTicker: async () => ({ lastPrice: 1 }),
    getKlines: async () => ({
      candles: [],
      sourceAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      ageMs: 0,
      ttlMs: 30_000,
    }),
  }),
}));

const { createApp } = await import("../../app.js");
const { signTelegramLogin } = await import("./auth.service.js");

const BOT_TOKEN = "123456:login-abuse-route-test";
let previousBotToken: string | undefined;

beforeEach(async () => {
  previousBotToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
  harness = await createTestDb();
}, 60_000);

afterEach(async () => {
  if (previousBotToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = previousBotToken;
  await harness?.close();
});

const postLogin = (
  body: unknown,
  sourcePseudonym: string | undefined,
  requestId: string,
) =>
  createApp().request("/auth/telegram", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
      ...(sourcePseudonym
        ? { "x-telegram-login-source": sourcePseudonym }
        : {}),
    },
    body: JSON.stringify(body),
  });

describe("Telegram Login abuse boundary", () => {
  it("rejects a missing or malformed source pseudonym before parsing", async () => {
    const missing = await postLogin({}, undefined, "missing_source_request");
    const uppercase = await postLogin(
      {},
      "A".repeat(64),
      "uppercase_source_request",
    );

    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: "INVALID_LOGIN_SOURCE" });
    expect(uppercase.status).toBe(400);

    const limits = await harness.db
      .select()
      .from(schema.telegramLoginAbuseLimits);
    expect(limits).toHaveLength(0);
  });

  it("returns an exact 300-second source block and structured V1 audit", async () => {
    const sourcePseudonym = "a".repeat(64);
    const invalidSignature = {
      id: 3_000_003,
      auth_date: Math.floor(Date.now() / 1000),
      hash: "0".repeat(64),
    };

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await postLogin(
        invalidSignature,
        sourcePseudonym,
        `source_request_${attempt}`,
      );
      expect(response.status).toBe(401);
    }
    const blocked = await postLogin(
      invalidSignature,
      sourcePseudonym,
      "source_request_blocked",
    );

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("300");
    expect(await blocked.json()).toEqual({
      error: "RATE_LIMITED",
      retryAfterSeconds: 300,
    });

    const events = await harness.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.reasonCode, "RATE_LIMITED"));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "AUTH_LOGIN_REJECTED",
      correlationId: "source_request_blocked",
      payload: { limiter: "SOURCE", retryAfterSeconds: 300 },
    });
    expect(JSON.stringify(events)).not.toContain(sourcePseudonym);

    const [stored] = await harness.db
      .select()
      .from(schema.telegramLoginAbuseLimits);
    expect(stored?.abuseKey).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.abuseKey).not.toBe(sourcePseudonym);
  });

  it("blocks a verified user across distinct sources", async () => {
    const telegramUserId = 4_000_004;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const fields = {
        id: telegramUserId,
        auth_date: Math.floor(Date.now() / 1000),
        first_name: `User-${attempt}`,
      };
      const response = await postLogin(
        { ...fields, hash: signTelegramLogin(fields, BOT_TOKEN) },
        String(attempt + 1).padStart(64, "0"),
        `user_request_${attempt}`,
      );

      if (attempt < 5) expect(response.status).toBe(200);
      else {
        expect(response.status).toBe(429);
        expect(response.headers.get("retry-after")).toBe("300");
        expect(await response.json()).toEqual({
          error: "RATE_LIMITED",
          retryAfterSeconds: 300,
        });
      }
    }

    const events = await harness.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.reasonCode, "RATE_LIMITED"));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      correlationId: "user_request_5",
      payload: { limiter: "USER", retryAfterSeconds: 300 },
    });
    expect(JSON.stringify(events)).not.toContain(String(telegramUserId));
  });
});
