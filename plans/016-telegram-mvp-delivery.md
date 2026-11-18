# Telegram-first spot MVP delivery

Updated: 2026-11-18. This is the execution backlog for
[plan 015](015-telegram-mvp-product-research.md). Existing operational gates
remain in the [master backlog](../tasks/00_MASTER_PLAN.md) and
[project status](../docs/23_PROJECT_STATUS.md).

## Outcome and scope

A spot buyer can set a rule, see the last recorded approval or rejection,
understand the per-strategy budget and pause from Telegram or the dashboard.
Ship and verify the current DRY_RUN experience first. Collect evidence from
prospective users and the prospective payer before choosing a commercial offer.
The later spot pilot depends on separate provider, risk and release decisions.

## People, models and handoffs

| Role | Accountable executor | Model / effort | Handoff |
| --- | --- | --- | --- |
| Product owner, delivery and integration | Root agent | GPT-6.2 Sol / session setting | Scope, dependency order, code integration and acceptance evidence |
| Customer discovery, UX research and GTM | `product_discovery` | GPT-6.2 Sol / high | Screener, comparison tasks, interview recording sheet, payer and retention hypotheses |
| Quantitative research and data engineering | `verified_data` | GPT-6.2 Astra / high | Source lineage, coverage and reproducible out-of-sample comparison |
| Frontend and interaction design | `web_evidence` | GPT-6.2 Sol / high | Plain-language record and accessible technical disclosure |
| API and database / risk controls | `budget_api` | GPT-6.2 Astra / high | Authenticated reads, budget accounting semantics and contracts |
| Telegram engineering | `telegram_status` | GPT-6.2 Sol / high | Bot status wording and command checks |
| Independent QA, SRE and release | `release_readiness` | GPT-6.1 Terra / high | Local verification, provider/destination gaps, release verdict inputs |
| Independent security review | `mvp_review`, after implementation | GPT-6.2 Astra / high | Tenant data, authentication, budget semantics, stale state and release risks |
| Commercial and privacy review | Product owner, with qualified human reviewers once market is selected | GPT-6.2 Sol / high for preparation | Owner for offer, data handling and country-specific obligations |
| Support and incident owner | QA/SRE and project owner, with a named human operator for the pilot | GPT-6.1 Terra / high for rehearsal | Support queue, escalation owner, incident evidence and stop conditions |
| Activation and retention analysis | Discovery/GTM and product owner | GPT-6.2 Sol / high | Closed cohort measurement, user feedback and next-cycle prioritization |
| Pilot decision | Project owner | Human | Approve release scope after evidence from independent QA and security |

Model assignments describe intended responsibility. An agent counts as executed
only after its work and verification are recorded in the log below.

## Backlog

| ID | Priority | Owner | Depends on | Accept when | State |
| --- | --- | --- | --- | --- | --- |
| MVP-01 | P0 | Root | — | One indexed backlog with scope, roles, dependencies and evidence | Done |
| MVP-02 | P0 | Discovery | — | Founder can recruit and run the same four tasks across products, collect unbiased usage and payer evidence | Protocol ready. [Session guide](../docs/research/2026-11-18-product-discovery.md) |
| MVP-03 | P0 | Quant/data | — | First-party Bybit BTCUSDT spot inputs with coverage, checksums and a reproducible comparison; provenance concerns remain visible | Importer verified locally. [Exchange data unavailable](../docs/research/2026-11-18-mvp-evidence.md) |
| MVP-04 | P0 | Frontend | — | Signed-in user sees clear labels for recorded approvals/rejections/completions and can inspect the underlying record separately | Local fixture and tests pass |
| MVP-05 | P0 | Telegram | — | `/status` distinguishes simulated activity, private-chat scope and unavailable state. Tests cover counts and labels | Local checks pass |
| MVP-06 | P0 | API/risk, web and bot | MVP-04, MVP-05 | A per-strategy balance view accounts for completed simulated spend and active holds on the same rolling 24h/7d windows as the runner, with an as-of and stale/unavailable state | Local API, bot and web checks pass |
| MVP-07 | P0 | QA/SRE and security | MVP-04, MVP-05, MVP-06, MVP-15 | Gate boundary and applicable source/test checks pass; independent review covers the changed slices; release gaps remain explicit | Local checks and independent source review pass |
| MVP-08 | P0 | QA/SRE, project owner | MVP-06, MVP-07 plus N07–N09 | A real test bot and trusted pilot destination prove private start, login, delivery, backup restore and isolation | Requires external access |
| MVP-09 | P1 | Discovery/GTM | MVP-02 | Real recruits complete matched tasks; record completion, errors, time, continued use and actual payer evidence | Requires participants |
| MVP-10 | P1 | Product/GTM | MVP-09 | Pick one customer problem and channel; test one truthful offer and track completed setup and repeat use | Open |
| MVP-11 | P1 | Product, QA/security, market reviewer | MVP-08, MVP-09 | Project owner makes a written go/no-go for a bounded DRY_RUN pilot with owner, monitoring and rollback | Gated |
| MVP-12 | P2 | API/risk, security, project owner | MVP-03, MVP-11 and separately approved scope | Bybit account eligibility, credential handling, order reconciliation and risk acceptance demonstrated before a separate spot pilot decision | Gated |
| MVP-13 | P1 | Support/SRE and project owner | MVP-08, before MVP-11 | Name a human support owner, rehearse first response and incident stop, document how a pilot user reports a disputed decision | Procedure drafted. Rehearsal pending |
| MVP-14 | P1 | Product analytics/GTM | MVP-11 | Review completed setup, observed repeat use in closed 14-day cohorts, support load and reasons to continue or cut scope | Gated |
| MVP-15 | P0 | API, Telegram | MVP-04 | `/decision` shows the most recently recorded owned risk decision, reason and time. Empty and unavailable states are distinct | Local API and bot checks pass |
| MVP-16 | P0 | QA/SRE, integration | MVP-07 | Draft release PR passes source and native PostgreSQL 18 contracts on the exact candidate | In progress |
| MVP-17 | P0 | QA/SRE, security | MVP-07 | Rehearsal restores the supported destination lineages in isolation, including the runtime role and its restricted access | In progress |

