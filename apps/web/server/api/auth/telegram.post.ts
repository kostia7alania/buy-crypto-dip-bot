import {
  TELEGRAM_LOGIN_SOURCE_HEADER,
  telegramLoginRateLimitFrom,
  telegramLoginSourcePseudonym,
} from "../../utils/auth-abuse-key.js";
import { type SessionUser, useAppSession } from "../../utils/session.js";

// The widget payload is forwarded verbatim to the trading API, which owns
// the bot token and performs the actual HMAC verification. The BFF only
// turns a verified user into a session cookie.
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  let verified: { user: SessionUser; session: { token: string } };
  try {
    verified = await apiFetchForEvent<{
      user: SessionUser;
      session: { token: string };
    }>(event, "/auth/telegram", {
      method: "POST",
      body,
      headers: {
        [TELEGRAM_LOGIN_SOURCE_HEADER]: telegramLoginSourcePseudonym(event),
      },
    });
  } catch (error) {
    logWebError(event, "TELEGRAM_LOGIN_REJECTED", error);
    const rateLimit = telegramLoginRateLimitFrom(error);
    if (rateLimit) {
      setResponseHeader(event, "Retry-After", rateLimit.retryAfterSeconds);
      throw createError({ statusCode: 429, statusMessage: "RATE_LIMITED" });
    }
    throw createError({ statusCode: 401, statusMessage: "LOGIN_REJECTED" });
  }

  if (!verified.session?.token) {
    logWebEvent(event, "TELEGRAM_LOGIN_RESPONSE_INCOMPLETE", "ERROR");
    throw createError({ statusCode: 502, statusMessage: "LOGIN_INCOMPLETE" });
  }

  const session = await useAppSession(event);
  await session.update({
    user: verified.user,
    apiSessionToken: verified.session.token,
  });

  // Only the user is returned. The API session token stays inside the sealed
  // cookie — putting it in the response body would hand it to the browser.
  return { user: verified.user };
});
