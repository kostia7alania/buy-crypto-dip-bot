import type {
  TestDatabase,
  TwoTenantWorld,
} from "@buy-crypto-dip-bot/db/testing";
import { createTestDb, seedTwoTenants } from "@buy-crypto-dip-bot/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { getDb } from "../../db.js";

// The Gate 1 A-versus-B matrix from docs/16_MULTI_USER_BYBIT_RESEARCH.md,
// executed against a real PostgreSQL with two seeded tenants.
//
// Everything here goes through the actual Hono app and the actual session
// middleware. Nothing is stubbed except the exchange HTTP client, because a
// test that reached Bybit would be measuring the network rather than tenancy.

let harness: TestDatabase;
let world: TwoTenantWorld;

// The API resolves its database through this module-level singleton; pointing
// it at the in-process Postgres is the only seam the tests need.
// PGlite and node-postgres produce structurally identical Drizzle databases
// but distinct nominal types, so the seam needs one cast. It is confined to
// this line rather than leaking a loose type into the tests.
vi.mock("../../db.js", () => ({
  getDb: () => harness.db as unknown as ReturnType<typeof getDb>,
}));

// Deterministic, offline prices so PnL assertions are about ownership rather
// than about what BTC happens to cost tonight.
vi.mock("@buy-crypto-dip-bot/exchange-bybit", () => ({
  createBybitPublicClient: () => ({
    getTicker: async (symbol: string) => ({
      symbol,
      lastPrice: 100_000,
      high24h: 110_000,
      low24h: 90_000,
      sourceAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      ageMs: 0,
      ttlMs: 30_000,
    }),
    getKlines: async () => ({
      candles: [
        { openTime: 1, open: 1, high: 1, low: 1, close: 50_000 },
        { openTime: 2, open: 1, high: 1, low: 1, close: 100_000 },
      ],
      sourceAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      ageMs: 0,
      ttlMs: 30_000,
    }),
  }),
}));

const { createApp } = await import("../../app.js");
const {
  deleteExpiredSessions,
  issueSession,
  resolveSession,
  revokeOwnedSession,
  revokeSession,
} = await import("./session.repository.js");

let aliceToken: string;
let bobToken: string;

const asUser = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { ...(init.headers ?? {}), "x-user-session": token },
});

/** Only the fields these assertions actually read. */
interface StrategyRow {
  id: string;
  userId: string;
  symbol: string;
  enabled: boolean;
  config: Record<string, number>;
}
interface OwnedRow {
  id: string;
  userId: string;
}
interface PnlBody {
  totals: { spentUsdt: number };
}
interface PerformanceBody {
  positions: Array<{ spentUsdt: number }>;
}

const json = async <T>(res: Response): Promise<T> => (await res.json()) as T;

/** The test database, typed as the app's database. See the mock note above. */
const appDb = () => harness.db as unknown as ReturnType<typeof getDb>;

beforeAll(async () => {
  harness = await createTestDb();
  world = await seedTwoTenants(harness.db);
  aliceToken = (await issueSession(appDb(), world.alice.userId)).token;
  bobToken = (await issueSession(appDb(), world.bob.userId)).token;
}, 60_000);

afterAll(async () => {
  await harness?.close();
});

