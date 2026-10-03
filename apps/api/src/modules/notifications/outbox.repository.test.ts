import { schema } from "@buy-crypto-dip-bot/db";
import type { TestDatabase } from "@buy-crypto-dip-bot/db/testing";
import { createTestDb } from "@buy-crypto-dip-bot/db/testing";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "../../db.js";
import { processNotificationOutbox } from "../runner/runner.service.js";
import {
  claimDueNotifications,
  enqueueNotification,
  markNotificationDelivered,
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "fake-delivery-secret");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>(async (_url, init) => {
        signal = init?.signal;
        return new Response("unread failure body", { status: 503 });
      }),
    );
    const queued = await enqueueNotification(db(), {
      userId,
      chatId: "outbox-user",
      correlationId: "outbox_retry_1",
      template: digestTemplate(),
    });
    await processNotificationOutbox(db());

    expect(signal?.aborted).toBe(true);
    expect(await readRecord(queued.id)).toMatchObject({
      status: "RETRY",
      lastErrorCode: "HTTP_503",
      attemptCount: 1,
    });
  });

  it.each([
    "headers",
    "body",
  ] as const)("retries a recipient with stalled %s and delivers the next recipient without an immediate retry", async (stage) => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "fake-delivery-secret");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const [otherUser] = await harness.db
      .insert(schema.users)
      .values({
        telegramUserId: "other-outbox-user",
        telegramChatId: "other-outbox-user",
        notificationEnabledAt: new Date(),
      })
      .returning();
    if (!otherUser) throw new Error("failed to seed next recipient");
    const first = await enqueueNotification(db(), {
      userId,
      chatId: "outbox-user",
      correlationId: "outbox_timeout_1",
      template: digestTemplate(),
    });
    const second = await enqueueNotification(db(), {
      userId: otherUser.id,
      chatId: "other-outbox-user",
      correlationId: "outbox_timeout_2",
      template: digestTemplate(),
    });
    // Make the stalled recipient deterministically first in the due queue.
    await harness.db
      .update(schema.notificationOutbox)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(schema.notificationOutbox.id, first.id));

    const waiting = Promise.withResolvers<void>();
    const requests: string[] = [];
    const signals: AbortSignal[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      const { chat_id: chatId } = JSON.parse(String(init?.body)) as {
        chat_id: string;
      };
      requests.push(chatId);
      const signal = init?.signal;
      if (!signal) throw new Error("missing delivery abort signal");
      signals.push(signal);
      if (chatId === "other-outbox-user") {
        expect(await readRecord(second.id)).toMatchObject({
          status: "SENDING",
          attemptCount: 1,
          updatedAt: new Date(),
        });
        return Response.json({ result: { message_id: 42 } });
      }
      const stalled = new Promise<never>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new Error("fake-delivery-secret provider body")),
          { once: true },
        );
      });
      if (stage === "headers") {
        waiting.resolve();
        return stalled;
      }
      const response = new Response();
      vi.spyOn(response, "json").mockImplementation(() => {
        waiting.resolve();
        return stalled;
      });
      return response;
    });
    vi.stubGlobal("fetch", fetch);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });

    const dispatch = processNotificationOutbox(db());
    await waiting.promise;
    expect(await readRecord(first.id)).toMatchObject({
      status: "SENDING",
      attemptCount: 1,
    });
    expect(await readRecord(second.id)).toMatchObject({
      status: "PENDING",
      attemptCount: 0,
      updatedAt: second.updatedAt,
    });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(requests).toEqual(["outbox-user"]);
    expect(signals[0]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await dispatch;

    expect(requests).toEqual(["outbox-user", "other-outbox-user"]);
    expect(signals.map((signal) => signal.aborted)).toEqual([true, true]);
    const retried = await readRecord(first.id);
    expect(retried).toMatchObject({
      userId,
      chatId: "outbox-user",
      status: "RETRY",
      lastErrorCode: "DELIVERY_TIMEOUT",
      attemptCount: 1,
    });
    expect(retried?.nextAttemptAt.getTime()).toBe(
      (retried?.updatedAt.getTime() ?? 0) + 5_000,
    );
    expect(await readRecord(second.id)).toMatchObject({
      userId: otherUser.id,
      chatId: "other-outbox-user",
      status: "DELIVERED",
      telegramMessageId: 42,
      attemptCount: 1,
    });
    expect(warning).toHaveBeenCalledOnce();
    expect(warning.mock.calls[0]?.[0]).toContain(
      "NOTIFICATION_DELIVERY_RETRY_SCHEDULED",
    );
    expect(JSON.stringify([warning.mock.calls, info.mock.calls])).not.toMatch(
      /fake-delivery-secret|provider body|outbox-user/,
    );
    await processNotificationOutbox(db());
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
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
