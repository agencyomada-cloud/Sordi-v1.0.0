# Mobino API (web backend)

Independent Node/Express/Postgres backend for the web version of Mobino. Lives entirely outside `src-tauri/` and the root `package.json` — the desktop app does not depend on anything in this directory and is unaffected by it.

Current scope: auth (signup/login/refresh/logout) + `clients` + `products`, the first vertical slice proving the multi-tenant pattern end-to-end. Every other resource (invoices, payments, orders, delivery notes, expenses, dashboard, production, employees, projects, scores, history) follows the exact same pattern — schema in `src/db/schema.ts` already covers all of them; only the repository + routes are still to come.

## Run it locally

```bash
cp .env.example .env          # then fill in real secrets if this isn't just local dev
docker compose up -d          # starts Postgres on localhost:5433
npm install
npm run db:generate           # generates SQL migrations from src/db/schema.ts
npm run db:migrate            # applies them
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
