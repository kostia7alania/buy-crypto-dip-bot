# Architecture

```txt
apps/api  -> core Hono API
apps/web  -> Nuxt SEO + dashboard + small BFF
apps/bot  -> Telegram bot
packages/* -> shared engines and clients
```

Data flow:

```txt
market data -> strategy signal -> RiskGuard -> dry-run order -> audit -> alert -> dashboard
```
