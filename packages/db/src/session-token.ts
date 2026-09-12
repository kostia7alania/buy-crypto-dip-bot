import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Primitives for the `api_sessions` table.
//
// These live in the db package because both the API (which mints a session
// after a verified Telegram Login) and the bot (which is itself an authority
// on Telegram identity) need to agree byte-for-byte on how a token is hashed
// and when it stops being usable. Two independent implementations of that
// agreement is a bug waiting to happen.
//
// Only the SHA-256 hash of a token is ever persisted, so a database dump
// cannot be replayed as a login.

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // matches the BFF cookie
export const SESSION_IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_CLEANUP_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_TOKEN_BYTES = 32;

// 64 lowercase hex characters. Anything else is rejected before it ever
// reaches the database, so malformed input cannot become a query.
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export const createSessionToken = (): string =>
  randomBytes(SESSION_TOKEN_BYTES).toString("hex");

export const hashSessionToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const isValidSessionTokenFormat = (token: unknown): token is string =>
  typeof token === "string" && TOKEN_PATTERN.test(token);

export const sessionExpiryFrom = (now: Date = new Date()): Date =>
  new Date(now.getTime() + SESSION_TTL_MS);

/**
 * The stored shape a session check needs. Kept structural so the predicate
 * below stays pure and testable without a database.
 */
export interface StoredSession {
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export type SessionVerdict =
  | { usable: true }
  | { usable: false; reason: "REVOKED" | "EXPIRED" | "IDLE_EXPIRED" };

export const checkStoredSession = (
  session: StoredSession,
  now: Date = new Date(),
): SessionVerdict => {
  // Revocation is checked first: a session that was explicitly killed should
  // report that fact even after it would also have expired on its own.
  if (session.revokedAt !== null) return { usable: false, reason: "REVOKED" };
  if (session.expiresAt.getTime() <= now.getTime()) {
    return { usable: false, reason: "EXPIRED" };
  }
  const lastActivityAt = session.lastUsedAt ?? session.createdAt;
  if (lastActivityAt.getTime() + SESSION_IDLE_TTL_MS <= now.getTime()) {
    return { usable: false, reason: "IDLE_EXPIRED" };
  }
  return { usable: true };
};

/**
 * Constant-time comparison of two token hashes.
 *
 * Lookups go through the unique index on `token_hash`, so this is belt and
 * braces rather than the primary defence — but a hash comparison that leaks
 * timing is free to avoid.
 */
export const sessionHashesMatch = (a: string, b: string): boolean => {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};
