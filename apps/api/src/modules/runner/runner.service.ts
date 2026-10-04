import { setTimeout as sleep } from "node:timers/promises";
import {
  getAllowedSymbols,
  orderExecutionDelaySeconds,
  strategyDefaults,
} from "@buy-crypto-dip-bot/config";
import {
  auditEventRow,
  createPostgresConnection,
  runMigrations,
  schema,
  verifyRuntimeDatabase,
  withPersonalTenant,
} from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import {
  AUDIT_SCHEMA_VERSION,
  createCorrelationId,
} from "@buy-crypto-dip-bot/shared-types";
import { and, eq, gte, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { logApiError, logApiEvent } from "../../operational-log.js";
import { deleteExpiredSessions } from "../auth/session.repository.js";
import {
  claimDueNotifications,
  claimNotificationById,
  enqueueNotification,
  markNotificationDelivered,
  markNotificationFailure,
  markNotificationSkipped,
  type OutboxRecord,
  recoverStaleSendingNotifications,
} from "../notifications/outbox.repository.js";
import {
  renderTelegramFallback,
  renderTelegramTemplate,
  TELEGRAM_TEMPLATE_VERSION,
  type TelegramTemplateV1,
} from "../notifications/telegram-template.js";
import { computePnlReport } from "../pnl/pnl.route.js";
import { getCountdownSecondsLeft } from "./countdown.js";
import { claimDueDryRunOrder } from "./order.repository.js";
import { reserveDryRunOrder } from "./reservation.repository.js";
import { createRunnerLifecycle } from "./runner-lifecycle.js";
import { createSingleFlightTask } from "./single-flight.js";

let tickIntervalId: NodeJS.Timeout | null = null;
let dueOrdersIntervalId: NodeJS.Timeout | null = null;
let digestIntervalId: NodeJS.Timeout | null = null;
let notificationOutboxIntervalId: NodeJS.Timeout | null = null;
let sessionCleanupIntervalId: NodeJS.Timeout | null = null;
let lastSessionCleanupAt: Date | null = null;

const RUN_INTERVAL_MS = 30000; // strategy evaluation cadence
const DUE_ORDERS_POLL_MS = 3000; // how often due PENDING orders are executed
const COUNTDOWN_TICK_MS = 1000; // Telegram's documented per-chat limit is 1 message/s
const DIGEST_UTC_HOUR = 6; // daily digest ~06:00 UTC (morning in EU/Asia)
const DIGEST_CHECK_MS = 10 * 60 * 1000;
const NOTIFICATION_OUTBOX_POLL_MS = 5_000;
const NOTIFICATION_OUTBOX_BATCH_LIMIT = 20;
const TELEGRAM_REQUEST_TIMEOUT_MS = 5_000;
const SESSION_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Heartbeat for /risk/status: lets the dashboard show whether the trading
// loop is actually alive instead of pretending.
let lastTickAt: Date | null = null;

export const getRunnerStatus = () => ({
  lastTickAt: lastTickAt ? lastTickAt.toISOString() : null,
  tickIntervalMs: tickIntervalId ? RUN_INTERVAL_MS : 0,
  sessionCleanup: {
    lastCompletedAt: lastSessionCleanupAt?.toISOString() ?? null,
    intervalMs: sessionCleanupIntervalId ? SESSION_CLEANUP_INTERVAL_MS : 0,
  },
});

type Db = ReturnType<typeof createPostgresConnection>["db"];

// Seed default strategies for the single operator of a self-hosted install.
//
// Seeding is owner-scoped and opt-in: without OPERATOR_TELEGRAM_USER_ID we
// create nothing at all. Ownerless seeded rows were safe when the product had
// exactly one user, but in a multi-user world they are ambiguous tenants that
// nobody can safely claim later — see the I05 migration notes.
async function seedDefaultStrategyIfNeeded(db: Db, signal?: AbortSignal) {
  if (signal?.aborted) return;
  const operatorTelegramUserId = process.env.OPERATOR_TELEGRAM_USER_ID;
  if (!operatorTelegramUserId) {
    logApiEvent("DEFAULT_STRATEGY_SEED_NOT_CONFIGURED");
    return;
  }

  const [operator] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.telegramUserId, operatorTelegramUserId))
    .limit(1);

  if (!operator) {
    logApiEvent("DEFAULT_STRATEGY_SEED_OWNER_NOT_FOUND", "WARN");
    return;
  }

  const defaultSymbols = getAllowedSymbols(process.env.ALLOWLIST_SYMBOLS);

  for (const symbol of defaultSymbols) {
    if (signal?.aborted) return;
    const correlationId = createCorrelationId();
    const inserted = await withPersonalTenant(db, operator.id, async (tx) => {
      const [strategy] = await tx
        .insert(schema.strategies)
        .values({
          userId: operator.id,
          name: `${symbol.replace("USDT", "")} Dip Buying Strategy`,
          symbol,
          mode: "DRY_RUN",
          enabled: true,
          config: { ...strategyDefaults },
        })
        .onConflictDoNothing()
        .returning({ id: schema.strategies.id });
      if (!strategy) return false;

      await tx.insert(schema.auditEvents).values(
        auditEventRow({
          schemaVersion: AUDIT_SCHEMA_VERSION,
          type: "STRATEGY_CREATED",
          scope: "USER",
          userId: operator.id,
          actor: { kind: "SYSTEM", channel: "RUNNER" },
          reasonCode: "OPERATOR_DEFAULT_SEED",
          correlationId,
          subject: { type: "STRATEGY", id: strategy.id },
          payloadClass: "TENANT_CONFIGURATION",
          payload: { symbol, mode: "DRY_RUN" },
        }),
      );
      return true;
    });
    if (inserted) {
      logApiEvent("DEFAULT_STRATEGY_SEEDED", "INFO", correlationId);
    }
  }
}

