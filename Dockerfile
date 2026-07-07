# syntax=docker/dockerfile:1
# Single image for api / bot / web — services pick their entrypoint via
# `command:` in docker-compose.prod.yml. Built in CI (GitHub Actions);
# the 1GB VPS only pulls, never builds.

FROM node:26-slim AS build
RUN npm install -g pnpm@11
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:26-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# API + bot are fully bundled except npm deps — install prod deps only.
COPY --from=build /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml /repo/package.json ./
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/bot/package.json apps/bot/package.json
COPY --from=build /repo/packages ./packages
RUN npm install -g pnpm@11 \
  && pnpm install --prod --frozen-lockfile \
    --filter @buy-crypto-dip-bot/api \
    --filter @buy-crypto-dip-bot/bot \
  && pnpm store prune && npm uninstall -g pnpm && rm -rf /root/.npm /root/.cache

# Built artifacts
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/bot/dist apps/bot/dist
# Nuxt output is self-contained (nitro bundles its deps)
COPY --from=build /repo/apps/web/.output apps/web/.output
# Drizzle migrations, applied by the API on startup
COPY --from=build /repo/packages/db/migrations /app/migrations
ENV DB_MIGRATIONS_DIR=/app/migrations

# Default command is the API; compose overrides for bot/web.
CMD ["node", "apps/api/dist/server.mjs"]
