export default defineEventHandler(async () => {
  try {
    return await apiFetch("/pnl");
  } catch (error) {
    console.error("Failed to fetch PnL from API:", error);
    return { positions: [], totals: null };
  }
});
