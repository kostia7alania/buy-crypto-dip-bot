export default defineEventHandler(async () => {
  try {
    return await apiFetch("/orders");
  } catch (error) {
    console.error("Failed to fetch orders from API:", error);
    return [];
  }
});