// Executes every PENDING order whose execute_at has passed. DB-driven so
// orders survive restarts; the atomic status flip below also guards against
// double execution.
async function processDueOrders(db: Db, signal: AbortSignal) {
  if (signal.aborted) return;
  const correlationId = createCorrelationId();
  const dueOrders = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.status, "PENDING"),
        or(
          lte(schema.orders.executeAt, new Date()),
          isNull(schema.orders.executeAt),
        ),
      ),
    );

  // One lookup per tick rather than per order: the owner's chat id is needed
  // to close out each order's Telegram message in the right conversation.
  const chatIdForUser = new Map<string, string | null>();
  const resolveChatId = async (userId: string | null) => {
    if (!userId) return null;
    if (chatIdForUser.has(userId)) return chatIdForUser.get(userId) ?? null;
    const [owner] = await db
      .select({
        telegramChatId: schema.users.telegramChatId,
        notificationEnabledAt: schema.users.notificationEnabledAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    if (!owner) return null;
    const chatId = owner.notificationEnabledAt ? owner.telegramChatId : null;
    chatIdForUser.set(userId, chatId);
    return chatId;
  };

  for (const order of dueOrders) {
    if (signal.aborted) return;
    const claimed = await claimDueDryRunOrder(db, order.id, correlationId);
    if (!claimed) continue;

    const [strategy] = await db
      .select()
      .from(schema.strategies)
      .where(
        and(
          eq(schema.strategies.id, order.strategyId),
          eq(schema.strategies.userId, order.userId),
        ),
      )
      .limit(1);
    const strategyName = strategy?.name ?? "Dip Buying Strategy";

    logApiEvent("DRY_RUN_ORDER_COMPLETED", "INFO", correlationId);

    if (order.tgMessageId) {
      const successText = renderTelegramTemplate({
        version: TELEGRAM_TEMPLATE_VERSION,
        key: "ORDER_COMPLETED",
        inputs: {
          strategyName,
          symbol: order.symbol,
          price: Number(order.price),
          quoteAmount: Number(order.quoteAmount),
        },
      }).text;
      await editTelegramMessage(
        order.tgMessageId,
        successText,
        await resolveChatId(order.userId),
      );
    }
  }
}

// Daily digest: one Telegram message each morning — what the bot did in the
// last 24h and where the simulated portfolio stands. The retention loop.
let lastDigestDay: string | null = null;

async function maybeSendDailyDigest(db: Db, signal: AbortSignal) {
  if (signal.aborted) return;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (now.getUTCHours() !== DIGEST_UTC_HOUR || lastDigestDay === today) return;
  lastDigestDay = today;

  // One digest per user, each built only from that user's own orders. The
  // previous single global digest would have told every reader the whole
  // install's activity the moment a second person signed up.
  const users = await db
    .select({
      id: schema.users.id,
      telegramChatId: schema.users.telegramChatId,
    })
    .from(schema.users)
    .where(
      and(
        isNotNull(schema.users.telegramChatId),
        isNotNull(schema.users.notificationEnabledAt),
      ),
    );

  for (const user of users) {
    if (signal.aborted) return;
    try {
      const inputs = await buildDigestRenderInputsForUser(db, user.id);
      if (signal.aborted) return;
      if (!inputs || !user.telegramChatId) continue;
      const correlationId = createCorrelationId();
      await enqueueNotification(db, {
        userId: user.id,
        chatId: user.telegramChatId,
        correlationId,
        template: {
          version: TELEGRAM_TEMPLATE_VERSION,
          key: "DAILY_DIGEST",
          inputs,
        },
      });
      logApiEvent("DAILY_DIGEST_QUEUED", "INFO", correlationId);
    } catch (error) {
      // One user's failure must not silence everyone else's digest.
      logApiError("DIGEST_USER_BUILD_FAILED", error);
    }
  }

  logApiEvent("DAILY_DIGEST_BATCH_QUEUED");
}

// Returns null when a user has nothing worth waking up for.
// Exported for tests: this is the function that decides what one person is
// told about their own money, so it is worth asserting on directly.
export async function buildDigestRenderInputsForUser(
  db: Db,
  userId: string,
): Promise<
  Extract<TelegramTemplateV1, { key: "DAILY_DIGEST" }>["inputs"] | null
> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const buys = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.userId, userId),
        eq(schema.orders.status, "COMPLETED"),
        eq(schema.orders.side, "BUY"),
        gte(schema.orders.createdAt, oneDayAgo),
      ),
    );
  const spent24h = buys.reduce((s, o) => s + Number(o.quoteAmount), 0);

  let portfolio: Extract<
    TelegramTemplateV1,
    { key: "DAILY_DIGEST" }
  >["inputs"]["portfolio"] = null;
  let hasPortfolio = false;
  try {
    const pnl = await computePnlReport(db, userId);
    if (pnl.totals.spentUsdt > 0) {
      hasPortfolio = true;
      portfolio = {
        investedUsdt: pnl.totals.spentUsdt,
        currentValueUsdt: pnl.totals.currentValueUsdt,
        pnlUsdt: pnl.totals.pnlUsdt,
        pnlPercent: pnl.totals.pnlPercent,
      };
    }
  } catch (error) {
    logApiError("DIGEST_PNL_COMPUTE_FAILED", error);
  }

  // Nothing bought and nothing held — no message worth sending.
  if (buys.length === 0 && !hasPortfolio) return null;

  const bySymbol = new Map<string, number>();
  for (const o of buys) {
    bySymbol.set(o.symbol, (bySymbol.get(o.symbol) ?? 0) + 1);
  }
  return {
    buyCount: buys.length,
    dips: [...bySymbol.entries()].map(([symbol, count]) => ({ symbol, count })),
    spent24hUsdt: spent24h,
    portfolio,
  };
}