describe("read isolation", () => {
  it("lists only the caller's own strategies", async () => {
    const res = await createApp().request("/strategies", asUser(aliceToken));
    expect(res.status).toBe(200);

    const rows = await json<OwnedRow[]>(res);
    expect(rows.length).toBeGreaterThan(0);
    // Not one row may belong to Bob.
    expect(rows.every((r) => r.userId === world.alice.userId)).toBe(true);
    expect(rows.map((r) => r.id)).not.toContain(
      world.bob.sharedSymbolStrategyId,
    );
    expect(rows.map((r) => (r as unknown as StrategyRow).symbol)).not.toContain(
      "SOLUSDT",
    );
  });

  it("lists only the caller's own orders", async () => {
    const res = await createApp().request("/orders", asUser(aliceToken));
    const rows = await json<OwnedRow[]>(res);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.userId === world.alice.userId)).toBe(true);
    expect(rows.map((r) => r.id)).not.toContain(world.bob.completedOrderId);
  });

  it("lists only the caller's own audit events", async () => {
    const res = await createApp().request("/audit", asUser(aliceToken));
    const rows = await json<OwnedRow[]>(res);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.userId === world.alice.userId)).toBe(true);
    expect(rows.map((r) => r.id)).not.toContain(world.bob.auditEventId);
  });

  it("gives each tenant a different view of the same endpoint", async () => {
    const [aliceRes, bobRes] = await Promise.all([
      createApp().request("/strategies", asUser(aliceToken)),
      createApp().request("/strategies", asUser(bobToken)),
    ]);
    const aliceIds = (await json<OwnedRow[]>(aliceRes)).map((r) => r.id).sort();
    const bobIds = (await json<OwnedRow[]>(bobRes)).map((r) => r.id).sort();

    expect(aliceIds).not.toEqual(bobIds);
    // Disjoint: no id appears in both.
    expect(aliceIds.filter((id) => bobIds.includes(id))).toEqual([]);
  });
});

