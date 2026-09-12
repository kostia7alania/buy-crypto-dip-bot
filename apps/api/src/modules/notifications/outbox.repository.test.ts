import { schema } from "@buy-crypto-dip-bot/db";
import type { TestDatabase } from "@buy-crypto-dip-bot/db/testing";
import { createTestDb } from "@buy-crypto-dip-bot/db/testing";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { getDb } from "../../db.js";
import {
  claimDueNotifications,
  enqueueNotification,
  markNotificationDelivered,
  markNotificationFailure,
  recoverStaleSendingNotifications,
} from "./outbox.repository.js";
import { TELEGRAM_TEMPLATE_VERSION } from "./telegram-template.js";

let harness: TestDatabase;
const db = () => harness.db as unknown as ReturnType<typeof getDb>;
let userId: string;

beforeEach(async () => {
  harness = await createTestDb();
  const [user] = await harness.db
    .insert(schema.users)
    .values({
      telegramUserId: "outbox-user",
      telegramChatId: "outbox-user",
      notificationEnabledAt: new Date(),
    })
    .returning();
  if (!user) throw new Error("failed to seed outbox user");
  userId = user.id;
});

afterEach(async () => {
  await harness?.close();
});

const readRecord = async (id: string) => {
  const [record] = await harness.db
    .select()
    .from(schema.notificationOutbox)
    .where(eq(schema.notificationOutbox.id, id));
  return record;
};

const digestTemplate = () => ({
  version: TELEGRAM_TEMPLATE_VERSION,
  key: "DAILY_DIGEST" as const,
  inputs: {
    buyCount: 1,
    dips: [{ symbol: "BTCUSDT", count: 1 }],
    spent24hUsdt: 25,
    portfolio: null,
  },
});

describe("notification outbox", () => {
  it("records requested, attempted, and delivered states", async () => {
    const queued = await enqueueNotification(db(), {
      userId,
      chatId: "outbox-user",
      correlationId: "outbox_delivery_1",
      template: digestTemplate(),
    });
    expect(queued.status).toBe("PENDING");
    expect(queued).toMatchObject({
      classification: "TENANT_FINANCIAL",
      templateVersion: 1,
      templateKey: "DAILY_DIGEST",
      correlationId: "outbox_delivery_1",
    });
    expect(queued).not.toHaveProperty("message");
    expect(queued.renderInputs).toEqual(digestTemplate().inputs);

    const [claimed] = await claimDueNotifications(db());
    expect(claimed).toMatchObject({ id: queued.id, status: "SENDING" });
    expect(claimed?.attemptCount).toBe(1);

    await markNotificationDelivered(
      db(),
      claimed as NonNullable<typeof claimed>,
      42,
    );
    expect(await readRecord(queued.id)).toMatchObject({
      status: "DELIVERED",
      telegramMessageId: 42,
      attemptCount: 1,
    });
  });

  it("keeps a failed attempt durable and schedules a retry", async () => {
    const queued = await enqueueNotification(db(), {
      userId,
      chatId: "outbox-user",
      correlationId: "outbox_retry_1",
      template: digestTemplate(),
    });
    const [claimed] = await claimDueNotifications(db());
    await markNotificationFailure(
      db(),
      claimed as NonNullable<typeof claimed>,
      "HTTP_503",
    );

    expect(await readRecord(queued.id)).toMatchObject({
      status: "RETRY",
      lastErrorCode: "HTTP_503",
      attemptCount: 1,
    });
  });

  it("lets only one worker claim a queued record", async () => {
    await enqueueNotification(db(), {
      userId,
      chatId: "outbox-user",
      correlationId: "outbox_claim_1",
      template: digestTemplate(),
    });

    const [first, second] = await Promise.all([
      claimDueNotifications(db()),
      claimDueNotifications(db()),
    ]);
    expect(first.length + second.length).toBe(1);
  });

  it("recovers a notification left SENDING by a dead worker", async () => {
    const now = new Date(Date.now() + 1_000);
    const queued = await enqueueNotification(db(), {
      userId,
      chatId: "outbox-user",
      correlationId: "outbox_recover_1",
      template: digestTemplate(),
    });
    const [claimed] = await claimDueNotifications(db(), now);
    expect(claimed?.id).toBe(queued.id);

    const recovered = await recoverStaleSendingNotifications(
      db(),
      new Date(now.getTime() + 61_000),
    );
    expect(recovered).toBe(1);
    expect(await readRecord(queued.id)).toMatchObject({
      status: "RETRY",
      lastErrorCode: "WORKER_LEASE_EXPIRED",
    });
  });
});
