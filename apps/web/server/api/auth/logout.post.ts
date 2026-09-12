import { useAppSession } from "../../utils/session.js";

export default defineEventHandler(async (event) => {
  const session = await useAppSession(event);
  const token = session.data.apiSessionToken;

  // Revoke server-side first so the session is dead even if the user keeps a
  // copy of the cookie. Clearing the cookie alone would leave a valid token
  // in the database.
  if (token) {
    try {
      await apiFetchForEvent(event, "/auth/logout", {
        method: "POST",
        headers: { "x-user-session": token },
      });
    } catch (error) {
      logWebError(event, "SESSION_REVOCATION_FAILED", error);
      throw upstreamError(error, "SESSION_REVOCATION_FAILED");
    }
  }

  await session.clear();
  return { user: null, revoked: Boolean(token) };
});
