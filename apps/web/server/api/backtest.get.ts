export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  try {
    return await authenticatedApiFetch(event, "/backtest", { query: q });
  } catch (error) {
    const fetchError = error as {
      status?: number;
      statusCode?: number;
      statusMessage?: string;
      data?: { error?: string };
    };
    const statusCode = fetchError.statusCode ?? fetchError.status ?? 500;
    if (statusCode >= 500) {
      console.error("Backtest via API failed:", error);
    }
    throw createError({
      statusCode,
      statusMessage:
        fetchError.statusMessage ?? fetchError.data?.error ?? "Backtest failed",
    });
  }
});
