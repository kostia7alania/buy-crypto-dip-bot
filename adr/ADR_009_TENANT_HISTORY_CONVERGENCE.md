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

This is defense in depth for restricted transactions. The privileged pool
still supports trusted bootstrap, auth, discovery, delivery and some bot reads.
Separate migrator/runtime credentials, complete A/B/restart proof and restore
rehearsal remain pre-GO work. No claim of protection from arbitrary SQL through
that privileged pool is made.

Reuse main's dashboard snapshot and immutable release design while retaining
recovery's stronger session, symbol and notification controls. Freeze generic
ledger/outbox history without activating a second dispatch path. OIDC, edge
runtime and scheduler cutover are separate decisions.

Rationale, alternatives, sources and evidence limits:
[tenant integration research](../docs/24_TENANT_INTEGRATION_RESEARCH.md).
