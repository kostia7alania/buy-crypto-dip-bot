export default defineEventHandler(async () => {
  try {
    return await apiFetch("/audit");
  } catch (error) {
    console.error("Failed to fetch audit events from API:", error);
    return [];
  }
});
