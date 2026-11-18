# Telegram spot buying discovery

18 November 2026 · [Product hypothesis](../14_PRODUCT_STRATEGY.md) · [MVP plan](../../plans/015-telegram-mvp-product-research.md)

Test whether regular Bybit spot buyers can set a spending rule, tell how much
they can still spend, understand why a buy was blocked, and pause from Telegram.
The current prototype simulates buys in `DRY_RUN`. Evidence here consists of a
source walkthrough, local regression tests and provider documentation. No
participant sessions, provider account trials or payments have been recorded.

## Who to recruit

Aim for 12 adults in the first round. Start with four sessions to catch issues
with the script. Keep any materially revised version identifiable in the notes.

| Group | Target | Qualification |
| --- | ---: | --- |
| Manual buyers | 6 | At least two Bybit spot purchases in the past 90 days, at least one tied to a price move or limit. Typically monitors the market, uses alerts or places orders manually. |
| Automation users | 6 | Same purchase history. Has personally configured an exchange bot or third-party spot automation in the past 90 days. Include native Bybit and third-party workflows where possible. |

For both groups, require weekly Telegram use and a recent concrete example of
setting or monitoring a spending limit, size or buying frequency. Ask which
Bybit app/site they already use, device, language, and whether someone else
handles setup. Log DCA-only users separately if interviewed. Exclude project
contributors and derivatives-only users from this round. Confirm the last
episode verbally. A redacted receipt is optional. Get consent for research notes
and agree separately on recording or future contact. Collect no credentials,
exchange identifiers, account balances or unredacted screens.

## Session script

Allow about 45 minutes. Spend 10 minutes on recent behaviour, 20–25 across two
task runs and 10 on trade-offs and a concrete follow-up. Start with “Walk me
through the last time a price move made you consider a Bybit spot buy.” Ask what
they checked, what they spent, how they kept track, what went wrong, what they
did about it, and what tool or workaround they used. Ask for one actual incident
or recurring task before showing the product. Keep reasons for choosing manual
control as evidence in their own right.

Use the same starting state and device for the two timed runs. Start signed in
with a research identity or equivalent fixture. Run sign-in and private
`/start` as an untimed preflight, and record what participants think each enables.
Use a resettable simulated account and staged competitor screens. Keep labels,
values and menu paths faithful to the reviewed version. Ask participants to
indicate an action before any screen that would submit, liquidate, transfer
or grant permissions. Alternate product order within each group and record
prior familiarity. Record fixture, source/version, date, locale and device.

### Task card

Read only the prompts. The scenario is fictional. Set the 24h high at 100,000
USDT. Use a current price of 100,000 USDT at setup and 97,800 USDT for budget
and reason. Start with no BTC rule, then load a completed-order/rejection state
for budget and reason, and an independent state with a pending simulation for
the pause. Freeze that fixture before settlement so each participant can find
the control. Record the live timing question separately from discoverability.

| Task | Participant prompt | Independent pass |
| --- | --- | --- |
| 1. Set up | “Set up a simulated BTC/USDT spot buy of 20 USDT when BTC is at least 2% below its 24-hour high. Cap this rule at 50 USDT per rolling 24 hours and 100 USDT per rolling seven days. Leave at least 60 minutes between buys. Tell me what will happen when you start it.” | Configures all values, identifies the rolling reference and spending periods, and understands that activating the prototype creates simulated activity only. A Telegram-to-web handoff is valid. Record where each control was found. |
| 2. Budget | “The rule has been running. Show me how much it can still spend in each window and whether the next 20-USDT buy fits.” | Identifies 10 USDT left in 24h (50 − 40) and 20 USDT left in 7d (100 − 80), and concludes the 24h cap blocks another 20 USDT. The fixture has no pending hold; include an extra hold variant only where authoritative amounts are visible. |
| 3. Explain | “BTC fell enough. Use the decision at 14:00 to tell me why the rule did not buy and point to the evidence.” | Identifies the 24h cap as the recorded blocker. Price was 2.2% below the high, the last simulated buy was 120 minutes ago and 40 + 20 = 60 USDT exceeds 50 USDT. The equivalent latest-decision view must distinguish a cap block from a missing signal or missing data. |
| 4. Pause | “Stop future buys for this BTC rule. Keep the ETH rule active. What happens to the BTC buy already waiting? Show how you would stop it too.” | Confirms BTC is paused and ETH remains active, understands that the pending simulated buy can still settle, and finds its separate cancel control while it is still pending. Record whether the surface discloses this before the participant acts. |

### Comparison controls

Bybit Spot Conditional is the primary comparator for the next price-triggered
buy. Preserve feature mismatches even when the participant finds a useful
workaround. Ask the participant to demonstrate their own usual method before
showing a secondary competitor. Use Bybit DCA if the episode centred on
schedules, and 3Commas if it centred on recurring triggers. Use the Bybit AI
and TradeGPT prompts as separate, untimed probes for the claimed advantages
of natural language and Telegram delivery.

