import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Identity is the Telegram account: the bot sees ctx.from.id, the web
// dashboard receives the same id via Telegram Login Widget / Mini App initData.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  telegramUserId: text("telegram_user_id").notNull().unique(),
  telegramChatId: text("telegram_chat_id"),
  notificationEnabledAt: timestamp("notification_enabled_at"),
  username: text("username"),
  firstName: text("first_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    provider: text("provider").notNull(),
    subject: text("subject").notNull(),
    profile: jsonb("profile").notNull(),
    verifiedAt: timestamp("verified_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("auth_identities_provider_subject_unique").on(
      table.provider,
      table.subject,
    ),
    unique("auth_identities_user_provider_unique").on(
      table.userId,
      table.provider,
    ),
    check(
      "auth_identities_provider_not_blank",
      sql`length(trim(${table.provider})) > 0`,
    ),
    check(
      "auth_identities_subject_not_blank",
      sql`length(trim(${table.subject})) > 0`,
    ),
  ],
);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull().default("personal"),
    personalOwnerUserId: uuid("personal_owner_user_id").references(
      () => users.id,
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("tenants_personal_owner_unique").on(table.personalOwnerUserId),
    check(
      "tenants_kind_owner_check",
      sql`(${table.kind} = 'personal' AND ${table.personalOwnerUserId} IS NOT NULL) OR (${table.kind} = 'quarantine' AND ${table.personalOwnerUserId} IS NULL)`,
    ),
  ],
).enableRLS();

export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "tenant_memberships_pk",
      columns: [table.tenantId, table.userId],
    }),
    index("tenant_memberships_user_idx").on(table.userId, table.tenantId),
    check("tenant_memberships_owner_only", sql`${table.role} = 'owner'`),
  ],
).enableRLS();

export const telegramDestinations = pgTable(
  "telegram_destinations",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    chatId: text("chat_id").notNull(),
    chatType: text("chat_type").notNull().default("private"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "telegram_destinations_pk",
      columns: [table.userId, table.chatId],
    }),
    uniqueIndex("telegram_destinations_enabled_private_chat_unique")
      .on(table.chatId)
      .where(sql`${table.chatType} = 'private' AND ${table.enabled} = true`),
    index("telegram_destinations_user_enabled_idx").on(
      table.userId,
      table.enabled,
    ),
    check(
      "telegram_destinations_chat_type_check",
      sql`${table.chatType} IN ('private', 'legacy_unknown')`,
    ),
    check(
      "telegram_destinations_unknown_disabled_check",
      sql`${table.chatType} <> 'legacy_unknown' OR ${table.enabled} = false`,
    ),
  ],
).enableRLS();

// Web sessions issued after a verified Telegram Login. The token itself is
// never stored — only its SHA-256 hash — so a database leak cannot be replayed
// as a login. The BFF keeps the plaintext token inside its sealed cookie and
// presents it to the API on every user-data request; the service `API_KEY`
// authenticates the BFF, this table authenticates the human.
export const apiSessions = pgTable(
  "api_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    kind: text("kind").notNull().default("WEB"),
    correlationId: text("correlation_id"),
    expiresAt: timestamp("expires_at").notNull(),
    // Set on logout or administrative revocation; a revoked session is dead
    // immediately, which a stateless signed token could not guarantee.
    revokedAt: timestamp("revoked_at"),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("api_sessions_token_hash_idx").on(table.tokenHash),
    index("api_sessions_user_id_idx").on(table.userId),
    index("api_sessions_correlation_id_idx").on(table.correlationId),
    check(
      "api_sessions_correlation_id_check",
      sql`${table.correlationId} IS NULL OR ${table.correlationId} ~ '^[A-Za-z0-9_-]{8,80}$'`,
    ),
  ],
);

// One correctly signed Telegram Login presentation may mint at most one web
// session. Only a SHA-256 fingerprint is stored; the signed payload and its
// Telegram hash are never persisted or logged.
export const telegramLoginPresentations = pgTable(
  "telegram_login_presentations",
  {
    fingerprint: text("fingerprint").primaryKey(),
    telegramUserId: text("telegram_user_id").notNull(),
    authDate: timestamp("auth_date").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at").notNull().defaultNow(),
  },
  (table) => [
    index("telegram_login_presentations_expires_at_idx").on(table.expiresAt),
  ],
);