// Compatibility seam for callers that need a preview rather than durable
// delivery. The outbox itself stores only the typed inputs above.
export async function buildDigestForUser(
  db: Db,
  userId: string,
): Promise<string | null> {
  const inputs = await buildDigestRenderInputsForUser(db, userId);
  return inputs
    ? renderTelegramTemplate({
        version: TELEGRAM_TEMPLATE_VERSION,
        key: "DAILY_DIGEST",
        inputs,
      }).text
    : null;
}

// Cosmetic live countdown in Telegram. Execution itself is DB-driven in
// processDueOrders — if this loop dies with the process, the order still runs.
async function runCountdownEdits(
  db: Db,
  orderId: string,
  messageId: number,
  executeAt: Date,
  textFor: (secondsLeft: number) => string,
  chatId: string | null,
  signal: AbortSignal,
) {
  try {
    let lastRenderedSeconds = getCountdownSecondsLeft(executeAt);

    while (true) {
      await sleep(COUNTDOWN_TICK_MS, undefined, { signal });
      const secondsLeft = getCountdownSecondsLeft(executeAt);
      if (secondsLeft <= 0) return;
      if (secondsLeft === lastRenderedSeconds) continue;
      lastRenderedSeconds = secondsLeft;

      // Stop if the order was cancelled or force-executed meanwhile
      const [currentOrder] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
        .limit(1);
      if (currentOrder?.status !== "PENDING") return;
      if (signal.aborted) return;

      const retryAfterSeconds = await editTelegramMessage(
        messageId,
        textFor(secondsLeft),
        chatId,
        orderId,
      );
      if (retryAfterSeconds) {
        await sleep(retryAfterSeconds * 1000, undefined, { signal });
      }
    }
  } catch (err) {
    if (!signal.aborted) logApiError("COUNTDOWN_EDIT_LOOP_FAILED", err);
  }
}

