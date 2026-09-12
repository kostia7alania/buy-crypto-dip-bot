import { describe, expect, it } from "vitest";
import {
  checkStoredSession,
  createSessionToken,
  hashSessionToken,
  isValidSessionTokenFormat,
  SESSION_IDLE_TTL_MS,
  SESSION_TTL_MS,
  sessionExpiryFrom,
  sessionHashesMatch,
} from "./session-token.js";

const NOW = new Date("2026-07-31T00:00:00.000Z");
const minutes = (n: number) => n * 60 * 1000;
const liveSession = (
  overrides: Partial<{
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    lastUsedAt: Date | null;
  }> = {},
) => ({
  expiresAt: new Date(NOW.getTime() + minutes(10)),
  revokedAt: null,
  createdAt: NOW,
  lastUsedAt: null,
  ...overrides,
});

describe("createSessionToken", () => {
  it("produces a 64-character hex token", () => {
    expect(createSessionToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not repeat itself", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => createSessionToken()),
    );
    expect(tokens.size).toBe(100);
  });
});

describe("hashSessionToken", () => {
  it("is deterministic", () => {
    const token = createSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("does not return the token itself", () => {
    const token = createSessionToken();
    expect(hashSessionToken(token)).not.toBe(token);
  });

  it("gives different tokens different hashes", () => {
    expect(hashSessionToken(createSessionToken())).not.toBe(
      hashSessionToken(createSessionToken()),
    );
  });
});

describe("isValidSessionTokenFormat", () => {
  it("accepts a freshly minted token", () => {
    expect(isValidSessionTokenFormat(createSessionToken())).toBe(true);
  });

  it.each([
    ["empty string", ""],
    ["too short", "abc123"],
    ["uppercase hex", "A".repeat(64)],
    ["non-hex characters", "z".repeat(64)],
    ["too long", `${"a".repeat(64)}0`],
    ["sql-ish payload", "' OR 1=1 --"],
  ])("rejects %s", (_label, value) => {
    expect(isValidSessionTokenFormat(value)).toBe(false);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["number", 12345],
    ["object", { token: "a".repeat(64) }],
  ])("rejects non-string %s", (_label, value) => {
    expect(isValidSessionTokenFormat(value)).toBe(false);
  });
});

describe("sessionExpiryFrom", () => {
  it("is exactly one TTL ahead of the given moment", () => {
    expect(sessionExpiryFrom(NOW).getTime()).toBe(
      NOW.getTime() + SESSION_TTL_MS,
    );
  });
});

describe("checkStoredSession", () => {
  it("accepts a live session", () => {
    const session = liveSession();
    expect(checkStoredSession(session, NOW)).toEqual({ usable: true });
  });

  it("rejects an expired session", () => {
    const session = liveSession({
      expiresAt: new Date(NOW.getTime() - minutes(1)),
    });
    expect(checkStoredSession(session, NOW)).toEqual({
      usable: false,
      reason: "EXPIRED",
    });
  });

  it("rejects a session expiring exactly now", () => {
    const session = liveSession({ expiresAt: NOW });
    expect(checkStoredSession(session, NOW)).toEqual({
      usable: false,
      reason: "EXPIRED",
    });
  });

  it("rejects a revoked session immediately, before its expiry", () => {
    const session = liveSession({
      revokedAt: new Date(NOW.getTime() - minutes(1)),
    });
    expect(checkStoredSession(session, NOW)).toEqual({
      usable: false,
      reason: "REVOKED",
    });
  });

  it("reports revocation rather than expiry when a session is both", () => {
    const session = liveSession({
      expiresAt: new Date(NOW.getTime() - minutes(10)),
      revokedAt: new Date(NOW.getTime() - minutes(20)),
    });
    expect(checkStoredSession(session, NOW)).toEqual({
      usable: false,
      reason: "REVOKED",
    });
  });

  it("rejects a session idle for the full inactivity window", () => {
    const session = liveSession({
      expiresAt: new Date(NOW.getTime() + SESSION_IDLE_TTL_MS * 2),
      createdAt: new Date(NOW.getTime() - SESSION_IDLE_TTL_MS),
    });
    expect(checkStoredSession(session, NOW)).toEqual({
      usable: false,
      reason: "IDLE_EXPIRED",
    });
  });

  it("uses last activity instead of creation time for the idle window", () => {
    const session = liveSession({
      expiresAt: new Date(NOW.getTime() + SESSION_IDLE_TTL_MS),
      createdAt: new Date(NOW.getTime() - SESSION_IDLE_TTL_MS * 2),
      lastUsedAt: new Date(NOW.getTime() - minutes(1)),
    });
    expect(checkStoredSession(session, NOW)).toEqual({ usable: true });
  });
});

describe("sessionHashesMatch", () => {
  it("matches identical hashes", () => {
    const hash = hashSessionToken(createSessionToken());
    expect(sessionHashesMatch(hash, hash)).toBe(true);
  });

  it("rejects different hashes", () => {
    expect(
      sessionHashesMatch(
        hashSessionToken(createSessionToken()),
        hashSessionToken(createSessionToken()),
      ),
    ).toBe(false);
  });

  it("rejects hashes of differing length without throwing", () => {
    expect(sessionHashesMatch("abc", "abcd")).toBe(false);
  });
});
