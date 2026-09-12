import { requireCaller } from "../utils/session.js";

export default defineEventHandler(async (event) => {
  const { apiSessionToken } = await requireCaller(event);
  const body = (await readBody(event)) as {
    id: string;
    enabled?: boolean;
    config?: any;
  };
  if (!body.id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Strategy ID is required.",
    });
  }

  const { id, ...updates } = body;
  try {
    // Ownership is enforced by the API against the session principal — the
    // BFF must never be the thing that decides whose strategy this is.
    return await apiFetchAsForEvent(
      event,
      apiSessionToken,
      `/strategies/${id}`,
      {
        method: "PATCH",
        body: updates,
      },
    );
  } catch (error: any) {
    logWebError(event, "STRATEGY_UPDATE_FAILED", error);
    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.data?.error || "Internal Server Error",
    });
  }
});
