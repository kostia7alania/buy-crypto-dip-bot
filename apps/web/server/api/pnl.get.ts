import { requireCaller } from "../utils/session.js";

export default defineEventHandler(async (event) => {
  const { apiSessionToken } = await requireCaller(event);
  try {
    return await apiFetchAsForEvent(event, apiSessionToken, "/pnl");
  } catch (error) {
    // A zeroed PnL is a claim about money. Never invent one.
    logWebError(event, "PNL_FETCH_FAILED", error);
    throw upstreamError(error, "PNL_UNAVAILABLE");
  }
});
