# Product direction: Telegram-first spot buying

Updated: 2026-11-16. This document describes the intended product and research
priorities, not a claim that the product is ready for public or live use.
[Project status](23_PROJECT_STATUS.md) owns the implementation and release
verdict; `DRY_RUN` remains the default and live trading is not yet implemented.

## Customer problem and product hypothesis

A person who accumulates crypto wants to set a buying plan, understand what it
can spend, and avoid watching the market all day. The proposed product is a
Telegram-first assistant that applies the customer's chosen spot-buying rules,
explains decisions, and lets them pause. Web is a second view of the same
account for configuration, history, and research. The intended destination is
real-money spot buying, subject to explicit activation and release readiness.

This is a hypothesis: demand, willingness to pay, retention, ease of use and
superiority over existing alternatives are not established. Do not market a
predictive edge, future returns or live execution as accomplished facts.

## Smallest target product

1. One account using Telegram identity across the bot and web. A private bot
   `/start` is separately needed for messages; identity is not notification
   consent or exchange authorization.
2. One exchange, Bybit spot, and the reviewed symbols in shared configuration.
   No derivatives, leverage, withdrawals, transfers or meme coins.
3. One understandable buying rule with amount, explicit spending limits,
   cooldown, an activation preview, pause, status, and decision history.
4. Telegram for onboarding, status, notifications and pause; web for larger
   configuration and history views. Both use the same tenant and strategy.
5. A separately authorized exchange connection before live use. Investigate
   Bybit's AI Subaccount and Broker OAuth eligibility as well as scoped API
   keys. Never solicit secrets through ordinary Telegram messages; isolate
   credentials per tenant, protect encryption keys separately, and verify the
   actual permissions. An exchange connection is not implemented today.
6. Before any real order, implement and independently verify durable order
   identity, bounded budgets, state reconciliation after ambiguous responses,
   security, and recovery. Keep automatic live trading disabled by default.

Do not block customer discovery on a platform migration. Defer additional
exchanges, speculative SEO expansion, cloud rewrites, a strategy marketplace,
and ML-driven live execution until there is a specific validated need. Retain
existing code and audit history until removal is scoped and dependencies are
checked; deferral is not a deletion instruction.

## Historical research and prediction

Research runs separately from the trading executor. Start with Bybit spot
historical candles and compare the current dip rule to a simple DCA baseline.
Document the instrument, data source, coverage, missing data, identical capital
and contribution schedule, execution assumptions, fees and slippage scenarios.
Measure total portfolio value including remaining cash and drawdown, not just
the average purchase price.

Use chronological train/validation windows and a final untouched holdout; never
train on later observations or use an unfinished candle as settled history.
Record the number of parameter and model trials to expose selection bias.
First assess price/volume features; evaluate timestamped news as an incremental
feature against the same baseline. Article availability and model training
cutoff matter. Correlation does not establish causation, and a historical
result does not prove future profitability. A model may be informative without
being suitable for live execution.

Sources: [Bybit spot candles](https://bybit-exchange.github.io/docs/v5/market/kline),
[GDELT data](https://www.gdeltproject.org/data.html), and
[time-ordered validation](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html).

## Positioning and competition

Candidate promise, to validate with actual users: "Set a spot buying plan and
see what the bot did, why, and how much of your budget remains." Bybit already
offers [AI-assisted trading](https://www.bybit.com/en/help-center/article/Introduction-to-Bybit-AI)
and a [Telegram market assistant](https://www.bybit.com/en/help-center/article/Introduction-to-Bybit-TradeGPT-Telegram-Bot).
Telegram, AI, and historical optimization alone are not a proven advantage.
Compare the actual experience and coverage before claiming differentiation.

No price, conversion result, user count, revenue, SLA, or hosted launch is
established. Current capability and public claims must follow the reviewed
revision and [claims registry](21_CLAIMS_REGISTRY.md).
