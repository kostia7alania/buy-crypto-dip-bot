export default defineEventHandler(async (event) => {
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
    return await apiFetch(`/strategies/${id}`, {
      method: "PATCH",
      body: updates,
    });
  } catch (error: any) {
    console.error(`Failed to update strategy ${id} via API:`, error);
    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.data?.error || "Internal Server Error",
    });
  }
});
