import {
  auditEventRow,
  checkStoredSession,
  createSessionToken,
  hashSessionToken,
  isValidSessionTokenFormat,
  SESSION_CLEANUP_GRACE_MS,
  schema,
  sessionExpiryFrom,
} from "@buy-crypto-dip-bot/db";
import {
  AUDIT_SCHEMA_VERSION,
  createCorrelationId,
} from "@buy-crypto-dip-bot/shared-types";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { getDb } from "../../db.js";
import { logApiError } from "../../operational-log.js";

type Db = ReturnType<typeof getDb>;

export interface UserPrincipal {
  sessionId: string;
  userId: string;
  sessionKind: "WEB" | "BOT_COMMAND";
  telegramUserId: string;
  telegramChatId: string | null;
  username: string | null;
  firstName: string | null;
}

/**
 * Mints a session for a user who has just proved their Telegram identity.
 * Returns the plaintext token exactly once — it is never readable again,
 * because only its hash is stored.
 */
export const issueSession = async (
  db: Db,
  userId: string,
  correlationId: string = createCorrelationId(),
): Promise<{ token: string; expiresAt: Date }> => {
  const token = createSessionToken();
  const expiresAt = sessionExpiryFrom();

  await db.insert(schema.apiSessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    correlationId,
    expiresAt,
  });

  return { token, expiresAt };
};

/**
 * Resolves a presented token to the human behind it, or null.
 *
 * Returns null — never a reason — for every failure mode. A caller that could
 * distinguish "no such session" from "expired" would gain an oracle for
 * probing which tokens once existed.
 */
export const resolveSession = async (
  db: Db,
  token: unknown,
): Promise<UserPrincipal | null> => {
  if (!isValidSessionTokenFormat(token)) return null;

  const rows = await db
    .select({
      sessionId: schema.apiSessions.id,
      expiresAt: schema.apiSessions.expiresAt,
      revokedAt: schema.apiSessions.revokedAt,
      createdAt: schema.apiSessions.createdAt,
      lastUsedAt: schema.apiSessions.lastUsedAt,
      sessionKind: schema.apiSessions.kind,
      userId: schema.users.id,
      telegramUserId: schema.users.telegramUserId,
      telegramChatId: schema.users.telegramChatId,
      username: schema.users.username,
      firstName: schema.users.firstName,
    })
    .from(schema.apiSessions)
    .innerJoin(schema.users, eq(schema.apiSessions.userId, schema.users.id))
    .where(eq(schema.apiSessions.tokenHash, hashSessionToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const verdict = checkStoredSession(
    {
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
    },
    new Date(),
  );
  if (!verdict.usable) return null;

  // Best-effort activity stamp; a failure here must never deny a valid
  // session, so it is deliberately not awaited into the happy path.
  void db
    .update(schema.apiSessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiSessions.id, row.sessionId))
    .catch((error: unknown) => {
      logApiError("SESSION_ACTIVITY_STAMP_FAILED", error);
    });

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    sessionKind: row.sessionKind === "BOT_COMMAND" ? "BOT_COMMAND" : "WEB",
    telegramUserId: row.telegramUserId,
    telegramChatId: row.telegramChatId,
    username: row.username,
    firstName: row.firstName,
  };
};

/**
 * Logout. Idempotent, and silent about whether the token existed.
 */
const sessionActorChannel = (principal: UserPrincipal): "WEB" | "TELEGRAM" =>
  principal.sessionKind === "BOT_COMMAND" ? "TELEGRAM" : "WEB";

const sessionRevocationAuditRow = (
  principal: UserPrincipal,
  correlationId: string,
  subjectSessionId: string,
  reasonCode: "LOGOUT" | "USER_REQUESTED",
  target: "ONE" | "ALL",
  revokedCount: number,
) =>
  auditEventRow({
    schemaVersion: AUDIT_SCHEMA_VERSION,
    type: "SESSION_REVOKED",
    scope: "USER",
    userId: principal.userId,
    actor: {
      kind: "USER",
      channel: sessionActorChannel(principal),
      userId: principal.userId,
    },
    reasonCode,
    correlationId,
    subject: { type: "SESSION", id: subjectSessionId },
    payloadClass: "SECURITY",
    payload: { target, revokedCount },
  });

