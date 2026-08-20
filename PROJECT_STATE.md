# Project State — Sordi

**Version:** 1.0.0 · **Date:** 2026-08-20 · **Market:** Algeria / North Africa (SME commercial, trading & industrial invoicing)

This document replaces the previous audit-style `PROJECT_STATE.md`. It covers what was actually designed and built in the current build phase: the monorepo restructure, the licensing system, the client-health ("Aperçu") feature, sidebar/search work, and everything still deferred. It's meant to travel with the repo, not just this chat — read it before resuming any of the threads below.

---

## 1. Monorepo architecture

### 1.1 Shape

```
sordi/
├── apps/
│   ├── desktop/     @sordi/desktop  — Tauri 2.9 + React 18 + TypeScript, the actual product
│   └── api/         @sordi/api      — Express + Postgres (Drizzle ORM), license issuance/verification
├── packages/
│   ├── ui/          @sordi/ui       — 50 shared shadcn-derived components (Button, Dialog, Card, Toaster, ...)
│   ├── schema/       @sordi/schema  — Drizzle schema, shared between apps/api and its migrations
│   └── data-layer/   @sordi/data-layer — DataClient contract + LocalAdapter/RemoteAdapter (see 1.3)
├── pnpm-workspace.yaml
└── package.json      (root scripts just proxy to apps/desktop, e.g. `pnpm tauri:dev`)
```

Package manager is pnpm (`pnpm@11.22.0`, pinned via `packageManager` field). npm's `package-lock.json` and the old `bun.lockb` were both removed in favor of a single `pnpm-lock.yaml` — deliberate, to stop three lockfiles drifting against each other.

### 1.2 Why this split

- **apps/desktop** is the actual shipped product — offline-first, single-tenant, one SQLite file per install. This is where 100% of day-to-day invoicing/CRM work happens.
- **apps/api** exists *only* for cross-device concerns the desktop app can't handle alone: issuing and verifying license keys (§3). It is not a data-sync backend today — no invoice/client/product data ever leaves the desktop app's local SQLite file.
- **packages/ui** was extracted so component styling/behavior has one source of truth instead of being duplicated if a second frontend (e.g. a future admin panel) ever needs the same primitives.
- **packages/data-layer** was extracted ahead of need, specifically to make a *future* cloud-sync adapter additive rather than a rewrite (§1.3).

### 1.3 DataClient / LocalAdapter — scaffolded, not wired in yet

`packages/data-layer` defines:
- `DataClient` — a single TypeScript interface (`types.ts`) covering clients, products, invoices, delivery notes, orders, payments, expenses as uniform `EntityClient<TEntity, TCreate, TUpdate, TListParams>` CRUD contracts. Every field in it was verified line-by-line against the real Rust structs in `commands.rs` (not inferred from how the frontend currently calls things) — several mismatches were caught and fixed in the process (e.g. `Client.contact` doesn't exist, the real field is `contactPerson`/`contact_person`).
- `LocalAdapter` — implements `DataClient` by wrapping Tauri's `invoke()`.
- `RemoteAdapter` — a stub implementing the same interface against a hypothetical HTTP backend, unused today.
- `WriteMeta` (`idempotencyKey`, `clientTimestamp`) — required on every write in the *type*, even though `LocalAdapter` doesn't do anything with it yet. The intent is that when real sync eventually happens, retries/conflict-resolution have a place to hook in without touching every call site again.

**Current reality:** `apps/desktop/src/lib/dataClient.ts` exports `dataClient = LocalAdapter` purely to prove the package resolves and compiles. **No page in the app uses it.** Every page still calls `apps/desktop/src/lib/database.ts`'s `db` object directly, which wraps `invoke()` itself with a different, older, and larger surface (includes settings, history, activity logs, PDF generation helpers, license commands — everything `DataClient` deliberately does *not* cover, since it only models the core CRUD entities).

**Open question, not yet decided:** whether to (a) migrate `database.ts`'s call sites onto `dataClient` incrementally, (b) fold `database.ts`'s extra surface into `DataClient` and retire `database.ts`, or (c) leave `data-layer` purely aspirational until real multi-device sync is actually being built. Nothing forces this decision now — the scaffold costs nothing sitting idle — but don't assume `DataClient` is "the" data layer when reading other code; `database.ts` still is.

### 1.4 Why Rust/SQLite stays local-first for now

The desktop app's actual business data (clients, invoices, products, payments, everything) lives in one `rusqlite`-backed SQLite file per installation (`database.db`, next to `license.token`, in the OS's Tauri `app_data_dir`). This was a deliberate choice, not a stopgap:

