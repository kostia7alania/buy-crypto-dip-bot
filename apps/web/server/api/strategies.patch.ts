export default defineEventHandler(async (event) => {
  const apiUrl = process.env.API_URL ?? "http://localhost:8787";
  const body = (await readBody(event)) as {
    id: string;
    enabled?: boolean;
    config?: any;
  };
  if (!body.id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Strategy ID is required.",
    });
  }

  const { id, ...updates } = body;
  try {
    const result = await $fetch(`${apiUrl}/strategies/${id}`, {
      method: "PATCH",
      body: updates,
    });
    return result;
  } catch (error: any) {
    console.error(`Failed to update strategy ${id} via API:`, error);
    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.data?.error || "Internal Server Error",
    });
  }
});
