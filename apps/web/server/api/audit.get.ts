export default defineEventHandler((event) =>
  authenticatedApiFetch(event, "/audit"),
);
