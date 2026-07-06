export default defineEventHandler(async () => {
  try {
    return await apiFetch("/strategies");
  } catch (error) {
    console.error("Failed to fetch strategies from API:", error);
    return [];
  }
});
