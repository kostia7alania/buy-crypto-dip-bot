import {
  bigint,
  boolean,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Identity is the Telegram account: the bot sees ctx.from.id, the web
// dashboard receives the same id via Telegram Login Widget / Mini App initData.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  telegramUserId: text("telegram_user_id").notNull().unique(),
  telegramChatId: text("telegram_chat_id").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const strategies = pgTable("strategies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  mode: text("mode").notNull().default("DRY_RUN"),
  enabled: boolean("enabled").notNull().default(false),
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  strategyId: uuid("strategy_id"),
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
});

export const schema = {
  users,
  strategies,
  auditEvents,
  orders,
};

export type DatabaseSchema = typeof schema;
