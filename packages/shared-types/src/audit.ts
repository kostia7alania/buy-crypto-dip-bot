export const AUDIT_SCHEMA_VERSION = 1 as const;

export type AuditActor =
  | { kind: "USER"; channel: "WEB" | "TELEGRAM"; userId: string }
  | { kind: "SYSTEM"; channel: "API" | "RUNNER" | "MIGRATOR" }
  | { kind: "ANONYMOUS"; channel: "WEB" | "TELEGRAM" };

export type AuditSubjectType = "USER" | "SESSION" | "STRATEGY" | "ORDER";
export type AuditPayloadClass =
  | "SECURITY"
  | "TENANT_CONFIGURATION"
  | "TENANT_FINANCIAL"
  | "OPERATIONAL";

interface AuditBase {
  schemaVersion: typeof AUDIT_SCHEMA_VERSION;
  correlationId: string;
  subject: { type: AuditSubjectType; id: string };
}

interface TenantAuditBase extends AuditBase {
  scope: "USER";
  userId: string;
}

interface SystemAuditBase extends AuditBase {
  scope: "SYSTEM";
  userId: null;
}

export type AuditEventV1 =
  | (TenantAuditBase & {
      type: "AUTH_LOGIN_SUCCEEDED";
      actor: { kind: "USER"; channel: "WEB"; userId: string };
      reasonCode: "TELEGRAM_IDENTITY_VERIFIED";
      payloadClass: "SECURITY";
      payload: { sessionKind: "WEB" };
    })
  | (SystemAuditBase & {
      type: "AUTH_LOGIN_REJECTED";
      actor: { kind: "ANONYMOUS"; channel: "WEB" };
      reasonCode:
        | "INVALID_PAYLOAD"
        | "INVALID_SIGNATURE"
        | "AUTH_PAYLOAD_EXPIRED"
        | "AUTH_PAYLOAD_FROM_FUTURE"
        | "LOGIN_REPLAYED";
      payloadClass: "SECURITY";
      payload: Record<string, never>;
    })
  | (SystemAuditBase & {
      type: "AUTH_LOGIN_REJECTED";
      actor: { kind: "ANONYMOUS"; channel: "WEB" };
      reasonCode: "RATE_LIMITED";
      payloadClass: "SECURITY";
      payload: {
        limiter: "SOURCE" | "USER";
        retryAfterSeconds: number;
      };
    })
  | (TenantAuditBase & {
      type: "SESSION_REVOKED";
      actor: { kind: "USER"; channel: "WEB" | "TELEGRAM"; userId: string };
      reasonCode: "LOGOUT" | "USER_REQUESTED";
      payloadClass: "SECURITY";
      payload: { target: "ONE" | "ALL"; revokedCount: number };
    })
  | (TenantAuditBase & {
      type: "NOTIFICATION_BINDING_VERIFIED";
      actor: { kind: "USER"; channel: "TELEGRAM"; userId: string };
      reasonCode: "PRIVATE_START_CONFIRMED";
      payloadClass: "SECURITY";
      payload: Record<string, never>;
    })
  | (TenantAuditBase & {
      type: "STRATEGY_CREATED";
      actor:
        | { kind: "USER"; channel: "WEB" | "TELEGRAM"; userId: string }
        | { kind: "SYSTEM"; channel: "RUNNER" };
      reasonCode:
        | "USER_REQUESTED"
        | "ONBOARDING_APPLIED"
        | "OPERATOR_DEFAULT_SEED";
      payloadClass: "TENANT_CONFIGURATION";
      payload: { symbol: string; mode: "DRY_RUN" };
    })
  | (TenantAuditBase & {
      type: "STRATEGY_UPDATED";
      actor: { kind: "USER"; channel: "WEB" | "TELEGRAM"; userId: string };
      reasonCode: "USER_REQUESTED" | "ONBOARDING_APPLIED";
      payloadClass: "TENANT_CONFIGURATION";
      payload: {
        fields: Array<
          | "enabled"
          | "thresholdPercent"
          | "suggestedQuoteAmount"
          | "maxDailySpendUsdt"
          | "maxWeeklySpendUsdt"
          | "cooldownMinutes"
        >;
      };
    })
  | (TenantAuditBase & {
      type: "STRATEGIES_BULK_PAUSED" | "STRATEGIES_BULK_RESUMED";
      actor: { kind: "USER"; channel: "TELEGRAM"; userId: string };
      reasonCode: "USER_KILL_SWITCH" | "USER_REQUESTED";
      payloadClass: "TENANT_CONFIGURATION";
      payload: { affectedCount: number };
    })
  | (TenantAuditBase & {
      type: "RISK_DECISION_REJECTED" | "RISK_DECISION_APPROVED";
      actor: { kind: "SYSTEM"; channel: "RUNNER" };
      reasonCode: "RISK_POLICY_REJECTED" | "RISK_POLICY_APPROVED";
      payloadClass: "TENANT_FINANCIAL";
      payload: {
        mode: "DRY_RUN";
        policyVersion: "RISK_V1";
        reasonCodes: string[];
        orderId?: string;
      };
    })
  | (TenantAuditBase & {
      type: "PENDING_ORDER_DUPLICATE_SUPPRESSED";
      actor: { kind: "SYSTEM"; channel: "RUNNER" };
      reasonCode: "EXISTING_PENDING_ORDER";
      payloadClass: "OPERATIONAL";
      payload: { mode: "DRY_RUN" };
    })
  | (TenantAuditBase & {
      type: "DRY_RUN_ORDER_COMPLETED";
      actor:
        | { kind: "SYSTEM"; channel: "RUNNER" }
        | { kind: "USER"; channel: "TELEGRAM"; userId: string };
      reasonCode: "SCHEDULE_DUE" | "USER_FORCED_EXECUTION";
      payloadClass: "TENANT_FINANCIAL";
      payload: { from: "PENDING"; to: "COMPLETED"; mode: "DRY_RUN" };
    })
  | (TenantAuditBase & {
      type: "DRY_RUN_ORDER_CANCELLED";
      actor: { kind: "USER"; channel: "TELEGRAM"; userId: string };
      reasonCode: "USER_CANCELLED";
      payloadClass: "TENANT_FINANCIAL";
      payload: { from: "PENDING"; to: "CANCELLED"; mode: "DRY_RUN" };
    });