| Control | Publicly documented path | Equivalent to test and what to record |
| --- | --- | --- |
| **Bybit Spot Conditional** | In Spot, choose Buy and Conditional. Current untriggered orders appear in Open Orders, where an order can be edited or cancelled. [Bybit Spot guide](https://www.bybit.com/en/help-center/article/How-to-Get-Started-with-Spot-Trading) · [Demo Trading](https://www.bybit.com/en/help-center/article/Demo-Trading) | Draft the fixture's next 20-USDT buy at a 98,000-USDT trigger (100,000 × 0.98). Find its current state and the action for cancelling only the chosen order. A fixed-price order represents one trigger. Record any manual re-arming, cap tracking and explanation work. Demo documents Spot support. Verify the exact control in a safe fixture before timing it. |
| **Bybit DCA Bot** | Tools → Trading Bot → DCA Bot. Choose frequency, amount and optional total maximum. My Bots → Details shows activity. Terminate offers settlement choices. Confirmation starts the first purchase. [Bybit DCA guide](https://www.bybit.com/en/help-center/article/How-to-Get-Started-with-DCA-Trading-on-Bybit) | Use a staged recurring purchase and total cap screen. Find recorded investment and how new purchases can be stopped while keeping the coin. Record the schedule trigger, cumulative scope and termination effects. |
| **Bybit AI** | Tools → Bybit AI on web, or More → Bybit AI under Trade in the app. Current documentation describes transaction previews and confirmation, including for Trading Bot actions. It identifies Main Account as the default, with an optional AI Subaccount. [Bybit AI](https://www.bybit.com/en/help-center/article/Introduction-to-Bybit-AI) | Show the same natural-language intent and ask where the participant would verify timing, limits and account before confirming. Treat the exact recurring rule and audit capabilities as unverified in this run. An isolated subaccount can hold transferred funds and has a different scope from paper trading. |
| **Bybit TradeGPT Telegram** | Private chat supports market questions and automated signal notifications. The guide describes blocking the bot and restarting it to control delivery. [TradeGPT Telegram](https://www.bybit.com/en/help-center/article/Introduction-to-Bybit-TradeGPT-Telegram-Bot) | Ask for the market move, then locate a signal and how to stop alerts. Score only the alert controls. Keep any evidence for spending-rule controls separate. |
| **3Commas DCA Bot** | Bybit appears as a supported exchange. The guide documents configurable entry conditions, position history, and Stop with distinct choices for open positions. The reviewed 3Commas Demo guide specifies perpetual markets. [Exchange list](https://3commas.io/exchanges) · [DCA setup](https://help.3commas.io/en/articles/16281102-how-the-dca-bot-works-strategy-setup-guide) · [Demo guide](https://help.3commas.io/en/articles/16281106-demo-trading-guide) | Use a staged Spot configuration and stop dialog to compare entry criteria, capital allocation and treatment of open positions. Verify whether they have the same windows and a per-event explanation. Skip futures and real exchange connections. |

### Scoring and decision log

- Mark `2` for correct unaided completion, `1` for correct completion after
  one neutral hint, and `0` for failure, unsafe action or a wrong interpretation.
  At three minutes, record the unaided outcome before offering “Where would you
  look next?” Allow up to two further minutes. Record task time and hint use.
- Mark `GAP` when a verified capability difference prevents the exact task.
  Mark `UNTESTED` for missing fixture access, unknown capability or setup
  failure. For a gap, record the closest equivalent in a separate outcome
  field. A manual calculation can score `2` if the participant independently
  finds the authoritative inputs and computes the right answer. Record manual
  steps and surface changes. Do not combine `GAP` or `UNTESTED` with timed
  completions in cross-product comparisons.
- Mark critical errors separately. Examples include interpreting simulation as
  real funds, choosing account balance as strategy headroom, stopping the wrong
  rule, or assuming a pending order was cancelled. Log the screen and what the
  participant did or said unaided before the moderator explains the result.
- Log one row per task in this order: participant ID | segment | device and
  locale | surface and version | sequence | task | score or gap | unaided and
  total time | errors and assistance | evidence/quote | comparable workaround.
  Summarize per task and segment as `unaided/eligible`, `assisted/eligible`,
  `critical errors/eligible`, and separate counts for gaps and untested cases.
  Report timing for matched, correctly completed tasks only and show sample sizes.

Prioritize any directly observed misunderstanding about funds or pending orders
for a fix and retest. Use repeated friction with budget or explanations to
choose a prototype change. Advance the Telegram positioning hypothesis if people
independently describe a recurring control problem and show reliable task
completion with less work than their alternative. If they prefer existing alerts
or one-off conditional orders, record why and revise the segment or promise.
This small exploratory round is for product decisions and finding failure modes.

## Pricing and acquisition evidence

Ask which tools they paid for in the last 90 days, amount, currency, billing
period, what triggered purchase and renewal, who paid, and which tool or time
the purchase replaced. Document free workarounds and cancellation reasons.
Ask which specific improvement would make them switch, then which control they
would cut if it cost money. Discuss self-hosted simulation and a possible future
hosted simulation as separate offers. For the second, keep the offer wording
fixed within each comparison. If testing prices later, derive two candidate
amounts from documented spend and delivery cost. Randomly assign one amount
per participant within each segment. Record the exact offer and currency.

| Evidence | Record and use |
| --- | --- |
| Prior actual spend | Tool, exact amount or range, period, payer and reason. Mark whether it is a self-report or supported by a redacted receipt. Shows existing category spend. |
| Stated willingness | Exact offer, participant's stated ceiling or chosen trade-off, and reason. Generates a pricing hypothesis. |
| Observed commitment | Agreed and attended repeat test, return to monitor a simulated rule, or agreed date for a clearly described future pilot. Track completed actions separately from promises and active return separately from cash evidence. |
| Actual payment | After approval and an available offer, record opt-in purchase, amount, currency, cancellation and renewal. This is the revenue evidence. Current round takes no payments or deposits. |

Compare recruitment sources where outreach is later approved. Record channel,
contacted or reached denominator where measurable, qualified, booked, attended
and unaided setup. For an approved 14-day cohort, report return among eligible
users whose full 14 days elapsed. Report counts and denominators. Keep the price
claim, public landing copy and GTM decision tied to the exact offer tested.

## Repository walkthrough

Reviewed `main` at `5316cea`. Local checks used Node 26.4.0 and pnpm 11.0.0.
The first test run loaded an older built DB export missing `orderReservations`
and had five failures. A rerun resolving workspace packages to current source
passed 38 tests in six files (bot creation, onboarding, bot order/pause,
reservation, strategy and risk). Tests include a disposable PGlite DB. The
walkthrough traces entry points and state. Actual Telegram delivery, browser
timings and provider account journeys remain unverified here.

| Task | Source observation | Candidate change to test |
| --- | --- | --- |
| Set up | Private `/start` binds notification delivery. The Telegram wizard selects pair, threshold and amount, shows the default daily cap and activates simulation. It describes a “recent high.” The engine uses the ticker's 24h high; weekly cap and cooldown can be edited on web. [Bot entry](../../apps/bot/src/bot.ts#L92) · [Wizard](../../apps/bot/src/onboarding.ts#L144) · [Engine](../../packages/strategy-engine/src/index.ts#L75) · [Web card](../../apps/web/app/entities/strategy/ui/StrategyCard.vue#L160) | Preview the 24h reference, both rolling caps and cooldown in Telegram. Give the user a way to review or adjust these values before enabling the rule. |
| Budget | Telegram `/status` totals caller-wide completed activity by creation time in the past 24h. `/settings` displays the daily cap per rule. The web strategy form previews configured bounds. The reservation path computes per-strategy completed spend, effective settlement times and committed amounts. No live headroom is surfaced by the reviewed status/settings or strategy card. [Bot status/settings](../../apps/bot/src/bot.ts#L140) · [Web preview](../../apps/web/app/entities/strategy/ui/StrategyCard.vue#L208) · [Reservation accounting](../../apps/api/src/modules/runner/reservation.repository.ts#L193) | Show authoritative simulated headroom in both windows with timestamp and pending state. Derive it from the reservation accounting used for new buys. |
| Explain | New cap rejections have durable provenance and may generate Telegram alerts with reason codes. Web displays the event and raw payload. A below-threshold observation or cooldown returns a runner skip and is logged outside that audit path. [Reservation decision](../../apps/api/src/modules/runner/reservation.repository.ts#L188) · [Runner outcomes](../../apps/api/src/modules/runner/runner.service.ts#L532) · [Alert template](../../apps/api/src/modules/notifications/telegram-template.ts#L323) · [Web audit](../../apps/web/app/widgets/audit-feed/ui/AuditFeedWidget.vue#L43) | Give audited rejections a human-readable rule, observed value, limit and time. Present unavailable decisions explicitly for outcomes with no tenant-visible evidence. |
| Pause | Telegram `/toggle` changes one rule and `/pause_all` changes all the caller's rules. The wizard says the bulk action “stops everything.” Web explicitly says pending simulations can still settle and cancellation is separate. [Bot pause](../../apps/bot/src/bot.ts#L354) · [Per-rule toggle](../../apps/bot/src/bot.ts#L619) · [Wizard return](../../apps/bot/src/onboarding.ts#L210) · [Web pause](../../apps/web/app/widgets/strategy-list/ui/StrategyListWidget.vue#L89) · [Pending settlement](../../apps/api/src/modules/runner/runner.service.ts#L145) · [Telegram cancellation](../../apps/bot/src/bot.ts#L772) | Clarify Telegram pause confirmation and show the pending order's separate cancel action when applicable. Test with one other rule active. |

Draft research message to test after those checks: “Set a simulated spot buying
rule and review its recorded decisions.” Treat per-rule headroom and permission
to publish stronger claims as separate open decisions. [Claims registry](../21_CLAIMS_REGISTRY.md) · [Release status](../23_PROJECT_STATUS.md)
