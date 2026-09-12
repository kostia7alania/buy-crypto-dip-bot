import { describe, expect, it } from "vitest";
import {
  signTelegramLogin,
  TELEGRAM_AUTH_MAX_AGE_SECONDS,
  telegramLoginAbuseKey,
  telegramLoginFingerprint,
  verifyTelegramLogin,
} from "./auth.service.js";

const BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
const NOW = 1_800_000_000;

const validPayload = () => {
  const fields = {
    id: 42,
    auth_date: NOW - 60,
    first_name: "Kostia",
    username: "kostia",
  };
  return { ...fields, hash: signTelegramLogin(fields, BOT_TOKEN) };
};

describe("verifyTelegramLogin", () => {
  it("accepts a correctly signed, fresh payload", () => {
    expect(verifyTelegramLogin(validPayload(), BOT_TOKEN, NOW)).toEqual({
      ok: true,
    });
  });

  it("accepts a payload without optional fields", () => {
    const fields = { id: 42, auth_date: NOW - 60 };
    const payload = { ...fields, hash: signTelegramLogin(fields, BOT_TOKEN) };
    expect(verifyTelegramLogin(payload, BOT_TOKEN, NOW)).toEqual({ ok: true });
  });

  it("rejects a tampered field", () => {
    const payload = { ...validPayload(), id: 43 };
    expect(verifyTelegramLogin(payload, BOT_TOKEN, NOW)).toEqual({
      ok: false,
      reason: "BAD_HASH",
    });
  });

  it("rejects a hash signed with a different bot token", () => {
    const payload = validPayload();
    expect(verifyTelegramLogin(payload, "999999:other-token", NOW)).toEqual({
      ok: false,
      reason: "BAD_HASH",
    });
  });

  it("rejects garbage hashes without throwing", () => {
    const payload = { ...validPayload(), hash: "not-hex" };
    expect(verifyTelegramLogin(payload, BOT_TOKEN, NOW)).toEqual({
      ok: false,
      reason: "BAD_HASH",
    });
  });

  it("rejects a stale auth_date even with a valid signature", () => {
    const fields = {
      id: 42,
      auth_date: NOW - TELEGRAM_AUTH_MAX_AGE_SECONDS - 1,
    };
    const payload = { ...fields, hash: signTelegramLogin(fields, BOT_TOKEN) };
    expect(verifyTelegramLogin(payload, BOT_TOKEN, NOW)).toEqual({
      ok: false,
      reason: "STALE_AUTH_DATE",
    });
  });

  it("rejects an auth_date far in the future", () => {
    const fields = { id: 42, auth_date: NOW + 3600 };
    const payload = { ...fields, hash: signTelegramLogin(fields, BOT_TOKEN) };
    expect(verifyTelegramLogin(payload, BOT_TOKEN, NOW)).toEqual({
      ok: false,
      reason: "STALE_AUTH_DATE",
    });
  });

  it("derives a stable non-reversible replay fingerprint", () => {
    const payload = validPayload();
    expect(telegramLoginFingerprint(payload)).toMatch(/^[0-9a-f]{64}$/);
    expect(telegramLoginFingerprint(payload)).toBe(
      telegramLoginFingerprint(payload),
    );
    expect(telegramLoginFingerprint(payload)).not.toContain(payload.hash);
  });

  it("derives domain-separated HMAC abuse keys", () => {
    const source = telegramLoginAbuseKey(BOT_TOKEN, "SOURCE", "source-token");
    const user = telegramLoginAbuseKey(BOT_TOKEN, "USER", "source-token");

    expect(source).toMatch(/^[0-9a-f]{64}$/);
    expect(source).toBe(
      telegramLoginAbuseKey(BOT_TOKEN, "SOURCE", "source-token"),
    );
    expect(source).not.toBe(user);
    expect(source).not.toContain("source-token");
    expect(source).not.toContain(BOT_TOKEN);
  });
});
