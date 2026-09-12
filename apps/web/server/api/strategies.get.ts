import { requireCaller } from "../utils/session.js";

export default defineEventHandler(async (event) => {
  const { apiSessionToken } = await requireCaller(event);
  try {
    return await apiFetchAsForEvent(event, apiSessionToken, "/strategies");
  } catch (error) {
    logWebError(event, "STRATEGY_LIST_FAILED", error);
    throw upstreamError(error, "STRATEGIES_UNAVAILABLE");
  }
});