export const revokeSession = async (
  db: Db,
  token: unknown,
  principal: UserPrincipal | undefined,
  correlationId: string,
): Promise<void> => {
  // Public logout stays idempotent for missing, malformed, expired, idle, and
  // already-revoked tokens. Without a resolved principal there is no truthful
  // user actor for the mandatory audit event, so there must be no mutation.
  if (!principal || !isValidSessionTokenFormat(token)) return;

  await db.transaction(async (tx) => {
    const rows = await tx
      .update(schema.apiSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.apiSessions.id, principal.sessionId),
          eq(schema.apiSessions.userId, principal.userId),
          eq(schema.apiSessions.tokenHash, hashSessionToken(token)),
          isNull(schema.apiSessions.revokedAt),
        ),
      )
      .returning({
        id: schema.apiSessions.id,
        userId: schema.apiSessions.userId,
      });
    const revoked = rows[0];
    if (!revoked) return;

    await tx
      .insert(schema.auditEvents)
      .values(
        sessionRevocationAuditRow(
          principal,
          correlationId,
          revoked.id,
          "LOGOUT",
          "ONE",
          1,
        ),
      );
  });
};

export interface SessionSummary {
  id: string;
  kind: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  current: boolean;
}

export const listActiveSessions = async (
  db: Db,
  userId: string,
  currentToken: unknown,
): Promise<SessionSummary[]> => {
  const currentHash = isValidSessionTokenFormat(currentToken)
    ? hashSessionToken(currentToken)
    : null;
  const now = new Date();
  const rows = await db
    .select()
    .from(schema.apiSessions)
    .where(
      and(
        eq(schema.apiSessions.userId, userId),
        isNull(schema.apiSessions.revokedAt),
        gt(schema.apiSessions.expiresAt, now),
      ),
    );

  return rows
    .filter(
      (row) =>
        checkStoredSession(
          {
            expiresAt: row.expiresAt,
            revokedAt: row.revokedAt,
            createdAt: row.createdAt,
            lastUsedAt: row.lastUsedAt,
          },
          now,
        ).usable,
    )
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt.toISOString(),
      current: row.tokenHash === currentHash,
    }));
};

export const revokeOwnedSession = async (
  db: Db,
  principal: UserPrincipal,
  sessionId: string,
  correlationId: string,
): Promise<boolean> => {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(schema.apiSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.apiSessions.id, sessionId),
          eq(schema.apiSessions.userId, principal.userId),
          isNull(schema.apiSessions.revokedAt),
        ),
      )
      .returning({ id: schema.apiSessions.id });
    if (rows.length !== 1) return false;

    await tx
      .insert(schema.auditEvents)
      .values(
        sessionRevocationAuditRow(
          principal,
          correlationId,
          sessionId,
          "USER_REQUESTED",
          "ONE",
          1,
        ),
      );
    return true;
  });
};

export const revokeAllOwnedSessions = async (
  db: Db,
  principal: UserPrincipal,
  correlationId: string,
): Promise<number> => {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(schema.apiSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.apiSessions.userId, principal.userId),
          isNull(schema.apiSessions.revokedAt),
        ),
      )
      .returning({ id: schema.apiSessions.id });
    if (rows.length === 0) return 0;

    await tx
      .insert(schema.auditEvents)
      .values(
        sessionRevocationAuditRow(
          principal,
          correlationId,
          principal.sessionId,
          "USER_REQUESTED",
          "ALL",
          rows.length,
        ),
      );
    return rows.length;
  });
};

/**
 * Housekeeping for sessions that expired long ago. Retention, not security:
 * an expired row is already refused by `checkStoredSession`.
 */
export const deleteExpiredSessions = async (
  db: Db,
  before: Date = new Date(Date.now() - SESSION_CLEANUP_GRACE_MS),
): Promise<void> => {
  await db
    .delete(schema.apiSessions)
    .where(lt(schema.apiSessions.expiresAt, before));
};
