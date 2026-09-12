import { requireCaller } from "../utils/session.js";

export default defineEventHandler(async (event) => {
  const { apiSessionToken } = await requireCaller(event);
  try {
    return await apiFetchAsForEvent(event, apiSessionToken, "/audit");
  } catch (error) {
    logWebError(event, "AUDIT_FETCH_FAILED", error);
    throw upstreamError(error, "AUDIT_UNAVAILABLE");
  }
});
