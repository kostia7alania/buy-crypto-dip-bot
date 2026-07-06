export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  try {
    return await apiFetch("/strategies", { method: "POST", body });
  } catch (error: any) {
    console.error("Failed to add strategy via API:", error);
    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.data?.error || "Internal Server Error",
    });
  }
});
