export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  try {
    return await authenticatedApiFetch(event, "/backtest", { query: q });
  } catch (error) {
    const fetchError = error as {
      status?: number;
      data?: { error?: string };
    };
    console.error("Backtest via API failed:", error);
    throw createError({
      statusCode: fetchError.status || 500,
      statusMessage: fetchError.data?.error || "Backtest failed",
    });
  }
});
