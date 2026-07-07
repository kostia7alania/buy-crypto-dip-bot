# Product Strategy & Competitive Landscape

_Written 2026-07-07 during infra hardening. A living document — revise as the
market and product move._

## One-line positioning

**The risk-first, dry-run-first, Telegram-native dip-buying bot for CEX spot
traders who are scared of trading bots.** We sell *trust and safety*, not
strategy count.

## The market has two camps (and a gap between them)

### Camp A — CEX automation platforms
3Commas, Pionex, Bitsgap, TradeSanta, Cryptohopper.

- Connect to exchange APIs (Bybit/Binance/…), run DCA / grid / DIP / QFL bots.
- Pricing: Pionex free (0.05% trade fee), others $15–$140/mo
  ([CoinGape](https://coingape.com/best-crypto-trading-bots/),
  [Bitsgap](https://bitsgap.com/)).
- Web-dashboard-first. Feature-maximalist: Bitsgap alone ships Grid, DCA,
  COMBO, BTD, LOOP, QFL. Steep learning curve; the UI assumes you already
  trade.
- **Weakness:** intimidating to beginners, web-centric, "wall of knobs",
  paper-trading is a buried afterthought.

### Camp B — Telegram-native on-chain bots
Maestro, Trojan, Banana Gun, BonkBot.

- Non-custodial DEX sniping of memecoins. 0.5–1% per-trade fees, no
  subscription for the base tier.
- Enormous traction: Trojan ~$25B lifetime volume / 2M users; Maestro
  573k users
  ([Breaking AC](https://breakingac.com/news/2026/apr/30/multi-chain-telegram-trading-bots-head-to-head-trojan-vs-banana-gun-vs-maestro/)).
- **Weakness:** degen risk profile, memecoin casino, self-custody key risk,
  zero "safety rails". The opposite of risk-first.

### The gap we sit in
Nobody serves **"I hold BTC/ETH on Bybit, I want to auto-buy dips, and I am
terrified of losing money to a bot I don't understand."** Camp A is too
complex and web-bound; Camp B is too degen and on-chain. We are:

- **Telegram-native like Camp B** (the UX people actually adopt) …
- **… but CEX-spot, DCA/dip, and risk-first like the safe end of Camp A.**

## Why "risk-first + dry-run-first" is the wedge, not a limitation

Every credible source says the same onboarding path: **paper-trade 2–4 weeks
→ live with 10–25% capital → scale**
([CoinCentral](https://coincentral.com/auto-trading-bot-guide-to-crypto-bots-strategies-and-risk-management-in-2026/),
[Bitsgap backtesting](https://bitsgap.com/blog/crypto-bot-backtesting-in-2026-what-it-shows-and-what-it-cannot-predict)).
Competitors treat dry-run as a checkbox. **We make it the front door.** The
product's entire first experience is a safe simulation with a visible PnL —
the user builds trust before a cent is at risk. That is a marketing story, a
retention mechanic, and a compliance posture in one.

## Who I think we become (3 horizons)

### Horizon 1 — "The safe dip bot" (now → 3 months)
A single-tenant, self-hostable, Telegram-first DCA/dip bot on Bybit spot,
dry-run by default, with an honest live dashboard. **Win = a user runs it for
a month, sees the simulated PnL, and trusts it.** Everything already built
serves this. Ship polish, not features.

### Horizon 2 — "Prove it, then trade it" (3–9 months)
- **Backtesting** on historical Bybit data (min 3 years, bull+bear+range) —
  the #1 credibility feature competitors gatekeep behind paid tiers. Turn
  our dry-run engine into a time-machine.
- **Guarded live trading**: spot-only, per-strategy caps, the existing
  RiskGuard as the gate, `/pause_all` kill switch. Live is opt-in, capped,
  and reversible.
- **Multi-user** via the Telegram identity already in the schema.

### Horizon 3 — "The trust layer for retail automation" (9+ months)
- Multiple safe strategies (QFL/base-drop, laddered DCA, rebalancing) — but
  each shipped only after it survives backtest + dry-run gates the user can
  see.
- Optional managed hosting (the SaaS the repo was scaffolded for) for people
  who won't self-host — priced against the $20–30 entry tier, undercutting on
  simplicity.
- Non-custodial ethos borrowed from Camp B: users hold their own Bybit API
  keys (spot-only, no-withdrawal), we never custody funds.

## What NOT to do (guardrails against scope creep)

- No futures, leverage, martingale, memecoins — it contradicts the wedge and
  the AGENTS.md rules.
- Don't out-feature Bitsgap. Our moat is *fewer knobs, more trust*.
- Don't chase Camp B volume/degen users — different product, different risk
  appetite, regulatory minefield.

## Near-term product backlog (ranked by trust-per-effort)

1. ~~**PnL vs benchmark**~~ — ✅ Shipped 2026-07-07. `/performance` API +
   dashboard PerformanceWidget + `/performance` bot command compare dip-DCA
   against calendar-DCA and buy-and-hold over the same capital and window,
   with a win/lag/mixed verdict.
2. **Backtesting MVP** — replay historical klines through the existing
   strategy+risk engines. Foundation now in place (`getKlines` on the Bybit
   adapter + pure `compareToBenchmarks`); next step is a replay harness that
   runs the strategy over a chosen historical window instead of live ticks.
3. **Onboarding wizard in Telegram** — `/start` → pick coin → threshold →
   amount → confirm; auto-store chat id. Lower the activation barrier to zero.
4. **Daily digest** — one Telegram message: dips caught, simulated PnL, vs
   benchmark. Retention loop. (`/performance` copy is reusable here.)
5. **Telegram Login on the dashboard** — unify bot + web identity (schema
   ready). Unlocks multi-user.

Also shipped 2026-07-07: rich SEO landing pages (reusable LandingPage widget,
8 unique keyword pages, JSON-LD FAQ + SoftwareApplication, OG/Twitter cards)
turning the thin placeholder pages into a real acquisition asset.

## Success metric to watch
Not MRR yet. **Weeks-a-user-keeps-the-bot-running in dry-run.** If people
leave it on and check the PnL, the trust thesis holds and everything else
(live trading, hosting revenue) follows.
