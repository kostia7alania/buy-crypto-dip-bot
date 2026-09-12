export default defineEventHandler(async (event) => {
  const observedAt = new Date().toISOString();

  try {
    const data = await apiFetchForEvent<Record<string, unknown>>(
      event,
      "/risk/status",
    );
    return { ...data, apiReachable: true, observedAt };
  } catch (error) {
    logWebError(event, "RISK_STATUS_FETCH_FAILED", error);
    // Degraded fallback so the dashboard still renders. apiReachable lets
    // the UI show an honest connection state. Do not invent safety facts when
    // the authoritative API could not be reached.
    return {
      apiReachable: false,
      observedAt,
    };
  }
});