export const AUDIT_EVENT_TYPES = [
  "AUTH_LOGIN_SUCCEEDED",
  "AUTH_LOGIN_REJECTED",
  "SESSION_REVOKED",
  "NOTIFICATION_BINDING_VERIFIED",
  "STRATEGY_CREATED",
  "STRATEGY_UPDATED",
  "STRATEGIES_BULK_PAUSED",
  "STRATEGIES_BULK_RESUMED",
  "RISK_DECISION_REJECTED",
  "RISK_DECISION_APPROVED",
  "PENDING_ORDER_DUPLICATE_SUPPRESSED",
  "DRY_RUN_ORDER_COMPLETED",
  "DRY_RUN_ORDER_CANCELLED",
] as const;

const EVENT_TYPES = new Set<string>(AUDIT_EVENT_TYPES);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const SYMBOL_PATTERN = /^[A-Z0-9]{3,20}$/;
const FIELD_NAMES = new Set([
  "enabled",
  "thresholdPercent",
  "suggestedQuoteAmount",
  "maxDailySpendUsdt",
  "maxWeeklySpendUsdt",
  "cooldownMinutes",
]);
const RISK_REASON_CODES = new Set([
  "LIVE_TRADING_DISABLED",
  "SYMBOL_NOT_ALLOWED",
  "NON_POSITIVE_QUOTE_AMOUNT",
  "DAILY_LIMIT_EXCEEDED",
  "WEEKLY_LIMIT_EXCEEDED",
  "NO_BUY_SIGNAL",
]);

const invalid = (code: string): never => {
  throw new Error(`AUDIT_EVENT_INVALID:${code}`);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
  code: string,
): void => {
  const actual = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (
    actual.length !== allowed.length ||
    actual.some((key, index) => key !== allowed[index])
  ) {
    invalid(code);
  }
};

const uuid = (value: unknown, code: string): string => {
  const stringValue = typeof value === "string" ? value : invalid(code);
  if (!UUID_PATTERN.test(stringValue)) invalid(code);
  return stringValue;
};

const nonNegativeInteger = (value: unknown, code: string): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) invalid(code);
  return Number(value);
};

const positiveInteger = (value: unknown, code: string): number => {
  const integer = nonNegativeInteger(value, code);
  if (integer === 0) invalid(code);
  return integer;
};

