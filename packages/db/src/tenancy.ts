import { and, eq, sql } from "drizzle-orm";
import type { DatabaseClient, DatabaseTransaction } from "./adapters.js";
import {
  auditEvents,
  authIdentities,
  eventLedger,
  orders,
  outboxEvents,
  strategies,
  telegramDestinations,
  tenantMemberships,
  tenants,
  users,
} from "./schema.js";

export const LEGACY_QUARANTINE_TENANT_ID =
  "00000000-0000-4000-8000-000000000022";

export type TelegramId = string | number | bigint;

export interface VerifiedTelegramProfile {
  id: TelegramId;
  verifiedAt: Date;
  privateChatId?: TelegramId | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  languageCode?: string | null;
}

export interface TelegramPrincipal {
  userId: string;
  tenantId: string;
  identityId: string;
  provider: "telegram";
  subject: string;
  privateChatId: string | null;
}

export interface TenantContext {
  userId: string;
  tenantId: string;
}

export interface LegacyClaimResult {
  userId: string;
  tenantId: string;
  movedStrategies: number;
  movedOrders: number;
  movedAuditEvents: number;
  movedLedgerEvents: number;
  movedOutboxEvents: number;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeTelegramId = (value: TelegramId, field: string): string => {
  const normalized = String(value).trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(`${field}_INVALID`);
  }
  return normalized;
};

const assertUuid = (value: string, field: string): void => {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`${field}_INVALID`);
  }
};

const buildIdentityProfile = (
  profile: VerifiedTelegramProfile,
): Record<string, string> => {
  const result: Record<string, string> = {};
  const values = {
    username: profile.username,
    firstName: profile.firstName,
    lastName: profile.lastName,
    photoUrl: profile.photoUrl,
    languageCode: profile.languageCode,
  };

  for (const [key, value] of Object.entries(values)) {
    if (value) result[key] = value;
  }

  return result;
};

const setLocalTenantContext = async (
  tx: DatabaseTransaction,
  context: TenantContext,
): Promise<void> => {
  await tx.execute(sql`
    select
      set_config('app.user_id', ${context.userId}, true),
      set_config('app.tenant_id', ${context.tenantId}, true)
  `);
};