MVP-04 and MVP-05 can ship as local, reversible improvements while source
validation and customer discovery proceed. MVP-06 must use the runner's
commitment semantics and expose a timestamped snapshot before it is wired in
both clients. Budget figures in past decisions are historical evidence.
Telegram reads recorded approvals and rejections. A missing record does not
establish whether the runner skipped an evaluation.

## Verification and boundaries

- Existing session, tenant ownership, service API key and audit rules govern
  all reads and writes. Do not expose private records in a group or publicly.
- Keep UI evidence separate from execution, open-order state and strategy
  mutation. A missing check or event must not be rendered as approval.
- Use local tests and scoped integration before a separate provider/destination
  rehearsal. Record the commands and scope; fixture results are not provider
  confirmation. Publication and contacting participants are separate actions.

## Pilot operation and learning

- Use the [deployment runbook](../docs/13_VPS_DEPLOYMENT_RUNBOOK.md) for
  incident response. Record the on-call human and private support path before
  accepting participants.
- For a disputed decision collect the symbol, UTC time and opaque event or
  correlation ID. Compare the event with its budget and reservation history.
  Do not request access tokens, account access or screenshots of secret fields.
- For incorrect owner, budget or execution state, stop admitting participants,
  preserve the relevant audit records and notify the on-call operator. Rehearse
  this flow in the pilot environment before launch.
- After a closed 14-day cohort, report completed setup, repeat use, assisted
  and unassisted task outcomes, support time and paid conversion if an approved
  offer existed. Keep qualitative findings separate from revenue evidence.

## Execution log

- 2026-11-18: opened research, customer discovery and local release verification
  in parallel. Prior evidence and working-tree changes retained.
- 2026-11-18: wrote the recruiting, task scoring and payment-evidence protocol.
  Archived strategy research still needs first-party Bybit rows. Added an
  importer for the official spot trade archive and verified four offline cases.
- 2026-11-18: verified dashboard audit and budget states with Vue fixtures,
  focused web tests and web typechecking. Chromium headless could not start on
  the local host. Keyboard use and 320px layout are pending browser verification.
- 2026-11-18: isolated PostgreSQL 18 verification needs a test server.
  Standard native binaries were not present and the Docker daemon socket was
  inaccessible. Real Telegram provider and destination rehearsal need a test
  identity, bot, trusted destination and fresh backup.
- 2026-11-18: `pnpm check` passed on Node 26.7.0 and pnpm 11.0.0. Vitest
  reported 445 passes and 21 opt-in PostgreSQL 18 skips. All five release
  control tests and the DRY_RUN boundary check passed. Lint reported warnings.
  `pnpm build` completed 12 tasks. Production Compose configuration validated
  with fixture variables.
- 2026-11-18: independent review verified session and tenant scope, simulated
  budget arithmetic, unsupported records, time handling and Telegram private
  command behavior. Fixed negative legacy commitments, future-dated status
  counts and omitted audit disclosure before the final check.
- 2026-11-18: release work started from main at `5316cea`. A pinned SSH probe
  was blocked before reaching the VPS. Review identified a restore gap for
  dumps that already reference the restricted runtime role. Native contracts
  and the synthetic restore are candidates for private-data-free PR checks.