const assertActor = (
  actorInput: unknown,
  scope: unknown,
  userId: unknown,
): void => {
  const actor = isRecord(actorInput) ? actorInput : invalid("ACTOR");
  if (typeof actor.kind !== "string") invalid("ACTOR");
  if (actor.kind === "USER") {
    exactKeys(actor, ["kind", "channel", "userId"], "ACTOR_KEYS");
    if (actor.channel !== "WEB" && actor.channel !== "TELEGRAM") {
      invalid("ACTOR_CHANNEL");
    }
    if (scope !== "USER" || actor.userId !== userId) {
      invalid("ACTOR_OWNER");
    }
    uuid(actor.userId, "ACTOR_USER_ID");
    return;
  }
  exactKeys(actor, ["kind", "channel"], "ACTOR_KEYS");
  if (actor.kind === "SYSTEM") {
    if (!new Set(["API", "RUNNER", "MIGRATOR"]).has(String(actor.channel))) {
      invalid("ACTOR_CHANNEL");
    }
    return;
  }
  if (actor.kind === "ANONYMOUS") {
    if (actor.channel !== "WEB" && actor.channel !== "TELEGRAM") {
      invalid("ACTOR_CHANNEL");
    }
    return;
  }
  invalid("ACTOR_KIND");
};

const assertPayload = (
  type: string,
  payloadInput: unknown,
  reasonCode: unknown,
): void => {
  const payload = isRecord(payloadInput)
    ? payloadInput
    : invalid("PAYLOAD_OBJECT");
  switch (type) {
    case "AUTH_LOGIN_SUCCEEDED":
      exactKeys(payload, ["sessionKind"], "PAYLOAD_KEYS");
      if (payload.sessionKind !== "WEB") invalid("SESSION_KIND");
      return;
    case "AUTH_LOGIN_REJECTED":
      if (reasonCode === "RATE_LIMITED") {
        exactKeys(payload, ["limiter", "retryAfterSeconds"], "PAYLOAD_KEYS");
        if (payload.limiter !== "SOURCE" && payload.limiter !== "USER") {
          invalid("AUTH_LIMITER");
        }
        positiveInteger(payload.retryAfterSeconds, "RETRY_AFTER_SECONDS");
        return;
      }
      exactKeys(payload, [], "PAYLOAD_KEYS");
      return;
    case "NOTIFICATION_BINDING_VERIFIED":
      exactKeys(payload, [], "PAYLOAD_KEYS");
      return;
    case "SESSION_REVOKED":
      exactKeys(payload, ["target", "revokedCount"], "PAYLOAD_KEYS");
      if (payload.target !== "ONE" && payload.target !== "ALL") {
        invalid("SESSION_TARGET");
      }
      nonNegativeInteger(payload.revokedCount, "REVOKED_COUNT");
      return;
    case "STRATEGY_CREATED":
      exactKeys(payload, ["symbol", "mode"], "PAYLOAD_KEYS");
      if (
        typeof payload.symbol !== "string" ||
        !SYMBOL_PATTERN.test(payload.symbol)
      ) {
        invalid("SYMBOL");
      }
      if (payload.mode !== "DRY_RUN") invalid("MODE");
      return;
    case "STRATEGY_UPDATED":
      exactKeys(payload, ["fields"], "PAYLOAD_KEYS");
      if (
        !Array.isArray(payload.fields) ||
        payload.fields.length === 0 ||
        payload.fields.some(
          (field) => typeof field !== "string" || !FIELD_NAMES.has(field),
        ) ||
        new Set(payload.fields).size !== payload.fields.length
      ) {
        invalid("STRATEGY_FIELDS");
      }
      return;
    case "STRATEGIES_BULK_PAUSED":
    case "STRATEGIES_BULK_RESUMED":
      exactKeys(payload, ["affectedCount"], "PAYLOAD_KEYS");
      nonNegativeInteger(payload.affectedCount, "AFFECTED_COUNT");
      return;
    case "RISK_DECISION_REJECTED":
    case "RISK_DECISION_APPROVED": {
      const expected =
        type === "RISK_DECISION_APPROVED"
          ? ["mode", "policyVersion", "reasonCodes", "orderId"]
          : ["mode", "policyVersion", "reasonCodes"];
      exactKeys(payload, expected, "PAYLOAD_KEYS");
      if (payload.mode !== "DRY_RUN" || payload.policyVersion !== "RISK_V1") {
        invalid("RISK_VERSION");
      }
      if (
        !Array.isArray(payload.reasonCodes) ||
        (type === "RISK_DECISION_REJECTED" &&
          payload.reasonCodes.length === 0) ||
        (type === "RISK_DECISION_APPROVED" &&
          payload.reasonCodes.length !== 0) ||
        payload.reasonCodes.some(
          (reason) =>
            typeof reason !== "string" || !RISK_REASON_CODES.has(reason),
        )
      ) {
        invalid("RISK_REASON_CODES");
      }
      if (type === "RISK_DECISION_APPROVED") uuid(payload.orderId, "ORDER_ID");
      return;
    }
    case "PENDING_ORDER_DUPLICATE_SUPPRESSED":
      exactKeys(payload, ["mode"], "PAYLOAD_KEYS");
      if (payload.mode !== "DRY_RUN") invalid("MODE");
      return;
    case "DRY_RUN_ORDER_COMPLETED":
    case "DRY_RUN_ORDER_CANCELLED":
      exactKeys(payload, ["from", "to", "mode"], "PAYLOAD_KEYS");
      if (payload.from !== "PENDING" || payload.mode !== "DRY_RUN") {
        invalid("ORDER_TRANSITION");
      }
      if (
        (type === "DRY_RUN_ORDER_COMPLETED" && payload.to !== "COMPLETED") ||
        (type === "DRY_RUN_ORDER_CANCELLED" && payload.to !== "CANCELLED")
      ) {
        invalid("ORDER_TRANSITION");
      }
      return;
    default:
      void reasonCode;
      invalid("TYPE");
  }
};

