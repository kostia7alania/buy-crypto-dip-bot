export default defineEventHandler(async (event) => {
  await requireAppPrincipal(event);
  const body = (await readBody(event)) as {
    id: string;
    enabled?: boolean;
    config?: unknown;
  };
  if (!body.id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Strategy ID is required.",
    });
  }

  const { id, ...updates } = body;
  return authenticatedApiFetch(event, `/strategies/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: updates,
  });
});