interface StartRunnerOptions {
  connectionString: string;
  enabled: boolean;
  databaseInitialization: "migrate" | "verify";
  onDatabaseReady?: () => void;
  signal?: AbortSignal;
}

export interface RunnerHandle {
  stop: () => Promise<void>;
}

export async function startRunner(
  options: StartRunnerOptions,
): Promise<RunnerHandle> {
  logApiEvent("RUNNER_DATABASE_INITIALIZING");
  const { db, pool } = createPostgresConnection(options.connectionString);

  try {
    if (options.databaseInitialization === "migrate") {
      logApiEvent("DATABASE_MIGRATION_STARTED");
      await runMigrations(db);
      logApiEvent("DATABASE_MIGRATION_COMPLETED");
    } else {
      logApiEvent("DATABASE_VERIFICATION_STARTED");
      await verifyRuntimeDatabase(db);
      logApiEvent("DATABASE_VERIFICATION_COMPLETED");
    }
    options.onDatabaseReady?.();

    if (!options.enabled || options.signal?.aborted) {
      logApiEvent(
        options.signal?.aborted
          ? "RUNNER_STARTUP_CANCELLED"
          : "RUNNER_DISABLED",
      );
      await pool.end();
      return { stop: async () => undefined };
    }

    await seedDefaultStrategyIfNeeded(db, options.signal);

    if (!options.signal?.aborted) {
      const correlationId = createCorrelationId();
      try {
        await deleteExpiredSessions(db);
        lastSessionCleanupAt = new Date();
        logApiEvent("SESSION_CLEANUP_COMPLETED", "INFO", correlationId);
      } catch (error) {
        // Cleanup failure must not make already-expired sessions usable again.
        logApiError("SESSION_CLEANUP_FAILED", error, correlationId);
      }
    }
  } catch (error) {
    logApiError("DATABASE_INITIALIZATION_FAILED", error);
    await pool.end();
    throw error;
  }

  if (options.signal?.aborted) {
    logApiEvent("RUNNER_STARTUP_CANCELLED");
    await pool.end();
    return { stop: async () => undefined };
  }

  const client = createBybitPublicClient({ baseUrl: "https://api.bybit.com" });
  const lifecycle = createRunnerLifecycle();
  const { signal } = lifecycle;

  const tick = async () => {
    if (signal.aborted) return;
    const correlationId = createCorrelationId();
    lastTickAt = new Date();
    try {
      // Every enabled strategy, joined to its owner. The join is inner on
      // purpose: a strategy with no owner has nobody to notify and no budget
      // to charge, so it is skipped rather than run against a global default.
      const activeStrategies = await db
        .select({
          id: schema.strategies.id,
          userId: schema.strategies.userId,
          name: schema.strategies.name,
          symbol: schema.strategies.symbol,
          mode: schema.strategies.mode,
          config: schema.strategies.config,
          ownerChatId: sql<string | null>`CASE
            WHEN ${schema.users.notificationEnabledAt} IS NOT NULL
            THEN ${schema.users.telegramChatId}
            ELSE NULL
          END`,
        })
        .from(schema.strategies)
        .innerJoin(schema.users, eq(schema.strategies.userId, schema.users.id))
        .where(eq(schema.strategies.enabled, true));

      if (activeStrategies.length === 0) {
        logApiEvent("RUNNER_NO_ACTIVE_STRATEGIES", "INFO", correlationId);
        return;
      }

      // Group strategies by symbol
      const symbols = Array.from(
        new Set(activeStrategies.map((s) => s.symbol)),
      );

      for (const symbol of symbols) {
        if (signal.aborted) return;
        let ticker: import("@buy-crypto-dip-bot/exchange-core").MarketTicker;
        try {
          ticker = await client.getTicker(symbol);
        } catch (error) {
          logApiError("RUNNER_TICKER_FETCH_FAILED", error, correlationId);
          continue;
        }

        const strategiesForSymbol = activeStrategies.filter(
          (s) => s.symbol === symbol,
        );

        for (const strategy of strategiesForSymbol) {
          if (signal.aborted) return;
          // The inner join guarantees this at runtime; narrowing it here keeps
          // every write below owner-typed rather than owner-optional.
          const ownerId = strategy.userId;
          if (!ownerId) continue;
          const executeAt = new Date(
            Date.now() + orderExecutionDelaySeconds * 1000,
          );
          const result = await reserveDryRunOrder(db, {
            userId: ownerId,
            strategyId: strategy.id,
            ticker,
            executeAt,
            correlationId,
          });

          if (result.outcome === "SKIPPED") {
            const event = {
              NOT_ACTIVE: "RUNNER_INACTIVE_STRATEGY_SKIPPED",
              INVALID_CONFIG: "RUNNER_INVALID_STRATEGY_CONFIG_SKIPPED",
              STALE_MARKET: "RUNNER_STALE_MARKET_SKIPPED",
              NO_SIGNAL: "RUNNER_NO_SIGNAL",
              PENDING: "RUNNER_PENDING_ORDER_SKIPPED",
              DUPLICATE: "RUNNER_DUPLICATE_EVALUATION_SKIPPED",
              COOLDOWN: "RUNNER_COOLDOWN_SKIPPED",
            }[result.reason];
            logApiEvent(event);
            continue;
          }

          if (result.outcome === "REJECTED") {
            logApiEvent("RISK_DECISION_REJECTED", "WARN", correlationId);
            if (result.shouldNotify) {
              if (strategy.ownerChatId) {
                await enqueueNotification(db, {
                  userId: ownerId,
                  chatId: strategy.ownerChatId,
                  correlationId,
                  template: {
                    version: TELEGRAM_TEMPLATE_VERSION,
                    key: "RISK_REJECTED",
                    inputs: {
                      strategyName: result.strategy.name,
                      symbol: result.strategy.symbol,
                      price: ticker.lastPrice,
                      reasonCodes: result.reasonCodes,
                    },
                  },
                }).catch((err) =>
                  logApiError("RISK_ALERT_QUEUE_FAILED", err, correlationId),
                );
              }
            } else {
              logApiEvent(
                "RISK_ALERT_DUPLICATE_SUPPRESSED",
                "INFO",
                correlationId,
              );
            }
            continue;
          }
          const { order, config, strategy: reservedStrategy } = result;
          const templateFor = (
            secondsLeft: number,
          ): Extract<TelegramTemplateV1, { key: "ORDER_PENDING" }> => ({
            version: TELEGRAM_TEMPLATE_VERSION,
            key: "ORDER_PENDING",
            inputs: {
              strategyName: reservedStrategy.name,
              symbol: reservedStrategy.symbol,
              price: ticker.lastPrice,
              quoteAmount: config.suggestedQuoteAmount,
              secondsLeft,
              totalSeconds: orderExecutionDelaySeconds,
            },
          });
          const textFor = (secondsLeft: number) =>
            renderTelegramTemplate(templateFor(secondsLeft)).text;

          const alert = await sendTelegramAlertWithCancel(
            db,
            ownerId,
            templateFor(orderExecutionDelaySeconds),
            order.id,
            strategy.ownerChatId,
            correlationId,
          );

          if (alert?.messageId) {
            await db
              .update(schema.orders)
              .set({ tgMessageId: alert.messageId })
              .where(eq(schema.orders.id, order.id));

            // Cosmetic work is separate from execution, but still drained on stop.
            void lifecycle.run(() =>
              runCountdownEdits(
                db,
                order.id,
                alert.messageId,
                executeAt,
                textFor,
                strategy.ownerChatId,
                signal,
              ),
            );
          }
        }
      }
    } catch (err) {
      logApiError("RUNNER_TICK_FAILED", err, correlationId);
    }
  };

  logApiEvent("RUNNER_EXECUTION_LOOP_STARTED");
  const managedTask = (task: () => Promise<void>, failureEvent: string) =>
    createSingleFlightTask(() =>
      lifecycle.run(async () => {
        try {
          await task();
        } catch (error) {
          logApiError(failureEvent, error);
        }
      }),
    );
  const runTick = managedTask(tick, "RUNNER_TICK_FAILED");
  const runDueOrders = managedTask(
    () => processDueOrders(db, signal),
    "DUE_ORDER_PROCESSING_FAILED",
  );
  const runDigest = managedTask(
    () => maybeSendDailyDigest(db, signal),
    "DAILY_DIGEST_FAILED",
  );
  const runOutbox = managedTask(
    () => processNotificationOutbox(db, signal),
    "NOTIFICATION_OUTBOX_PROCESSING_FAILED",
  );
  const runSessionCleanup = managedTask(async () => {
    await deleteExpiredSessions(db);
    lastSessionCleanupAt = new Date();
    logApiEvent("SESSION_CLEANUP_COMPLETED");
  }, "SESSION_CLEANUP_FAILED");
  // Run first tick immediately. Later interval attempts are skipped while a
  // prior tick is still active, so one process cannot overlap itself.
  void runTick();
  tickIntervalId = setInterval(() => {
    void runTick().then((ran) => {
      if (!ran) logApiEvent("RUNNER_TICK_OVERLAP_SKIPPED", "WARN");
    });
  }, RUN_INTERVAL_MS);
  dueOrdersIntervalId = setInterval(() => {
    void runDueOrders();
  }, DUE_ORDERS_POLL_MS);
  digestIntervalId = setInterval(() => {
    void runDigest();
  }, DIGEST_CHECK_MS);
  void runOutbox();
  notificationOutboxIntervalId = setInterval(() => {
    void runOutbox();
  }, NOTIFICATION_OUTBOX_POLL_MS);
  sessionCleanupIntervalId = setInterval(() => {
    void runSessionCleanup();
  }, SESSION_CLEANUP_INTERVAL_MS);

  let stopping: Promise<void> | undefined;
  const stop = async () => {
    logApiEvent("RUNNER_DRAIN_STARTED");
    const draining = lifecycle.stop();
    if (tickIntervalId) clearInterval(tickIntervalId);
    if (dueOrdersIntervalId) clearInterval(dueOrdersIntervalId);
    if (digestIntervalId) clearInterval(digestIntervalId);
    if (notificationOutboxIntervalId) {
      clearInterval(notificationOutboxIntervalId);
    }
    if (sessionCleanupIntervalId) clearInterval(sessionCleanupIntervalId);
    tickIntervalId = null;
    dueOrdersIntervalId = null;
    digestIntervalId = null;
    notificationOutboxIntervalId = null;
    sessionCleanupIntervalId = null;
    await draining;
    await pool.end();
    logApiEvent("RUNNER_DRAIN_COMPLETED");
  };
  return { stop: () => (stopping ??= stop()) };
}

