import { hashSessionToken, schema } from "@buy-crypto-dip-bot/db";
import type {
  TestDatabase,
  TwoTenantWorld,
} from "@buy-crypto-dip-bot/db/testing";
import { createTestDb, seedTwoTenants } from "@buy-crypto-dip-bot/db/testing";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createBot } from "./bot.js";
import { getDb } from "./db.js";

vi.mock("./db.js", () => ({ getDb: vi.fn() }));

const mockCallerApi = (path: string, body: unknown, status = 200) => {
  vi.stubEnv("APP_RUNTIME", "local");
  vi.stubEnv("API_URL", "http://localhost:8787");
  vi.stubEnv("API_KEY", "local-api-fixture-only");
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    switch (new URL(String(input)).pathname) {
      case path:
        return Response.json(body, { status });
      case "/auth/logout":
        return new Response(null, { status: 204 });
      default:
        throw new Error("UNEXPECTED_API_CALL");
    }
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const setupCommandBot = () => {
  const bot = createBot("1:local_fixture_only");
  bot.botInfo = {
    id: 1,
    is_bot: true,
    first_name: "Local fixture",
    username: "local_fixture_bot",
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  };
  const replies: string[] = [];
  bot.api.config.use(async (previous, method, payload) => {
    if (method === "answerCallbackQuery") {
      return { ok: true, result: true } as Awaited<ReturnType<typeof previous>>;
    }
    if (
      (method !== "sendMessage" && method !== "editMessageText") ||
      !("text" in payload)
    ) {
      throw new Error("UNEXPECTED_TELEGRAM_CALL");
    }
    replies.push(payload.text as string);
    return { ok: true, result: { message_id: 1 } } as Awaited<
      ReturnType<typeof previous>
    >;
  });

  const send = (
    text: string,
    actor: number,
    type: "private" | "group" = "private",
  ) =>
    bot.handleUpdate({
      update_id: 91,
      message: {
        message_id: 1,
        from: { id: actor, is_bot: false, first_name: "Fixture user" },
        chat:
          type === "private"
            ? { id: actor, type, first_name: "Fixture user" }
            : { id: -51, type, title: "Shared chat" },
        date: 0,
        text,
        entities: [{ type: "bot_command", offset: 0, length: text.length }],
      },
    });

  const click = (data: string, actor: number) =>
    bot.handleUpdate({
      update_id: 92,
      callback_query: {
        id: "test_callback",
        from: { id: actor, is_bot: false, first_name: "Fixture user" },
        chat_instance: "local_fixture_chat",
        message: {
          message_id: 1,
          chat: { id: actor, type: "private", first_name: "Fixture user" },
          date: 1,
        },
        data,
      },
    });

  return { click, send, replies };
};

describe("bot skeleton", () => {
  it("creates a grammY bot without starting network polling", () => {
    const bot = createBot("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
    expect(bot).toHaveProperty("command");
    expect(typeof bot.command).toBe("function");
  });
});

describe("private simulation commands", () => {
  let harness: TestDatabase;
  let world: TwoTenantWorld;

  beforeAll(async () => {
    harness = await createTestDb();
    await harness.exec("SET TIME ZONE 'UTC'");
    world = await seedTwoTenants(harness.db);
    await harness.db
      .update(schema.users)
      .set({ notificationEnabledAt: new Date() });
    await harness.db.insert(schema.users).values({
      telegramUserId: "3000003",
      telegramChatId: "3000003",
      notificationEnabledAt: new Date(),
    });
    vi.mocked(getDb).mockReturnValue(
      harness.db as unknown as ReturnType<typeof getDb>,
    );
  }, 60_000);

  afterEach(() => {
    vi.mocked(getDb).mockClear();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await harness?.close();
  });

  it("shows the caller's completed buys by completion time with a legacy creation-time fallback", async () => {
    const { alice, bob } = world;
    await harness.db
      .update(schema.strategies)
      .set({ enabled: false })
      .where(eq(schema.strategies.id, alice.ownSymbolStrategyId));
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await harness.db.transaction(async (tx) => {
      const [pending] = await tx
        .insert(schema.orders)
        .values({
          userId: alice.userId,
          strategyId: alice.ownSymbolStrategyId,
          symbol: "ETHUSDT",
          side: "BUY",
          quoteAmount: "20.55",
          status: "PENDING",
          createdAt: twoDaysAgo,
        })
        .returning();
      if (!pending) throw new Error("Missing pending test order");
      await tx.insert(schema.orderReservations).values({
        userId: pending.userId,
        strategyId: pending.strategyId,
        orderId: pending.id,
        quoteAmount: pending.quoteAmount,
        policyVersion: "TEST_POLICY",
        configRevision: "test-config",
        strategyConfig: {},
        marketSnapshotKey: "test-market",
        marketSnapshot: {},
        riskSnapshot: {},
        createdAt: twoDaysAgo,
      });
      await tx
        .update(schema.orders)
        .set({ status: "COMPLETED" })
        .where(eq(schema.orders.id, pending.id));
    });
    await harness.db.insert(schema.orders).values([
      {
        userId: alice.userId,
        strategyId: alice.sharedSymbolStrategyId,
        symbol: world.sharedSymbol,
        side: "BUY",
        quoteAmount: "30.50",
        status: "COMPLETED",
        createdAt: twoDaysAgo,
      },
      {
        userId: alice.userId,
        strategyId: alice.sharedSymbolStrategyId,
        symbol: world.sharedSymbol,
        side: "BUY",
        quoteAmount: "40.75",
        status: "CANCELLED",
      },
      {
        userId: alice.userId,
        strategyId: alice.sharedSymbolStrategyId,
        symbol: world.sharedSymbol,
        side: "SELL",
        quoteAmount: "90",
        status: "COMPLETED",
      },
      {
        userId: alice.userId,
        strategyId: alice.sharedSymbolStrategyId,
        symbol: world.sharedSymbol,
        side: "BUY",
        quoteAmount: "50.75",
        status: "COMPLETED",
        createdAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    ]);

    const aliceCommand = setupCommandBot();
    await aliceCommand.send("/status", Number(alice.telegramUserId));
    expect(aliceCommand.replies).toEqual([
      "📊 *Simulation status* (`DRY_RUN`)\n\n" +
        "• Enabled strategies — 1\n" +
        "• Simulated buys completed (past 24h) — 2\n" +
        "• Simulated buy amount (past 24h) — 120.55 USDT\n\n" +
        "_Older records use order creation time._",
    ]);

    const bobCommand = setupCommandBot();
    await bobCommand.send("/status", Number(bob.telegramUserId));
    expect(bobCommand.replies[0]).toContain("Enabled strategies — 2");
    expect(bobCommand.replies[0]).toContain(
      "Simulated buys completed (past 24h) — 1",
    );
    expect(bobCommand.replies[0]).toContain(
      "Simulated buy amount (past 24h) — 700.00 USDT",
    );

    await harness.db.insert(schema.orders).values({
      userId: alice.userId,
      strategyId: alice.sharedSymbolStrategyId,
      symbol: world.sharedSymbol,
      side: "BUY",
      quoteAmount: "-5",
      status: "COMPLETED",
    });
    const invalidAmount = setupCommandBot();
    await invalidAmount.send("/status", Number(alice.telegramUserId));
    expect(invalidAmount.replies[0]).toContain(
      "Simulated buys completed (past 24h) — 3",
    );
    expect(invalidAmount.replies[0]).toContain(
      "Simulated buy amount (past 24h) — Unavailable",
    );
  });

  it("reports zero for a verified user with no strategies or buys", async () => {
    const { send, replies } = setupCommandBot();
    await send("/status", 3000003);

    expect(replies[0]).toContain("Enabled strategies — 0");
    expect(replies[0]).toContain("Simulated buys completed (past 24h) — 0");
    expect(replies[0]).toContain("Simulated buy amount (past 24h) — 0.00 USDT");
  });

  it("refuses group status requests before touching private data", async () => {
    const { send, replies } = setupCommandBot();
    await send("/status", Number(world.alice.telegramUserId), "group");

    expect(replies).toEqual([
      expect.stringContaining("only works in a direct chat"),
    ]);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("requires a verified private /start before reading status", async () => {
    const { send, replies } = setupCommandBot();
    await send("/status", 4000004);

    expect(replies).toEqual([expect.stringContaining("Send /start first")]);
    expect(getDb).toHaveBeenCalledOnce();
  });

  it("shows an unavailable reply and logs a failed status lookup", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getDb).mockImplementationOnce(() => {
      throw new Error("TEST_DB_OFFLINE");
    });
    const { send, replies } = setupCommandBot();
    await send("/status", Number(world.alice.telegramUserId));

    expect(replies).toEqual([
      "❌ Simulation status is unavailable. Try /status again.",
    ]);
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('"event":"STATUS_COMMAND_FAILED"'),
    );
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('"correlationId":"telegram_update_91"'),
    );
  });

  it("warns pending simulated buys can complete after pausing strategies", async () => {
    const { bob } = world;
    const { send, replies } = setupCommandBot();
    await send("/pause_all", Number(bob.telegramUserId));

    expect(replies[0]).toContain("Your strategies are paused");
    expect(replies[0]).toContain("Pending simulated buys can still complete");
    const [order] = await harness.db
      .select({ status: schema.orders.status })
      .from(schema.orders)
      .where(eq(schema.orders.id, bob.pendingOrderId));
    expect(order?.status).toBe("PENDING");
  });

  it("uses a caller-owned lease to read the simulation budget and cleans up the lease", async () => {
    const { alice } = world;
    const asOf = new Date().toISOString();
    const fetchMock = mockCallerApi("/strategies/budget", {
      asOf,
      strategies: [
        {
          strategyId: alice.sharedSymbolStrategyId,
          symbol: world.sharedSymbol,
          dailyRemainingUsdt: 0,
          weeklyRemainingUsdt: null,
          activeReservedUsdt: 0.004,
        },
      ],
    });
    const { send, replies } = setupCommandBot();
    await send("/budget", Number(alice.telegramUserId));

    expect(replies).toHaveLength(1);
    expect(replies[0]).toContain(`${asOf.slice(0, 19).replace("T", " ")} UTC`);
    expect(replies[0]).toContain("Remaining (rolling 24h) — 0.00 USDT");
    expect(replies[0]).toContain("Remaining (rolling 7d) — Unavailable");
    expect(replies[0]).toContain("Held for pending buys — 0.004 USDT");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [read, logout] = fetchMock.mock.calls;
    expect(read?.[0]).toBe("http://localhost:8787/strategies/budget");
    const headers = new Headers(read?.[1]?.headers);
    const token = headers.get("x-user-session");
    if (!token) throw new Error("Missing caller session lease");
    expect(headers.get("x-api-key")).toBe("local-api-fixture-only");
    expect(headers.get("x-request-id")).toBe("telegram_update_91");
    const [session] = await harness.db
      .select()
      .from(schema.apiSessions)
      .where(eq(schema.apiSessions.tokenHash, hashSessionToken(token)));
    expect(session).toMatchObject({
      userId: alice.userId,
      kind: "BOT_COMMAND",
    });
    expect(logout?.[0]).toBe("http://localhost:8787/auth/logout");
    expect(logout?.[1]?.method).toBe("POST");
    expect(new Headers(logout?.[1]?.headers).get("x-user-session")).toBe(token);
  });

  it("refuses group budget requests before minting a session or fetching data", async () => {
    const fetchMock = mockCallerApi("/strategies/budget", {});
    const { send, replies } = setupCommandBot();
    await send("/budget", Number(world.alice.telegramUserId), "group");

    expect(replies).toEqual([
      expect.stringContaining("only works in a direct chat"),
    ]);
    expect(getDb).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    -120_000, 120_000,
  ])("recognizes a budget timestamp offset of %d ms", async (offset) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockCallerApi("/strategies/budget", {
      asOf: new Date(Date.now() + offset).toISOString(),
      strategies: [],
    });
    const { send, replies } = setupCommandBot();
    await send("/budget", Number(world.alice.telegramUserId));

    expect(replies).toEqual([
      "⚠️ Simulation budget is out of date. Try /budget again.",
    ]);
  });

  it.each([
    200, 503,
  ])("shows an unavailable budget for malformed or failed API status %d", async (status) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCallerApi(
      "/strategies/budget",
      { asOf: "invalid timestamp", strategies: [] },
      status,
    );
    const { send, replies } = setupCommandBot();
    await send("/budget", Number(world.alice.telegramUserId));

    expect(replies).toEqual([
      "❌ Simulation budget is unavailable. Try /budget again.",
    ]);
  });

  it("shows a recorded rejection with its reason and UTC time", async () => {
    const fetchMock = mockCallerApi("/audit/decisions/latest", {
      decision: {
        type: "RISK_DECISION_REJECTED",
        createdAt: "2026-11-18T10:00:23.000Z",
        symbol: "BTCUSDT",
        reasonCodes: ["DAILY_LIMIT_EXCEEDED"],
      },
    });
    const { send, replies } = setupCommandBot();
    await send("/decision", Number(world.alice.telegramUserId));

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:8787/audit/decisions/latest",
    );
    expect(replies).toEqual([
      "<b>Last recorded risk decision</b> (DRY_RUN)\nRejected a simulated buy — BTCUSDT\n" +
        "2026-11-18 10:00:23 UTC\n• Rolling 24h limit would be exceeded",
    ]);
  });

  it("distinguishes a missing risk decision from an unavailable report", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = mockCallerApi("/audit/decisions/latest", {
      decision: null,
    });
    const { send, replies } = setupCommandBot();
    await send("/decision", Number(world.alice.telegramUserId));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await send("/decision", Number(world.alice.telegramUserId));

    expect(replies).toEqual([
      expect.stringContaining(
        "No verified risk decision is available for your strategies yet.",
      ),
      "❌ Latest risk decision is unavailable. Try /decision again.",
    ]);
  });

  it("refuses group risk decision requests before touching private data", async () => {
    const fetchMock = mockCallerApi("/audit/decisions/latest", {
      decision: null,
    });
    const { send, replies } = setupCommandBot();
    await send("/decision", Number(world.alice.telegramUserId), "group");

    expect(replies).toEqual([
      expect.stringContaining("only works in a direct chat"),
    ]);
    expect(getDb).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the terms and actual enabled state of an onboarding strategy", async () => {
    vi.stubEnv("ALLOWLIST_SYMBOLS", "BTCUSDT");
    const { click, send, replies } = setupCommandBot();
    const actor = 5000005;
    await send("/start", actor);
    await click("wiz:threshold:BTCUSDT", actor);
    await click("wiz:confirm:BTCUSDT:2:10", actor);
    await click("wiz:apply:BTCUSDT:2:10", actor);
    await click("wiz:apply:BTCUSDT:3:20", actor);

    expect(replies[1]).toContain("below its 24h high");
    expect(replies[2]).toContain(
      "A new strategy starts paused with these defaults",
    );
    expect(replies[2]).toContain("Rolling 24h limit");
    expect(replies[2]).toContain("Rolling 7d limit");
    expect(replies[2]).toContain("Cooldown");
    expect(replies[2]).toContain(
      "keeps its limits and cooldown and enables it",
    );
    expect(replies[3]).toContain("strategy saved and paused");
    expect(replies[3]).toContain("/toggle BTCUSDT");
    expect(replies[4]).toContain("strategy updated and enabled");
  });
});
