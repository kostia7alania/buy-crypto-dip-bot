import { buildSafeErrorResponse } from "./utils/error-response.js";
import { logWebError, webCorrelationId } from "./utils/operational-log.js";

const FALLBACK_CORRELATION_ID = "op_unavailable";

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "cache-control": "no-store",
  "content-security-policy": "script-src 'none'; frame-ancestors 'none';",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

export default defineNitroErrorHandler((error, event) => {
  // Nitro invokes its built-in handler next unless this event is marked handled.
  // Marking it here also prevents Nitro from raw-logging the original error if
  // the response socket fails while this boundary is running.
  event._handled = true;

  let correlationId = FALLBACK_CORRELATION_ID;
  try {
    correlationId = webCorrelationId(event);
  } catch {
    // A degraded response still gets a safe, non-secret correlation marker.
  }

  const response = buildSafeErrorResponse(error, correlationId);

  if (response.statusCode >= 500) {
    try {
      logWebError(event, "NITRO_REQUEST_FAILED", error);
    } catch {
      // Logging must never turn the error boundary into another raw error.
    }
  }

  try {
    if (event.node.res.headersSent) return;

    event.node.res.statusCode = response.statusCode;
    event.node.res.statusMessage = response.statusMessage;
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      event.node.res.setHeader(name, value);
    }
    event.node.res.setHeader("x-request-id", correlationId);
    event.node.res.end(JSON.stringify(response.body));
  } catch {
    // The event remains handled, so Nitro cannot fall through to its raw logger.
  }
});
