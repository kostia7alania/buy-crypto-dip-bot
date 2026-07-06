# Production VPS Deployment Runbook

How **Buy Crypto Dip Bot** ships to the VPS. The server never builds anything — a 1GB
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

```bash
ssh root@<VPS_IP>
# docker, swap, ufw, deploy user, Traefik edge proxy, /opt/buy-crypto-dip-bot/.env
curl -fsSL https://raw.githubusercontent.com/kostia7alania/buy-crypto-dip-bot/main/scripts/vps-bootstrap.sh | bash

cd /opt/buy-crypto-dip-bot
curl -fsSL https://raw.githubusercontent.com/kostia7alania/buy-crypto-dip-bot/main/docker-compose.prod.yml -o docker-compose.yml
nano .env    # fill TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
docker compose up -d
docker compose ps    # db healthy, api/bot/web running
curl -s localhost:8787/health
```

The bootstrap generates strong `POSTGRES_PASSWORD` and `API_KEY` in
`/opt/buy-crypto-dip-bot/.env` automatically. Postgres and the API are
reachable only from the docker network / localhost.

### Edge proxy: Traefik (all projects on this VPS)

Traefik (`/opt/traefik`, from `infra/traefik/docker-compose.yml`) owns ports
80 and 2053 and terminates TLS with automatic Let's Encrypt certificates.
Host nginx is retired. Host port 443 is occupied by an unrelated service, so
HTTPS rides Cloudflare's alternative port 2053; a Cloudflare **Origin Rule**
(incoming port 443 → destination port 2053) makes standard
`https://buy-crypto-dip-bot.com` work. Keep Cloudflare SSL mode **Full**.

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

`git push` to `main`. That is the whole procedure. Watch it in the repo's
Actions tab.

Manual redeploy: Actions → Deploy → Run workflow, or on the server
`cd /opt/buy-crypto-dip-bot && docker compose pull && docker compose up -d`.

## 5. Rollback

```bash
ssh root@<VPS_IP>
cd /opt/buy-crypto-dip-bot
# pin the image to the previous commit sha shown in the Actions history
sed -i 's|buy-crypto-dip-bot:latest|buy-crypto-dip-bot:<previous_sha>|' docker-compose.yml
docker compose up -d
```

Revert the pin at the next normal deploy.

## 6. Migrating off the legacy PM2 deployment

The first deployments ran from `/var/www/buy-crypto-dip-bot` under PM2 with a
standalone `dipbot-db` container. To switch a box that still runs it:

```bash
~/.local/share/fnm/node-versions/v26.4.0/installation/bin/pm2 delete all
docker stop dipbot-db      # keep as backup; volume buy-crypto-dip-bot_pgdata stays
# then follow step 3
```

## 7. Domain & TLS (when a domain is pointed at the VPS)

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d <domain>
```

Then register the domain with @BotFather (`/setdomain`) to enable Telegram
Login on the dashboard. Prefer a non-.ru TLD; put DNS behind Cloudflare to
hide the origin IP.

## 8. Security checklist

- [ ] `API_KEY` set in `/opt/buy-crypto-dip-bot/.env` (bootstrap does this)
- [ ] Rotate the VPS root password after sharing it anywhere; CI never uses it
- [ ] SSH password auth disabled once key login is confirmed (step 1)
- [ ] `ufw status` → only 22/80/443 (+ your own services) allowed
- [ ] Postgres is NOT published on a host port (`docker compose ps` shows no 5432 mapping)
- [ ] `.env` files are chmod 600 and never committed
- [ ] The repo is public: never put real tokens in code, compose files, or workflows — only in GH secrets and the server `.env`
