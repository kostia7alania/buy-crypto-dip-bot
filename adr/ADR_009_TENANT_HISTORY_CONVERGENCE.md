# ADR 009: Guarded history convergence and restricted tenant transactions

Status: accepted for local implementation, 2026-09-14. Gate 1 remains NO-GO.

Reconciles the two ADR 008 records for this integration. Preserve the original
recovery and cost-first migration histories and apply explicit, hash-checked
forward bridges inside one transaction and advisory lock. Refuse unknown
history and unresolved strategy/order ownership without writes. Subsequent
migrations have a separate common forward journal.

Keep opaque API sessions as the identity authority. Resolve personal tenant
membership from that user, then use SET LOCAL identity/tenant and SET LOCAL ROLE
dipbot_app on the same connection for designated owned operations. Preserve
owner constraints and immutable audit in addition to forced RLS.

This is defense in depth for restricted transactions. The trusted runtime pool
supports auth, discovery, delivery and some bot reads through explicit grants
and role-specific policies; it is not an object owner or RLS-bypass role.
The administrator credential is confined to the one-shot migration service.
Non-local API/bot startup verifies journals/catalog/credentials read-only.
Credential-boundary acceptance, complete A/B/restart proof and destination
restore rehearsal remain pre-GO work until verified. No claim of protection
from arbitrary SQL through that trusted cross-user pool is made.

Reuse main's dashboard snapshot and immutable release design while retaining
recovery's stronger session, symbol and notification controls. Freeze generic
ledger/outbox history without activating a second dispatch path. OIDC, edge
runtime and scheduler cutover are separate decisions.

Rationale, alternatives, sources and evidence limits:
[tenant integration research](../docs/24_TENANT_INTEGRATION_RESEARCH.md).
