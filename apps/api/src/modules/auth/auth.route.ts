import {
  auditEventRow,
  createSessionToken,
  hashSessionToken,
  schema,
  sessionExpiryFrom,
} from "@buy-crypto-dip-bot/db";
import {
  AUDIT_SCHEMA_VERSION,
  type AuditEventV1,
} from "@buy-crypto-dip-bot/shared-types";
import { lt } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import { getDb } from "../../db.js";
import { logApiError, logApiEvent } from "../../operational-log.js";
import {
  TELEGRAM_AUTH_MAX_AGE_SECONDS,
  type TelegramLoginPayload,
  telegramLoginAbuseKey,
  telegramLoginFingerprint,
  verifyTelegramLogin,
} from "./auth.service.js";
import {
  ANONYMOUS_AUTH_SUBJECT_ID,
  consumeTelegramLoginAttempt,
  TELEGRAM_LOGIN_SOURCE_POLICY,
  TELEGRAM_LOGIN_USER_POLICY,
} from "./login-abuse.repository.js";
import {
  type AppEnv,
  requireUser,
  SESSION_HEADER,
} from "./principal.middleware.js";
import {
  listActiveSessions,
  revokeAllOwnedSessions,
  revokeOwnedSession,
  revokeSession,
} from "./session.repository.js";

const LOGIN_SOURCE_HEADER = "x-telegram-login-source";
const LOGIN_SOURCE_PATTERN = /^[0-9a-f]{64}$/;

type AuthRejectionReason = Extract<
  AuditEventV1,
  { type: "AUTH_LOGIN_REJECTED" }
>["reasonCode"];
type StandardAuthRejectionReason = Exclude<AuthRejectionReason, "RATE_LIMITED">;

const authRejectionEvent = (
  correlationId: string,
  reasonCode: StandardAuthRejectionReason,
): AuditEventV1 => ({
  schemaVersion: AUDIT_SCHEMA_VERSION,
  type: "AUTH_LOGIN_REJECTED",
  scope: "SYSTEM",
  userId: null,
  actor: { kind: "ANONYMOUS", channel: "WEB" },
  reasonCode,
  correlationId,
  subject: { type: "USER", id: ANONYMOUS_AUTH_SUBJECT_ID },
  payloadClass: "SECURITY",
  payload: {},
});

const recordAuthRejection = async (
  correlationId: string,
  reasonCode: StandardAuthRejectionReason,
): Promise<void> => {
  try {
    await getDb()
      .insert(schema.auditEvents)
      .values(auditEventRow(authRejectionEvent(correlationId, reasonCode)));
  } catch (error) {
    logApiError("AUTH_REJECTION_AUDIT_FAILED", error, correlationId);
  }
};

const telegramLoginSchema = v.object({
  id: v.number(),
  auth_date: v.number(),
  hash: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
  first_name: v.optional(v.string()),
  last_name: v.optional(v.string()),
  username: v.optional(v.string()),
  photo_url: v.optional(v.string()),
});

const revokeSessionSchema = v.object({
  sessionId: v.pipe(
    v.string(),
    v.regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ),
  ),
});

