export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  try {
    return await apiFetch("/backtest", { query: q });
  } catch (error: any) {
    console.error("Backtest via API failed:", error);
    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.data?.error || "Backtest failed",
    });
  }
});
