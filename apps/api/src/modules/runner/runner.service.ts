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
} from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { evaluateRisk } from "@buy-crypto-dip-bot/risk-engine";
import {
  AUDIT_SCHEMA_VERSION,
  createCorrelationId,
} from "@buy-crypto-dip-bot/shared-types";
import { evaluateDipStrategy } from "@buy-crypto-dip-bot/strategy-engine";
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
const SESSION_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Heartbeat for /risk/status: lets the dashboard show whether the trading
// loop is actually alive instead of pretending.
let lastTickAt: Date | null = null;

export const getRunnerStatus = () => ({
  lastTickAt: lastTickAt ? lastTickAt.toISOString() : null,
  tickIntervalMs: RUN_INTERVAL_MS,
  sessionCleanup: {
    lastCompletedAt: lastSessionCleanupAt?.toISOString() ?? null,
    intervalMs: SESSION_CLEANUP_INTERVAL_MS,
  },
});

type Db = ReturnType<typeof createPostgresConnection>["db"];

interface StrategyConfigJson {
  thresholdPercent: number;
  maxDailySpendUsdt: number;
  maxWeeklySpendUsdt: number;
  cooldownMinutes: number;
  suggestedQuoteAmount: number;
}

// Seed default strategies for the single operator of a self-hosted install.
//
// Seeding is owner-scoped and opt-in: without OPERATOR_TELEGRAM_USER_ID we
// create nothing at all. Ownerless seeded rows were safe when the product had
// exactly one user, but in a multi-user world they are ambiguous tenants that
// nobody can safely claim later — see the I05 migration notes.
async function seedDefaultStrategyIfNeeded(db: Db) {
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
    const correlationId = createCorrelationId();
    const inserted = await db.transaction(async (tx) => {
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
async function processDueOrders(db: Db) {
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

async function maybeSendDailyDigest(db: Db) {
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
    try {
      const inputs = await buildDigestRenderInputsForUser(db, user.id);
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
) {
  try {
    let lastRenderedSeconds = getCountdownSecondsLeft(executeAt);

    while (true) {
      await sleep(COUNTDOWN_TICK_MS);
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

      const retryAfterSeconds = await editTelegramMessage(
        messageId,
        textFor(secondsLeft),
        chatId,
        orderId,
      );
      if (retryAfterSeconds) {
        await sleep(retryAfterSeconds * 1000);
      }
    }
  } catch (err) {
    logApiError("COUNTDOWN_EDIT_LOOP_FAILED", err);
  }
}

interface StartRunnerOptions {
  connectionString: string;
  onMigrationsComplete?: () => void;
}

export async function startRunner(options: StartRunnerOptions) {
  logApiEvent("RUNNER_DATABASE_INITIALIZING");
  const { db, pool } = createPostgresConnection(options.connectionString);

  try {
    logApiEvent("DATABASE_MIGRATION_STARTED");
    await runMigrations(db);
    logApiEvent("DATABASE_MIGRATION_COMPLETED");
    options.onMigrationsComplete?.();

    await seedDefaultStrategyIfNeeded(db);

    const correlationId = createCorrelationId();
    try {
      await deleteExpiredSessions(db);
      lastSessionCleanupAt = new Date();
      logApiEvent("SESSION_CLEANUP_COMPLETED", "INFO", correlationId);
    } catch (error) {
      // Retention cleanup must be observable, but a temporary cleanup failure
      // does not make already-expired sessions usable again.
      logApiError("SESSION_CLEANUP_FAILED", error, correlationId);
    }
  } catch (error) {
    logApiError("DATABASE_MIGRATION_FAILED", error);
    await pool.end();
    throw error;
  }

  const client = createBybitPublicClient({ baseUrl: "https://api.bybit.com" });

  const tick = async () => {
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
          // The inner join guarantees this at runtime; narrowing it here keeps
          // every write below owner-typed rather than owner-optional.
          const ownerId = strategy.userId;
          if (!ownerId) continue;

          const config = strategy.config as unknown as StrategyConfigJson;
          const strategyContract = {
            id: strategy.id,
            name: strategy.name,
            symbol: strategy.symbol,
            mode: (strategy.mode === "LIVE" ? "LIVE" : "DRY_RUN") as
              | "LIVE"
              | "DRY_RUN",
            maxDailySpendUsdt: config.maxDailySpendUsdt,
            maxWeeklySpendUsdt: config.maxWeeklySpendUsdt,
            cooldownMinutes: config.cooldownMinutes,
          };

          // 1. Evaluate strategy
          const signal = evaluateDipStrategy({
            strategy: strategyContract,
            currentPrice: ticker.lastPrice,
            high24h: ticker.high24h ?? ticker.lastPrice,
            thresholdPercent: config.thresholdPercent,
            suggestedQuoteAmount: config.suggestedQuoteAmount,
            now: new Date().toISOString(),
          });

          // If no signal, log and skip
          if (signal.type === "NO_SIGNAL") {
            logApiEvent("RUNNER_NO_SIGNAL");
            continue;
          }

          // 2. Fetch risk boundaries (spent USDT in last 24h and last 7 days)
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          const dailySpentResult = await db
            .select({
              sum: sql<string>`sum(cast(${schema.orders.quoteAmount} as numeric))`,
            })
            .from(schema.orders)
            .where(
              and(
                // Owner as well as strategy: the strategy id alone would be
                // enough today, but a spend cap is the last thing that should
                // depend on a single id being right.
                eq(schema.orders.userId, ownerId),
                eq(schema.orders.strategyId, strategy.id),
                eq(schema.orders.status, "COMPLETED"),
                gte(schema.orders.createdAt, oneDayAgo),
              ),
            );

          const weeklySpentResult = await db
            .select({
              sum: sql<string>`sum(cast(${schema.orders.quoteAmount} as numeric))`,
            })
            .from(schema.orders)
            .where(
              and(
                eq(schema.orders.userId, ownerId),
                eq(schema.orders.strategyId, strategy.id),
                eq(schema.orders.status, "COMPLETED"),
                gte(schema.orders.createdAt, oneWeekAgo),
              ),
            );

          const dailySpentUsdt = Number(dailySpentResult[0]?.sum ?? "0");
          const weeklySpentUsdt = Number(weeklySpentResult[0]?.sum ?? "0");

          // 3. Check for cooldown to avoid double-buying in the same dip.
          // PENDING orders count too — otherwise a second signal could
          // schedule a duplicate while the first is still counting down.
          const lastOrder = await db
            .select()
            .from(schema.orders)
            .where(
              and(
                eq(schema.orders.userId, ownerId),
                eq(schema.orders.strategyId, strategy.id),
                or(
                  eq(schema.orders.status, "COMPLETED"),
                  eq(schema.orders.status, "PENDING"),
                ),
              ),
            )
            .orderBy(sql`${schema.orders.createdAt} DESC`)
            .limit(1);

          const [lastOrderRow] = lastOrder;
          if (lastOrderRow) {
            if (lastOrderRow.status === "PENDING") {
              logApiEvent("RUNNER_PENDING_ORDER_SKIPPED");
              continue;
            }
            const lastOrderTime = new Date(lastOrderRow.createdAt).getTime();
            const minutesSinceLastOrder =
              (Date.now() - lastOrderTime) / (60 * 1000);
            if (minutesSinceLastOrder < config.cooldownMinutes) {
              logApiEvent("RUNNER_COOLDOWN_SKIPPED");
              continue;
            }
          }

          // 4. Run through RiskGuard
          const decision = evaluateRisk(signal, strategyContract, {
            liveTradingEnabled: false, // always false for dry-run only safety
            allowedSymbols: getAllowedSymbols(process.env.ALLOWLIST_SYMBOLS),
            dailySpentUsdt,
            weeklySpentUsdt,
          });

          if (decision.status === "REJECTED") {
            logApiEvent("RISK_DECISION_REJECTED", "WARN", correlationId);

            // Cooldown/Throttle RiskGuard alerts to Telegram (once per 1 hour per strategy/reason combination)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentAlerts = await db
              .select()
              .from(schema.auditEvents)
              .where(
                and(
                  eq(schema.auditEvents.userId, ownerId),
                  eq(schema.auditEvents.entityType, "strategy"),
                  eq(schema.auditEvents.entityId, strategy.id),
                  eq(schema.auditEvents.action, "RISK_DECISION_REJECTED"),
                  gte(schema.auditEvents.createdAt, oneHourAgo),
                ),
              );

            const hasRecentSimilarAlert = recentAlerts.some((alert) => {
              const payload = alert.payload as { reasonCodes?: string[] };
              const prevReasons = payload.reasonCodes;
              if (!prevReasons) return false;
              return (
                prevReasons.length === decision.reasonCodes.length &&
                prevReasons.every((r) => decision.reasonCodes.includes(r))
              );
            });

            // Save Audit Event
            await db.insert(schema.auditEvents).values(
              auditEventRow({
                schemaVersion: AUDIT_SCHEMA_VERSION,
                type: "RISK_DECISION_REJECTED",
                scope: "USER",
                userId: ownerId,
                actor: { kind: "SYSTEM", channel: "RUNNER" },
                reasonCode: "RISK_POLICY_REJECTED",
                correlationId,
                subject: { type: "STRATEGY", id: strategy.id },
                payloadClass: "TENANT_FINANCIAL",
                payload: {
                  mode: "DRY_RUN",
                  policyVersion: "RISK_V1",
                  reasonCodes: decision.reasonCodes,
                },
              }),
            );

            if (!hasRecentSimilarAlert) {
              if (strategy.ownerChatId) {
                enqueueNotification(db, {
                  userId: ownerId,
                  chatId: strategy.ownerChatId,
                  correlationId,
                  template: {
                    version: TELEGRAM_TEMPLATE_VERSION,
                    key: "RISK_REJECTED",
                    inputs: {
                      strategyName: strategy.name,
                      symbol: strategy.symbol,
                      price: ticker.lastPrice,
                      reasonCodes: decision.reasonCodes,
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

          // 5. Schedule a PENDING order; processDueOrders executes it once
          // execute_at passes, even across restarts. The reservation and its
          // approval evidence commit together.
          const executeAt = new Date(
            Date.now() + orderExecutionDelaySeconds * 1000,
          );
          const order = await db.transaction(async (tx) => {
            const [inserted] = await tx
              .insert(schema.orders)
              .values({
                userId: ownerId,
                strategyId: strategy.id,
                symbol: strategy.symbol,
                mode: strategy.mode,
                side: "BUY",
                quoteAmount: String(config.suggestedQuoteAmount),
                price: String(ticker.lastPrice),
                status: "PENDING",
                executeAt,
              })
              .onConflictDoNothing()
              .returning();

            await tx.insert(schema.auditEvents).values(
              inserted
                ? auditEventRow({
                    schemaVersion: AUDIT_SCHEMA_VERSION,
                    type: "RISK_DECISION_APPROVED",
                    scope: "USER",
                    userId: ownerId,
                    actor: { kind: "SYSTEM", channel: "RUNNER" },
                    reasonCode: "RISK_POLICY_APPROVED",
                    correlationId,
                    subject: { type: "STRATEGY", id: strategy.id },
                    payloadClass: "TENANT_FINANCIAL",
                    payload: {
                      mode: "DRY_RUN",
                      policyVersion: "RISK_V1",
                      reasonCodes: [],
                      orderId: inserted.id,
                    },
                  })
                : auditEventRow({
                    schemaVersion: AUDIT_SCHEMA_VERSION,
                    type: "PENDING_ORDER_DUPLICATE_SUPPRESSED",
                    scope: "USER",
                    userId: ownerId,
                    actor: { kind: "SYSTEM", channel: "RUNNER" },
                    reasonCode: "EXISTING_PENDING_ORDER",
                    correlationId,
                    subject: { type: "STRATEGY", id: strategy.id },
                    payloadClass: "OPERATIONAL",
                    payload: { mode: "DRY_RUN" },
                  }),
            );
            return inserted ?? null;
          });

          if (!order) {
            continue;
          }
          const templateFor = (
            secondsLeft: number,
          ): Extract<TelegramTemplateV1, { key: "ORDER_PENDING" }> => ({
            version: TELEGRAM_TEMPLATE_VERSION,
            key: "ORDER_PENDING",
            inputs: {
              strategyName: strategy.name,
              symbol: strategy.symbol,
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

            // Fire-and-forget: cosmetic countdown edits
            void runCountdownEdits(
              db,
              order.id,
              alert.messageId,
              executeAt,
              textFor,
              strategy.ownerChatId,
            );
          }
        }
      }
    } catch (err) {
      logApiError("RUNNER_TICK_FAILED", err, correlationId);
    }
  };

  logApiEvent("RUNNER_EXECUTION_LOOP_STARTED");
  const runTick = createSingleFlightTask(tick);
  // Run first tick immediately. Later interval attempts are skipped while a
  // prior tick is still active, so one process cannot overlap itself.
  void runTick();
  tickIntervalId = setInterval(() => {
    void runTick().then((ran) => {
      if (!ran) logApiEvent("RUNNER_TICK_OVERLAP_SKIPPED", "WARN");
    });
  }, RUN_INTERVAL_MS);
  dueOrdersIntervalId = setInterval(() => {
    processDueOrders(db).catch((err) =>
      logApiError("DUE_ORDER_PROCESSING_FAILED", err),
    );
  }, DUE_ORDERS_POLL_MS);
  digestIntervalId = setInterval(() => {
    maybeSendDailyDigest(db).catch((err) =>
      logApiError("DAILY_DIGEST_FAILED", err),
    );
  }, DIGEST_CHECK_MS);
  void processNotificationOutbox(db).catch((err) =>
    logApiError("NOTIFICATION_OUTBOX_PROCESSING_FAILED", err),
  );
  notificationOutboxIntervalId = setInterval(() => {
    processNotificationOutbox(db).catch((err) =>
      logApiError("NOTIFICATION_OUTBOX_PROCESSING_FAILED", err),
    );
  }, NOTIFICATION_OUTBOX_POLL_MS);
  sessionCleanupIntervalId = setInterval(() => {
    const correlationId = createCorrelationId();
    deleteExpiredSessions(db)
      .then(() => {
        lastSessionCleanupAt = new Date();
        logApiEvent("SESSION_CLEANUP_COMPLETED", "INFO", correlationId);
      })
      .catch((error) =>
        logApiError("SESSION_CLEANUP_FAILED", error, correlationId),
      );
  }, SESSION_CLEANUP_INTERVAL_MS);

  // Close connection pool on process exit
  process.on("SIGTERM", async () => {
    if (tickIntervalId) clearInterval(tickIntervalId);
    if (dueOrdersIntervalId) clearInterval(dueOrdersIntervalId);
    if (digestIntervalId) clearInterval(digestIntervalId);
    if (notificationOutboxIntervalId) {
      clearInterval(notificationOutboxIntervalId);
    }
    if (sessionCleanupIntervalId) clearInterval(sessionCleanupIntervalId);
    await pool.end();
  });
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
    await recordFailure("TRANSPORT_ERROR");
    return null;
  }
};

async function processNotificationOutbox(db: Db): Promise<void> {
  await recoverStaleSendingNotifications(db);
  const records = await claimDueNotifications(db);
  for (const record of records) {
    await deliverOutboxRecord(db, record);
  }
}

async function editTelegramMessage(
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
  try {
    const response = await fetch(url, {
      method: "POST",
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
      const retryAfterSeconds = payload?.parameters?.retry_after ?? 1;
      logApiEvent("TELEGRAM_COUNTDOWN_RATE_LIMITED", "WARN");
      return retryAfterSeconds;
    }

    logApiEvent("TELEGRAM_MESSAGE_EDIT_REJECTED", "WARN");
  } catch (error) {
    logApiError("TELEGRAM_MESSAGE_EDIT_FAILED", error);
  }
  return null;
}
