import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Verification of Telegram Login Widget payloads, per
// https://core.telegram.org/widgets/login#checking-authorization:
// the hash is HMAC-SHA256 over the alphabetically sorted `key=value`
// lines of every other field, keyed with SHA256(bot_token).

export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;

export type TelegramLoginPayload = {
  id: number;
  auth_date: number;
  hash: string;
  first_name?: string | undefined;
  last_name?: string | undefined;
  username?: string | undefined;
  photo_url?: string | undefined;
};

export type TelegramLoginVerdict =
  | { ok: true }
  | { ok: false; reason: "BAD_HASH" | "STALE_AUTH_DATE" };

export const buildDataCheckString = (
  payload: Omit<TelegramLoginPayload, "hash"> & Record<string, unknown>,
): string =>
  Object.entries(payload)
    .filter(([key, value]) => key !== "hash" && value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

export const verifyTelegramLogin = (
  payload: TelegramLoginPayload,
  botToken: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): TelegramLoginVerdict => {
  const secretKey = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secretKey)
    .update(buildDataCheckString(payload))
    .digest();

  let received: Buffer;
  try {
    received = Buffer.from(payload.hash, "hex");
  } catch {
    return { ok: false, reason: "BAD_HASH" };
  }
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return { ok: false, reason: "BAD_HASH" };
  }

  // Reject replays of old payloads; allow small clock skew into the future.
  const age = nowSeconds - payload.auth_date;
  if (age > TELEGRAM_AUTH_MAX_AGE_SECONDS || age < -300) {
    return { ok: false, reason: "STALE_AUTH_DATE" };
  }

  return { ok: true };
};

// Test helper mirroring what Telegram's servers do when signing a payload.
export const signTelegramLogin = (
  payload: Omit<TelegramLoginPayload, "hash">,
  botToken: string,
): string => {
  const secretKey = createHash("sha256").update(botToken).digest();
  return createHmac("sha256", secretKey)
    .update(buildDataCheckString(payload))
    .digest("hex");
};
