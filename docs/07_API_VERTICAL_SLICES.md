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

`GET /strategies/budget` uses the service key and user session under the
restricted tenant role. It returns the caller's strategy IDs, symbols,
remaining 24-hour and 7-day simulated allowances, active reservations and
one UTC timestamp from the read transaction. `/dashboard/snapshot` includes
the same report when available. If that read fails, the dashboard keeps its
other sections and omits the budget. Responses are private and non-cacheable.

`GET /audit/decisions/latest` returns the latest recorded versioned risk
approval or rejection for the caller. Telegram `/decision` uses the event type,
time, reason codes and symbol when the original record identifies it. An
unreadable latest record returns unavailable. An empty result means no
supported record was found.

The dashboard reports the count of unreadable owned V1 events in its recent
100-record audit window, without returning their raw payloads. Older schema
versions are outside this window. `GET /audit` retains its validated array.
