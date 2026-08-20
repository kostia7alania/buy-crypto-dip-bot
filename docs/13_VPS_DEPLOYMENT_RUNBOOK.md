# Production VPS Deployment Runbook

How **Buy Crypto Dip Bot** ships to the VPS. The server never builds anything — a 1GB
box cannot build Nuxt. GitHub Actions builds a single Docker image; the VPS
only pulls and restarts.

```
git push main ──▶ verify (typecheck + lint + build)
              └─▶ image :<commit-sha> ──▶ immutable GHCR digest
                                      └─▶ backup DB ──▶ migrate ──▶ health/wait
```

- Workflow: `.github/workflows/deploy.yml`
- Image: one commit-SHA tag, deployed by immutable `@sha256:<digest>`
- Startup: `db healthy` → one-shot `migrate` succeeds → `api healthy` → bot/web
- Server stack: `/opt/buy-crypto-dip-bot/docker-compose.yml` (from `docker-compose.prod.yml`)
- The GHCR package is public — the VPS pulls anonymously, no `docker login`.

## 1. SSH deploy key (never deploy as root, never use passwords in CI)

Generate a dedicated keypair on your machine (NOT the server, and never
commit it):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/dipbot_deploy -N "" -C "gh-actions-deploy"
```

- **Public** key (`~/.ssh/dipbot_deploy.pub`) → append to
  `/home/deploy/.ssh/authorized_keys` on the VPS (the bootstrap script
  creates the `deploy` user with docker access).
- **Private** key (`~/.ssh/dipbot_deploy`) → paste into the `VPS_SSH_KEY`
  GitHub secret (`pbcopy < ~/.ssh/dipbot_deploy` on macOS).

## 2. GitHub configuration (Settings → Secrets and variables → Actions)

| Kind | Name | Value |
|---|---|---|
| Secret | `VPS_HOST` | server IP |
| Secret | `VPS_USER` | `deploy` |
| Secret | `VPS_SSH_KEY` | private key from step 1 |
| Variable | `DEPLOY_ENABLED` | `true` — the safety switch; deploy job is skipped otherwise |

No `VPS_PASSWORD`: CI authenticates only with the key. After confirming key
login works, disable SSH password auth entirely:

```bash
# /etc/ssh/sshd_config.d/hardening.conf
PasswordAuthentication no
PermitRootLogin prohibit-password
# then: systemctl reload ssh
```

Keep `DEPLOY_ENABLED` unset until the server has been bootstrapped (step 3),
or the deploy job will fail on a missing `/opt/buy-crypto-dip-bot`.

## 3. One-time server bootstrap

The shared `/opt/traefik` configuration is host-specific because it also
routes the existing VPN. The bootstrap refuses to overwrite it. Verify that
`docker-compose.yml`, `dynamic.yml`, and the external `proxy` network already
exist before running the app bootstrap.

```bash
ssh root@<VPS_IP>
REPO_REF=<40-character-main-commit-sha>
curl -fsSL "https://raw.githubusercontent.com/kostia7alania/buy-crypto-dip-bot/$REPO_REF/scripts/vps-bootstrap.sh" \
  | REPO_REF="$REPO_REF" bash

cd /opt/buy-crypto-dip-bot
nano .env  # fill TELEGRAM_BOT_TOKEN and the public bot username
chmod 600 .env
```

The bootstrap generates strong `POSTGRES_PASSWORD` and `API_KEY` in
`/opt/buy-crypto-dip-bot/.env` automatically. Postgres and the API are
reachable only from the docker network / localhost.

### Edge proxy: Traefik (all projects on this VPS)

Traefik (`/opt/traefik`, from `infra/traefik/docker-compose.yml`) owns ports
80, 443 and 2053 (fallback) and terminates TLS with automatic Let's Encrypt
certificates. Host nginx is retired. Keep Cloudflare SSL mode **Full**.

Port 443 is shared with the host's x-ui VPN (xray, VLESS+Reality): xray
listens on 8443 (firewalled to docker subnets only), and `dynamic.yml`
routes the Reality SNI plus any unknown SNI to it via L4 TLS passthrough.
VPN clients keep connecting to :443 — their configs never changed. If you
edit the x-ui inbound, keep its port at 8443.

Adding the next subdomain/SaaS project needs zero central config — in that
project's compose:

```yaml
services:
  myapp:
    networks: [default, proxy]
    labels:
      - traefik.enable=true
      - traefik.docker.network=proxy
      - traefik.http.routers.myapp.rule=Host(`dev.buy-crypto-dip-bot.com`)
      - traefik.http.routers.myapp.entrypoints=websecure
      - traefik.http.routers.myapp.tls.certresolver=le
      - traefik.http.services.myapp.loadbalancer.server.port=3000