const assertSemantics = (input: Record<string, unknown>): void => {
  const actor = input.actor as Record<string, unknown>;
  const subject = input.subject as Record<string, unknown>;
  const expectCommon = (
    scope: "USER" | "SYSTEM",
    subjectType: AuditSubjectType,
    payloadClass: AuditPayloadClass,
  ) => {
    if (
      input.scope !== scope ||
      subject.type !== subjectType ||
      input.payloadClass !== payloadClass
    ) {
      invalid("SEMANTICS");
    }
  };

  switch (input.type) {
    case "AUTH_LOGIN_SUCCEEDED":
      expectCommon("USER", "USER", "SECURITY");
      if (
        actor.kind !== "USER" ||
        actor.channel !== "WEB" ||
        input.reasonCode !== "TELEGRAM_IDENTITY_VERIFIED"
      ) {
        invalid("SEMANTICS");
      }
      return;
    case "AUTH_LOGIN_REJECTED":
      expectCommon("SYSTEM", "USER", "SECURITY");
      if (
        actor.kind !== "ANONYMOUS" ||
        actor.channel !== "WEB" ||
        !new Set([
          "INVALID_PAYLOAD",
          "INVALID_SIGNATURE",
          "AUTH_PAYLOAD_EXPIRED",
          "AUTH_PAYLOAD_FROM_FUTURE",
          "LOGIN_REPLAYED",
          "RATE_LIMITED",
        ]).has(String(input.reasonCode))
      ) {
        invalid("SEMANTICS");
      }
      return;
    case "SESSION_REVOKED":
      expectCommon("USER", "SESSION", "SECURITY");
      if (
        actor.kind !== "USER" ||
        !new Set(["LOGOUT", "USER_REQUESTED"]).has(String(input.reasonCode))
      ) {
        invalid("SEMANTICS");
      }
      return;
    case "NOTIFICATION_BINDING_VERIFIED":
      expectCommon("USER", "USER", "SECURITY");
      if (
        actor.kind !== "USER" ||
        actor.channel !== "TELEGRAM" ||
        input.reasonCode !== "PRIVATE_START_CONFIRMED"
      ) {
        invalid("SEMANTICS");
      }
      return;
    case "STRATEGY_CREATED": {
      expectCommon("USER", "STRATEGY", "TENANT_CONFIGURATION");
      const isSeed = input.reasonCode === "OPERATOR_DEFAULT_SEED";
      if (
        (isSeed && (actor.kind !== "SYSTEM" || actor.channel !== "RUNNER")) ||
        (!isSeed && actor.kind !== "USER") ||
        !new Set([
          "USER_REQUESTED",
          "ONBOARDING_APPLIED",
          "OPERATOR_DEFAULT_SEED",
        ]).has(String(input.reasonCode))
      ) {
        invalid("SEMANTICS");
      }
      return;
    }
    case "STRATEGY_UPDATED":
      expectCommon("USER", "STRATEGY", "TENANT_CONFIGURATION");
      if (
        actor.kind !== "USER" ||
        !new Set(["USER_REQUESTED", "ONBOARDING_APPLIED"]).has(
          String(input.reasonCode),
        )
      ) {
        invalid("SEMANTICS");
      }
      return;
    case "STRATEGIES_BULK_PAUSED":
    case "STRATEGIES_BULK_RESUMED":
      expectCommon("USER", "USER", "TENANT_CONFIGURATION");
      if (
        actor.kind !== "USER" ||
        actor.channel !== "TELEGRAM" ||
        (input.type === "STRATEGIES_BULK_PAUSED" &&
          input.reasonCode !== "USER_KILL_SWITCH") ||
        (input.type === "STRATEGIES_BULK_RESUMED" &&
          input.reasonCode !== "USER_REQUESTED")
      ) {
        invalid("SEMANTICS");
      }
      return;
    case "RISK_DECISION_REJECTED":
    case "RISK_DECISION_APPROVED":
      expectCommon("USER", "STRATEGY", "TENANT_FINANCIAL");
      if (
        actor.kind !== "SYSTEM" ||
        actor.channel !== "RUNNER" ||
        (input.type === "RISK_DECISION_REJECTED" &&
          input.reasonCode !== "RISK_POLICY_REJECTED") ||
        (input.type === "RISK_DECISION_APPROVED" &&
          input.reasonCode !== "RISK_POLICY_APPROVED")
      ) {
        invalid("SEMANTICS");
      }
      return;
    case "PENDING_ORDER_DUPLICATE_SUPPRESSED":
      expectCommon("USER", "STRATEGY", "OPERATIONAL");
      if (
        actor.kind !== "SYSTEM" ||
        actor.channel !== "RUNNER" ||
        input.reasonCode !== "EXISTING_PENDING_ORDER"
      ) {
        invalid("SEMANTICS");
      }
      return;
    case "DRY_RUN_ORDER_COMPLETED":
      expectCommon("USER", "ORDER", "TENANT_FINANCIAL");
      if (
        (input.reasonCode === "SCHEDULE_DUE" &&
          (actor.kind !== "SYSTEM" || actor.channel !== "RUNNER")) ||
        (input.reasonCode === "USER_FORCED_EXECUTION" &&
          (actor.kind !== "USER" || actor.channel !== "TELEGRAM")) ||
        !new Set(["SCHEDULE_DUE", "USER_FORCED_EXECUTION"]).has(
          String(input.reasonCode),
        )
      ) {
        invalid("SEMANTICS");
      }
      return;
    case "DRY_RUN_ORDER_CANCELLED":
      expectCommon("USER", "ORDER", "TENANT_FINANCIAL");
      if (
        actor.kind !== "USER" ||
        actor.channel !== "TELEGRAM" ||
        input.reasonCode !== "USER_CANCELLED"
      ) {
        invalid("SEMANTICS");
      }
      return;
    default:
      invalid("TYPE");
  }
};