// Telegram delivery.
//
// Every per-user event must name its recipient explicitly — hence the required
// `chatId` argument rather than an environment lookup inside these functions.
// `TELEGRAM_CHAT_ID` is reserved for future operator-level alerts about
// install-wide problems and is deliberately *not* a fallback for a user event:
// silently redirecting one user's trading activity to the operator's chat
// would be a cross-tenant leak, not a degraded mode.

const orderKeyboard = (orderId: string) => ({
  inline_keyboard: [
    [
      { text: "Cancel ❌", callback_data: `cancel_order:${orderId}` },
      { text: "Buy Now ⚡", callback_data: `buy_now:${orderId}` },
    ],
  ],
});

async function sendTelegramAlertWithCancel(
  db: Db,
  userId: string,
  template: Extract<TelegramTemplateV1, { key: "ORDER_PENDING" }>,
  orderId: string,
  chatId: string | null,
  correlationId: string,
): Promise<{ messageId: number } | null> {
  if (!chatId) return null;
  const queued = await enqueueNotification(db, {
    userId,
    orderId,
    chatId,
    correlationId,
    template,
  });
  const claimed = await claimNotificationById(db, queued.id);
  return claimed ? deliverOutboxRecord(db, claimed) : null;
}

const deliverOutboxRecord = async (
  db: Db,
  record: OutboxRecord,
): Promise<{ messageId: number } | null> => {
  const recordFailure = async (errorCode: string) => {
    const state = await markNotificationFailure(db, record, errorCode);
    logApiEvent(
      state === "FAILED"
        ? "NOTIFICATION_DELIVERY_FAILED"
        : "NOTIFICATION_DELIVERY_RETRY_SCHEDULED",
      "WARN",
      record.correlationId,
    );
  };

  if (record.templateKey === "ORDER_PENDING" && record.orderId) {
    const [order] = await db
      .select({ status: schema.orders.status })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.id, record.orderId),
          eq(schema.orders.userId, record.userId),
        ),
      )
      .limit(1);
    if (order?.status !== "PENDING") {
      await markNotificationSkipped(db, record, "ORDER_NOT_PENDING");
      logApiEvent(
        "NOTIFICATION_DELIVERY_SKIPPED",
        "INFO",
        record.correlationId,
      );
      return null;
    }
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    await recordFailure("TELEGRAM_NOT_CONFIGURED");
    return null;
  }

  const controller = new AbortController();
  // Keep the same deadline through response body consumption, not just headers.
  const timeout = setTimeout(
    () => controller.abort(),
    TELEGRAM_REQUEST_TIMEOUT_MS,
  );
  try {
    let rendered: ReturnType<typeof renderTelegramTemplate>;
    try {
      rendered = renderTelegramTemplate({
        version: record.templateVersion,
        key: record.templateKey,
        inputs: record.renderInputs,
      });
    } catch {
      // The fallback intentionally contains no persisted render input. Its
      // correlation id is enough to trace the originating audit decision.
      rendered = renderTelegramFallback(record.correlationId);
      logApiEvent(
        "NOTIFICATION_TEMPLATE_FALLBACK_USED",
        "WARN",
        record.correlationId,
      );
    }
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: record.chatId,
          text: rendered.text,
          parse_mode: rendered.parseMode,
          ...(record.templateKey === "ORDER_PENDING" && record.orderId
            ? { reply_markup: orderKeyboard(record.orderId) }
            : {}),
        }),
      },
    );
    if (!response.ok) {
      await recordFailure(`HTTP_${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      result?: { message_id?: number };
    };
    clearTimeout(timeout);
    const messageId = data.result?.message_id;
    if (!messageId) {
      await recordFailure("INVALID_RESPONSE");
      return null;
    }

    await markNotificationDelivered(db, record, messageId);
    logApiEvent(
      "NOTIFICATION_DELIVERY_COMPLETED",
      "INFO",
      record.correlationId,
    );
    if (record.orderId) {
      await db
        .update(schema.orders)
        .set({ tgMessageId: messageId })
        .where(
          and(
            eq(schema.orders.id, record.orderId),
            eq(schema.orders.userId, record.userId),
          ),
        );
    }
    return { messageId };
  } catch {
    // Telegram may have accepted a timed-out send; retries remain at-least-once.
    await recordFailure(
      controller.signal.aborted ? "DELIVERY_TIMEOUT" : "TRANSPORT_ERROR",
    );
    return null;
  } finally {
    controller.abort();
    clearTimeout(timeout);
  }
};

export async function processNotificationOutbox(
  db: Db,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) return;
  await recoverStaleSendingNotifications(db);
  for (
    let attempt = 0;
    attempt < NOTIFICATION_OUTBOX_BATCH_LIMIT;
    attempt += 1
  ) {
    if (signal?.aborted) return;
    // Lease only the next send so queued rows cannot expire while waiting.
    const [record] = await claimDueNotifications(db, new Date(), 1);
    if (!record) return;
    await deliverOutboxRecord(db, record);
  }
}

export async function editTelegramMessage(
  messageId: number,
  newText: string,
  chatId: string | null,
  // When provided, keeps the Cancel/Buy Now buttons attached — Telegram
  // drops reply_markup on every edit unless it is sent again.
  keepButtonsForOrderId?: string,
): Promise<number | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId || !messageId) return null;

  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TELEGRAM_REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: newText,
        parse_mode: "HTML",
        ...(keepButtonsForOrderId
          ? { reply_markup: orderKeyboard(keepButtonsForOrderId) }
          : {}),
      }),
    });
    if (response.ok) return null;

    if (response.status === 429) {
      const payload = (await response.json().catch(() => null)) as {
        parameters?: { retry_after?: number };
      } | null;
      controller.signal.throwIfAborted();
      const retryAfterSeconds = payload?.parameters?.retry_after ?? 1;
      logApiEvent("TELEGRAM_COUNTDOWN_RATE_LIMITED", "WARN");
      return retryAfterSeconds;
    }

    logApiEvent("TELEGRAM_MESSAGE_EDIT_REJECTED", "WARN");
  } catch (error) {
    if (controller.signal.aborted) {
      logApiEvent("TELEGRAM_MESSAGE_EDIT_TIMED_OUT", "WARN");
    } else {
      logApiError("TELEGRAM_MESSAGE_EDIT_FAILED", error);
    }
  } finally {
    controller.abort();
    clearTimeout(timeout);
  }
  return null;
}
