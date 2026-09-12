import { requireCaller } from "../utils/session.js";

export default defineEventHandler(async (event) => {
  const { apiSessionToken } = await requireCaller(event);
  const body = await readBody(event);
  try {
    return await apiFetchAsForEvent(event, apiSessionToken, "/strategies", {
      method: "POST",
      body,
    });
  } catch (error: any) {
    logWebError(event, "STRATEGY_CREATE_FAILED", error);
    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.data?.error || "Internal Server Error",
    });
  }
});