networks:
  proxy:
    external: true
```

…plus a proxied A/CNAME record for the subdomain in Cloudflare.

## 4. Every deploy after that

Set repository variable `DEPLOY_ENABLED=true`, then push to `main` or run the
Deploy workflow on `main`. The deploy job:

1. refuses unverified builds and non-main refs;
2. downloads Compose from the exact commit and pulls the image by digest;
3. validates Compose and creates a verified custom-format PostgreSQL backup;
4. runs the one-shot migration before API startup;
5. waits for API/web health and verifies the HTTP-to-HTTPS redirect;
6. restores the previous Compose/image automatically if startup or health fails.

Backups live in `/opt/buy-crypto-dip-bot/backups`; release metadata lives in
`/opt/buy-crypto-dip-bot/.deploy`. The workflow never prints `.env` values.

Before enabling deploy, confirm every entry in
`packages/db/migrations/meta/_journal.json` has a matching `.sql` file. A
missing migration file is a hard release blocker: `migrate` will fail and API
will not start.

`RUNNER_ENABLED=false` prevents the background scheduler from starting and
sets its dashboard heartbeat interval to zero. The API, dashboard, and bot
remain available for inspection and configuration.

## 5. Rollback

Failed startup/health rolls code back automatically. For an explicit rollback,
use the previous commit-SHA tag or digest; never switch back to `latest`:

```bash
ssh deploy@<VPS_IP>
cd /opt/buy-crypto-dip-bot
cp .deploy/docker-compose.previous.yml docker-compose.yml
PREVIOUS_IMAGE=$(cat .deploy/image.previous)
sed -i "s|^DIPBOT_IMAGE=.*|DIPBOT_IMAGE=$PREVIOUS_IMAGE|" .env
docker compose config --quiet
docker compose up -d --wait --wait-timeout 180
curl -fsS http://127.0.0.1:8787/health
```

Schema rollback is deliberately not automatic. Migrations must be additive and
backward-compatible. Restore a pre-deploy dump only after assessing data loss
and stopping all app writers.

## 6. Migrating off the legacy PM2 deployment

The first deployments ran from `/var/www/buy-crypto-dip-bot` under PM2 with a
standalone `dipbot-db` container. To switch a box that still runs it:

```bash
~/.local/share/fnm/node-versions/v26.4.0/installation/bin/pm2 delete all
docker stop dipbot-db      # keep as backup; volume buy-crypto-dip-bot_pgdata stays
# then follow step 3
```

## 7. Domain & TLS

Traefik owns TLS and redirects port 80 to HTTPS. Keep Cloudflare SSL mode
**Full (strict)** and register the exact domain with @BotFather (`/setdomain`)
for Telegram Login. Responses add HSTS, frame denial, MIME sniffing protection,
and a strict-origin referrer policy at the edge.

## 8. Security checklist

- [ ] `API_KEY` set in `/opt/buy-crypto-dip-bot/.env` (bootstrap does this)
- [ ] `DIPBOT_IMAGE` is an `@sha256:` digest written by the Deploy workflow
- [ ] `POSTGRES_PASSWORD`, `API_KEY`, `SESSION_SECRET`, and bot token exist only in server/GitHub secret stores
- [ ] Every migration journal entry has a matching SQL file
- [ ] Rotate the VPS root password after sharing it anywhere; CI never uses it
- [ ] SSH password auth disabled once key login is confirmed (step 1)
- [ ] `ufw status` → only 22/80/443 (+ your own services) allowed
- [ ] Postgres is NOT published on a host port (`docker compose ps` shows no 5432 mapping)
- [ ] `.env` files are chmod 600 and never committed
- [ ] HTTP redirects to HTTPS and HTTPS responses include HSTS
- [ ] The repo is public: never put real tokens in code, compose files, or workflows — only in GH secrets and the server `.env`
