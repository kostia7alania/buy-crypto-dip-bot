import { auditEventRow, schema } from "@buy-crypto-dip-bot/db";
import { AUDIT_SCHEMA_VERSION } from "@buy-crypto-dip-bot/shared-types";
import { and, eq, isNull, lt, lte, or } from "drizzle-orm";
import type { getDb } from "../../db.js";
import type { TelegramLoginAbuseLimiter } from "./auth.service.js";

type Db = ReturnType<typeof getDb>;

export const ANONYMOUS_AUTH_SUBJECT_ID = "00000000-0000-4000-8000-000000000000";

const ABUSE_KEY_PATTERN = /^[0-9a-f]{64}$/;
const RETENTION_SECONDS = 24 * 60 * 60;

export interface TelegramLoginAbusePolicy {
  limiter: TelegramLoginAbuseLimiter;
  maxAttempts: number;
  windowSeconds: number;
  blockSeconds: number;
}

export const TELEGRAM_LOGIN_SOURCE_POLICY = {
  limiter: "SOURCE",
  maxAttempts: 10,
  windowSeconds: 60,
  blockSeconds: 5 * 60,
} as const satisfies TelegramLoginAbusePolicy;

export const TELEGRAM_LOGIN_USER_POLICY = {
  limiter: "USER",
  maxAttempts: 5,
  windowSeconds: 60,
  blockSeconds: 5 * 60,
} as const satisfies TelegramLoginAbusePolicy;

export type TelegramLoginAbuseDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const retryAfterSeconds = (blockedUntil: Date, now: Date): number =>
  Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000));

/**
 * Consumes one attempt from a durable fixed window.
 *
 * The seed insert plus `FOR UPDATE` serializes both first use and later use
 * across API processes. A blocked request does not extend its block, so the
 * returned Retry-After is an exact countdown to the persisted boundary.
 */
export const consumeTelegramLoginAttempt = async (
  db: Db,
  abuseKey: string,
  policy: TelegramLoginAbusePolicy,
  correlationId: string,
  now: Date = new Date(),
): Promise<TelegramLoginAbuseDecision> => {
  if (!ABUSE_KEY_PATTERN.test(abuseKey)) {
    throw new Error("TELEGRAM_LOGIN_ABUSE_KEY_INVALID");
  }

  return db.transaction(async (tx) => {
    const retentionCutoff = new Date(now.getTime() - RETENTION_SECONDS * 1000);
    await tx
      .delete(schema.telegramLoginAbuseLimits)
      .where(
        and(
          lt(schema.telegramLoginAbuseLimits.updatedAt, retentionCutoff),
          or(
            isNull(schema.telegramLoginAbuseLimits.blockedUntil),
            lte(schema.telegramLoginAbuseLimits.blockedUntil, now),
          ),
        ),
      );

    await tx
      .insert(schema.telegramLoginAbuseLimits)
      .values({
        abuseKey,
        windowStartedAt: now,
        attemptCount: 0,
        updatedAt: now,
      })
      .onConflictDoNothing();

    const [state] = await tx
      .select()
      .from(schema.telegramLoginAbuseLimits)
      .where(eq(schema.telegramLoginAbuseLimits.abuseKey, abuseKey))
      .for("update");
    if (!state) throw new Error("TELEGRAM_LOGIN_ABUSE_STATE_MISSING");

    const recordRateLimit = async (seconds: number) => {
      await tx.insert(schema.auditEvents).values(
        auditEventRow({
          schemaVersion: AUDIT_SCHEMA_VERSION,
          type: "AUTH_LOGIN_REJECTED",
          scope: "SYSTEM",
          userId: null,
          actor: { kind: "ANONYMOUS", channel: "WEB" },
          reasonCode: "RATE_LIMITED",
          correlationId,
          subject: { type: "USER", id: ANONYMOUS_AUTH_SUBJECT_ID },
          payloadClass: "SECURITY",
          payload: {
            limiter: policy.limiter,
            retryAfterSeconds: seconds,
          },
        }),
      );
    };

    if (state.blockedUntil && state.blockedUntil.getTime() > now.getTime()) {
      const seconds = retryAfterSeconds(state.blockedUntil, now);
      await tx
        .update(schema.telegramLoginAbuseLimits)
        .set({ updatedAt: now })
        .where(eq(schema.telegramLoginAbuseLimits.abuseKey, abuseKey));
      await recordRateLimit(seconds);
      return { allowed: false, retryAfterSeconds: seconds };
    }

    const windowExpired =
      now.getTime() - state.windowStartedAt.getTime() >=
      policy.windowSeconds * 1000;
    const windowStartedAt = windowExpired ? now : state.windowStartedAt;
    const attemptCount = windowExpired ? 1 : state.attemptCount + 1;
    const blockedUntil =
      attemptCount > policy.maxAttempts
        ? new Date(now.getTime() + policy.blockSeconds * 1000)
        : null;

    await tx
      .update(schema.telegramLoginAbuseLimits)
      .set({
        windowStartedAt,
        attemptCount,
        blockedUntil,
        updatedAt: now,
      })
      .where(eq(schema.telegramLoginAbuseLimits.abuseKey, abuseKey));

    if (!blockedUntil) return { allowed: true };

    const seconds = retryAfterSeconds(blockedUntil, now);
    await recordRateLimit(seconds);
    return { allowed: false, retryAfterSeconds: seconds };
  });
};
