# Production VPS Deployment Runbook

How **DCA Guard** ships to the VPS. The server never builds anything — a 1GB
box cannot build Nuxt. GitHub Actions builds a single Docker image; the VPS
only pulls and restarts.

```
git push main ──▶ CI (typecheck+lint+test)
              └─▶ Deploy workflow:
                    build ──▶ ghcr.io/kostia7alania/buy-crypto-dip-bot:latest + :<sha>
                    deploy ─▶ ssh VPS: docker compose pull && up -d
```

- Workflow: `.github/workflows/deploy.yml`
- Image: single image, three services (api / bot / web) selected by `command:`
- Server stack: `/opt/dca-guard/docker-compose.yml` (from `docker-compose.prod.yml`)
- The GHCR package is public — the VPS pulls anonymously, no `docker login`.

## 1. GitHub configuration (Settings → Secrets and variables → Actions)

| Kind | Name | Value |
|---|---|---|
| Secret | `VPS_HOST` | server IP |
| Secret | `VPS_USER` | `root` (or a deploy user) |
| Secret | `VPS_PASSWORD` | SSH password for that user |
| Secret | `VPS_SSH_KEY` | optional; private key if/when password auth is disabled |
| Variable | `DEPLOY_ENABLED` | `true` — the safety switch; deploy job is skipped otherwise |

Keep `DEPLOY_ENABLED` unset until the server has been bootstrapped (step 2),
or the deploy job will fail on a missing `/opt/dca-guard`.

## 2. One-time server bootstrap

```bash
ssh root@<VPS_IP>
# docker, swap, ufw (22/80/443 only), nginx proxy 80→3000, /opt/dca-guard/.env
curl -fsSL https://raw.githubusercontent.com/kostia7alania/buy-crypto-dip-bot/main/scripts/vps-bootstrap.sh | bash

cd /opt/dca-guard
curl -fsSL https://raw.githubusercontent.com/kostia7alania/buy-crypto-dip-bot/main/docker-compose.prod.yml -o docker-compose.yml
nano .env    # fill TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
docker compose up -d
docker compose ps    # db healthy, api/bot/web running
curl -s localhost:8787/health
```

The bootstrap generates strong `POSTGRES_PASSWORD` and `API_KEY` in
`/opt/dca-guard/.env` automatically. Postgres and the API are reachable only
from the docker network / localhost — nginx exposes just the web app.

## 3. Every deploy after that

`git push` to `main`. That is the whole procedure. Watch it in the repo's
Actions tab.

Manual redeploy: Actions → Deploy → Run workflow, or on the server
`cd /opt/dca-guard && docker compose pull && docker compose up -d`.

## 4. Rollback

```bash
ssh root@<VPS_IP>
cd /opt/dca-guard
# pin the image to the previous commit sha shown in the Actions history
sed -i 's|buy-crypto-dip-bot:latest|buy-crypto-dip-bot:<previous_sha>|' docker-compose.yml
docker compose up -d
```

Revert the pin at the next normal deploy.

## 5. Migrating off the legacy PM2 deployment

The first deployments ran from `/var/www/buy-crypto-dip-bot` under PM2 with a
standalone `dca-guard-db` container. To switch a box that still runs it:

```bash
~/.local/share/fnm/node-versions/v26.4.0/installation/bin/pm2 delete all
docker stop dca-guard-db      # keep as backup; volume buy-crypto-dip-bot_pgdata stays
# then follow step 2
```

## 6. Domain & TLS (when a domain is pointed at the VPS)

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d <domain>
```

Then register the domain with @BotFather (`/setdomain`) to enable Telegram
Login on the dashboard. Prefer a non-.ru TLD; put DNS behind Cloudflare to
hide the origin IP.

## 7. Security checklist

- [ ] `API_KEY` set in `/opt/dca-guard/.env` (bootstrap does this)
- [ ] Rotate the VPS password after sharing it anywhere; update `VPS_PASSWORD` secret
- [ ] `ufw status` → only 22/80/443 (+ your own services) allowed
- [ ] Postgres is NOT published on a host port (`docker compose ps` shows no 5432 mapping)
- [ ] `.env` files are chmod 600 and never committed
- [ ] The repo is public: never put real tokens in code, compose files, or workflows — only in GH secrets and the server `.env`
