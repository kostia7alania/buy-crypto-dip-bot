# Security

No secrets in source. No withdrawal permissions. Separate subaccount for future live trading. Spot-only keys. Audit all decisions.

## API access

The trading API is protected by a shared `API_KEY` (header `x-api-key`).
Enforcement activates when the variable is set; setting it is REQUIRED on any
non-local deployment. `/health` stays public for uptime probes. The web BFF
attaches the key server-side only — it must never reach the browser.

Destructive helper endpoints are forbidden: audit history is append-only and
must not be clearable over HTTP.
