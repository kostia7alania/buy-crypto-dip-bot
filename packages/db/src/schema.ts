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
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Product users are intentionally provider-neutral. Telegram identity and
// delivery data live in dedicated tables below.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
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

export const strategies = pgTable(
  "strategies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    mode: text("mode").notNull().default("DRY_RUN"),
    enabled: boolean("enabled").notNull().default(false),
    config: jsonb("config").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("strategies_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("strategies_tenant_symbol_unique").on(table.tenantId, table.symbol),
    index("strategies_tenant_enabled_idx").on(table.tenantId, table.enabled),
    check("strategies_mode_dry_run", sql`${table.mode} = 'DRY_RUN'`),
  ],
).enableRLS();

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    eventKey: text("event_key"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("audit_events_tenant_event_key_unique")
      .on(table.tenantId, table.eventKey)
      .where(sql`${table.eventKey} IS NOT NULL`),
    index("audit_events_tenant_created_idx").on(
      table.tenantId,
      table.createdAt,
    ),
    index("audit_events_tenant_entity_idx").on(
      table.tenantId,
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
  ],
).enableRLS();

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    strategyId: uuid("strategy_id"),
    evaluationKey: text("evaluation_key"),
    symbol: text("symbol").notNull(),
    mode: text("mode").notNull().default("DRY_RUN"),
    side: text("side").notNull(),
    quoteAmount: numeric("quote_amount").notNull(),
    price: numeric("price"),
    status: text("status").notNull(),
    riskDecisionId: uuid("risk_decision_id"),
    executeAt: timestamp("execute_at"),
    tgChatId: text("tg_chat_id"),
    tgMessageId: bigint("tg_message_id", { mode: "number" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "orders_tenant_strategy_fk",
      columns: [table.tenantId, table.strategyId],
      foreignColumns: [strategies.tenantId, strategies.id],
    }),
    uniqueIndex("orders_tenant_evaluation_key_unique")
      .on(table.tenantId, table.evaluationKey)
      .where(sql`${table.evaluationKey} IS NOT NULL`),
    uniqueIndex("orders_tenant_strategy_pending_unique")
      .on(table.tenantId, table.strategyId)
      .where(
        sql`${table.status} = 'PENDING' AND ${table.strategyId} IS NOT NULL`,
      ),
    index("orders_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("orders_tenant_strategy_created_idx").on(
      table.tenantId,
      table.strategyId,
      table.createdAt,
    ),
    index("orders_tenant_status_execute_idx").on(
      table.tenantId,
      table.status,
      table.executeAt,
    ),
    check("orders_mode_dry_run", sql`${table.mode} = 'DRY_RUN'`),
  ],
).enableRLS();

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
  users,
  authIdentities,
  tenants,
  tenantMemberships,
  telegramDestinations,
  strategies,
  auditEvents,
  orders,
  eventLedger,
  outboxEvents,
};

export type DatabaseSchema = typeof schema;
