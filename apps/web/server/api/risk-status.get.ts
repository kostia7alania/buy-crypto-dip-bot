export default defineEventHandler(async () => {
  const observedAt = new Date().toISOString();

  try {
    const data = await apiFetch<Record<string, unknown>>("/risk/status");
    return { ...data, apiReachable: true, observedAt };
  } catch (error) {
    console.error(
      "Failed to fetch risk status from API, returning backup:",
      error,
    );
    // Degraded fallback so the dashboard still renders. apiReachable lets
    // the UI show an honest connection state instead of pretending.
    return {
      mode: "DRY_RUN",
      liveTradingEnabled: false,
      orderLikeActionsRequireApproval: true,
      apiReachable: false,
      observedAt,
    };
  }
});
