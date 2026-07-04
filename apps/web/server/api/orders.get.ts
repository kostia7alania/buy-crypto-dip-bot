export default defineEventHandler(async () => {
  const apiUrl = process.env.API_URL ?? "http://localhost:8787";
  try {
    const list = await $fetch(`${apiUrl}/orders`);
    return list;
  } catch (error) {
    console.error("Failed to fetch orders from API:", error);
    return [];
  }
});
