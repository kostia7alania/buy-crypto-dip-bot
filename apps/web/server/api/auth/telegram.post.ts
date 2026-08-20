import {
  APP_SESSION_VERSION,
  normalizeSessionUser,
  useAppSession,
} from "../../utils/session.js";

// The widget payload is forwarded verbatim to the trading API, which owns
// the bot token and performs the actual HMAC verification. The BFF only
// turns a verified user into a session cookie.
export default defineEventHandler(async (event) => {
  setPrivateResponseHeaders(event);
  const body = await readBody(event);

  let verified: { user: unknown };
  try {
    verified = await apiFetch<{ user: unknown }>("/auth/telegram", {
      method: "POST",
      body,
    });
  } catch {
    console.error("Telegram login rejected by API.");
    throw createError({ statusCode: 401, statusMessage: "LOGIN_REJECTED" });
  }

  const user = normalizeSessionUser(verified.user);
  if (!user) {
    throw createError({
      statusCode: 502,
      statusMessage: "INVALID_AUTH_PRINCIPAL",
    });
  }

  const session = await useAppSession(event);
  await session.update({ version: APP_SESSION_VERSION, user });
  return { user };
});
