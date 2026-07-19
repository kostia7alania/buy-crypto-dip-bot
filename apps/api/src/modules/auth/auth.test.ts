import { describe, expect, it } from "vitest";
import {
  signTelegramLogin,
  TELEGRAM_AUTH_MAX_AGE_SECONDS,
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
});
