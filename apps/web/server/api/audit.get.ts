export default defineEventHandler(async () => {
  const apiUrl = process.env.API_URL ?? "http://localhost:8787";
  try {
    const list = await $fetch(`${apiUrl}/audit`);
    return list;
  } catch (error) {
    console.error("Failed to fetch audit events from API:", error);
    return [];
  }
});
