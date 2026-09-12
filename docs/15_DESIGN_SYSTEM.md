# Safety Ledger Design System

> Source scope, 2026-09-12: this design system describes the local Safety Ledger line. Remote main has a different snapshot/rendering implementation. Preserve these safety and accessibility semantics during integration; see [current status](23_PROJECT_STATUS.md). R121 still needs complete real-browser/accessibility evidence.

Version: 1.1\
Owner: product maintainer\
Reviewed: 2026-08-02\
Next review: 2026-09-02 or before a new execution/delivery state ships

Exceptions require a dated record in the final section of this document. An
exception must name the component, reason, owner, expiry, accessible fallback,
and the evidence that permits it. Silence is not an exception.

## Positioning

Buy Crypto Dip Bot is the risk-first alternative to broad crypto automation
platforms. Competitors compete on the number of bots, exchanges, indicators,
and controls. This product competes on the quality of its evidence:

- simulation status is persistent and explicit;
- operating mode, live-trading state, approval state, and connectivity are
  separate facts;
- implemented signal, risk, strategy, and simulated-order paths write
  tenant-scoped audit evidence;
- performance appears beside honest benchmarks rather than as a promise;
- advanced detail is progressively disclosed without hiding evidence.

The visual direction is **Safety Ledger**: a calm editorial operations console
that combines a financial ledger with a flight checklist. It is dark, precise,
and tactile, without the neon-casino language of a trading terminal.

## Market and competitor synthesis

Research was reviewed on 2026-07-27.

| Product | Product emphasis | Common interface pattern | Opportunity for us |
| --- | --- | --- | --- |
| 3Commas | DCA, grid, signals, SmartTrade, many exchanges and subscription tiers | Dense navigation, market tape, balances, bot counts, charts | Keep creation secondary to the current safety posture |
| Coinrule | No-code rules, templates, paper trading, exchange connections | Simpler rule builder with strategy breadth and security copy | Make decision evidence more prominent than rule count |
| Cryptohopper | Paper trading, signals, backtesting, strategy designer | Capability-dense plans and performance tooling | Explain risk gates before performance |
| Bitsgap | Multiple bot families, terminal, portfolio, AI assistant | Exchange breadth, dashboards, configuration depth | Use fewer controls and clearer operating state |
| Pionex | Exchange with built-in grid, DCA, and futures bots | Live quotes, bot catalogue, profit and range controls | Avoid venue-like urgency and futures framing |

Repeated industry patterns include near-black canvases, neon blue/green
accents, dense cards, live prices, pill statuses, and profit-led hierarchy.
Security is often supporting copy while operating mode and risk gates are
secondary. Safety Ledger reverses that hierarchy.

Official references:

