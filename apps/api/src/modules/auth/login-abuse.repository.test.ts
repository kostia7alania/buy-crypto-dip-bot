import { schema } from "@buy-crypto-dip-bot/db";
import type { TestDatabase } from "@buy-crypto-dip-bot/db/testing";
import { createTestDb } from "@buy-crypto-dip-bot/db/testing";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { getDb } from "../../db.js";
import { telegramLoginAbuseKey } from "./auth.service.js";
import {
  consumeTelegramLoginAttempt,
  TELEGRAM_LOGIN_SOURCE_POLICY,
  TELEGRAM_LOGIN_USER_POLICY,
  type TelegramLoginAbusePolicy,
} from "./login-abuse.repository.js";

let harness: TestDatabase;
const db = () => harness.db as unknown as ReturnType<typeof getDb>;

beforeEach(async () => {
  harness = await createTestDb();
}, 60_000);

afterEach(async () => {
  await harness?.close();
});

const NOW = new Date("2026-08-02T20:00:00.000Z");
const BOT_SECRET = "test-bot-secret-never-persist";

describe("consumeTelegramLoginAttempt", () => {
  it("blocks the first excess source attempt and preserves an exact countdown", async () => {
    const rawSource = "source-pseudonym-from-bff";
    const abuseKey = telegramLoginAbuseKey(BOT_SECRET, "SOURCE", rawSource);

    for (
      let attempt = 0;
      attempt < TELEGRAM_LOGIN_SOURCE_POLICY.maxAttempts;
      attempt += 1
    ) {
      await expect(
        consumeTelegramLoginAttempt(
          db(),
          abuseKey,
          TELEGRAM_LOGIN_SOURCE_POLICY,
          `source_attempt_${attempt}`,
          NOW,
        ),
      ).resolves.toEqual({ allowed: true });
    }

    await expect(
      consumeTelegramLoginAttempt(
        db(),
        abuseKey,
        TELEGRAM_LOGIN_SOURCE_POLICY,
        "source_attempt_blocked",
        NOW,
      ),
    ).resolves.toEqual({ allowed: false, retryAfterSeconds: 300 });

    const [stateAtBlock] = await harness.db
      .select()
      .from(schema.telegramLoginAbuseLimits)
      .where(eq(schema.telegramLoginAbuseLimits.abuseKey, abuseKey));
    expect(stateAtBlock).toMatchObject({
      abuseKey,
      attemptCount: 11,
      blockedUntil: new Date("2026-08-02T20:05:00.000Z"),
    });
    expect(JSON.stringify(stateAtBlock)).not.toContain(rawSource);
    expect(JSON.stringify(stateAtBlock)).not.toContain(BOT_SECRET);

    const duringBlock = new Date(NOW.getTime() + 123_400);
    await expect(
      consumeTelegramLoginAttempt(
        db(),
        abuseKey,
        TELEGRAM_LOGIN_SOURCE_POLICY,
        "source_attempt_during_block",
        duringBlock,
      ),
    ).resolves.toEqual({ allowed: false, retryAfterSeconds: 177 });

    const [stateDuringBlock] = await harness.db
      .select()
      .from(schema.telegramLoginAbuseLimits)
      .where(eq(schema.telegramLoginAbuseLimits.abuseKey, abuseKey));
    expect(stateDuringBlock?.blockedUntil).toEqual(stateAtBlock?.blockedUntil);

    const atBoundary = new Date(NOW.getTime() + 300_000);
    await expect(
      consumeTelegramLoginAttempt(
        db(),
        abuseKey,
        TELEGRAM_LOGIN_SOURCE_POLICY,
        "source_attempt_after_block",
        atBoundary,
      ),
    ).resolves.toEqual({ allowed: true });
  });

  it("writes one structured V1 rejection without the abuse key", async () => {
    const abuseKey = telegramLoginAbuseKey(BOT_SECRET, "USER", "3000003");
    for (
      let attempt = 0;
      attempt <= TELEGRAM_LOGIN_USER_POLICY.maxAttempts;
      attempt += 1
    ) {
      await consumeTelegramLoginAttempt(
        db(),
        abuseKey,
        TELEGRAM_LOGIN_USER_POLICY,
        `user_attempt_${attempt}`,
        NOW,
      );
    }

    const events = await harness.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.reasonCode, "RATE_LIMITED"));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      schemaVersion: 1,
      action: "AUTH_LOGIN_REJECTED",
      scope: "SYSTEM",
      userId: null,
      actorKind: "ANONYMOUS",
      actorChannel: "WEB",
      actorUserId: null,
      entityType: "user",
      entityId: "00000000-0000-4000-8000-000000000000",
      reasonCode: "RATE_LIMITED",
      payloadClass: "SECURITY",
      payload: { limiter: "USER", retryAfterSeconds: 300 },
    });
    expect(JSON.stringify(events)).not.toContain(abuseKey);
    expect(JSON.stringify(events)).not.toContain("3000003");
  });

  it("serializes concurrent attempts so only one crosses the limit", async () => {
    const policy: TelegramLoginAbusePolicy = {
      limiter: "SOURCE",
      maxAttempts: 1,
      windowSeconds: 60,
      blockSeconds: 300,
    };
    const abuseKey = telegramLoginAbuseKey(
      BOT_SECRET,
      "SOURCE",
      "concurrent-source",
    );

    const decisions = await Promise.all([
      consumeTelegramLoginAttempt(
        db(),
        abuseKey,
        policy,
        "concurrent_attempt_a",
        NOW,
      ),
      consumeTelegramLoginAttempt(
        db(),
        abuseKey,
        policy,
        "concurrent_attempt_b",
        NOW,
      ),
    ]);

    expect(decisions).toContainEqual({ allowed: true });
    expect(decisions).toContainEqual({
      allowed: false,
      retryAfterSeconds: 300,
    });
  });

  it("rolls the block state back when its audit event is invalid", async () => {
    const policy: TelegramLoginAbusePolicy = {
      limiter: "USER",
      maxAttempts: 1,
      windowSeconds: 60,
      blockSeconds: 300,
    };
    const abuseKey = telegramLoginAbuseKey(BOT_SECRET, "USER", "atomic-user");
    await consumeTelegramLoginAttempt(
      db(),
      abuseKey,
      policy,
      "atomic_attempt_first",
      NOW,
    );

    await expect(
      consumeTelegramLoginAttempt(db(), abuseKey, policy, "bad", NOW),
    ).rejects.toThrow("AUDIT_EVENT_INVALID");

    const [state] = await harness.db
      .select()
      .from(schema.telegramLoginAbuseLimits)
      .where(eq(schema.telegramLoginAbuseLimits.abuseKey, abuseKey));
    expect(state).toMatchObject({ attemptCount: 1, blockedUntil: null });
  });
});
