import { type SessionUser, useAppSession } from "../../utils/session.js";

// The widget payload is forwarded verbatim to the trading API, which owns
// the bot token and performs the actual HMAC verification. The BFF only
// turns a verified user into a session cookie.
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  let verified: { user: SessionUser };
  try {
    verified = await apiFetch<{ user: SessionUser }>("/auth/telegram", {
      method: "POST",
      body,
    });
  } catch (error) {
    console.error("Telegram login rejected by API:", error);
    throw createError({ statusCode: 401, statusMessage: "LOGIN_REJECTED" });
  }

  const session = await useAppSession(event);
  await session.update({ user: verified.user });
  return { user: verified.user };
});
