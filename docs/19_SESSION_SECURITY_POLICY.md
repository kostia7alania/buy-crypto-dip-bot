# Session security policy

> Source scope reviewed 2026-09-12: this policy describes the local Gate 1 session implementation. It must be preserved and re-proved when integrating remote main or Supabase identity. [Project status](23_PROJECT_STATUS.md) distinguishes those baselines.

Date: 2026-08-02\
Applies to: Gate 1 `DRY_RUN` web and bot identity

## Web sessions

- A correctly signed Telegram Login presentation is accepted once and must be
  no more than five minutes old, with at most five minutes of future clock skew.
- The browser receives only an encrypted, HTTP-only session cookie. Non-local
  deployments use `__Host-dipbot_session`, `Secure`, `Path=/`, no `Domain`, and
  `SameSite=Lax`.
- The database stores only a SHA-256 token hash. Absolute lifetime is 30 days;
  inactivity lifetime is 7 days. There is no silent renewal: after either limit
  the user authenticates with Telegram again.
- `/auth/me` is server-authoritative. A stale sealed cookie does not count as
  an authenticated identity after its API session expires or is revoked.
- A user can list active sessions, revoke one owned session, or revoke all.
  Session IDs are not bearer credentials and another user's ID cannot be
  revoked through the tenant API.
- Expired session rows are retained for a seven-day investigation grace period
  before cleanup. Revocation is immediate and takes precedence over expiry.

## Bot command sessions

- A private-chat command can mint a five-minute `BOT_COMMAND` session for its
  resolved Telegram actor. The token is a one-request lease: after the scoped
  API call the bot invokes audited logout with the same command correlation.
  If that cleanup request fails, the absolute five-minute expiry remains the
  fail-safe. The session is distinguishable from `WEB` in inventory and is
  subject to the same revoke-one/revoke-all checks.
- Group/channel updates and actorless updates cannot mint a session.

## Telegram Login abuse limits

- The public BFF converts the request network source to a domain-separated
  HMAC before forwarding it. The API validates that pseudonym, HMACs it again
  with its Telegram secret, and persists only the final 64-character digest.
- The source limit is 10 attempts per fixed 60-second window. A verified
  Telegram identity has a separate 5-attempt window, consumed only after its
  signature passes so an attacker cannot lock out a claimed id with forgeries.
- The first excess attempt blocks that pseudonymous key for 300 seconds.
  Requests during a block do not extend it. HTTP `Retry-After` and the response
  body contain the ceiling of the exact remaining persisted duration.
- Every throttle rejection is an immutable V1 security event with limiter kind,
  retry seconds, and correlation id. It never contains IP, Telegram id, signed
  payload, signature, bot/service secret, replay fingerprint, or abuse key.
- Proxy trust is part of this boundary: an internet-facing proxy must remove
  caller-supplied forwarding headers and write the actual client chain before
  the BFF reads `X-Forwarded-For`. If that invariant cannot be guaranteed, the
  deployment must use the trusted socket/client address instead.

## Cross-site requests

Unsafe BFF methods require an `Origin` or `Referer` matching the configured site
origin. Non-local deployments do not derive the trusted origin from the request
Host header. Safe `GET`, `HEAD`, and `OPTIONS` requests do not require Origin.

## Cleanup and incidents

Cleanup runs once during runner startup and every six hours after that. The
public risk-status projection exposes only its last successful completion time
and cadence; cleanup logs never contain tokens or hashes. A suspected cookie,
service key, bot token, or database exposure requires revoke-all for affected
users, rotation of the exposed service secret, and preservation of audit
evidence.