describe("write isolation", () => {
  it("refuses to update another tenant's strategy, and says 404 rather than 403", async () => {
    const res = await createApp().request(
      `/strategies/${world.bob.sharedSymbolStrategyId}`,
      asUser(aliceToken, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }),
    );

    // 403 would confirm the id exists, which is itself a cross-tenant leak.
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ error: "STRATEGY_NOT_FOUND" });
  });

  it("leaves the other tenant's row untouched after a refused update", async () => {
    await createApp().request(
      `/strategies/${world.bob.sharedSymbolStrategyId}`,
      asUser(aliceToken, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }),
    );

    const bobView = await json<StrategyRow[]>(
      await createApp().request("/strategies", asUser(bobToken)),
    );
    const target = bobView.find(
      (r) => r.id === world.bob.sharedSymbolStrategyId,
    );
    expect(target?.enabled).toBe(true);
  });

  it("lets a tenant update their own strategy", async () => {
    const res = await createApp().request(
      `/strategies/${world.alice.ownSymbolStrategyId}`,
      asUser(aliceToken, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: { thresholdPercent: 4 } }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await json<{ strategy: StrategyRow }>(res);
    expect(body.strategy.config.thresholdPercent).toBe(4);
    // A partial config update must not drop the other keys.
    expect(body.strategy.config.suggestedQuoteAmount).toBe(20);
  });

  it("does not let a made-up id reach another tenant's row", async () => {
    const res = await createApp().request(
      `/strategies/${world.bob.ownSymbolStrategyId}`,
      asUser(aliceToken, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe("same-symbol independence", () => {
  it("gives both tenants their own strategy for the shared symbol", async () => {
    const aliceRows = await json<StrategyRow[]>(
      await createApp().request("/strategies", asUser(aliceToken)),
    );
    const bobRows = await json<StrategyRow[]>(
      await createApp().request("/strategies", asUser(bobToken)),
    );

    const aliceShared = aliceRows.find((r) => r.symbol === world.sharedSymbol);
    const bobShared = bobRows.find((r) => r.symbol === world.sharedSymbol);

    expect(aliceShared).toBeDefined();
    expect(bobShared).toBeDefined();
    expect(aliceShared?.id).not.toBe(bobShared?.id);
  });

  it("treats 'already exists' as a per-user fact, not a global one", async () => {
    // Bob already owns BTCUSDT. Alice owning it too must not make this a
    // duplicate for Bob, and vice versa — so re-adding a symbol the *caller*
    // already has is the only case that should be refused.
    const res = await createApp().request(
      "/strategies",
      asUser(bobToken, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol: world.sharedSymbol }),
      }),
    );
    expect(res.status).toBe(400);
    expect(await json(res)).toEqual({ error: "STRATEGY_ALREADY_EXISTS" });
  });

  it("lets a tenant add a symbol another tenant already owns", async () => {
    // Alice does not have SOLUSDT; Bob does. Alice must still be allowed it.
    const res = await createApp().request(
      "/strategies",
      asUser(aliceToken, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol: "SOLUSDT" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await json<{ strategy: StrategyRow }>(res);
    expect(body.strategy.userId).toBe(world.alice.userId);
    expect(body.strategy.symbol).toBe("SOLUSDT");
    expect(body.strategy.id).not.toBe(world.bob.ownSymbolStrategyId);
  });

  it("pauses one tenant's strategy without touching the other's", async () => {
    await createApp().request(
      `/strategies/${world.alice.sharedSymbolStrategyId}`,
      asUser(aliceToken, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }),
    );

    const bobRows = await json<StrategyRow[]>(
      await createApp().request("/strategies", asUser(bobToken)),
    );
    const bobShared = bobRows.find(
      (r) => r.id === world.bob.sharedSymbolStrategyId,
    );
    expect(bobShared?.enabled).toBe(true);
  });
});

describe("aggregate isolation", () => {
  it("computes PnL from only the caller's own spend", async () => {
    const res = await createApp().request("/pnl", asUser(aliceToken));
    expect(res.status).toBe(200);

    const report = await json<PnlBody>(res);
    // Alice spent 100; Bob spent 700. A leaked aggregate would read 800.
    expect(report.totals.spentUsdt).toBe(100);
  });

  it("gives each tenant a different total", async () => {
    const alice = await json<PnlBody>(
      await createApp().request("/pnl", asUser(aliceToken)),
    );
    const bob = await json<PnlBody>(
      await createApp().request("/pnl", asUser(bobToken)),
    );

    expect(alice.totals.spentUsdt).toBe(100);
    expect(bob.totals.spentUsdt).toBe(700);
  });

  it("scopes the benchmark comparison to the caller", async () => {
    const res = await createApp().request("/performance", asUser(aliceToken));
    expect(res.status).toBe(200);

    const report = await json<PerformanceBody>(res);
    const totalSpend = report.positions.reduce(
      (sum, p) => sum + p.spentUsdt,
      0,
    );
    expect(totalSpend).toBe(100);
  });
});

describe("session lifecycle", () => {
  it("reports identity from the live API session rather than caller input", async () => {
    const response = await createApp().request("/auth/me", asUser(aliceToken));

    expect(response.status).toBe(200);
    expect(
      await json<{ user: { id: string; telegramUserId: string } }>(response),
    ).toEqual({
      user: {
        id: world.alice.userId,
        telegramUserId: world.alice.telegramUserId,
        username: "alice",
        firstName: "alice",
      },
    });
  });

  it("stops accepting a token the moment it is revoked", async () => {
    const { token } = await issueSession(appDb(), world.alice.userId);
    const correlationId = "session_logout_test_1234";

    const before = await createApp().request("/orders", asUser(token));
    expect(before.status).toBe(200);

    const logout = await createApp().request(
      "/auth/logout",
      asUser(token, {
        method: "POST",
        headers: { "x-request-id": correlationId },
      }),
    );
    expect(logout.status).toBe(200);

    // No grace window: the very next request is refused.
    const after = await createApp().request("/orders", asUser(token));
    expect(after.status).toBe(401);

    const { auditEventFromRow, schema } = await import(
      "@buy-crypto-dip-bot/db"
    );
    const [audit] = await harness.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.correlationId, correlationId));
    expect(audit ? auditEventFromRow(audit) : null).toMatchObject({
      type: "SESSION_REVOKED",
      scope: "USER",
      userId: world.alice.userId,
      actor: {
        kind: "USER",
        channel: "WEB",
        userId: world.alice.userId,
      },
      reasonCode: "LOGOUT",
      correlationId,
      payload: { target: "ONE", revokedCount: 1 },
    });
  });

  it("does not invalidate other sessions when one is revoked", async () => {
    const { token: doomed } = await issueSession(appDb(), world.bob.userId);
    await createApp().request(
      "/auth/logout",
      asUser(doomed, { method: "POST" }),
    );

    const survivor = await createApp().request("/orders", asUser(bobToken));
    expect(survivor.status).toBe(200);
  });

  it("refuses an expired session", async () => {
    const { schema } = await import("@buy-crypto-dip-bot/db");
    const { hashSessionToken, createSessionToken } = await import(
      "@buy-crypto-dip-bot/db"
    );
    const token = createSessionToken();
    await harness.db.insert(schema.apiSessions).values({
      userId: world.alice.userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await createApp().request("/orders", asUser(token));
    expect(res.status).toBe(401);

    const correlationId = "expired_session_logout_1234";
    const logout = await createApp().request(
      "/auth/logout",
      asUser(token, {
        method: "POST",
        headers: { "x-request-id": correlationId },
      }),
    );
    expect(logout.status).toBe(200);

    const [session] = await harness.db
      .select({ revokedAt: schema.apiSessions.revokedAt })
      .from(schema.apiSessions)
      .where(eq(schema.apiSessions.tokenHash, hashSessionToken(token)));
    expect(session?.revokedAt).toBeNull();

    const [audit] = await harness.db
      .select({ id: schema.auditEvents.id })
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.correlationId, correlationId));
    expect(audit).toBeUndefined();
  });

  it("resolves a token to its own owner and nobody else", async () => {
    const aliceOrders = await json<OwnedRow[]>(
      await createApp().request("/orders", asUser(aliceToken)),
    );
    const bobOrders = await json<OwnedRow[]>(
      await createApp().request("/orders", asUser(bobToken)),
    );

    expect(aliceOrders.every((o) => o.userId === world.alice.userId)).toBe(
      true,
    );
    expect(bobOrders.every((o) => o.userId === world.bob.userId)).toBe(true);
  });

  it("stores only a hash, never the token itself", async () => {
    const { schema } = await import("@buy-crypto-dip-bot/db");
    const rows = await harness.db.select().from(schema.apiSessions);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.tokenHash).not.toBe(aliceToken);
      expect(row.tokenHash).not.toBe(bobToken);
      expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("lists only owned sessions without exposing bearer hashes", async () => {
    const response = await createApp().request(
      "/auth/sessions",
      asUser(aliceToken),
    );
    expect(response.status).toBe(200);
    const body = await json<{
      sessions: Array<Record<string, unknown> & { current: boolean }>;
    }>(response);
    expect(body.sessions.some((session) => session.current)).toBe(true);
    expect(body.sessions.every((session) => !("tokenHash" in session))).toBe(
      true,
    );
  });

  it("cannot revoke another tenant's session by guessing its id", async () => {
    const { token: bobDisposable } = await issueSession(
      appDb(),
      world.bob.userId,
    );
    const inventory = await json<{
      sessions: Array<{ id: string; current: boolean }>;
    }>(await createApp().request("/auth/sessions", asUser(bobDisposable)));
    const target = inventory.sessions.find((session) => session.current);
    expect(target).toBeDefined();

    const attempted = await createApp().request(
      "/auth/sessions/revoke",
      asUser(aliceToken, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: target?.id }),
      }),
    );
    expect(await json<{ revoked: boolean }>(attempted)).toEqual({
      revoked: false,
    });
    expect(
      (await createApp().request("/auth/me", asUser(bobDisposable))).status,
    ).toBe(200);
  });

  it("rolls back revocation when its audit envelope is rejected", async () => {
    const { token } = await issueSession(appDb(), world.alice.userId);
    const principal = await resolveSession(appDb(), token);
    expect(principal).not.toBeNull();

    await expect(
      revokeOwnedSession(
        appDb(),
        principal as NonNullable<typeof principal>,
        principal?.sessionId as string,
        "bad",
      ),
    ).rejects.toThrow("AUDIT_EVENT_INVALID:CORRELATION_ID");

    expect((await createApp().request("/auth/me", asUser(token))).status).toBe(
      200,
    );
  });

  it("attributes a bot-command session revocation to Telegram", async () => {
    const { createSessionToken, hashSessionToken, schema } = await import(
      "@buy-crypto-dip-bot/db"
    );
    const token = createSessionToken();
    const correlationId = "telegram_session_logout_1234";
    await harness.db.insert(schema.apiSessions).values({
      userId: world.alice.userId,
      tokenHash: hashSessionToken(token),
      kind: "BOT_COMMAND",
      correlationId: "telegram_session_issue_1234",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    const principal = await resolveSession(appDb(), token);
    expect(principal?.sessionKind).toBe("BOT_COMMAND");

    await revokeSession(
      appDb(),
      token,
      principal as NonNullable<typeof principal>,
      correlationId,
    );

    const [audit] = await harness.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.correlationId, correlationId));
    expect(audit).toMatchObject({
      action: "SESSION_REVOKED",
      actorKind: "USER",
      actorChannel: "TELEGRAM",
      userId: world.alice.userId,
      payload: { target: "ONE", revokedCount: 1 },
    });
  });

  it("revokes every session owned by one user without touching another", async () => {
    const { schema } = await import("@buy-crypto-dip-bot/db");
    const [user] = await harness.db
      .insert(schema.users)
      .values({
        telegramUserId: "4000004",
        telegramChatId: "4000004",
        username: "dave",
      })
      .returning();
    expect(user).toBeDefined();
    const first = (await issueSession(appDb(), user?.id as string)).token;
    const second = (await issueSession(appDb(), user?.id as string)).token;

    const revoked = await createApp().request(
      "/auth/sessions/revoke-all",
      asUser(first, {
        method: "POST",
        headers: { "x-request-id": "session_revoke_all_test_1234" },
      }),
    );
    expect(await json<{ revoked: number }>(revoked)).toEqual({ revoked: 2 });
    expect((await createApp().request("/auth/me", asUser(first))).status).toBe(
      401,
    );
    expect((await createApp().request("/auth/me", asUser(second))).status).toBe(
      401,
    );
    expect(
      (await createApp().request("/auth/me", asUser(bobToken))).status,
    ).toBe(200);

    const [audit] = await harness.db
      .select()
      .from(schema.auditEvents)
      .where(
        eq(schema.auditEvents.correlationId, "session_revoke_all_test_1234"),
      );
    expect(audit).toMatchObject({
      action: "SESSION_REVOKED",
      userId: user?.id,
      reasonCode: "USER_REQUESTED",
      payload: { target: "ALL", revokedCount: 2 },
    });
  });

  it("removes only sessions older than the retention boundary", async () => {
    const { createSessionToken, hashSessionToken, schema } = await import(
      "@buy-crypto-dip-bot/db"
    );
    const oldToken = createSessionToken();
    const recentToken = createSessionToken();
    const boundary = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await harness.db.insert(schema.apiSessions).values([
      {
        userId: world.alice.userId,
        tokenHash: hashSessionToken(oldToken),
        expiresAt: new Date(boundary.getTime() - 1000),
      },
      {
        userId: world.alice.userId,
        tokenHash: hashSessionToken(recentToken),
        expiresAt: new Date(boundary.getTime() + 1000),
      },
    ]);

    await deleteExpiredSessions(appDb(), boundary);

    const oldRows = await harness.db
      .select()
      .from(schema.apiSessions)
      .where(eq(schema.apiSessions.tokenHash, hashSessionToken(oldToken)));
    const recentRows = await harness.db
      .select()
      .from(schema.apiSessions)
      .where(eq(schema.apiSessions.tokenHash, hashSessionToken(recentToken)));
    expect(oldRows).toHaveLength(0);
    expect(recentRows).toHaveLength(1);
  });
});

describe("Telegram Login presentation lifecycle", () => {
  it("allows one session mint per correctly signed presentation", async () => {
    const botToken = "123456:integration-test-token";
    const previousBotToken = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = botToken;
    try {
      const { signTelegramLogin } = await import("./auth.service.js");
      const fields = {
        id: 3_000_003,
        auth_date: Math.floor(Date.now() / 1000),
        first_name: "Carol",
        username: "carol",
      };
      const body = JSON.stringify({
        ...fields,
        hash: signTelegramLogin(fields, botToken),
      });
      const request = () =>
        createApp().request("/auth/telegram", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-telegram-login-source": "c".repeat(64),
          },
          body,
        });

      const first = await request();
      const replay = await request();

      expect(first.status).toBe(200);
      const { schema } = await import("@buy-crypto-dip-bot/db");
      const users = await harness.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.telegramUserId, String(fields.id)));
      expect(users[0]).toMatchObject({
        telegramChatId: null,
        notificationEnabledAt: null,
      });
      expect(replay.status).toBe(401);
      expect(await json<{ error: string }>(replay)).toEqual({
        error: "LOGIN_REPLAYED",
      });
    } finally {
      if (previousBotToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = previousBotToken;
    }
  });
});