- The target customer (Algerian SME trading/invoicing) needs the app to work fully offline, with zero latency, with no dependency on a hosted service staying up. A local embedded DB is the only architecture that guarantees that.
- Multi-device sync is a real feature customers will eventually want, but it's a hard problem (conflict resolution, partial connectivity, merge semantics) that doesn't need to be solved before the app is useful — hence `data-layer`'s `WriteMeta` scaffolding exists to make that addition *possible later* without it being *required now*.
- `apps/api` was intentionally scoped to only the one thing that genuinely requires a server — proving a device is entitled to write access — rather than becoming a general backend prematurely.

---

## 2. Mobino → Sordi rebrand & real-client-data cleanup

- App identity fully renamed: `productName`/`identifier` in `tauri.conf.json` (`Sordi` / `com.sordi.app`), `Cargo.toml` package name (`sordi`), both pinned to version **1.0.0** (corrected from a stray `4.0.0` left in one config file).
- macOS Dock/bundle icon regenerated from the project's actual favicon via Tauri's icon generation tooling (previously still showing the old Mobino mark).
- A grep across the whole tree (`.rs`, `.ts`, `.tsx`, `.toml`, `.json`, `.md`, `.sql`, `.yml`, `.env*`) turns up **zero** remaining "mobino" references — the rename is complete, not just cosmetic on the surface.
- Postgres (local dev instance) and its connection strings/`docker-compose.yml`/`.env.example` are already named `sordi` throughout — verified directly against the running local instance (`psql -l` shows a `sordi` database owned by role `sordi`), not just the config files.
- The two real-client Excel exports at the repo root (`ETAT DES SUIVI FACT CLIENTS 2025.xlsx`, `FICHE POUR CLIENTS 2025...xlsx`) are `.gitignore`d and confirmed **never committed** — `git ls-files` doesn't list them, `git log --diff-filter=A -- "*.xlsx"` returns nothing.
- Full git history (8 commits total, root commit `fdeaa7f "baseline: pre-web-migration snapshot"` onward) contains no `.env` file, no `*.db`/`*.sqlite` file, and no real client data at any point — checked directly, not assumed.

**On the "database name cleanup" and "git history rewrite before any remote" items** flagged as open: investigating both just now turned up nothing outstanding — SQLite/Postgres/Cargo/Tauri naming is already consistently "sordi" everywhere, and history is already clean of secrets and real data. If there's a specific naming or history concern you had in mind that isn't reflected here, it likely predates what's in this session's context — flag it again and it'll get addressed directly rather than guessed at.

---

## 3. Licensing system

Full operational detail (creating/revoking licenses, rotating the keypair) lives in `LICENSING.md` at the repo root — this section covers the *design*, that one covers *operating it*.

### 3.1 Framing

Explicitly **a deterrent against casual reuse** (copying the app folder, sharing a key) — **not DRM** and not designed to survive a determined attacker with local code access. This scope was fixed deliberately up front rather than let it creep toward defeating reverse engineering, which offline desktop software can't credibly do anyway.

### 3.2 Signing: Ed25519 / EdDSA, hand-rolled on the Node side

- `apps/api`'s `licenseService.ts` signs license tokens using `node:crypto`'s native Ed25519 support directly (manual JWT construction: `base64url(header) + "." + base64url(payload)`, signed with `crypto.sign(null, ..., privateKey)`), **not** the `jsonwebtoken` npm package that's also a dependency in the same file's neighborhood. That package is used elsewhere in `apps/api` for ordinary session auth (HS256), but its EdDSA support doesn't exist — neither its TypeScript types nor its runtime recognize the algorithm. This was confirmed by reading the installed package's source directly, not assumed from its README.
- The Rust side (`apps/desktop/src-tauri/src/license.rs`) verifies using the `jsonwebtoken` **crate** (an unrelated, different package from the npm one), which does support EdDSA natively — `Validation::new(Algorithm::EdDSA)`.
- Cross-language interop was verified with a real test: a token signed by the Node implementation, decoded and signature-checked by the Rust implementation, in an automated test — not just "the algorithm names match on both sides."
- **Why asymmetric matters here:** the public key is embedded in every shipped desktop binary (it has to be, to verify offline). If signing were symmetric (HMAC), that same embedded secret could sign new valid tokens — trivially defeating the whole scheme by extracting one string from the binary. With Ed25519, the embedded public key can verify but never forge.

