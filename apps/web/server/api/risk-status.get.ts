export default defineEventHandler(async () => {
  const apiUrl = process.env.API_URL ?? "http://localhost:8787";
  try {
    const data = await $fetch(`${apiUrl}/risk/status`);
    return data;
  } catch (error) {
    console.error(
      "Failed to fetch risk status from API, returning backup:",
      error,
    );
    return {
      mode: "DRY_RUN",
      liveTradingEnabled: false,
      maxDailySpendUsdt: 20,
      maxWeeklySpendUsdt: 100,
      orderLikeActionsRequireApproval: true,
    };
  }
});
