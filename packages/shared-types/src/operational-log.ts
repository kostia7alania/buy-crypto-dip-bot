export type OperationalLogLevel = "INFO" | "WARN" | "ERROR";

const TOKEN_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const ERROR_CODE_PATTERN = /^[A-Z0-9_]{1,63}$/;
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;

export interface OperationalLogInput {
  service: string;
  event: string;
  level?: OperationalLogLevel;
  correlationId?: string | undefined;
}

export interface OperationalErrorLogInput extends OperationalLogInput {
  error: unknown;
}

export interface OperationalLogRecord {
  timestamp: string;
  level: OperationalLogLevel;
  service: string;
  event: string;
  correlationId: string;
  errorCode?: string;
}

const safeToken = (value: string, fallback: string): string => {
  const normalized = value.trim().toUpperCase().replaceAll("-", "_");
  return TOKEN_PATTERN.test(normalized) ? normalized : fallback;
};

const readSafeErrorCode = (error: unknown): string => {
  if ((typeof error !== "object" && typeof error !== "function") || !error) {
    return "UNKNOWN_ERROR";
  }

  try {
    const code = Reflect.get(error, "code");
    if (typeof code === "string") {
      const normalized = code.trim().toUpperCase();
      if (ERROR_CODE_PATTERN.test(normalized)) return normalized;
    }
    if (typeof code === "number" && Number.isSafeInteger(code)) {
      const normalized = String(code);
      if (ERROR_CODE_PATTERN.test(normalized)) return normalized;
    }
  } catch {
    // A hostile getter must not make logging fail or disclose its value.
  }

  return "UNKNOWN_ERROR";
};

export const createCorrelationId = (): string =>
  `op_${globalThis.crypto.randomUUID().replaceAll("-", "")}`;

export const normalizeCorrelationId = (
  candidate: string | null | undefined,
): string => {
  const value = candidate?.trim();
  return value && CORRELATION_ID_PATTERN.test(value)
    ? value
    : createCorrelationId();
};

export const buildOperationalLogRecord = (
  input: OperationalLogInput,
): OperationalLogRecord => ({
  timestamp: new Date().toISOString(),
  level: input.level ?? "INFO",
  service: safeToken(input.service, "UNKNOWN_SERVICE"),
  event: safeToken(input.event, "UNKNOWN_EVENT"),
  correlationId: normalizeCorrelationId(input.correlationId),
});

export const buildOperationalErrorLogRecord = (
  input: OperationalErrorLogInput,
): OperationalLogRecord => ({
  ...buildOperationalLogRecord({ ...input, level: input.level ?? "ERROR" }),
  errorCode: readSafeErrorCode(input.error),
});

const write = (record: OperationalLogRecord): void => {
  const serialized = JSON.stringify(record);
  if (record.level === "ERROR") {
    console.error(serialized);
    return;
  }
  if (record.level === "WARN") {
    console.warn(serialized);
    return;
  }
  console.info(serialized);
};

export const logOperationalEvent = (input: OperationalLogInput): string => {
  const record = buildOperationalLogRecord(input);
  write(record);
  return record.correlationId;
};

export const logOperationalError = (
  input: OperationalErrorLogInput,
): string => {
  const record = buildOperationalErrorLogRecord(input);
  write(record);
  return record.correlationId;
};
