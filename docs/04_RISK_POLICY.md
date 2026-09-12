# Risk policy

Reviewed: 2026-09-12. Scope: local recovery source.

`DRY_RUN` is the only executable mode. Futures, leverage, martingale,
withdrawals, transfers and meme-coin trading are prohibited. No private
exchange credential or order-submission path may start before its gate.

`packages/config` owns the reviewed BTCUSDT/ETHUSDT/SOLUSDT policy and strategy
defaults. `ALLOWLIST_SYMBOLS` can only narrow it; an explicit empty or
unknown-only value permits no symbols. API and bot receive the same production
setting. Active strategies and exchange listings never expand this policy.

The policy is checked at strategy creation/activation, market/backtest input,
Telegram onboarding/input, RiskGuard evaluation and pending-order completion.
Unsupported legacy pending orders remain cancellable. Historical audit and
orders are preserved, not deleted to make a policy change look clean.

Daily and weekly limits currently apply to a strategy's completed local
spend. One pending order per strategy and cooldown checks are separate
controls. A reservation lifecycle and immutable policy/snapshot revisions
remain backlog work; these controls are not a guarantee against defects or
loss. Simulation does not model real execution conditions.
