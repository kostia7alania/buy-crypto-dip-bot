import { isAllowedSymbol, strategyDefaults } from "@buy-crypto-dip-bot/config";
import { auditEventRow, schema } from "@buy-crypto-dip-bot/db";
import {
  AUDIT_SCHEMA_VERSION,
  createCorrelationId,
} from "@buy-crypto-dip-bot/shared-types";
import { and, eq, sql } from "drizzle-orm";
import type { getDb } from "./db.js";

type Db = ReturnType<typeof getDb>;

export interface PrivateNotificationBinding {
  telegramUserId: string;
  telegramChatId: string;
  username: string | null;
  firstName: string | null;
}

export type MutableStrategyConfigField =
  | "thresholdPercent"
  | "suggestedQuoteAmount"
  | "maxDailySpendUsdt";

export type StrategyMutationOutcome =
  | { outcome: "UPDATED"; strategyId: string }
  | { outcome: "NOT_FOUND" };

export type StrategyToggleOutcome =
  | { outcome: "UPDATED"; strategyId: string; enabled: boolean }
  | { outcome: "NOT_FOUND" };

export interface OnboardingStrategyInput {
  symbol: string;
  thresholdPercent: number;
  amountUsdt: number;
}

export type OnboardingStrategyOutcome = {
  outcome: "CREATED" | "UPDATED";
  strategyId: string;
};

/**
 * Registers a private Telegram chat as a notification target and records the
 * security-sensitive binding in the same transaction.
 */
export const bindPrivateNotificationTarget = async (
  db: Db,
  binding: PrivateNotificationBinding,
  correlationId: string = createCorrelationId(),
): Promise<{ userId: string }> => {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({
        telegramUserId: binding.telegramUserId,
        telegramChatId: binding.telegramChatId,
        notificationEnabledAt: new Date(),
        username: binding.username,
        firstName: binding.firstName,
      })
      .onConflictDoUpdate({
        target: schema.users.telegramUserId,
        set: {
          telegramChatId: binding.telegramChatId,
          notificationEnabledAt: new Date(),
          username: binding.username,
          firstName: binding.firstName,
        },
      })
      .returning({ id: schema.users.id });
    if (!user) throw new Error("notification binding upsert returned no row");

    await tx.insert(schema.auditEvents).values(
      auditEventRow({
        schemaVersion: AUDIT_SCHEMA_VERSION,
        type: "NOTIFICATION_BINDING_VERIFIED",
        scope: "USER",
        userId: user.id,
        actor: { kind: "USER", channel: "TELEGRAM", userId: user.id },
        reasonCode: "PRIVATE_START_CONFIRMED",
        correlationId,
        subject: { type: "USER", id: user.id },
        payloadClass: "SECURITY",
        payload: {},
      }),
    );

    return { userId: user.id };
  });
};

/** Creates or refreshes the caller's onboarding strategy and its V1 audit. */
export const applyOwnedOnboardingStrategy = async (
  db: Db,
  callerId: string,
  input: OnboardingStrategyInput,
  correlationId: string = createCorrelationId(),
): Promise<OnboardingStrategyOutcome> => {
  if (!isAllowedSymbol(input.symbol, process.env.ALLOWLIST_SYMBOLS)) {
    throw new Error("SYMBOL_NOT_ALLOWED");
  }
  return db.transaction(async (tx) => {
    const configPatch = {
      thresholdPercent: input.thresholdPercent,
      suggestedQuoteAmount: input.amountUsdt,
    };
    const [existing] = await tx
      .select()
      .from(schema.strategies)
      .where(
        and(
          eq(schema.strategies.userId, callerId),
          eq(schema.strategies.symbol, input.symbol),
        ),
      )
      .limit(1);

    if (existing) {
      await tx
        .update(schema.strategies)
        .set({
          enabled: true,
          config: { ...(existing.config as object), ...configPatch },
        })
        .where(
          and(
            eq(schema.strategies.id, existing.id),
            eq(schema.strategies.userId, callerId),
          ),
        );
      await tx.insert(schema.auditEvents).values(
        auditEventRow({
          schemaVersion: AUDIT_SCHEMA_VERSION,
          type: "STRATEGY_UPDATED",
          scope: "USER",
          userId: callerId,
          actor: { kind: "USER", channel: "TELEGRAM", userId: callerId },
          reasonCode: "ONBOARDING_APPLIED",
          correlationId,
          subject: { type: "STRATEGY", id: existing.id },
          payloadClass: "TENANT_CONFIGURATION",
          payload: {
            fields: ["enabled", "thresholdPercent", "suggestedQuoteAmount"],
          },
        }),
      );

      return { outcome: "UPDATED", strategyId: existing.id };
    }

    const [created] = await tx
      .insert(schema.strategies)
      .values({
        userId: callerId,
        name: `${input.symbol} Dip Buying Strategy`,
        symbol: input.symbol,
        mode: "DRY_RUN",
        config: { ...strategyDefaults, ...configPatch },
      })
      .returning();
    if (!created) throw new Error("insert returned no row");

    await tx.insert(schema.auditEvents).values(
      auditEventRow({
        schemaVersion: AUDIT_SCHEMA_VERSION,
        type: "STRATEGY_CREATED",
        scope: "USER",
        userId: callerId,
        actor: { kind: "USER", channel: "TELEGRAM", userId: callerId },
        reasonCode: "ONBOARDING_APPLIED",
        correlationId,
        subject: { type: "STRATEGY", id: created.id },
        payloadClass: "TENANT_CONFIGURATION",
        payload: { symbol: input.symbol, mode: "DRY_RUN" },
      }),
    );

    return { outcome: "CREATED", strategyId: created.id };
  });
};

