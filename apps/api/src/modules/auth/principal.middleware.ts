import {
  type TenantTransaction,
  withPersonalTenant,
} from "@buy-crypto-dip-bot/db";
import type { MiddlewareHandler } from "hono";
import { getDb } from "../../db.js";
import { logApiError } from "../../operational-log.js";
import { resolveSession, type UserPrincipal } from "./session.repository.js";

/**
 * Routes that serve no user-owned data and therefore need no human behind the
 * request. Everything not listed here is private.
 *
 * This list is deliberately explicit and deliberately short. A new route is
 * private by default; making it public has to be a decision someone writes
 * down here, not an omission.
 *
 * - `/health`, `/version`  — operational probes.
 * - `/market`              — public Bybit market data, identical for everyone.
 * - `/backtest`            — pure replay over public candles; no stored rows.
 * - `/risk`                — global safety posture (mode, runner heartbeat).
 * - `/auth`                — how a caller obtains a session in the first place.
 */
const PUBLIC_PATH_PREFIXES = [
  "/health",
  "/version",
  "/market",
  "/backtest",
  "/risk",
] as const;

const PUBLIC_EXACT_PATHS = ["/auth/telegram", "/auth/logout"] as const;

export const isPublicPath = (path: string): boolean =>
  PUBLIC_EXACT_PATHS.some((publicPath) => path === publicPath) ||
  PUBLIC_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

export interface AppEnv {
  Variables: {
    correlationId: string;
    // Present only on private routes. `requireUser` below is the sole
    // supported way to read it, so a handler cannot forget the null case.
    user?: UserPrincipal;
    tenantDb?: TenantTransaction;
  };
}

export const SESSION_HEADER = "x-user-session";

/**
 * Resolves the session token into a principal and refuses private routes that
 * do not have one.
 *
 * The service `API_KEY` middleware runs before this and proves the request came
 * from our own BFF. That is authentication of the *caller*, not authorization
 * of a *user* — so it is necessary and explicitly not sufficient here. A
 * leaked API key alone reads nobody's data.
 */
export const userPrincipalMiddleware = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const isPublic = isPublicPath(c.req.path);
    const token = c.req.header(SESSION_HEADER);

    if (!token) {
      if (isPublic) return next();
      return c.json({ error: "UNAUTHENTICATED" }, 401);
    }

    let principal: UserPrincipal | null = null;
    try {
      principal = await resolveSession(getDb(), token);
    } catch (error) {
      logApiError("SESSION_RESOLVE_FAILED", error, c.get("correlationId"));
      // A failed lookup is not an anonymous caller or a successful logout.
      throw error;
    }

    if (!principal) {
      if (isPublic) return next();
      return c.json({ error: "UNAUTHENTICATED" }, 401);
    }

    c.set("user", principal);
    return next();
  };
};

const TENANT_PATHS = [
  "/strategies",
  "/orders",
  "/audit",
  "/pnl",
  "/performance",
  "/dashboard",
];

/** Only owned-data routes enter the restricted role; auth bootstrap stays separate. */
export const tenantDatabaseMiddleware =
  (): MiddlewareHandler<AppEnv> => async (c, next) => {
    if (
      !TENANT_PATHS.some(
        (prefix) =>
          c.req.path === prefix || c.req.path.startsWith(`${prefix}/`),
      )
    )
      return next();
    const user = requireUser(c);
    c.header("cache-control", "private, no-store");
    await withPersonalTenant(
      getDb(),
      user.userId,
      async (tx) => {
        c.set("tenantDb", tx);
        await next();
        if (c.error) throw c.error;
      },
      c.req.path === "/dashboard/snapshot"
        ? { isolationLevel: "repeatable read", accessMode: "read only" }
        : undefined,
    );
  };

export const requireTenantDb = (c: {
  get: (key: "tenantDb") => TenantTransaction | undefined;
}): TenantTransaction => {
  const db = c.get("tenantDb");
  if (!db) throw new Error("TENANT_DATABASE_CONTEXT_REQUIRED");
  return db;
};

/**
 * Reads the principal a private route is guaranteed to have.
 *
 * Throws rather than returning null: reaching this on a route the middleware
 * left unauthenticated means the route was mis-registered, and failing loudly
 * in development beats leaking every tenant's rows in production.
 */
export const requireUser = (c: {
  get: (key: "user") => UserPrincipal | undefined;
}): UserPrincipal => {
  const user = c.get("user");
  if (!user) {
    throw new Error(
      "requireUser called on a route without a user principal — check PUBLIC_PATH_PREFIXES",
    );
  }
  return user;
};
