# Runbook

## Local setup

```bash
corepack enable
corepack prepare pnpm@latest-11 --activate
pnpm install
pnpm dev
```

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Environment

Use `.env.example` as template.

## Incident: live trading accidentally enabled

Expected in MVP: impossible.

If a future version enables live trading:

1. Disable `LIVE_TRADING_ENABLED`.
2. Revoke API key at exchange.
3. Check audit logs.
4. Check orders.
5. Add regression test.
