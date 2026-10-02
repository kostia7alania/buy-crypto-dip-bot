#!/usr/bin/env bash
# Read-only destination evidence. Never print environment values or user rows.
set -Eeuo pipefail

APP_DIR=/opt/buy-crypto-dip-bot
cd "$APP_DIR"
test -s docker-compose.yml
test -s .env

printf 'INVENTORY_UTC %s\n' "$(date -u +%FT%TZ)"
printf '\nHOST_CAPACITY\n'
free -m
df -h "$APP_DIR"
docker version --format 'DOCKER_SERVER {{.Server.Version}}'
docker compose version

containers=()
for service in db api bot web; do
  container="$(docker compose ps -aq "$service")"
  if [ -z "$container" ]; then
    printf 'SERVICE %s MISSING\n' "$service"
    continue
  fi
  containers+=("$container")
  printf '\nSERVICE %s\n' "$service"
  docker inspect --format 'state={{.State.Status}} image={{.Image}} started={{.State.StartedAt}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}}' "$container"
  image="$(docker inspect --format '{{.Image}}' "$container")"
  docker image inspect --format 'revision={{index .Config.Labels "org.opencontainers.image.revision"}} digests={{json .RepoDigests}}' "$image"
done
if [ "${#containers[@]}" -gt 0 ]; then
  printf '\nPROJECT_RESOURCE_USAGE\n'
  docker stats --no-stream --format '{{.Name}} memory={{.MemUsage}} cpu={{.CPUPerc}}' "${containers[@]}"
fi

printf '\nHTTP_STATUS_ONLY\n'
for path in /health /health/ready /orders; do
  status="$(curl --silent --max-time 15 --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:8787$path")" || status=unreachable
  printf '%s %s\n' "$path" "$status"
done

printf '\nDATABASE_CATALOG_ONLY\n'
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U postgres -d dipbot <<'SQL'
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT current_setting('server_version') AS postgres_version,
       pg_size_pretty(pg_database_size(current_database())) AS database_size;
SELECT n.nspname AS schema, c.relname AS relation,
       c.relrowsecurity AS rls, c.relforcerowsecurity AS forced_rls
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'drizzle') AND c.relkind = 'r'
ORDER BY 1, 2;
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies WHERE schemaname = 'public'
ORDER BY 1, 2, 3;
SELECT 'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id;'
WHERE to_regclass('drizzle.__drizzle_migrations') IS NOT NULL
\gexec
SELECT 'SELECT id, hash, created_at FROM drizzle.__dipbot_forward_migrations ORDER BY id;'
WHERE to_regclass('drizzle.__dipbot_forward_migrations') IS NOT NULL
\gexec
COMMIT;
SQL
printf '\nINVENTORY_COMPLETE no deployment or migration performed\n'