- [3Commas pricing](https://3commas.io/pricing)
- [3Commas security](https://help.3commas.io/en/articles/4456595-3commas-security)
- [Coinrule pricing](https://coinrule.com/pricing.html)
- [Coinrule product](https://cloud.coinrule.com/)
- [Cryptohopper pricing](https://www.cryptohopper.com/pricing)
- [Bitsgap](https://bitsgap.com/)
- [Pionex bots](https://www.pionex.com/en/bot)
- [Coinbase design system](https://cds.coinbase.com/)
- [Coinbase accessibility and design-system approach](https://www.coinbase.com/blog/coinbase-for-everyone-making-economic-freedom-accessible)

## Design principles

1. **Evidence before execution.** Show what the system knows, which gate was
   checked, and what happened next.
2. **Safety is a persistent state.** `DRY_RUN` is not a temporary notification
   or marketing badge. It stays visible in the global shell and safety console.
3. **Separate related facts.** API connectivity does not imply live trading.
   Approval state does not imply exchange connectivity.
4. **Calm over urgency.** No profit glow, ticker tape, pulsing CTAs, or
   casino-like gradients.
5. **Honest comparison.** Positive and negative outcomes have equal visual
   weight. Benchmarks carry the same time and budget context.
6. **Progressive disclosure without missing evidence.** Configuration can
   collapse or reflow; audit data must remain available on mobile.
7. **Native semantics first.** Keep real headings, forms, labels, tables,
   details, inputs, selects, and buttons.

## Token architecture

Tokens live in `apps/web/app/assets/css/main.css`.

### Tier 1: primitives

Primitive tokens are literal palette values and are only defined centrally:

- `--primitive-ink-*`: mineral canvas and surface steps;
- `--primitive-stone-*`: text and separator values;
- `--primitive-periwinkle-*`: brand and action values;
- `--primitive-mint-*`: successful safety state;
- `--primitive-amber-*`: attention and degraded state;
- `--primitive-coral-*`: danger and offline state;
- `--primitive-blue-*`: simulation and information.

Components must not use primitive tokens or raw hex/RGB values.

### Tier 2: semantic roles

Components consume semantic roles:

- canvas and surfaces: `--color-canvas`, `--color-canvas-deep`,
  `--color-surface`, `--color-surface-raised`, `--color-surface-strong`;
- borders: `--color-border-subtle`, `--color-border`,
  `--color-border-strong`;
- text: `--color-text-primary`, `--color-text-secondary`,
  `--color-text-muted`, `--color-text-subtle`;
- action: `--color-action`, `--color-action-strong`,
  `--color-action-soft`, `--color-action-border`;
- state: the `--color-simulation-*`, `--color-success-*`,
  `--color-warning-*`, and `--color-danger-*` families.

Transitional aliases such as `--surface-1` remain temporarily for consumers
that have not yet migrated. New code uses the semantic names.

## Color usage

Color never communicates state alone. Pair it with a label and, when useful, a
dot, border, or icon.

| State | Tokens | Use |
| --- | --- | --- |
| Simulation / information | `--color-simulation*` | `DRY_RUN`, simulated order, explanatory system information |
| Success / safe posture | `--color-success*` | live trading disabled, approval required, check passed, healthy connection |
| Warning / attention | `--color-warning*` | live trading enabled, approval bypassed, stale runner, mixed result |
| Danger / unavailable | `--color-danger*` | API offline, rejected signal, destructive or failed action |
| Brand / action | `--color-action*` | primary action, navigation state, selected non-semantic control |

Do not use success green to imply investment return quality without a signed
number and comparison context.

## Typography

- Interface copy uses the native `--font-sans` stack. There are no external
  font requests.
- Money, percentages, timestamps, modes, symbols, connection states, and audit
  metadata use `--font-mono` and tabular numbers.
- Display and page titles use `clamp()` through `--text-display` and
  `--text-page-title`.
- Titles are compact and editorial. Do not apply gradient text.
- Body copy uses `--line-body`; data labels use the caption or small scale.
- Use `text-wrap: balance` for short headings and natural wrapping for data.

## Spacing, shape, and elevation

The spacing scale is based on four pixels: `--space-1` through `--space-20`.
Use the smallest token that gives the content enough separation.

- compact controls: `--control-height-compact`;
- default controls: `--control-height`;
- compact UI radius: `--radius-sm`;
- panels and cards: `--radius-md` or `--radius-lg`;
- pills: `--radius-pill`, reserved for short statuses only;
- use `--shadow-1` for a slight boundary and `--shadow-2` only for an important
  raised focal element such as the landing evidence rail.

Panels rely on keylines and surface hierarchy, not blur or glow.

## Motion

- Motion is optional enhancement and must respect `prefers-reduced-motion`.
- Use `--duration-fast` for hover/focus feedback and `--duration-medium` for
  state changes.
- Use `--ease-standard`.
- Animate opacity and transform/translate. Avoid layout-heavy continuous
  animation.
- The landing evidence rail may reveal its three steps once. Dashboard status
  must not pulse indefinitely.

## Component and state patterns

### Governed component inventory

| Component/surface | Owns | Must not imply |
| --- | --- | --- |
| `UiButton` | action hierarchy, focus, pending and disabled presentation | that a request succeeded before confirmation |
| `UiInput` | label, hint, validation and units | suitability of a financial value |
| `UiSwitch` | explicit boolean intent and accessible name | that an async mutation is already committed |
| `UiIcon` | decorative or named symbolic support | state through shape or color alone |
| `LandingPage` | claims-safe evidence rail, glossary, CTA and FAQ semantics | live execution, hosted availability or guaranteed delivery |
| `StrategyCard` | configured limits and confirmed strategy state | exchange connectivity or future performance |
| `OrderLedgerWidget` | local `DRY_RUN` order evidence | exchange acceptance, fill or fee |
| `AuditFeedWidget` | tenant-scoped implemented audit events | universal capture of every failure |
| dashboard operating posture | mode, live state, approval and connection as separate facts | that one healthy fact makes the whole system ready |

### Global shell

The product bar carries a persistent `Dry-run first` cue. Active routes use a
keyline, action color, and background rather than color alone. Footer content
keeps the existing SEO link architecture.

### Buttons

`UiButton` owns primary and secondary actions:

- primary is a filled periwinkle action;
- secondary is a bordered surface action;
- all variants include hover, active, keyboard focus, and disabled states;
- use the compact size inside dense strategy cards;
- avoid emoji in operational action labels.

### Inputs and switches

`UiInput` and `UiSwitch` use semantic tokens, visible `:focus-visible` rings,
disabled styling, and coarse-pointer-aware minimum sizes. Inputs containing
money or thresholds use the monospaced stack. Every icon-only or switch control
needs an accessible label.

### Status

A status contains:

1. a plain-language label;
2. a short monospaced value;
3. an explanatory note when the consequence is not obvious;
4. an optional dot, keyline, or icon.

Do not combine operating mode, live trading, approval, and connection into one
badge.

The canonical public vocabulary is shared with `docs/21_CLAIMS_REGISTRY.md`:

| Label | Required meaning | Required non-color cue |
| --- | --- | --- |
| Detected | configured condition matched; no approval/order implied | text label plus timestamp/reference |
| Approved | recorded checks passed for one decision; not exchange evidence | text label plus check summary |
| Rejected | policy blocked the action | text label plus reason |
| Simulated | local `DRY_RUN` outcome; no external order/fill/fee | `DRY_RUN` or `SIMULATED` text |
| Accepted / Filled | future external evidence only; unavailable today | explicit source/reference when ever introduced |
| Unknown / Stale | evidence cannot support a current conclusion | text warning plus recovery action |

### Panels and empty states

Top-level dashboard panels use the main surface and subtle border. Nested cards
use the raised surface. Empty states use a dashed keyline and explain what must
happen before data appears. Loading and error states keep the panel size stable
where possible.

### Tables and audit data

Tables remain native tables. On narrow screens, place them in an obvious
bordered horizontal scroll container with stable gutters. Never hide audit
columns to make a table fit. Audit payloads use the monospaced stack and a
bounded vertical scroll area.

## Accessibility

- All text and keylines must remain legible against the mineral canvas.
- Interactive elements are at least `2.5rem` high and grow to larger targets
  for coarse pointers.
- Use `:focus-visible`; never remove focus without an equivalent outline.
- Forced-colors mode receives system-color borders, separators, and focus.
- Do not rely on box shadows, gradients, or color alone for important state.
- Respect `prefers-reduced-motion`.
- Keep native form, details, and table semantics.
- Decorative icons use `aria-hidden="true"`. Meaningful controls receive an
  accessible name.

## Responsive behavior

- Page gutters stay stable through `--content-max` and spacing tokens.
- The landing hero changes from two columns to one before the evidence rail
  becomes cramped.
- The dashboard system summary changes from four columns to two, then one.
- Operational tables scroll horizontally instead of dropping information.
- Forms stack on small screens, and data values can wrap without overflowing.
- Prefer media queries for page composition. Use container queries only when a
  component must adapt to its actual parent width.

## Review checklist

- Is `DRY_RUN` or an equivalent simulation cue visible before an action?
- Are operating mode, live trading, approval, and connection separate?
- Can the user identify why a decision happened or was blocked?
- Are positive outcomes shown beside honest benchmarks?
- Are raw colors absent from component styles?
- Are focus, disabled, empty, loading, error, and populated states represented?
- Does the mobile layout retain all audit information?
- Does forced-colors mode retain focus and separators?

## Exception register

No active design-system exceptions as of 2026-08-02.

Closed exceptions and temporary migrations remain visible here rather than
being deleted:

| Component | Exception | Owner | Opened | Closed/expiry | Resolution |
| --- | --- | --- | --- | --- | --- |
| Legacy component aliases | `--surface-*`, `--text-*` aliases temporarily remain while existing consumers migrate | product maintainer | 2026-07-27 | 2026-09-02 | New code must use semantic tokens; remove aliases only after a repository search shows no consumers. |
