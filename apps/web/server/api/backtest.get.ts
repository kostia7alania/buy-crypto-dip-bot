export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  try {
    return await apiFetchForEvent(event, "/backtest", { query: q });
  } catch (error: any) {
    logWebError(event, "BACKTEST_FETCH_FAILED", error);
    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.data?.error || "Backtest failed",
    });
  }
});
