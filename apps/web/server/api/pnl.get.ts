export default defineEventHandler((event) =>
  authenticatedApiFetch(event, "/pnl"),
);
