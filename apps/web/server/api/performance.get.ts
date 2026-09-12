import { requireCaller } from "../utils/session.js";

export default defineEventHandler(async (event) => {
  const { apiSessionToken } = await requireCaller(event);
  try {
    return await apiFetchAsForEvent(event, apiSessionToken, "/performance");
  } catch (error) {
    logWebError(event, "PERFORMANCE_FETCH_FAILED", error);
    throw upstreamError(error, "PERFORMANCE_UNAVAILABLE");
  }
});
