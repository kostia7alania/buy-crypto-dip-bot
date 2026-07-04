# Security

## Secrets

Never commit:

- `.env`
- Bybit API key
- Bybit API secret
- Telegram bot token
- seed phrases
- private keys

## API permissions

Task 0 uses no private API keys.

Later live trading keys must be:

- separate subaccount
- spot-only
- no withdrawal permission
- tiny balance
- IP restricted if possible

## Logs

Never log secrets.

Log:

- signal input
- risk decision
- order intent
- dry-run order
- reason codes

## Authentication

Dashboard auth is later. Until then, run locally or protect behind private network.
