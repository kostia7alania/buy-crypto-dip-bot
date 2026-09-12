# API vertical slices

Hono routes and local repositories live under `apps/api/src/modules`, grouped
by capability: auth, strategies, market data, runner, notifications, orders,
audit, risk and reporting. Shared domain behavior belongs in the existing
packages, not global controller/service/helper folders. Nuxt routes remain a
small BFF rather than a trading engine.

In the local recovery, service authentication identifies the caller and an
opaque user session identifies its owner. Private routes require the resolved
principal; owner predicates must be part of reads and writes. State changes
and audit evidence commit atomically. Public market routes use product policy
only and cannot consult another user's strategy existence.

Remote main uses personal tenant context and RLS. Integrate that model while
preserving local session/audit controls, as recorded in [current architecture](02_ARCHITECTURE.md).
