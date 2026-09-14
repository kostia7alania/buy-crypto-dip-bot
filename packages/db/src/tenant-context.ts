import { and, eq, sql } from "drizzle-orm";
import type { DatabaseConnection } from "./adapters.js";
import { tenantMemberships, tenants } from "./schema.js";

type Db = DatabaseConnection["db"];
export type TenantTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Resolve the personal tenant from an authenticated user, never request headers. */
export const withPersonalTenant = async <T>(
  db: Db,
  userId: string,
  operation: (tx: TenantTransaction) => Promise<T>,
  transactionConfig?: Parameters<Db["transaction"]>[1],
): Promise<T> => {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("TENANT_USER_ID_INVALID");
  }
  return db.transaction(async (tx) => {
    const [tenant] = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .innerJoin(
        tenantMemberships,
        and(
          eq(tenantMemberships.tenantId, tenants.id),
          eq(tenantMemberships.userId, userId),
          eq(tenantMemberships.role, "owner"),
        ),
      )
      .where(
        and(
          eq(tenants.kind, "personal"),
          eq(tenants.personalOwnerUserId, userId),
        ),
      )
      .limit(1);
    if (!tenant) throw new Error("TENANT_ACCESS_DENIED");
    await tx.execute(
      sql`select set_config('app.user_id',${userId},true), set_config('app.tenant_id',${tenant.id},true)`,
    );
    await tx.execute(sql`set local role dipbot_app`);
    return operation(tx);
  }, transactionConfig);
};