export const assertAuditEventV1: (
  value: unknown,
) => asserts value is AuditEventV1 = (value) => {
  const input = isRecord(value) ? value : invalid("OBJECT");
  exactKeys(
    input,
    [
      "schemaVersion",
      "type",
      "scope",
      "userId",
      "actor",
      "reasonCode",
      "correlationId",
      "subject",
      "payloadClass",
      "payload",
    ],
    "ENVELOPE_KEYS",
  );
  if (input.schemaVersion !== AUDIT_SCHEMA_VERSION) invalid("VERSION");
  const eventType =
    typeof input.type === "string" ? input.type : invalid("TYPE");
  if (!EVENT_TYPES.has(eventType)) invalid("TYPE");
  if (
    typeof input.correlationId !== "string" ||
    !CORRELATION_ID_PATTERN.test(input.correlationId)
  ) {
    invalid("CORRELATION_ID");
  }
  if (input.scope === "USER") uuid(input.userId, "USER_ID");
  else if (input.scope === "SYSTEM" && input.userId !== null) {
    invalid("SYSTEM_OWNER");
  } else if (input.scope !== "SYSTEM") invalid("SCOPE");

  assertActor(input.actor, input.scope, input.userId);
  const subject = isRecord(input.subject) ? input.subject : invalid("SUBJECT");
  exactKeys(subject, ["type", "id"], "SUBJECT_KEYS");
  if (
    !new Set(["USER", "SESSION", "STRATEGY", "ORDER"]).has(String(subject.type))
  ) {
    invalid("SUBJECT_TYPE");
  }
  uuid(subject.id, "SUBJECT_ID");
  if (
    !new Set([
      "SECURITY",
      "TENANT_CONFIGURATION",
      "TENANT_FINANCIAL",
      "OPERATIONAL",
    ]).has(String(input.payloadClass))
  ) {
    invalid("PAYLOAD_CLASS");
  }

  assertSemantics(input);
  assertPayload(eventType, input.payload, input.reasonCode);

  let serialized = "";
  try {
    serialized = JSON.stringify(input.payload);
  } catch {
    invalid("PAYLOAD_JSON");
  }
  if (new TextEncoder().encode(serialized).byteLength > 8192) {
    invalid("PAYLOAD_SIZE");
  }
};