### 3.3 Device fingerprinting

- Per-OS stable hardware identifiers, SHA-256 hashed, computed in `compute_device_fingerprint()` (Rust). The raw hardware ID is never sent anywhere or embedded raw in the token — only its hash.
- The fingerprint is embedded inside the signed JWT payload (`device_fingerprint` claim) at issuance time and re-derived fresh on the local machine at every verification (`verify_local()`), then compared. This is what stops a copied `license.token` file (not the whole app — just that one file) from working on a second machine: the token's signature is still valid there, but the fingerprint comparison fails, so it falls back to `read_only` rather than `active`.
- This is explicitly **not** copy-protection against someone who also copies/reconstructs the fingerprinting logic — it raises the bar for casual file-sharing, which was the stated goal, not more.

### 3.4 Offline tolerance & token lifetime

- Tokens are valid for **35 days** from issuance (`exp` claim), verified **entirely locally** on every app launch and before every gated write — no network call required for day-to-day use.
- A background verification (`verify_license_background`) periodically re-checks against `apps/api` when a connection happens to be available, refreshing the local token — this is how a revocation (§3.6) eventually reaches an offline device, at the cost of a delay of up to ~35 days if the device stays offline the entire window. That tradeoff (offline-first usability vs. instant revocation) was a deliberate, explicit choice — see `license.rs`'s module doc for the reasoning.
- `LicenseStatus` has three states: `active` (verified, unexpired, right device), `read_only` (token present but invalid/expired/wrong-device, or a revoked license not yet re-synced), `not_activated` (no token file at all). `read_only` and `not_activated` get identical UI treatment — the distinction only matters for internal logic, not what the user sees.

### 3.5 Command-gating scope

`require_active_license()` is the single gate, called at the top of every mutating command — re-checked fresh (file read + signature check) on every call rather than cached, to avoid a separate cache-invalidation path drifting out of sync with activate/verify. Currently gates **46 Tauri commands** (create/update/delete across clients, products, invoices, orders, delivery notes, payments, expenses, employees, projects, scores, production logs, settings writes, etc.) — read/list commands and PDF export/print are deliberately ungated, matching the stated design: consultation and export stay available even on an expired license, only *new* mutation is blocked.

### 3.6 What's NOT built yet (admin tooling)

- No admin UI for creating/revoking licenses — done via a raw `curl` call against `POST /licenses/create` (header-gated with `x-admin-secret`) and, for revocation, a direct `UPDATE licenses SET status = 'revoked' WHERE ...` SQL statement. Both are documented step-by-step in `LICENSING.md`.
- No endpoint to revoke a license via the API — only the direct-SQL path exists today, because nothing has asked for the endpoint yet.

### 3.7 ⚠️ Blocking item before any real customer license

