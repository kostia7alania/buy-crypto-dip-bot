export default defineEventHandler((event) =>
  authenticatedApiFetch(event, "/strategies"),
);
