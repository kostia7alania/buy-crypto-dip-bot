const SAFE_STATUS_MESSAGE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

const DEFAULT_STATUS_MESSAGES: Readonly<Record<number, string>> = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  422: "UNPROCESSABLE_CONTENT",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_SERVER_ERROR",
  502: "UPSTREAM_UNAVAILABLE",
  503: "SERVICE_UNAVAILABLE",
  504: "UPSTREAM_TIMEOUT",
};

interface SafeErrorPayload {
  error: true;
  statusCode: number;
  statusMessage: string;
  message: string;
  correlationId: string;
}

export interface SafeErrorResponse {
  statusCode: number;
  statusMessage: string;
  body: SafeErrorPayload;
}

const readProperty = (error: unknown, property: string): unknown => {
  if ((typeof error !== "object" && typeof error !== "function") || !error) {
    return undefined;
  }

  try {
    return Reflect.get(error, property);
  } catch {
    return undefined;
  }
};

const safeStatusCode = (error: unknown): number => {
  if (readProperty(error, "unhandled") || readProperty(error, "fatal")) {
    return 500;
  }

  const candidate = readProperty(error, "statusCode");
  return typeof candidate === "number" &&
    Number.isInteger(candidate) &&
    candidate >= 400 &&
    candidate <= 599
    ? candidate
    : 500;
};

const safeStatusMessage = (error: unknown, statusCode: number): string => {
  if (statusCode === 500) return DEFAULT_STATUS_MESSAGES[500] as string;

  const candidate = readProperty(error, "statusMessage");
  if (
    typeof candidate === "string" &&
    SAFE_STATUS_MESSAGE_PATTERN.test(candidate)
  ) {
    return candidate;
  }

  return (
    DEFAULT_STATUS_MESSAGES[statusCode] ??
    (statusCode >= 500 ? "SERVER_ERROR" : "REQUEST_FAILED")
  );
};

export const buildSafeErrorResponse = (
  error: unknown,
  correlationId: string,
): SafeErrorResponse => {
  const statusCode = safeStatusCode(error);
  const statusMessage = safeStatusMessage(error, statusCode);

  return {
    statusCode,
    statusMessage,
    body: {
      error: true,
      statusCode,
      statusMessage,
      message: statusMessage,
      correlationId,
    },
  };
};
