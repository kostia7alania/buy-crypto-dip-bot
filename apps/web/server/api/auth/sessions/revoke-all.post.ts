import { useAppSession } from "../../../utils/session.js";

export default defineEventHandler(async (event) => {
  const session = await useAppSession(event);
  const token = session.data.apiSessionToken;
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "UNAUTHENTICATED" });
  }

  try {
    const result = await apiFetchAsForEvent<{ revoked: number }>(
      event,
      token,
      "/auth/sessions/revoke-all",
      { method: "POST" },
    );
    await session.clear();
    return result;
  } catch (error) {
    logWebError(event, "SESSION_REVOKE_ALL_FAILED", error);
    throw upstreamError(error, "SESSION_REVOCATION_FAILED");
  }
});
