export default defineEventHandler((event) =>
  authenticatedApiFetch(event, "/orders"),
);