The Ed25519 keypair currently embedded in the repo (`apps/api/.env`'s `LICENSE_PRIVATE_KEY_PEM`, `license.rs`'s `LICENSE_PUBLIC_KEY_PEM`) is a **development keypair generated while building this feature, inside an AI session's context.** It must never be used to sign a real customer's license. `LICENSING.md` has the exact `node -e "..."` one-liner to generate a production keypair, plus the three-step rollout order (new private key into production `.env`, new public key baked into a *new* desktop build, ship that build *before* activating anyone against the new private key — an old build with the old public key can't verify tokens from a new private key).

---

## 4. Client "Aperçu" (health overview) feature

Lives in `apps/desktop/src/lib/clientOverview.ts` — one file, shared by both the client detail page's Aperçu tab and the clients-list status badge, so the two can't drift into disagreeing about a client's status. Raw numbers come from Rust's `get_client_overview_stats`; every threshold and priority rule below is pure TypeScript on top of those numbers.

**Metric — Délai de paiement moyen** (average payment delay): mean of the last 10 fully-paid invoices' delay-to-payment. Requires at least 3 data points, else shows "Pas assez de données" rather than a misleading average of 1–2 invoices.

**Metric — Fréquence d'achat** (purchase frequency): mean gap between the last 6 invoices, bucketed into a label:
- ≤ 10 days → **Hebdomadaire**
- ≤ 35 days → **Mensuelle**
- ≤ 100 days → **Trimestrielle**
- otherwise → **Occasionnelle**
Requires ≥ 3 invoices total, else "Trop tôt pour évaluer". Displayed with the actual computed number alongside the label (e.g. "tous les 12 jours (Mensuelle)"), per an explicit follow-up request during this feature's build — not just the bucket name alone.

**Metric — Statut** (the badge shown everywhere): first-match-wins priority order —
1. **En retard** — any unpaid/partial invoice past `invoice_date + payment_terms_days` (falls back to a conventional 30-day term when a client has no explicit terms set — this fallback is kept identical on both the Rust side, in `has_overdue_unpaid`, and the TypeScript side, deliberately, so the two never disagree about what "overdue" means).
2. **À surveiller** — the average delay of the client's *last 3* paid invoices exceeds 1.5× their payment terms, **or** the gap since their last invoice exceeds 2× their own computed purchase-frequency average ("gone quiet" relative to their own normal rhythm, not a fixed calendar threshold).
3. **Nouveau** — fewer than 3 invoices total (not enough history to judge either way).
4. **Bon payeur** — none of the above triggered.

---

## 5. Sidebar restructuring

`apps/desktop/src/components/layout/Sidebar.tsx` — grouped navigation (**Transactions**: Facturation/Paiements/Commandes/Livraisons; **Gestion**: Clients/Produits/Charges; **Pilotage**: Analyses/Historique), each group collapsible and its collapsed state persisted to `localStorage` per-group. **Paramètres** stays pinned below all groups, never collapses, always visible.

Below the nav (as a sibling, not a nav item) sits a **license status card** — reads `useLicenseStatus()` and renders one of two states:
- **Active:** a tinted "Sordi Pro" card with the crown icon in a colored badge, showing days remaining until expiry.
- **Not active:** a gradient upgrade card with a "Passer à Pro" CTA button, opening a new in-app `/upgrade` route (bank-transfer instructions + WhatsApp/email proof workflow + license-key activation form — no payment gateway, matching how payment actually happens in this market today).

This card went through one visible design correction: the first version used the same subtle background/radius as regular nav-item hover states, so it read as "just another list item" rather than a distinct status card. Redesigned with a clearly different visual treatment (tinted background, circular icon badge, gradient in the unlicensed state) to match the intended "upgrade card, not a nav destination" pattern.

A second, unrelated bug surfaced while building this card: the days-remaining number wasn't rendering even for a genuinely active license. Root cause was in `license.rs`, not the new UI — the `LicenseStatus` Rust struct had `#[serde(rename_all = "camelCase")]` (copy-pasted from the neighboring `LicenseClaims` struct, which correctly needs it for the Node-side JWT contract), so it was serializing `expires_at` as `expiresAt` over IPC while the TypeScript interface expected snake_case. Only `state` (no underscore) happened to match, silently masking the bug until something actually read `expires_at`. It's the only struct in the entire Tauri command surface that had this rename — fixed by removing it.

A **Centre d'aide** link (mailto to `contact@sordi.app`) sits in the footer above the logout button — explicitly a placeholder until a real help page/docs site exists.

---

## 6. Global search (⌘K)

`apps/desktop/src/hooks/useGlobalSearch.ts` + Rust's `search_global` command. Deliberately scoped in phases rather than built all at once — **Phase 1 (shipped): Clients + Invoices only.**

- Clients: `name LIKE %query%` or `code LIKE %query%`, top 5, ordered by name.
- Invoices: `invoice_number LIKE %query%` only (client name is joined in for display, not matched against), top 5, ordered by invoice date descending.
- 2-character minimum before a query fires, 150ms debounce, `staleTime: 0` (bounded local queries, ~1–3ms, no reason to hold a stale result once the user keeps typing).
- Verified with a real IPC-level test (`search_global_finds_matching_clients_and_invoices_via_real_ipc`), not just a unit test against the SQL in isolation.

**Deferred, not started:** Produits and Commandes search — explicitly left for a later phase per the original scoping decision, not an oversight.

---

## 7. Other features shipped this phase (brief)

- **Toast/notification redesign:** dead shadcn `Toaster` removed entirely in favor of Sonner exclusively; only the success color changed (emerald → Sordi Blue); notification sound replaced with a quieter asset.
- **Clear-history feature** (`History.tsx`): destructive confirmation via `AlertDialog`, with the Radix auto-close-on-click default deliberately overridden (`e.preventDefault()` in the confirm handler) so the dialog only closes on confirmed success, not optimistically.
- **Invoice editor responsiveness fix:** the A4-fixed-width editable preview now scales to fit the available viewport (`ScaleToFit` wrapper, `apps/desktop/src/components/invoice/EditableInvoicePreview.tsx`) rather than overflowing at the app's own minimum window size — a visual zoom, not a layout/DOM change, so print/export accuracy is untouched.
- **Conditional PDF watermark:** "Created by Sordi v1.0.0 — www.sordi.app" now renders on all 3 invoice PDF themes (Structuré/Épuré/Moderne) whenever the generating device's license isn't active, threaded through as an explicit `licenseActive` parameter (not a hook call) since the PDF templates are pure `@react-pdf/renderer` render functions outside React context — 11 real call sites across the app were updated to pass it.

---

## 8. Deferred / pending — full list

| Item | Status | Notes |
|---|---|---|
| **Production Ed25519 keypair** | 🔴 Blocking before any real customer | Dev keypair is in the repo/`.env` right now; must be regenerated and rolled out per the 3-step order in `LICENSING.md` §"Before selling any real license" before activating a paying customer. |
| **License admin UI** | Not started | Creation is a `curl` + admin-secret header; revocation is raw SQL. Fine for the current volume, not fine at scale. |
| **License revoke endpoint** | Not started | Only direct `UPDATE licenses SET status = 'revoked'` exists. |
| **`DataClient`/`LocalAdapter` adoption** | Scaffolded, unused | Type contract + adapter exist and compile; zero call sites use it. `database.ts` remains the real data layer. Decision on whether/how to migrate is open (§1.3). |
| **Multi-device cloud sync** | Not started, not designed beyond `WriteMeta` | The one piece of forward-looking scaffolding is `idempotencyKey`/`clientTimestamp` on every write type — unused by any adapter today. |
| **Search Phase 2** (Produits, Commandes) | Deferred by design | Explicit phased scoping decision, not a gap. |
| **Remember window position** (`tauri-plugin-window-state`) | Deferred | Mentioned, not prioritized. |
| **ClientDetail view/edit UX restructure** (hoist Statut badge to header, separate "Profil" tab) | Proposed, never approved | A plan was presented mid-session and never explicitly confirmed or resumed — don't treat it as agreed scope. |
| **ESLint debt** (from the prior audit, still true) | Open | ~178 `no-explicit-any` errors concentrated in `NewInvoice.tsx`/`NewOrder.tsx`/`NewProforma.tsx`/`Payments.tsx`/`pdf.worker.ts`, plus `react-hooks/exhaustive-deps` gaps in the same files. |
| **Git history / secrets review before adding a remote** | Investigated, appears already clean | 8 commits total, no `.env`/db files/real client data ever committed (verified directly, not assumed). Still worth a final check immediately before the first `git remote add` + push, as standard practice — but nothing concrete found to actually rewrite. |
| **Database naming** | Investigated, appears already clean | SQLite file, Postgres DB/role, Cargo package, Tauri identifier are all consistently `sordi`/`com.sordi.app` already; no leftover "mobino" or generic naming found anywhere in the tree. If something specific was meant here, it wasn't reproducible from current repo state — flag it again with specifics. |

---

## 9. Where things physically live (quick index)

- Licensing design/ops: `LICENSING.md` (root), `apps/desktop/src-tauri/src/license.rs`, `apps/api/src/services/licenseService.ts`, `apps/api/src/routes/licenses.ts`
- Data contract: `packages/data-layer/src/{types,LocalAdapter,RemoteAdapter}.ts`
- Client health logic: `apps/desktop/src/lib/clientOverview.ts`
- Sidebar: `apps/desktop/src/components/layout/Sidebar.tsx`
- Upgrade flow: `apps/desktop/src/pages/Upgrade.tsx`
- Global search: `apps/desktop/src/hooks/useGlobalSearch.ts`, `search_global` in `apps/desktop/src-tauri/src/commands.rs`
- Invoice PDF themes: `apps/desktop/src/components/pdf/{InvoicePDFDocument,InvoiceTemplateEpure,InvoiceTemplateModerne}.tsx`
