# Master backlog

Reviewed: 2026-09-16. [Project status](../docs/23_PROJECT_STATUS.md) owns source
identity, verification and the Gate 1 NO-GO verdict. The September 14
integration and September 16 reservation extension are recorded in
[the research](../docs/24_TENANT_INTEGRATION_RESEARCH.md).

## Next delivery sequence

| ID | Priority / owner | State | Outcome and acceptance |
| --- | --- | --- | --- |
| N01 | P0, API/Risk/Bot | LOCAL_DONE | Close the allowlist bypass (R070 DRY_RUN portion): one reviewed config policy, narrower deployment subset, rejected unsupported creation/input/completion, cancellable legacy records. Regression cases pass. |
| N02 | P1, API/Tenancy | LOCAL_DONE | Remove public strategy-existence oracle. An unsupported symbol has the same response with and without another tenant's row; no exchange fetch. |
| N03 | P1, Web/Auth | LOCAL_DONE | Clear private Nuxt data and pending writes on identity change; remount account-owned panels. A delayed A response cannot show under B. Browser fixture flow passed. |
| N04 | P1, Web/Auth | LOCAL_DONE | Reinstall a single Telegram widget after logout; clean its callback; failed logout remains signed in with an actionable error. Browser fixture flow passed. |
| N05 | P0, Release/DB | LOCAL_DONE | Both original histories preserved; strict guarded forward convergence and common subsequent migration journal implemented. Real PG18 proves clean/recovery/main catalog equivalence, preservation, refusal and atomicity. Destination ownership decisions remain N08. |
| N06 | P0, API/DB/Web | LOCAL_DONE | Personal tenants/RLS integrated with opaque sessions, replay/CSRF, allowlist, immutable audit and typed outbox. Owned API and bot/runner mutations use restricted transactions; dashboard uses one private snapshot. Immutable release source integrated. Privileged service credentials and full proof remain N07/N08. |
| N07 | P0, Verification/Release | PRE_GO | Targeted PostgreSQL 18 reservation race/reopened-pool settlement passes in one process. Independent process-crash recovery/startup discovery remain unproved. Still run the complete clean/upgrade, A/B, failure/restart/concurrency and outbox matrix on the final integrated revision; record catalog, commands, reviewer and immutable artifact before GO. |
| N08 | P0, Operations | PRE_GO | Verify deployed revision/catalog, trusted forwarding headers, per-service secrets, migration/readiness ordering, backup/restore and rollback. Rehearsal preserves tenant and audit evidence. |
| N09 | P1, Web/UX | OPEN | Finish actual Telegram login/account-switch/private-start delivery and R121 keyboard, screen-reader, zoom, contrast and mobile checks. Signed-out backtest copy corrected; snapshot A/B/late-response, hidden visibility and 401 fixtures pass. Fixture tests are not provider proof. |
| N10 | P0, Product/Reporting | GATED | Local source now covers approved dry-run config/public-market/risk snapshots and atomic consume/release reservation semantics (R047-R051 slice). Finish rejected-decision provenance, shared snapshot semantics, R052-R058 and truthful missing-data/freshness/fees/slippage reporting. |
| N11 | P1, Platform/Auth | GATED | Implement cost-first Supabase identity/OIDC/JWT, edge-compatible Hono/BFF, verified Telegram webhook, bounded Cron/Queue and idempotency. Verify paid/free cost signals and exactly one scheduler/bot mode at cutover. No private exchange work. |
| N12 | P1, Product/Content | OPEN_EXTERNAL | Refresh claims on the actual published revision; complete keyword/content map, privacy QA, real interviews and pricing discovery. Leave tariffs, revenue, SLA and legal conclusions unannounced until supported. |

`LOCAL_DONE` closes a recovery finding. It does not mark the remote deployment
fixed. N05-N08 prevent losing either version's protections during integration.
No new schema or credential work is implied by closing a documentation item.

## Full historical ticket index

Acceptance details and original evidence are preserved in
[the 123-ticket research inventory](../plans/008-123-task-night-research-loop.md).
Its dates/line numbers describe that research snapshot. This index supersedes
old blanket DONE counts and the status list at the end of plan 009.

- `LOCAL_SOURCE`: implementation exists in local source and its prior record;
  it still needs preservation/review in the integrated result.
