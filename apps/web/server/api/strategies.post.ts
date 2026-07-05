export default defineEventHandler(async (event) => {
  const apiUrl = process.env.API_URL ?? "http://localhost:8787";
  const body = await readBody(event);
  try {
    const result = await $fetch(`${apiUrl}/strategies`, {
      method: "POST",
      body,
    });
    return result;
  } catch (error: any) {
    console.error("Failed to add strategy via API:", error);
    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.data?.error || "Internal Server Error",
    });
  }
});
