import { probePostgresConnection } from "@buy-crypto-dip-bot/db";

export const DATABASE_READINESS_CACHE_MS = 5_000;

export const createDatabaseReadinessProbe = (
  connectionString: string,
  probe = probePostgresConnection,
) => {
  let pending: Promise<boolean> | undefined;
  let cached: { available: boolean; expiresAt: number } | undefined;
  return (): Promise<boolean> => {
    if (pending) return pending;
    if (cached && Date.now() < cached.expiresAt) {
      return Promise.resolve(cached.available);
    }
    pending = probe(connectionString)
      .catch(() => false)
      .then((available) => {
        cached = {
          available,
          expiresAt: Date.now() + DATABASE_READINESS_CACHE_MS,
        };
        return available;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
};
