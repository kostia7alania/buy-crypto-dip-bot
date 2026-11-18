# Telegram-first spot MVP: product, research and marketing plan

Date: 2026-11-16. Working draft; no launch date, revenue, budget, customer
count or competitive advantage is established. The implementation verdict
continues to live in `docs/23_PROJECT_STATUS.md`.

Research checkpoint, 2026-11-18. The
[hourly comparison and source audit](../docs/research/2026-11-18-mvp-evidence.md)
found 6,088 exactly matching OHLC candles out of 6,150 common 2025 hours in
two third-party datasets labeled as different exchanges. The first trial of
FOMC features also had only 16 test events. Treat these runs as method
validation. They do not select a production threshold or a news feature.

## Outcome

Let someone with a Bybit spot account configure a budgeted buying rule, monitor
and pause it in Telegram, and inspect the same rule and history on the web.
The intended end state is real spot orders with explicit activation; current
capability and published messaging must remain truthful at every stage.

## Work sequence

1. **User and competitor evidence.** Compare one setup, pause, and decision
   explanation against Bybit AI, TradeGPT and an established bot. Interview
   people about recent buying experiences, current alternatives and actual
   spending. Treat the proposed audience and positioning as hypotheses.
2. **Market-data research.** Obtain verifiable Bybit spot data, document
   gaps and timestamps, and compare fixed-budget dip strategies with DCA and
   buy-and-hold including unused cash and realistic cost scenarios. Choose
   parameters using earlier periods; reserve truly unseen periods. Evaluate
   news incrementally against a price-only baseline, with point-in-time data.
   Research results do not authorize automated live trading.
3. **One account, two surfaces.** Preserve the existing Telegram identity,
   private `/start` binding and web BFF session. Review setup and pause end to
   end before expanding. Users must understand the threshold reference,
   budget, cooldown, current state, and reason for each action.
4. **One exchange connection.** Evaluate Bybit AI Subaccount OAuth, Broker
   OAuth eligibility and scoped keys. Design a browser-based authorization,
   tenant-separated encrypted credentials, revocation and least privilege.
   The viability of each OAuth path for this service is unconfirmed. Never
   ask users to send secrets in Telegram messages.
5. **Order reliability before real orders.** Implement and verify the required
   exchange adapter, risk checks, durable request identity, persisted state,
   unknown-result reconciliation, tenant isolation, recovery and audited
   pauses. Default remains `DRY_RUN`; no live switch is enabled by default.
6. **Release.** Validate real Telegram delivery, exchange permissions,
   operations and applicable rules for target markets. Launch scope and
   real-money activation require their existing explicit release decisions.

## Marketing: 90-day draft

| Window | Hypothesis and action | Evidence to collect |
| --- | --- | --- |
| Weeks 1–2 | Talk to 10–12 people already buying dips and run a side-by-side task with Bybit's current tools. | Actual recent behavior, friction, alternatives and willingness to trial. |
| Weeks 3–4 | Prototype one promise: "Set your rule, see the budget and understand each decision." | Can users set a rule and explain its consequences unaided? |
| Weeks 5–8 | If the flow is ready, invite a small cohort from relevant communities with permission. | Completed setup; return within a closed 14-day cohort; reasons for leaving. |
| Weeks 9–12 | Compare acquisition channels and price/packaging interviews. | Sign-ups, qualified activations and actual purchase intent or payments; no invented targets. |

Acquisition: relevant communities and useful comparison content. Activation:
first understood configuration. Retention: repeat use or management of a rule.
Referral: organic only after value is demonstrated. Revenue: test packaging
against evidence, not invented conversion forecasts.

Use one observable task for the comparison: configure a spot buying rule,
find its remaining budget, explain the last skipped action, then pause it.
Record completion without help, time per task, errors and the participant's
current workaround. Swap product order across sessions. Use the results
to pick one message for the landing page. Prioritize qualified participants
from communities and direct conversations before spending on ads.

## Conditional 12-month outlook

- Q1: understand a concrete customer problem and prove the setup flow.
- Q2: only if technical and applicable legal readiness permit, run a small
  pilot and measure retention and operational cost.
- Q3: if people return and show willingness to pay, test pricing and a second
  acquisition channel.
- Q4: scale only channels supported by real sales, cost and retention data.

## Open decisions

Target geography and language, first customer segment, marketing budget,
available team capacity, price, trusted Bybit historical data source, OAuth
eligibility and applicable legal requirements are unknown. Do not imply this
draft is a completed 13-section marketing-plan workflow or that any user has
approved a launch.
