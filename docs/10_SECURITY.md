# Security

Reviewed: 2026-09-12. Scope: the local recovery described in
[project status](23_PROJECT_STATUS.md). No secrets in source or browser
bundles. No private exchange credential or order path. Preserve audit evidence.

## API access

The trading API is protected by a shared `API_KEY` (header `x-api-key`). The
bot readiness write additionally requires `BOT_HEARTBEAT_SECRET` in
`x-bot-heartbeat-secret`. Production Compose exposes that bot-only secret to
the API and bot containers, never to the web BFF or browser.
Non-local startup refuses missing service authentication and required secrets.
The key identifies an internal caller; owned-data routes also require a live
opaque user session and owner-qualified queries. `/health` stays public for
uptime probes. The web BFF attaches the service key only on the server.

The browser clears private Nuxt cache entries and pending writes when identity
changes; account-owned dashboard panels remount. Logout revokes the server
session first and reports failure rather than pretending the user signed out.
The Telegram login widget is recreated for the new signed-out host.

Reviewed-symbol policy comes from `packages/config`. Deployment values can
only narrow it and must agree between API and bot. Strategy rows cannot grant
market access or expand the runner's policy. Unsupported pending records
cannot be forced or completed by the scheduler, but cancellation remains valid.

Destructive helper endpoints are forbidden: audit history is append-only and
must not be clearable over HTTP.

## Telegram notification privacy

The durable outbox stores a template key/version, a small validated JSON input,
the `TENANT_FINANCIAL` classification, and a correlation id that points back to
the originating audited or operational workflow. It does not store the fully
rendered Telegram message. Template v1 uses Telegram HTML and escapes every
untrusted text field before delivery.

If a stored template cannot be validated, delivery uses a detail-free fallback
containing only the correlation id. Transport failures retain a bounded error
code and retry state; operational logs use the same correlation id and never
the financial render inputs. Migration `0014_bouncy_zuras` irreversibly removes
the legacy plaintext column and marks any old undelivered plaintext record
`SKIPPED` rather than sending data that cannot be validated against a versioned
template.
