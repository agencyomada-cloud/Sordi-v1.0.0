# Mobino API (web backend)

Independent Node/Express/Postgres backend for the web version of Mobino. Lives entirely outside `src-tauri/` and the root `package.json` — the desktop app does not depend on anything in this directory and is unaffected by it.

Current scope: auth (signup/login/refresh/logout) + `clients` + `products`, the first vertical slice proving the multi-tenant pattern end-to-end. Every other resource (invoices, payments, orders, delivery notes, expenses, dashboard, production, employees, projects, scores, history) follows the exact same pattern — schema in `src/db/schema.ts` already covers all of them; only the repository + routes are still to come.

## Run it locally

With Docker:

```bash
cp .env.example .env          # then fill in real secrets if this isn't just local dev
docker compose up -d          # starts Postgres on localhost:5434
npm install
npm run db:generate           # generates SQL migrations from src/db/schema.ts
npm run db:migrate            # applies them
npm run dev                   # API on http://localhost:4000
```

Without Docker (e.g. this machine — no `docker` binary installed), use a native Postgres via Homebrew instead of `docker compose up`, kept inside this directory so it doesn't collide with any other local Postgres instance:

```bash
brew install postgresql@16    # if not already installed
cp .env.example .env

# one-time setup — creates server/.pgdata/ (gitignored)
initdb -D "$(pwd)/.pgdata" -U mobino --auth=trust -E UTF8
mkdir -p /tmp/mobino_dev_sock

# start/stop the local instance (port 5434, matches .env.example)
pg_ctl -D "$(pwd)/.pgdata" -l "$(pwd)/pg.log" -o "-p 5434 -k /tmp/mobino_dev_sock" start
createdb -h /tmp/mobino_dev_sock -p 5434 -U mobino mobino   # first time only
pg_ctl -D "$(pwd)/.pgdata" stop -m fast                      # when you're done for the day

npm install
npm run db:generate
npm run db:migrate
npm run dev                   # API on http://localhost:4000
```

Smoke test:

```bash
curl -s -c cookies.txt -X POST http://localhost:4000/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"changeme123","organizationName":"Test Co"}'

# copy the accessToken from the response, then:
curl -s http://localhost:4000/clients -H "Authorization: Bearer <accessToken>"
```

## Tenant isolation

Every business table has a required `org_id`. Routes never read an org id from the request — only from the verified JWT (`requireAuth` middleware, `req.auth.orgId`). Repository functions (`src/repositories/*.ts`) are the only code allowed to query these tables, and every query in them filters by `orgId`. When adding a new resource, follow that same shape: schema → repository (always takes `orgId`) → route (reads `orgId` only from `req.auth`).
