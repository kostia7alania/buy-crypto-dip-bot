import { type createPostgresConnection, schema } from "@buy-crypto-dip-bot/db";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import {
  classificationForTemplate,
  parseTelegramTemplate,
  type TelegramTemplateV1,
} from "./telegram-template.js";

type Db = ReturnType<typeof createPostgresConnection>["db"];
export type OutboxRecord = typeof schema.notificationOutbox.$inferSelect;

export const MAX_NOTIFICATION_ATTEMPTS = 5;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;
const SENDING_LEASE_MS = 60_000;

export const enqueueNotification = async (
  db: Db,
  input: {
    userId: string;
    orderId?: string | undefined;
    chatId: string;
    correlationId: string;
    template: TelegramTemplateV1;
  },
): Promise<OutboxRecord> => {
  const template = parseTelegramTemplate(input.template);
  const [record] = await db
    .insert(schema.notificationOutbox)
    .values({
      userId: input.userId,
      orderId: input.orderId,
      chatId: input.chatId,
      classification: classificationForTemplate(template),
      templateVersion: template.version,
      templateKey: template.key,
      renderInputs: template.inputs,
      correlationId: input.correlationId,
      nextAttemptAt: new Date(),
    })
    .returning();
  if (!record) throw new Error("NOTIFICATION_OUTBOX_INSERT_FAILED");
  return record;
};

const claimCandidates = async (
  db: Db,
  ids: string[],
  now: Date,
): Promise<OutboxRecord[]> => {
  const claimed: OutboxRecord[] = [];
  for (const id of ids) {
    const [record] = await db
      .update(schema.notificationOutbox)
      .set({
        status: "SENDING",
        attemptCount: sql`${schema.notificationOutbox.attemptCount} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.notificationOutbox.id, id),
          inArray(schema.notificationOutbox.status, ["PENDING", "RETRY"]),
          lte(schema.notificationOutbox.nextAttemptAt, now),
        ),
      )
      .returning();
    if (record) claimed.push(record);
  }
  return claimed;
};

export const claimDueNotifications = async (
  db: Db,
  now: Date = new Date(),
  limit = 20,
): Promise<OutboxRecord[]> => {
  const candidates = await db
    .select({ id: schema.notificationOutbox.id })
    .from(schema.notificationOutbox)
    .where(
      and(
        inArray(schema.notificationOutbox.status, ["PENDING", "RETRY"]),
        lte(schema.notificationOutbox.nextAttemptAt, now),
      ),
    )
    .orderBy(asc(schema.notificationOutbox.nextAttemptAt))
    .limit(limit);
  return claimCandidates(
    db,
    candidates.map((candidate) => candidate.id),
    now,
  );
};

export const claimNotificationById = async (
  db: Db,
  id: string,
  now: Date = new Date(),
): Promise<OutboxRecord | null> =>
  (await claimCandidates(db, [id], now))[0] ?? null;

export const recoverStaleSendingNotifications = async (
  db: Db,
  now: Date = new Date(),
): Promise<number> => {
  const recovered = await db
    .update(schema.notificationOutbox)
    .set({
      status: "RETRY",
      nextAttemptAt: now,
      lastErrorCode: "WORKER_LEASE_EXPIRED",
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.notificationOutbox.status, "SENDING"),
        lte(
          schema.notificationOutbox.updatedAt,
          new Date(now.getTime() - SENDING_LEASE_MS),
        ),
      ),
    )
    .returning({ id: schema.notificationOutbox.id });
  return recovered.length;
};

export const markNotificationDelivered = async (
  db: Db,
  record: OutboxRecord,
  telegramMessageId: number,
  now: Date = new Date(),
): Promise<void> => {
  await db
    .update(schema.notificationOutbox)
    .set({
      status: "DELIVERED",
      telegramMessageId,
      deliveredAt: now,
      lastErrorCode: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.notificationOutbox.id, record.id),
        eq(schema.notificationOutbox.status, "SENDING"),
      ),
    );
};

export const markNotificationFailure = async (
  db: Db,
  record: OutboxRecord,
  errorCode: string,
  now: Date = new Date(),
): Promise<"RETRY" | "FAILED"> => {
  const terminal = record.attemptCount >= MAX_NOTIFICATION_ATTEMPTS;
  const delayMs = Math.min(
    RETRY_BASE_MS * 2 ** Math.max(0, record.attemptCount - 1),
    RETRY_MAX_MS,
  );
  const status = terminal ? "FAILED" : "RETRY";
  await db
    .update(schema.notificationOutbox)
    .set({
      status,
      lastErrorCode: errorCode.slice(0, 80),
      nextAttemptAt: new Date(now.getTime() + delayMs),
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.notificationOutbox.id, record.id),
        eq(schema.notificationOutbox.status, "SENDING"),
      ),
    );
  return status;
};

export const markNotificationSkipped = async (
  db: Db,
  record: OutboxRecord,
  reasonCode: string,
  now: Date = new Date(),
): Promise<void> => {
  await db
    .update(schema.notificationOutbox)
    .set({
      status: "SKIPPED",
      lastErrorCode: reasonCode.slice(0, 80),
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.notificationOutbox.id, record.id),
        eq(schema.notificationOutbox.status, "SENDING"),
      ),
    );
};