- `PARTIAL`: implementation or documentation exists but acceptance is incomplete.
- `PRE_GO`: required to establish Gate 1 GO. Corrects the old circular
  AFTER_GATE1 labels on R037-R041.
- `GATED`: blocked by an unproved foundation or its stated dependencies.
- `OPEN`: specified work not yet completed.
- `EXTERNAL`: needs actual user/market/qualified-review evidence.
- `LATER`: a separately approved future decision.

R070 is now partial: the current DRY_RUN policy bypass is fixed by N01, while
future instrument metadata and Demo eligibility remain gated. R093 still
needs pair discovery in the UI. R052 remains gated by truthful execution and
reporting semantics even though the local reservation state core exists and the
present ledger correctly labels completion as simulation.
R089/R090/R092 remain partial until source-specific claims and the complete
first-run journey agree, including authenticated backtests.

Index totals: EXTERNAL 4, GATED 41, LATER 1, LOCAL_SOURCE 53, OPEN 4, PARTIAL 15, PRE_GO 5. Total: 123. These are not release completion percentages.

| Ticket | Priority | Current state | Acceptance item |
| --- | --- | --- | --- |
| R001 | P0 | LOCAL_SOURCE | Establish one normative Gate 1 verdict |
| R002 | P0 | PARTIAL | Version Gate evidence identity |
| R003 | P0 | LOCAL_SOURCE | Enforce milestone dependency policy |
| R004 | P0 | LOCAL_SOURCE | Define the target tenant catalog |
| R005 | P0 | LOCAL_SOURCE | Complete legacy ownership preflight taxonomy |
| R006 | P0 | LOCAL_SOURCE | Enforce same-owner order/strategy integrity |
| R007 | P0 | LOCAL_SOURCE | Align declared schema with the final catalog |
| R008 | P0 | LOCAL_SOURCE | Create reproducible contract migration authority |
| R009 | P0 | LOCAL_SOURCE | Prove clean-install and upgrade catalog equivalence |
| R010 | P1 | PARTIAL | Record irreversible legacy-owner decisions |
| R011 | P0 | LOCAL_SOURCE | Formalize tenant versus system audit scope |
| R012 | P1 | PARTIAL | Preserve ambiguous audit history during remediation |
| R013 | P2 | LOCAL_SOURCE | Restricted tenant transactions and forced RLS integrated under ADR 009; privileged pool limits documented |
| R014 | P0 | LOCAL_SOURCE | Tenant-qualify order-to-strategy reads |
| R015 | P1 | LOCAL_SOURCE | Establish owner-required private-data boundaries |
| R016 | P2 | GATED | Separate operator inspection from tenant surfaces |
| R017 | P1 | LOCAL_SOURCE | Make DRY_RUN data fail closed |
| R018 | P0 | LOCAL_SOURCE | Define non-local deployment classification |
| R019 | P0 | LOCAL_SOURCE | Validate required configuration before service work |
| R020 | P0 | LOCAL_SOURCE | Gate traffic and runner on successful migration |
| R021 | P0 | LOCAL_SOURCE | Publish dependency-aware readiness |
| R022 | P0 | LOCAL_SOURCE | Fail closed for BFF and bot service authentication |
| R023 | P1 | LOCAL_SOURCE | Make `/api/auth/me` server-authoritative |
| R024 | P1 | LOCAL_SOURCE | Make logout revocation outcome truthful |
| R025 | P1 | LOCAL_SOURCE | Define the complete session lifecycle |
| R026 | P0 | LOCAL_SOURCE | Prevent Telegram Login replay and abuse |
| R027 | P1 | LOCAL_SOURCE | Define an explicit BFF CSRF boundary |
| R028 | P0 | LOCAL_SOURCE | Redact and correlate operational errors |
| R029 | P1 | LOCAL_SOURCE | Establish verified notification eligibility |
| R030 | P1 | LOCAL_SOURCE | Unify bot actor authorization contract |
| R031 | P2 | LOCAL_SOURCE | Account for bot-minted sessions |
| R032 | P0 | LOCAL_SOURCE | Make delivery evidence durable and truthful |
| R033 | P0 | LOCAL_SOURCE | Prevent overlapping strategy scheduling |
| R034 | P0 | LOCAL_SOURCE | Atomically preserve state-transition evidence |
| R035 | P1 | LOCAL_SOURCE | Version audit event semantics and payload policy |
| R036 | P0 | PARTIAL | Create a contracted PostgreSQL 18 proof lane |
| R037 | P0 | PRE_GO | Run the complete A/B isolation matrix |
| R038 | P0 | PRE_GO | Prove race, restart, and failure recovery |
| R039 | P0 | PRE_GO | Gate merge on immutable evidence |
| R040 | P1 | PRE_GO | Deploy immutable revision only after readiness |
| R041 | P1 | PRE_GO | Rehearse evidence-preserving operations response |
| R042 | P0 | LOCAL_SOURCE | Validate market-data response schemas |
| R043 | P0 | LOCAL_SOURCE | Define market-data freshness and timestamp semantics |
| R044 | P1 | GATED | Add an upstream market-data circuit-breaker policy |
| R045 | P1 | GATED | Share market-data budgets and snapshots |
| R046 | P1 | GATED | Define per-tenant scheduler fairness and backpressure |
| R047 | P0 | PARTIAL | Approved dry-run reservations persist an immutable public-market snapshot/key; rejected decisions and shared dashboard provenance remain |
| R048 | P0 | PARTIAL | Approved reservations persist risk-policy and effective-config revisions; rejected-decision references remain |
| R049 | P1 | PARTIAL | Exact strategy/config/market evaluations are duplicate-suppressed; broader observation identity and scheduler semantics remain |
| R050 | P0 | LOCAL_SOURCE | Separate durable hold lifecycle from order lifecycle; commit, consume and release invariants pass locally |
| R051 | P1 | LOCAL_SOURCE | Preserve the effective strategy snapshot for an active hold; later strategy edits do not rewrite evidence |
| R052 | P0 | GATED | Separate simulated completion from exchange execution semantics |
| R053 | P1 | GATED | Model countdown scalability independently of execution |
| R054 | P1 | GATED | Define countdown ownership and restart recovery |
| R055 | P1 | GATED | Define graceful runner drain |
| R056 | P1 | OPEN | Publish scheduler ownership map |
| R057 | P1 | GATED | Make PnL partial/stale valuation explicit |
| R058 | P1 | GATED | Record benchmark source/window evidence |
| R059 | P1 | GATED | Freeze digest financial cutoff semantics |
| R060 | P1 | LOCAL_SOURCE | Minimize durable outbox payload data |
| R061 | P1 | GATED | Dispatch outbox work fairly across tenants |
| R062 | P2 | LOCAL_SOURCE | Version notification templates and safe rendering fallback |
| R063 | P2 | GATED | Define per-user digest timezone behavior |
| R064 | P0 | GATED | Design Demo credential rotation/reverification states |
| R065 | P0 | GATED | Fix the Demo environment registry |
| R066 | P0 | GATED | Define canonical private-request signing boundary |
| R067 | P1 | GATED | Control clock skew and receive window |
| R068 | P0 | GATED | Verify Demo identity and permissions read-only |
| R069 | P0 | GATED | Maintain a dynamic spot-instrument catalog |
| R070 | P0 | PARTIAL | Make the product allowlist authoritative |
| R071 | P0 | GATED | Define a narrow Demo spot-buy request type |
| R072 | P0 | GATED | Persist durable external correlation identity |
| R073 | P0 | GATED | Keep REST acknowledgement distinct from fill |
| R074 | P0 | GATED | Design the private order-stream consumer |
| R075 | P0 | GATED | Normalize execution fills and fees |
| R076 | P0 | GATED | Define duplicate/out-of-order stream policy |
| R077 | P0 | GATED | Design REST reconciliation after gaps/restarts |
| R078 | P1 | GATED | Bound reconciliation cadence before Demo retention expires |
| R079 | P1 | GATED | Allocate Bybit rate budgets by criticality |
| R080 | P0 | GATED | Define typed external errors and `UNKNOWN` safety |
| R081 | P1 | GATED | Version a Demo capability-drift manifest |
| R082 | P2 | LATER | Keep Broker OAuth a separate later decision |
| R083 | P0 | LOCAL_SOURCE | Create a phase-aware claims matrix |
| R084 | P0 | LOCAL_SOURCE | Separate OSS self-hosting from future hosted SaaS |
| R085 | P0 | LOCAL_SOURCE | Remove simulation-equivalence claims |
| R086 | P0 | LOCAL_SOURCE | Remove absolute safety/performance guarantees |
| R087 | P0 | LOCAL_SOURCE | Make Telegram copy delivery-aware |
| R088 | P0 | LOCAL_SOURCE | Publish a user-facing Safety Ledger status glossary |
| R089 | P1 | PARTIAL | Maintain a versioned claims registry |
| R090 | P0 | PARTIAL | Publish “What works today” |
| R091 | P0 | LOCAL_SOURCE | Make CTA hierarchy delivery-model-aware |
| R092 | P0 | PARTIAL | Design the first-run proof journey |
| R093 | P0 | GATED | Replace arbitrary symbol entry with safe pair discovery |
| R094 | P0 | LOCAL_SOURCE | Preview caps before activation |
| R095 | P0 | GATED | Build a human-readable decision detail |
| R096 | P1 | GATED | Replace raw-JSON audit feed with progressive disclosure |
| R097 | P0 | LOCAL_SOURCE | Make the dry-run order ledger truthful |
| R098 | P0 | GATED | Define loading/empty/error/stale/unauthorized states |
| R099 | P0 | GATED | Separate identity from notification readiness |
| R100 | P0 | LOCAL_SOURCE | Make pause/activate semantics explicit |
| R101 | P0 | GATED | Publish benchmark methodology in the product |
| R102 | P1 | OPEN | Define a canonical keyword-to-page map |
| R103 | P1 | OPEN | Build a topic hub and contextual internal links |
| R104 | P0 | PARTIAL | Correct SoftwareApplication/Offer structured data |
| R105 | P0 | LOCAL_SOURCE | Publish “What DRY_RUN proves - and cannot prove” |
| R106 | P0 | LOCAL_SOURCE | Publish “Why withdrawal permission is never needed” |
| R107 | P1 | GATED | Publish “Why the bot did not buy” |
| R108 | P1 | PARTIAL | Make DCA/dip/grid comparison neutral and sourced |
| R109 | P0 | LOCAL_SOURCE | Make analytics consent-gated |
| R110 | P1 | GATED | Version a trust-funnel event contract |
| R111 | P1 | GATED | Build first-party north-star reporting |
| R112 | P0 | GATED | Establish analytics privacy QA |
| R113 | P1 | EXTERNAL | Conduct 12 problem interviews |
| R114 | P1 | EXTERNAL | Maintain a hypothesis scorecard and decision log |
| R115 | P1 | EXTERNAL | Run pricing discovery without announcing a tariff |
| R116 | P1 | GATED | Create a qualified hosted-beta/Demo-interest funnel |
| R117 | P1 | OPEN | Govern competitor comparisons |
| R118 | P1 | LOCAL_SOURCE | Define OSS support and hosted-status readiness |
| R119 | P0 | LOCAL_SOURCE | Publish phase-aware privacy and retention notice |
| R120 | P0 | EXTERNAL | Prepare a phase-gated legal-readiness pack |
| R121 | P0 | PARTIAL | Audit accessibility of stateful financial UI |
| R122 | P1 | PARTIAL | Set static-performance and third-party budgets |
| R123 | P1 | LOCAL_SOURCE | Govern design-system safety semantics |

## Cost-first plan mapping

The remote plan contains 22 numbered tasks. Its source labels are preserved
in [that plan](../plans/004-cost-first-multi-tenant-edge.md), not counted again
as new R-ticket delivery. Tasks 6, 10, 12, 17-20 and 22 still contain the
Supabase/Worker/webhook/Cron/Queue/cutover work. Tasks 7-9, 11 and 13-16 have
VPS source implementations that N05-N08 must reconcile and prove. Task 21's
hybrid rendering/snapshot needs to retain N03-N04 when ported.

## Definition of done

A runtime ticket needs source, relevant regression evidence, documented
behavior and the correct revision/catalog identity. Integration and deployment
are separate outcomes. An external ticket needs the actual external result;
research, a scaffold, a test run or a checkbox alone never closes it.
