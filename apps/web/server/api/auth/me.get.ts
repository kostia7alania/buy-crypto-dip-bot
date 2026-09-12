import { type SessionUser, useAppSession } from "../../utils/session.js";

export default defineEventHandler(async (event) => {
  const session = await useAppSession(event);
  const token = session.data.apiSessionToken;
  if (!token) {
    if (session.data.user) await session.clear();
    return { user: null };
  }

  try {
    const authoritative = await apiFetchAsForEvent<{ user: SessionUser }>(
      event,
      token,
      "/auth/me",
    );
    if (!session.data.user || session.data.user.id !== authoritative.user.id) {
      await session.update({
        user: authoritative.user,
        apiSessionToken: token,
      });
    }
    return authoritative;
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number(error.status)
        : undefined;
    if (status === 401) {
      await session.clear();
      return { user: null };
    }
    logWebError(event, "AUTH_STATUS_FETCH_FAILED", error);
    throw upstreamError(error, "AUTH_STATUS_UNAVAILABLE");
  }
});
