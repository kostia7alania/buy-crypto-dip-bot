# Web accessibility, performance, and third-party budgets

Historical measurement: this records the 2026-08-02 local source, not the
recovery or deployed build. Current readiness is in [project status](23_PROJECT_STATUS.md).

Version: 1\
Owner: product maintainer\
Measured: 2026-08-02\
Revision basis: dirty working tree based on `cedc6df`\
Next review: before release and monthly after public deployment

## Current evidence

The production Nuxt build passes on Node `v26.5.0` and Nuxt `4.4.8`.

Build-time compressed assets reported by Vite:

| Asset class | Current largest gzip result |
| --- | ---: |
| Shared client JavaScript | 68.77 kB |
| Secondary shared client JavaScript | 17.46 kB |
| Route JavaScript chunk | 3.07 kB |
| Dashboard CSS chunk | 4.34 kB |
| Landing CSS chunk | 2.23 kB |
| Entry CSS | 2.33 kB |
| Default-layout CSS | 1.14 kB |

These numbers are build artifacts, not Core Web Vitals. No LCP, INP, CLS,
FCP, TBT, or network-chain result is claimed: the required Chrome DevTools MCP
performance tools were unavailable in this execution environment. R122 remains
partial until a cold-load trace covers `/` and `/dashboard` on the exact
release artifact.

## Enforced budgets

| Surface | Budget | Failure action |
| --- | --- | --- |
| Public landing initial first-party JS | <= 100 kB gzip | block release or document an owned exception |
| Dashboard initial first-party JS | <= 130 kB gzip | split non-critical panels or block release |
| Public landing first-party CSS | <= 15 kB gzip | remove unused/repeated styles or block release |
| Any single lazy route chunk | <= 20 kB gzip | split the feature or record why atomicity is required |
| Above-fold raster media | <= 150 kB compressed each | resize/encode and provide dimensions before release |
| Third-party requests before consent | 0 | release blocker |
| Third-party origins after consent | Google Analytics only; Telegram widget only when explicitly configured on its sign-in surface | release blocker for any undeclared origin |
| External fonts | 0 | use the documented native stack |

Budgets are checked on compressed transfer size and route dependency closure,
not by summing unrelated lazy chunks. Hash changes alone are not regressions.

## Core Web Vitals targets

Measure mobile and desktop cold loads, record the trace/environment, and keep
the 75th-percentile field target at:

| Metric | Target |
| --- | ---: |
| LCP | <= 2.5 s |
| INP | <= 200 ms |
| CLS | <= 0.10 |

Local traces also record TTFB, FCP, TBT, Speed Index, render-blocking savings,
and the exact LCP/CLS element. A score without trace identity is not evidence.

## Third-party loading contract

- GA4 is absent from server-rendered head and stays default-off.
- It loads only in production when the measurement ID is non-placeholder and
  the user explicitly grants the documented page-traffic purpose.
- Withdrawal is available from the persistent analytics settings control and
  disables future collection.
- Analytics payloads must not contain Telegram identity, session values,
  strategy configuration, symbols, order/portfolio values, audit payloads,
  error strings, keys, signatures, or free-form user content.
- The Telegram Login script loads only on its explicit sign-in widget when a
  bot username is configured. It is not a site-wide analytics dependency.
- Adding an origin requires a claims/privacy update, captured network evidence,
  owner, retention/purpose statement, and a new budget row.

## No-JavaScript and resource policy

- Landing headline, evidence rail, glossary, steps, FAQ text, links and legal
  copy are server rendered and readable without client JavaScript.
- Navigation uses links; actions use native buttons. FAQ uses native
  `details`/`summary`.
- No external fonts or above-fold hero images are required for first content.
- Decorative images have empty alternative text and explicit dimensions.
- Non-essential third-party work never competes with the initial render.

## Accessibility audit record

Code inspection on 2026-08-02 confirms:

| Requirement | Current evidence | State |
| --- | --- | --- |
| Landmarks and heading hierarchy | header/nav/main/footer; one page `h1`; sequential landing headings | covered in code |
| Keyboard bypass | visible-on-focus skip link targets focusable `main` | covered in code |
| Focus visibility | global `:focus-visible`, forced-colors override, native controls | covered in code |
| Reduced motion | global zero-duration tokens and opt-in landing reveal | covered in code |
| Status not color-only | text value and explanatory note accompany system colors/dots | covered in code |
| Forms and controls | native elements; shared inputs/switches require explicit props/labels | code review required per new component |
| Tables | native table structure inside labeled horizontal scroll containers | covered in code |
| Async state announcements | no noisy global live region; critical user-triggered failures need per-flow review | partial |
| Screen reader and zoom behavior | not exercised in this environment | pending manual evidence |
| Contrast | semantic token intent exists; computed contrast not measured here | pending browser evidence |

R121 remains partial until keyboard-only, 200% zoom, forced-colors, reduced
motion, VoiceOver/Safari, and an accessibility-tree snapshot are captured for
landing, sign-in, strategy mutation, ledger and audit flows.

## Release measurement procedure

1. Build the exact release revision with `pnpm --filter
   @buy-crypto-dip-bot/web build`.
2. Serve that artifact locally or in the release candidate environment.
3. Capture cold-load Chrome DevTools traces for `/` and `/dashboard` at mobile
   and desktop profiles.
4. Record CWV/supplementary metrics, request list, transfer sizes, LCP element,
   CLS culprits and accessibility snapshot.
5. Verify zero third-party requests before consent; grant then withdraw
   analytics and confirm future collection stops.
6. Run keyboard, 200% zoom, forced-colors, reduced-motion and VoiceOver/Safari
   flows.
7. Attach trace IDs, artifact revision, environment and reviewer to the release
   evidence. Do not replace measurements with this budget document.
