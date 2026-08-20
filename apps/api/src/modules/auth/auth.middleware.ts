import { schema, withTenantContext } from "@buy-crypto-dip-bot/db";
import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { getDb } from "../../db.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TenantActor {
  userId: string;
  tenantId: string;
  role: string;
}

export interface ProtectedApiEnv {
  Variables: {
    tenantActor: TenantActor;
  };
}

type ApiKeyVerdict = "OK" | "SERVER_MISCONFIGURED" | "UNAUTHORIZED";

const verifyInternalApiKey = (provided: string | undefined): ApiKeyVerdict => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return process.env.NODE_ENV === "production"
      ? "SERVER_MISCONFIGURED"
      : "OK";
  }
  return provided === apiKey ? "OK" : "UNAUTHORIZED";
};

export const requireInternalApiKey = createMiddleware(async (c, next) => {
  const verdict = verifyInternalApiKey(c.req.header("x-api-key"));
  if (verdict === "SERVER_MISCONFIGURED") {
    console.error("API_KEY is required in production");
    return c.json({ error: "SERVICE_MISCONFIGURED" }, 503);
  }
  if (verdict === "UNAUTHORIZED") {
    return c.json({ error: "UNAUTHORIZED" }, 401);
  }
  await next();
});

export const requireProtectedApiContext = createMiddleware<ProtectedApiEnv>(
  async (c, next) => {
    const apiKeyVerdict = verifyInternalApiKey(c.req.header("x-api-key"));
    if (apiKeyVerdict === "SERVER_MISCONFIGURED") {
      console.error("API_KEY is required in production");
      return c.json({ error: "SERVICE_MISCONFIGURED" }, 503);
    }
    if (apiKeyVerdict === "UNAUTHORIZED") {
      return c.json({ error: "UNAUTHORIZED" }, 401);
    }

    const userId = c.req.header("x-dipbot-user-id");
    const tenantId = c.req.header("x-dipbot-tenant-id");
    if (
      !userId ||
      !tenantId ||
      !UUID_PATTERN.test(userId) ||
      !UUID_PATTERN.test(tenantId)
    ) {
      return c.json({ error: "UNAUTHORIZED" }, 401);
    }

    try {
      const membership = await withTenantContext(
        getDb(),
        { userId, tenantId },
        async (db) => {
          const [row] = await db
            .select({ role: schema.tenantMemberships.role })
            .from(schema.tenantMemberships)
            .where(
              and(
                eq(schema.tenantMemberships.userId, userId),
                eq(schema.tenantMemberships.tenantId, tenantId),
              ),
            )
            .limit(1);
          return row;
        },
      );

      if (!membership) {
        return c.json({ error: "FORBIDDEN" }, 403);
      }

      c.set("tenantActor", { userId, tenantId, role: membership.role });
      c.header("cache-control", "private, no-store");
      await next();
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_ACCESS_DENIED") {
        return c.json({ error: "FORBIDDEN" }, 403);
      }
      console.error("Tenant authorization failed:", error);
      return c.json({ error: "AUTHORIZATION_UNAVAILABLE" }, 500);
    }
  },
);