// Durable login-abuse state. `abuse_key` is a domain-separated HMAC; raw
// network addresses, Telegram identities, payloads and signatures never enter
// this table.
export const telegramLoginAbuseLimits = pgTable(
  "telegram_login_abuse_limits",
  {
    abuseKey: text("abuse_key").primaryKey(),
    windowStartedAt: timestamp("window_started_at").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    blockedUntil: timestamp("blocked_until"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("telegram_login_abuse_limits_updated_at_idx").on(table.updatedAt),
    check(
      "telegram_login_abuse_limits_key_check",
      sql`${table.abuseKey} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "telegram_login_abuse_limits_attempt_count_check",
      sql`${table.attemptCount} >= 0`,
    ),
  ],
);

export const strategies = pgTable(
  "strategies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The insert trigger resolves this from userId; clients cannot select a foreign tenant.
    tenantId: uuid("tenant_id")
      .notNull()
      .default(sql`NULL`)
      .references(() => tenants.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    mode: text("mode").notNull().default("DRY_RUN"),
    enabled: boolean("enabled").notNull().default(false),
    config: jsonb("config").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("strategies_user_id_idx").on(table.userId),
    uniqueIndex("strategies_user_id_symbol_idx").on(table.userId, table.symbol),
    uniqueIndex("strategies_user_id_id_idx").on(table.userId, table.id),
    check("strategies_mode_dry_run_check", sql`${table.mode} = 'DRY_RUN'`),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Historical and SYSTEM records may have no stored tenant; RLS also checks the owner.
    tenantId: uuid("tenant_id").references(() => tenants.id),
    eventKey: text("event_key"),
    schemaVersion: smallint("schema_version").notNull().default(1),
    // Nullable during expand; see I05/I06. Operator-level events that belong
    // to no single user stay null by design even after the contract step.
    userId: uuid("user_id").references(() => users.id),
    scope: text("scope"),
    actorKind: text("actor_kind"),
    actorChannel: text("actor_channel"),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    reasonCode: text("reason_code"),
    correlationId: text("correlation_id"),
    payloadClass: text("payload_class"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_user_id_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("audit_events_scope_user_created_at_idx").on(
      table.scope,
      table.userId,
      table.createdAt,
    ),
    index("audit_events_correlation_id_idx").on(table.correlationId),
    check(
      "audit_events_v1_envelope_check",
      sql`${table.schemaVersion} = 0 OR (
        ${table.schemaVersion} = 1
        AND ${table.scope} IS NOT NULL
        AND ${table.scope} IN ('USER', 'SYSTEM')
        AND (
          (${table.scope} = 'USER' AND ${table.userId} IS NOT NULL)
          OR (${table.scope} = 'SYSTEM' AND ${table.userId} IS NULL)
        )
        AND ${table.actorKind} IS NOT NULL
        AND ${table.actorKind} IN ('USER', 'SYSTEM', 'ANONYMOUS')
        AND ${table.actorChannel} IS NOT NULL
        AND ${table.actorChannel} IN ('WEB', 'TELEGRAM', 'API', 'RUNNER', 'MIGRATOR')
        AND (
          (${table.actorKind} = 'USER' AND ${table.actorUserId} IS NOT NULL AND ${table.actorUserId} = ${table.userId})
          OR (${table.actorKind} IN ('SYSTEM', 'ANONYMOUS') AND ${table.actorUserId} IS NULL)
        )
        AND ${table.reasonCode} IS NOT NULL
        AND ${table.action} IN (
          'AUTH_LOGIN_SUCCEEDED',
          'AUTH_LOGIN_REJECTED',
          'SESSION_REVOKED',
          'NOTIFICATION_BINDING_VERIFIED',
          'STRATEGY_CREATED',
          'STRATEGY_UPDATED',
          'STRATEGIES_BULK_PAUSED',
          'STRATEGIES_BULK_RESUMED',
          'RISK_DECISION_REJECTED',
          'RISK_DECISION_APPROVED',
          'PENDING_ORDER_DUPLICATE_SUPPRESSED',
          'DRY_RUN_ORDER_COMPLETED',
          'DRY_RUN_ORDER_CANCELLED'
        )
        AND ${table.correlationId} IS NOT NULL
        AND ${table.correlationId} ~ '^[A-Za-z0-9_-]{8,80}$'
        AND ${table.payloadClass} IS NOT NULL
        AND ${table.payloadClass} IN ('SECURITY', 'TENANT_CONFIGURATION', 'TENANT_FINANCIAL', 'OPERATIONAL')
        AND jsonb_typeof(${table.payload}) = 'object'
        AND octet_length(${table.payload}::text) <= 8192
      )`,
    ),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The insert trigger resolves this from userId; clients cannot select a foreign tenant.
    tenantId: uuid("tenant_id")
      .notNull()
      .default(sql`NULL`)
      .references(() => tenants.id),
    // Denormalised owner. The strategy already knows its user, but the runner,
    // the ledger and every spend cap read orders directly and must be able to
    // scope without a join it could forget to write.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    strategyId: uuid("strategy_id")
      .notNull()
      .references(() => strategies.id),
    evaluationKey: text("evaluation_key"),
    tgChatId: text("tg_chat_id"),
    symbol: text("symbol").notNull(),
    mode: text("mode").notNull().default("DRY_RUN"),
    side: text("side").notNull(),
    quoteAmount: numeric("quote_amount").notNull(),
    price: numeric("price"),
    status: text("status").notNull(),
    riskDecisionId: uuid("risk_decision_id"),
    // When a PENDING order becomes due. Execution is DB-driven so pending
    // orders survive process restarts (no in-memory timers).
    executeAt: timestamp("execute_at"),
    // Telegram alert message id, kept so the message can be edited to its
    // final state even after a restart.
    tgMessageId: bigint("tg_message_id", { mode: "number" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("orders_user_id_created_at_idx").on(table.userId, table.createdAt),
    index("orders_strategy_id_idx").on(table.strategyId),
    uniqueIndex("orders_one_pending_per_strategy_idx")
      .on(table.userId, table.strategyId)
      .where(sql`${table.status} = 'PENDING'`),
    uniqueIndex("orders_user_id_id_idx").on(table.userId, table.id),
    foreignKey({
      name: "orders_user_id_strategy_id_strategies_user_id_id_fk",
      columns: [table.userId, table.strategyId],
      foreignColumns: [strategies.userId, strategies.id],
    }),
    check("orders_mode_dry_run_check", sql`${table.mode} = 'DRY_RUN'`),
  ],
);

export const orderReservations = pgTable(
  "order_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Filled by the same owner trigger used by strategies and orders.
    tenantId: uuid("tenant_id")
      .notNull()
      .default(sql`NULL`)
      .references(() => tenants.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    strategyId: uuid("strategy_id").notNull(),
    orderId: uuid("order_id").notNull(),
    quoteAmount: numeric("quote_amount").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    policyVersion: text("policy_version").notNull(),
    configRevision: text("config_revision").notNull(),
    strategyConfig: jsonb("strategy_config")
      .$type<Record<string, unknown>>()
      .notNull(),
    marketSnapshotKey: text("market_snapshot_key").notNull(),
    marketSnapshot: jsonb("market_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    riskSnapshot: jsonb("risk_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    unique("order_reservations_order_unique").on(table.orderId),
    index("order_reservations_tenant_snapshot_idx").on(
      table.tenantId,
      table.marketSnapshotKey,
    ),
    index("order_reservations_strategy_status_idx").on(
      table.userId,
      table.strategyId,
      table.status,
    ),
    foreignKey({
      name: "order_reservations_user_strategy_fk",
      columns: [table.userId, table.strategyId],
      foreignColumns: [strategies.userId, strategies.id],
    }),
    foreignKey({
      name: "order_reservations_user_order_fk",
      columns: [table.userId, table.orderId],
      foreignColumns: [orders.userId, orders.id],
    }),
    check(
      "order_reservations_quote_positive_check",
      sql`${table.quoteAmount} > 0`,
    ),
    check(
      "order_reservations_status_check",
      sql`${table.status} IN ('ACTIVE', 'CONSUMED', 'RELEASED')`,
    ),
    check(
      "order_reservations_resolution_check",
      sql`(${table.status} = 'ACTIVE' AND ${table.resolvedAt} IS NULL) OR (${table.status} <> 'ACTIVE' AND ${table.resolvedAt} IS NOT NULL)`,
    ),
    check(
      "order_reservations_snapshot_shape_check",
      sql`jsonb_typeof(${table.strategyConfig}) = 'object' AND jsonb_typeof(${table.marketSnapshot}) = 'object' AND jsonb_typeof(${table.riskSnapshot}) = 'object'`,
    ),
  ],
).enableRLS();

export const notificationOutbox = pgTable(
  "notification_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    orderId: uuid("order_id"),
    chatId: text("chat_id").notNull(),
    classification: text("classification").notNull(),
    templateVersion: smallint("template_version").notNull(),
    templateKey: text("template_key").notNull(),
    renderInputs: jsonb("render_inputs")
      .$type<Record<string, unknown>>()
      .notNull(),
    // Links delivery attempts and privacy-safe fallbacks back to the audited
    // or operational workflow without persisting a fully rendered message.
    correlationId: text("correlation_id").notNull(),
    status: text("status").notNull().default("PENDING"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
    lastErrorCode: text("last_error_code"),
    telegramMessageId: bigint("telegram_message_id", { mode: "number" }),
    deliveredAt: timestamp("delivered_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("notification_outbox_due_idx").on(table.status, table.nextAttemptAt),
    index("notification_outbox_user_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    foreignKey({
      name: "notification_outbox_user_id_order_id_orders_user_id_id_fk",
      columns: [table.userId, table.orderId],
      foreignColumns: [orders.userId, orders.id],
    }),
    check(
      "notification_outbox_classification_check",
      sql`${table.classification} = 'TENANT_FINANCIAL'`,
    ),
    check(
      "notification_outbox_template_check",
      sql`${table.templateVersion} = 1 AND ${table.templateKey} IN ('RISK_REJECTED', 'ORDER_PENDING', 'ORDER_COMPLETED', 'DAILY_DIGEST')`,
    ),
    check(
      "notification_outbox_render_inputs_check",
      sql`jsonb_typeof(${table.renderInputs}) = 'object' AND octet_length(${table.renderInputs}::text) <= 4096`,
    ),
    check(
      "notification_outbox_correlation_id_check",
      sql`${table.correlationId} ~ '^[A-Za-z0-9_-]{8,80}$'`,
    ),
    check(
      "notification_outbox_status_check",
      sql`${table.status} IN ('PENDING', 'SENDING', 'DELIVERED', 'RETRY', 'FAILED', 'SKIPPED')`,
    ),
  ],
);

export const eventLedger = pgTable(
  "event_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventKey: text("event_key").notNull(),
    eventType: text("event_type").notNull(),
    status: text("status").notNull().default("PROCESSING"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    unique("event_ledger_tenant_event_key_unique").on(
      table.tenantId,
      table.eventKey,
    ),
    index("event_ledger_tenant_status_created_idx").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
    check(
      "event_ledger_status_check",
      sql`${table.status} IN ('PROCESSING', 'COMPLETED', 'FAILED')`,
    ),
  ],
).enableRLS();

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    topic: text("topic").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at").notNull().defaultNow(),
    publishedAt: timestamp("published_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("outbox_events_tenant_dedupe_key_unique").on(
      table.tenantId,
      table.dedupeKey,
    ),
    index("outbox_events_pending_available_idx")
      .on(table.availableAt)
      .where(sql`${table.status} = 'PENDING'`),
    index("outbox_events_tenant_created_idx").on(
      table.tenantId,
      table.createdAt,
    ),
    check(
      "outbox_events_status_check",
      sql`${table.status} IN ('PENDING', 'PUBLISHED', 'FAILED')`,
    ),
    check("outbox_events_attempts_check", sql`${table.attempts} >= 0`),
  ],
).enableRLS();

export const schema = {
  authIdentities,
  tenants,
  tenantMemberships,
  telegramDestinations,
  eventLedger,
  outboxEvents,
  users,
  apiSessions,
  telegramLoginPresentations,
  telegramLoginAbuseLimits,
  strategies,
  auditEvents,
  orders,
  orderReservations,
  notificationOutbox,
};

export type DatabaseSchema = typeof schema;
