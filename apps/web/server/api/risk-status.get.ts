export default defineEventHandler(async (event) => {
  const observedAt = new Date().toISOString();
  const data = await authenticatedApiFetch<Record<string, unknown>>(
    event,
    "/risk/status",
  );

  return { ...data, apiReachable: true, observedAt };
});
