export default defineEventHandler(async () => {
  const apiUrl = process.env.API_URL ?? "http://localhost:8787";
  try {
    const list = await $fetch(`${apiUrl}/strategies`);
    return list;
  } catch (error) {
    console.error("Failed to fetch strategies from API:", error);
    return [];
  }
});
