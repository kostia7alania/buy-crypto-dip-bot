#!/usr/bin/env bash
# Invoked by the gated workflow, never by local verification.
set -Eeuo pipefail
umask 077

[[ "${TARGET_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || { echo "COMMIT_REQUIRED"; exit 1; }
[[ "${TARGET_IMAGE:-}" =~ ^ghcr.io/kostia7alania/buy-crypto-dip-bot@sha256:[0-9a-f]{64}$ ]] || { echo "IMMUTABLE_IMAGE_REQUIRED"; exit 1; }
# Resolve a first-install compose with an empty image entry. Discovery/stop/start
# refer to existing containers; only the post-migration up recreates app images.
export DIPBOT_IMAGE="$TARGET_IMAGE"
APP_DIR=/opt/buy-crypto-dip-bot
cd "$APP_DIR"
test -s .env
test -s docker-compose.yml
mkdir -p .deploy backups
RELEASE_ID="$TARGET_SHA-$(date -u +%Y%m%dT%H%M%S)"
NEXT_COMPOSE="$APP_DIR/.deploy/$RELEASE_ID.next.yml"
BACKUP="$APP_DIR/backups/$RELEASE_ID.dump"
MIGRATION_STARTED=0
WRITERS_STOPPED=0

fail_release() {
  local status=$?
  trap - ERR
  if [ "$MIGRATION_STARTED" = 1 ]; then
    docker compose stop api bot web || true
    echo "Migration was attempted. Services remain stopped; use a reviewed forward repair or restore rehearsal."
    echo "Previous compose and database backup: .deploy/$RELEASE_ID.before.yml and backups/$RELEASE_ID.dump"
  elif [ "$WRITERS_STOPPED" = 1 ]; then
    # No DDL was attempted, and the original containers still exist.
    docker compose start api bot web || true
  fi
  exit "$status"
}
trap fail_release ERR

curl --fail --silent --show-error --location --retry 3 \
  "https://raw.githubusercontent.com/kostia7alania/buy-crypto-dip-bot/$TARGET_SHA/docker-compose.prod.yml" \
  --output "$NEXT_COMPOSE"
DIPBOT_IMAGE="$TARGET_IMAGE" docker compose --env-file "$APP_DIR/.env" \
  --project-directory "$APP_DIR" -f "$NEXT_COMPOSE" config --quiet
docker pull "$TARGET_IMAGE"
# Validate credentials in the target image without connecting to the database.
# Configuration errors must not take healthy application writers offline.
DIPBOT_IMAGE="$TARGET_IMAGE" docker compose --env-file "$APP_DIR/.env" \
  --project-directory "$APP_DIR" -f "$NEXT_COMPOSE" run --rm --no-deps migrate \
  node packages/db/scripts/migrate.mjs --check-config
cp docker-compose.yml ".deploy/$RELEASE_ID.before.yml"
cp .env ".deploy/$RELEASE_ID.before.env"
# Preserve the actual local image IDs, even if an older compose used latest.
for service in api bot web; do
  container="$(docker compose ps -aq "$service")"
  if [ -n "$container" ]; then
    docker inspect --format '{{.Image}}' "$container" > ".deploy/$RELEASE_ID.$service.image"
  fi
done

WRITERS_STOPPED=1
docker compose stop api bot web
docker compose up -d --wait --wait-timeout 90 db
docker compose exec -T db pg_dump -U postgres -d dipbot -Fc > "$BACKUP.tmp"
test -s "$BACKUP.tmp"
# This checks archive readability, not restore correctness.
docker compose exec -T db pg_restore --list < "$BACKUP.tmp" > /dev/null
mv "$BACKUP.tmp" "$BACKUP"

# From this point, automatically restarting an old image is unsafe even if
# the client disconnects before it learns whether the transaction committed.
MIGRATION_STARTED=1
DIPBOT_IMAGE="$TARGET_IMAGE" docker compose --env-file "$APP_DIR/.env" \
  --project-directory "$APP_DIR" -f "$NEXT_COMPOSE" run --rm migrate
awk -v value="$TARGET_IMAGE" '
  BEGIN { replaced=0 }
  /^DIPBOT_IMAGE=/ { if (!replaced) print "DIPBOT_IMAGE=" value; replaced=1; next }
  { print }
  END { if (!replaced) print "DIPBOT_IMAGE=" value }
' .env > .env.next
chmod 600 .env.next
mv .env.next .env
mv "$NEXT_COMPOSE" docker-compose.yml
docker compose up -d --wait --wait-timeout 180
curl --fail --silent --show-error --retry 12 --retry-delay 5 --retry-all-errors \
  http://127.0.0.1:8787/health/ready > /dev/null
docker compose exec -T web node -e \
  "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
REDIRECT_STATUS="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --header 'Host: buy-crypto-dip-bot.com' http://127.0.0.1/)"
case "$REDIRECT_STATUS" in
  301|302|307|308) ;;
  *) echo "HTTP_REDIRECT_FAILED"; false ;;
esac
trap - ERR
printf '%s\n' "$TARGET_IMAGE" > .deploy/image.last-successful
cp docker-compose.yml .deploy/docker-compose.last-successful.yml
docker compose ps
