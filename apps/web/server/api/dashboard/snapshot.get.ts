export default defineEventHandler((event) =>
  authenticatedApiFetch(event, "/dashboard/snapshot"),
);
