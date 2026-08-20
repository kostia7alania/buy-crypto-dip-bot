export default defineEventHandler((event) =>
  authenticatedApiFetch(event, "/performance"),
);
