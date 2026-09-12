# Build from the monorepo ROOT: docker build -f apps/api/Dockerfile -t sordi-api .
# (not from apps/api/) — pnpm workspace resolution needs the root
# package.json/pnpm-lock.yaml/pnpm-workspace.yaml plus @sordi/api's
# workspace dependency @sordi/schema, none of which exist inside apps/api/
# alone.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
WORKDIR /repo

# ---------------------------------------------------------------------------
# deps: install once, cached across builds as long as lockfile/manifests
# don't change. python3/make/g++ are needed for argon2's native addon
# (node-gyp) — removed again in the final runtime stage below, they're only
# needed to compile it once here.
# ---------------------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/schema/package.json packages/schema/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter @sordi/api...

# ---------------------------------------------------------------------------
# build: compile TypeScript to dist/ (see apps/api/tsconfig.json's outDir)
# ---------------------------------------------------------------------------
FROM deps AS build
COPY packages/schema packages/schema
COPY apps/api apps/api
RUN pnpm --filter @sordi/api build

# ---------------------------------------------------------------------------
# prod-deps: a second, separate install with devDependencies pruned — kept
# as its own stage (not just `pnpm prune` on the deps stage) so the final
# image never inherits the python3/make/g++ toolchain layer.
# ---------------------------------------------------------------------------
FROM base AS prod-deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/schema/package.json packages/schema/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN apk add --no-cache python3 make g++ \
  && pnpm install --frozen-lockfile --prod --filter @sordi/api... \
  && apk del python3 make g++

# ---------------------------------------------------------------------------
# runtime: the actual image shipped to Dokploy — no build tools, no
# devDependencies, runs as a non-root user.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
WORKDIR /repo

RUN addgroup -S sordi && adduser -S sordi -G sordi

COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /repo/packages/schema/node_modules ./packages/schema/node_modules
COPY packages/schema/package.json packages/schema/package.json
COPY packages/schema/src packages/schema/src
COPY apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/drizzle apps/api/drizzle
COPY apps/api/drizzle.config.ts apps/api/drizzle.config.ts

WORKDIR /repo/apps/api
USER sordi

EXPOSE 4000
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Runs via tsx, not plain `node`, even though apps/api/dist is already
# compiled JS: @sordi/schema's package.json points "main" at its raw
# src/index.ts (workspace convention — apps/web's Vite build and this
# package's own `tsx watch` dev script both handle a .ts main natively).
# Plain Node's ESM resolver cannot load a .ts file and throws
# ERR_MODULE_NOT_FOUND on that import at runtime — confirmed by actually
# running this image with `node dist/index.js` before landing on this fix.
# tsx resolves it correctly with negligible startup overhead.
CMD ["node_modules/.bin/tsx", "dist/index.js"]