/** Updates one allowlisted config field on one of the caller's own strategies. */
export const updateOwnedStrategyConfig = async (
  db: Db,
  callerId: string,
  symbol: string,
  field: MutableStrategyConfigField,
  value: number,
  correlationId: string = createCorrelationId(),
): Promise<StrategyMutationOutcome> => {
  return db.transaction(async (tx) => {
    // Lock the row while merging JSON so concurrent edits to different fields
    // cannot overwrite one another with an older config snapshot.
    const [strategy] = await tx
      .select()
      .from(schema.strategies)
      .where(
        and(
          eq(schema.strategies.userId, callerId),
          eq(schema.strategies.symbol, symbol),
        ),
      )
      .limit(1)
      .for("update");
    if (!strategy) return { outcome: "NOT_FOUND" };

    const existingConfig =
      typeof strategy.config === "object" &&
      strategy.config !== null &&
      !Array.isArray(strategy.config)
        ? (strategy.config as Record<string, unknown>)
        : {};
    const [updated] = await tx
      .update(schema.strategies)
      .set({ config: { ...existingConfig, [field]: value } })
      .where(
        and(
          eq(schema.strategies.id, strategy.id),
          eq(schema.strategies.userId, callerId),
        ),
      )
      .returning({ id: schema.strategies.id });
    if (!updated) return { outcome: "NOT_FOUND" };

    await tx.insert(schema.auditEvents).values(
      auditEventRow({
        schemaVersion: AUDIT_SCHEMA_VERSION,
        type: "STRATEGY_UPDATED",
        scope: "USER",
        userId: callerId,
        actor: { kind: "USER", channel: "TELEGRAM", userId: callerId },
        reasonCode: "USER_REQUESTED",
        correlationId,
        subject: { type: "STRATEGY", id: updated.id },
        payloadClass: "TENANT_CONFIGURATION",
        payload: { fields: [field] },
      }),
    );

    return { outcome: "UPDATED", strategyId: updated.id };
  });
};

/** Atomically toggles one of the caller's own strategies and audits the result. */
export const toggleOwnedStrategy = async (
  db: Db,
  callerId: string,
  symbol: string,
  correlationId: string = createCorrelationId(),
): Promise<StrategyToggleOutcome> => {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.strategies)
      .set({ enabled: sql<boolean>`not ${schema.strategies.enabled}` })
      .where(
        and(
          eq(schema.strategies.userId, callerId),
          eq(schema.strategies.symbol, symbol),
        ),
      )
      .returning({
        id: schema.strategies.id,
        enabled: schema.strategies.enabled,
      });
    if (!updated) return { outcome: "NOT_FOUND" };

    await tx.insert(schema.auditEvents).values(
      auditEventRow({
        schemaVersion: AUDIT_SCHEMA_VERSION,
        type: "STRATEGY_UPDATED",
        scope: "USER",
        userId: callerId,
        actor: { kind: "USER", channel: "TELEGRAM", userId: callerId },
        reasonCode: "USER_REQUESTED",
        correlationId,
        subject: { type: "STRATEGY", id: updated.id },
        payloadClass: "TENANT_CONFIGURATION",
        payload: { fields: ["enabled"] },
      }),
    );

    return {
      outcome: "UPDATED",
      strategyId: updated.id,
      enabled: updated.enabled,
    };
  });
};
