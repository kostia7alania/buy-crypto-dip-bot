import { hashSessionToken, schema } from "@buy-crypto-dip-bot/db";
import type { TestDatabase } from "@buy-crypto-dip-bot/db/testing";
import { createTestDb } from "@buy-crypto-dip-bot/db/testing";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BOT_SESSION_TTL_MS, getSessionTokenFor } from "./caller.js";

let harness: TestDatabase;

beforeEach(async () => {
  harness = await createTestDb();
});

afterEach(async () => {
  await harness?.close();
});

describe("bot command session provenance", () => {
  it("stores a bounded kind and command correlation without the bearer token", async () => {
    const [user] = await harness.db
      .insert(schema.users)
      .values({
        telegramUserId: "bot-session-user",
        telegramChatId: "bot-session-user",
        notificationEnabledAt: new Date(),
      })
      .returning();
    if (!user) throw new Error("failed to seed bot session user");
    const before = Date.now();
    const correlationId = "telegram_update_session_1234";

    const token = await getSessionTokenFor(
      {
        id: user.id,
        telegramUserId: user.telegramUserId,
        telegramChatId: user.telegramChatId as string,
      },
      correlationId,
      harness.db as unknown as Parameters<typeof getSessionTokenFor>[2],
    );

    const [session] = await harness.db
      .select()
      .from(schema.apiSessions)
      .where(eq(schema.apiSessions.tokenHash, hashSessionToken(token)));
    expect(session).toMatchObject({
      userId: user.id,
      kind: "BOT_COMMAND",
      correlationId,
      revokedAt: null,
    });
    expect(session?.tokenHash).not.toBe(token);
    expect(session?.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + BOT_SESSION_TTL_MS,
    );
    expect(session?.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + BOT_SESSION_TTL_MS,
    );
  });
});