export const authRoutes = new Hono<AppEnv>()
  .post("/telegram", async (c) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return c.json({ error: "TELEGRAM_LOGIN_NOT_CONFIGURED" }, 503);
    }

    // The BFF derives this pseudonym from the network source. The API accepts
    // only the fixed HMAC shape and HMACs it again with the bot secret before
    // persistence; raw IP addresses never cross this boundary.
    const sourcePseudonym = c.req.header(LOGIN_SOURCE_HEADER);
    if (!sourcePseudonym || !LOGIN_SOURCE_PATTERN.test(sourcePseudonym)) {
      logApiEvent(
        "TELEGRAM_LOGIN_SOURCE_REJECTED",
        "WARN",
        c.get("correlationId"),
      );
      await recordAuthRejection(c.get("correlationId"), "INVALID_PAYLOAD");
      return c.json({ error: "INVALID_LOGIN_SOURCE" }, 400);
    }

    const db = getDb();
    const sourceDecision = await consumeTelegramLoginAttempt(
      db,
      telegramLoginAbuseKey(botToken, "SOURCE", sourcePseudonym),
      TELEGRAM_LOGIN_SOURCE_POLICY,
      c.get("correlationId"),
    );
    if (!sourceDecision.allowed) {
      c.header("Retry-After", String(sourceDecision.retryAfterSeconds));
      logApiEvent(
        "TELEGRAM_LOGIN_RATE_LIMITED",
        "WARN",
        c.get("correlationId"),
      );
      return c.json(
        {
          error: "RATE_LIMITED",
          retryAfterSeconds: sourceDecision.retryAfterSeconds,
        },
        429,
      );
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      await recordAuthRejection(c.get("correlationId"), "INVALID_PAYLOAD");
      return c.json({ error: "INVALID_PAYLOAD" }, 400);
    }
    const parsed = v.safeParse(telegramLoginSchema, body);
    if (!parsed.success) {
      logApiEvent(
        "TELEGRAM_LOGIN_PAYLOAD_REJECTED",
        "WARN",
        c.get("correlationId"),
      );
      await recordAuthRejection(c.get("correlationId"), "INVALID_PAYLOAD");
      return c.json({ error: "INVALID_PAYLOAD" }, 400);
    }

    const payload: TelegramLoginPayload = parsed.output;
    const verdict = verifyTelegramLogin(payload, botToken);
    if (!verdict.ok) {
      logApiEvent(
        "TELEGRAM_LOGIN_SIGNATURE_REJECTED",
        "WARN",
        c.get("correlationId"),
      );
      const rejectionReason: StandardAuthRejectionReason =
        verdict.reason === "BAD_HASH"
          ? "INVALID_SIGNATURE"
          : payload.auth_date > Math.floor(Date.now() / 1000) + 300
            ? "AUTH_PAYLOAD_FROM_FUTURE"
            : "AUTH_PAYLOAD_EXPIRED";
      await recordAuthRejection(c.get("correlationId"), rejectionReason);
      return c.json({ error: verdict.reason }, 401);
    }

    try {
      const telegramUserId = String(payload.id);
      const userDecision = await consumeTelegramLoginAttempt(
        db,
        telegramLoginAbuseKey(botToken, "USER", telegramUserId),
        TELEGRAM_LOGIN_USER_POLICY,
        c.get("correlationId"),
      );
      if (!userDecision.allowed) {
        c.header("Retry-After", String(userDecision.retryAfterSeconds));
        logApiEvent(
          "TELEGRAM_LOGIN_RATE_LIMITED",
          "WARN",
          c.get("correlationId"),
        );
        return c.json(
          {
            error: "RATE_LIMITED",
            retryAfterSeconds: userDecision.retryAfterSeconds,
          },
          429,
        );
      }
      const now = new Date();
      await db
        .delete(schema.telegramLoginPresentations)
        .where(lt(schema.telegramLoginPresentations.expiresAt, now));
      const token = createSessionToken();
      const expiresAt = sessionExpiryFrom(now);
      const result = await db.transaction(async (tx) => {
        const [presentation] = await tx
          .insert(schema.telegramLoginPresentations)
          .values({
            fingerprint: telegramLoginFingerprint(payload),
            telegramUserId,
            authDate: new Date(payload.auth_date * 1000),
            expiresAt: new Date(
              now.getTime() + TELEGRAM_AUTH_MAX_AGE_SECONDS * 1000,
            ),
          })
          .onConflictDoNothing()
          .returning({
            fingerprint: schema.telegramLoginPresentations.fingerprint,
          });
        if (!presentation) {
          await tx
            .insert(schema.auditEvents)
            .values(
              auditEventRow(
                authRejectionEvent(c.get("correlationId"), "LOGIN_REPLAYED"),
              ),
            );
          return null;
        }

        const [user] = await tx
          .insert(schema.users)
          .values({
            telegramUserId,
            // Web identity is not notification consent. Only a successful
            // private /start may establish telegram_chat_id and enable delivery.
            telegramChatId: null,
            username: payload.username ?? null,
            firstName: payload.first_name ?? null,
          })
          .onConflictDoUpdate({
            target: schema.users.telegramUserId,
            set: {
              username: payload.username ?? null,
              firstName: payload.first_name ?? null,
            },
          })
          .returning();
        if (!user) throw new Error("upsert returned no row");

        await tx.insert(schema.apiSessions).values({
          userId: user.id,
          tokenHash: hashSessionToken(token),
          kind: "WEB",
          correlationId: c.get("correlationId"),
          expiresAt,
        });
        await tx.insert(schema.auditEvents).values(
          auditEventRow({
            schemaVersion: AUDIT_SCHEMA_VERSION,
            type: "AUTH_LOGIN_SUCCEEDED",
            scope: "USER",
            userId: user.id,
            actor: { kind: "USER", channel: "WEB", userId: user.id },
            reasonCode: "TELEGRAM_IDENTITY_VERIFIED",
            correlationId: c.get("correlationId"),
            subject: { type: "USER", id: user.id },
            payloadClass: "SECURITY",
            payload: { sessionKind: "WEB" },
          }),
        );
        return user;
      });
      if (!result) {
        logApiEvent(
          "TELEGRAM_LOGIN_REPLAY_REJECTED",
          "WARN",
          c.get("correlationId"),
        );
        return c.json({ error: "LOGIN_REPLAYED" }, 401);
      }

      return c.json({
        user: {
          id: result.id,
          telegramUserId: result.telegramUserId,
          username: result.username,
          firstName: result.firstName,
        },
        session: { token, expiresAt: expiresAt.toISOString() },
      });
    } catch (error) {
      logApiError("TELEGRAM_LOGIN_FAILED", error, c.get("correlationId"));
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  })
  .get("/me", (c) => {
    const user = requireUser(c);
    return c.json({
      user: {
        id: user.userId,
        telegramUserId: user.telegramUserId,
        username: user.username,
        firstName: user.firstName,
      },
    });
  })
  .get("/sessions", async (c) => {
    const user = requireUser(c);
    const sessions = await listActiveSessions(
      getDb(),
      user.userId,
      c.req.header(SESSION_HEADER),
    );
    return c.json({ sessions });
  })
  .post("/sessions/revoke", async (c) => {
    const user = requireUser(c);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "INVALID_PAYLOAD" }, 400);
    }
    const parsed = v.safeParse(revokeSessionSchema, body);
    if (!parsed.success) return c.json({ error: "INVALID_PAYLOAD" }, 400);

    const revoked = await revokeOwnedSession(
      getDb(),
      user,
      parsed.output.sessionId,
      c.get("correlationId"),
    );
    return c.json({ revoked });
  })
  .post("/sessions/revoke-all", async (c) => {
    const user = requireUser(c);
    const revoked = await revokeAllOwnedSessions(
      getDb(),
      user,
      c.get("correlationId"),
    );
    return c.json({ revoked });
  })
  // Logout. Always reports success: telling a caller whether the token it
  // presented was real would turn logout into a session-probing oracle.
  .post("/logout", async (c) => {
    const token = c.req.header("x-user-session");
    try {
      await revokeSession(
        getDb(),
        token,
        c.get("user"),
        c.get("correlationId"),
      );
    } catch (error) {
      logApiError("SESSION_REVOCATION_FAILED", error, c.get("correlationId"));
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
    return c.json({ success: true });
  });
