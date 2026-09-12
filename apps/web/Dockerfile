# Build from the monorepo ROOT: docker build -f apps/web/Dockerfile -t sordi-web \
#   --build-arg VITE_API_URL=https://api.sordi.finance .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/schema/package.json packages/schema/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter @sordi/web...

FROM deps AS build
ARG VITE_API_URL
COPY packages/schema packages/schema
COPY packages/ui packages/ui
COPY apps/web apps/web
# Only written into the build env when actually non-empty — a blank
# --build-arg VITE_API_URL="" (some hosts, Dokploy included, pass unset
# build args through as "" rather than omitting them) must never override
# apps/web/.env.production's own default: Docker's `ENV VITE_API_URL=$ARG`
# would set the var to "" regardless, since ENV always applies once
# declared. Writing to .env.production.local (Vite's highest-priority env
# file, git-ignored) only when the arg is genuinely set avoids that.
RUN if [ -n "$VITE_API_URL" ]; then echo "VITE_API_URL=$VITE_API_URL" > apps/web/.env.production.local; fi
RUN pnpm --filter @sordi/web build

# ---------------------------------------------------------------------------
# runtime: static build served by Nginx — no Node runtime in the shipped
# image at all.
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
