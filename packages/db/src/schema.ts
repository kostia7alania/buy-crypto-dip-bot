import {
  boolean,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const strategies = pgTable("strategies", {
  id: uuid("id").primaryKey().defaultRandom(),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const schema = {
  strategies,
  auditEvents,
  orders,
};

export type DatabaseSchema = typeof schema;
