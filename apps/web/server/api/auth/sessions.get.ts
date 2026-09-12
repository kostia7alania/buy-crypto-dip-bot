import { requireCaller } from "../../utils/session.js";

export default defineEventHandler(async (event) => {
  const caller = await requireCaller(event);
  try {
    return await apiFetchAsForEvent(
      event,
      caller.apiSessionToken,
      "/auth/sessions",
    );
  } catch (error) {
    logWebError(event, "SESSION_LIST_FAILED", error);
    throw upstreamError(error, "SESSION_LIST_UNAVAILABLE");
  }
});