export const ensureTelegramPrincipal = async (
  db: DatabaseClient,
  profile: VerifiedTelegramProfile,
): Promise<TelegramPrincipal> => {
  const subject = normalizeTelegramId(profile.id, "TELEGRAM_USER_ID");
  const privateChatId =
    profile.privateChatId === undefined || profile.privateChatId === null
      ? null
      : normalizeTelegramId(profile.privateChatId, "TELEGRAM_PRIVATE_CHAT_ID");

  if (
    !(profile.verifiedAt instanceof Date) ||
    Number.isNaN(profile.verifiedAt.getTime())
  ) {
    throw new Error("TELEGRAM_VERIFIED_AT_INVALID");
  }

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`telegram:${subject}`}, 0))`,
    );

    const [existingIdentity] = await tx
      .select({
        id: authIdentities.id,
        userId: authIdentities.userId,
      })
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.provider, "telegram"),
          eq(authIdentities.subject, subject),
        ),
      )
      .limit(1);

    const now = new Date();
    let identityId = existingIdentity?.id;
    let userId = existingIdentity?.userId;

    if (existingIdentity) {
      await tx
        .update(authIdentities)
        .set({
          profile: buildIdentityProfile(profile),
          verifiedAt: profile.verifiedAt,
          updatedAt: now,
        })
        .where(eq(authIdentities.id, existingIdentity.id));
    } else {
      const [user] = await tx
        .insert(users)
        .values({})
        .returning({ id: users.id });
      if (!user) throw new Error("TELEGRAM_USER_CREATE_FAILED");

      const [identity] = await tx
        .insert(authIdentities)
        .values({
          userId: user.id,
          provider: "telegram",
          subject,
          profile: buildIdentityProfile(profile),
          verifiedAt: profile.verifiedAt,
        })
        .returning({ id: authIdentities.id });
      if (!identity) throw new Error("TELEGRAM_IDENTITY_CREATE_FAILED");

      userId = user.id;
      identityId = identity.id;
    }

    if (!userId || !identityId) {
      throw new Error("TELEGRAM_PRINCIPAL_RESOLUTION_FAILED");
    }

    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);

    let [tenant] = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(
        and(
          eq(tenants.kind, "personal"),
          eq(tenants.personalOwnerUserId, userId),
        ),
      )
      .limit(1);

    if (!tenant) {
      [tenant] = await tx
        .insert(tenants)
        .values({ kind: "personal", personalOwnerUserId: userId })
        .returning({ id: tenants.id });
    }
    if (!tenant) throw new Error("PERSONAL_TENANT_CREATE_FAILED");

    await setLocalTenantContext(tx, { userId, tenantId: tenant.id });

    await tx
      .insert(tenantMemberships)
      .values({ tenantId: tenant.id, userId, role: "owner" })
      .onConflictDoUpdate({
        target: [tenantMemberships.tenantId, tenantMemberships.userId],
        set: { role: "owner" },
      });

    if (privateChatId) {
      await tx
        .insert(telegramDestinations)
        .values({
          userId,
          chatId: privateChatId,
          chatType: "private",
          enabled: true,
        })
        .onConflictDoUpdate({
          target: [telegramDestinations.userId, telegramDestinations.chatId],
          set: {
            chatType: "private",
            enabled: true,
            updatedAt: now,
          },
        });
    }

    return {
      userId,
      tenantId: tenant.id,
      identityId,
      provider: "telegram",
      subject,
      privateChatId,
    };
  });
};

export const withTenantContext = async <T>(
  db: DatabaseClient,
  context: TenantContext,
  operation: (tx: DatabaseTransaction) => Promise<T>,
): Promise<T> => {
  assertUuid(context.userId, "USER_ID");
  assertUuid(context.tenantId, "TENANT_ID");

  return db.transaction(async (tx) => {
    await setLocalTenantContext(tx, context);

    const [membership] = await tx
      .select({ role: tenantMemberships.role })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, context.tenantId),
          eq(tenantMemberships.userId, context.userId),
          eq(tenantMemberships.role, "owner"),
        ),
      )
      .limit(1);

    if (!membership) throw new Error("TENANT_ACCESS_DENIED");

    await tx.execute(sql`set local role dipbot_app`);
    return operation(tx);
  });
};

// This is an explicit administrative cutover operation. Call it through a
// superuser/BYPASSRLS connection, never from a user-facing request path.
export const claimQuarantinedLegacy = async (
  db: DatabaseClient,
  telegramUserId: TelegramId,
): Promise<LegacyClaimResult> => {
  const subject = normalizeTelegramId(telegramUserId, "TELEGRAM_USER_ID");

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('dipbot:legacy-quarantine-claim', 0))`,
    );

    const [identity] = await tx
      .select({ userId: authIdentities.userId })
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.provider, "telegram"),
          eq(authIdentities.subject, subject),
        ),
      )
      .limit(1);
    if (!identity) throw new Error("TELEGRAM_PRINCIPAL_NOT_FOUND");

    const [tenant] = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(
        and(
          eq(tenants.kind, "personal"),
          eq(tenants.personalOwnerUserId, identity.userId),
        ),
      )
      .limit(1);
    if (!tenant) throw new Error("PERSONAL_TENANT_NOT_FOUND");

    const [quarantinedStrategies, targetStrategies] = await Promise.all([
      tx
        .select({ symbol: strategies.symbol })
        .from(strategies)
        .where(eq(strategies.tenantId, LEGACY_QUARANTINE_TENANT_ID)),
      tx
        .select({ symbol: strategies.symbol })
        .from(strategies)
        .where(eq(strategies.tenantId, tenant.id)),
    ]);
    const targetSymbols = new Set(targetStrategies.map(({ symbol }) => symbol));
    const conflictingStrategy = quarantinedStrategies.find(({ symbol }) =>
      targetSymbols.has(symbol),
    );
    if (conflictingStrategy) {
      throw new Error(
        `LEGACY_TENANT_CLAIM_CONFLICT:${conflictingStrategy.symbol}`,
      );
    }

    await tx.execute(sql`set constraints orders_tenant_strategy_fk deferred`);

    const movedOrders = await tx
      .update(orders)
      .set({ tenantId: tenant.id })
      .where(eq(orders.tenantId, LEGACY_QUARANTINE_TENANT_ID))
      .returning({ id: orders.id });
    const movedStrategies = await tx
      .update(strategies)
      .set({ tenantId: tenant.id })
      .where(eq(strategies.tenantId, LEGACY_QUARANTINE_TENANT_ID))
      .returning({ id: strategies.id });
    const movedAuditEvents = await tx
      .update(auditEvents)
      .set({ tenantId: tenant.id })
      .where(eq(auditEvents.tenantId, LEGACY_QUARANTINE_TENANT_ID))
      .returning({ id: auditEvents.id });
    const movedLedgerEvents = await tx
      .update(eventLedger)
      .set({ tenantId: tenant.id })
      .where(eq(eventLedger.tenantId, LEGACY_QUARANTINE_TENANT_ID))
      .returning({ id: eventLedger.id });
    const movedOutboxEvents = await tx
      .update(outboxEvents)
      .set({ tenantId: tenant.id })
      .where(eq(outboxEvents.tenantId, LEGACY_QUARANTINE_TENANT_ID))
      .returning({ id: outboxEvents.id });

    await setLocalTenantContext(tx, {
      userId: identity.userId,
      tenantId: tenant.id,
    });

    const movedCount =
      movedStrategies.length +
      movedOrders.length +
      movedAuditEvents.length +
      movedLedgerEvents.length +
      movedOutboxEvents.length;
    if (movedCount > 0) {
      await tx.insert(auditEvents).values({
        tenantId: tenant.id,
        actorUserId: identity.userId,
        entityType: "tenant",
        entityId: tenant.id,
        action: "LEGACY_QUARANTINE_CLAIMED",
        payload: {
          sourceTenantId: LEGACY_QUARANTINE_TENANT_ID,
          movedStrategies: movedStrategies.length,
          movedOrders: movedOrders.length,
          movedAuditEvents: movedAuditEvents.length,
          movedLedgerEvents: movedLedgerEvents.length,
          movedOutboxEvents: movedOutboxEvents.length,
        },
      });
    }

    return {
      userId: identity.userId,
      tenantId: tenant.id,
      movedStrategies: movedStrategies.length,
      movedOrders: movedOrders.length,
      movedAuditEvents: movedAuditEvents.length,
      movedLedgerEvents: movedLedgerEvents.length,
      movedOutboxEvents: movedOutboxEvents.length,
    };
  });
};
