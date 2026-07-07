export default defineEventHandler(async () => {
  try {
    return await apiFetch("/performance");
  } catch (error) {
    console.error("Failed to fetch performance from API:", error);
    return { positions: [] };
  }
});
