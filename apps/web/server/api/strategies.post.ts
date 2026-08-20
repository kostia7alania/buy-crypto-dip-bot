export default defineEventHandler(async (event) => {
  await requireAppPrincipal(event);
  const body = await readBody(event);
  return authenticatedApiFetch(event, "/strategies", {
    method: "POST",
    body,
  });
});
