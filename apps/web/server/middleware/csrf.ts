import {
  isTrustedRequestOrigin,
  resolveAllowedWebOrigin,
} from "../utils/csrf.js";

export default defineEventHandler((event) => {
  const requestUrl = getRequestURL(event);
  const trusted = isTrustedRequestOrigin({
    method: event.method,
    origin: getHeader(event, "origin"),
    referer: getHeader(event, "referer"),
    allowedOrigin: resolveAllowedWebOrigin(requestUrl.origin),
  });

  if (!trusted) {
    throw createError({ statusCode: 403, statusMessage: "ORIGIN_REJECTED" });
  }
});
