import { requireCaller } from "../utils/session.js";

export default defineEventHandler(async (event) => {
  const { apiSessionToken } = await requireCaller(event);
  try {
    return await apiFetchAsForEvent(event, apiSessionToken, "/orders");
  } catch (error) {
    // Deliberately not falling back to []. An empty ledger and an unreachable
    // API look identical to the user, and only one of them is true.
    logWebError(event, "ORDER_LIST_FAILED", error);
    throw upstreamError(error, "ORDERS_UNAVAILABLE");
  }
});
