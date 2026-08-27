# Stack Overview

## Monorepo structure

Sordi is a **pnpm workspace** (`pnpm-workspace.yaml`: `apps/*`, `packages/*`), managed with `pnpm@11.22.0`.

```
sordi/
├── apps/
│   ├── desktop/       @sordi/desktop — the Tauri desktop app (the product)
│   └── api/           Node service used for license issuance/verification
├── packages/
│   ├── ui/            @sordi/ui — shared shadcn/Radix component library
│   └── schema/        shared schema/type definitions
└── docs/              this documentation set
```

The root `package.json` exposes thin proxy scripts (`dev`, `build`, `tauri`, `tauri:dev`, `tauri:build`, etc.) that all delegate to `pnpm --filter @sordi/desktop <script>` — so running `pnpm tauri:dev` from the repo root is equivalent to running `pnpm tauri:dev` inside `apps/desktop`.

## `apps/desktop` — the product

| Layer | Technology | Notes |
|---|---|---|
| Shell | **Tauri 2.9** (`@tauri-apps/cli` 2.9.6, `tauri` crate 2.9.5) | Rust-backed native window wrapping a system webview; bundles a real OS binary, not Electron. |
| UI framework | **React 18.3** + **TypeScript 5.8** | Function components + hooks throughout. |
| Build tool | **Vite 5.4** (`@vitejs/plugin-react-swc` for fast refresh) | `dev`/`build` scripts run with `--mode omada-agency`, a Vite mode that loads `.env.omada-agency` (this branch's specific configuration) instead of the default mode. |
| Routing | **react-router-dom 6.30** | Client-side routing, `BrowserRouter`, all routes defined in `src/App.tsx`. |
| Server-state / data fetching | **TanStack React Query 5.83** | Every domain hook in `src/hooks/` wraps `useQuery`/`useMutation` around Tauri command calls. |
| Styling | **Tailwind CSS 3.4** + `tailwindcss-animate` | Utility-first CSS, themed via CSS custom properties (see [`docs/ui-ux/design-language.md`](../ui-ux/design-language.md)). |
| Component library | **`@sordi/ui`** (workspace package) | shadcn/Radix-based; see [`docs/design-system/component-catalogue.md`](../design-system/component-catalogue.md). |
| Forms | **react-hook-form** + **zod** (`@hookform/resolvers`) | Validation schemas live in `src/lib/validations.ts`. |
| PDF generation | **`@react-pdf/renderer`** (React-tree-to-PDF) plus a native Rust path (`headless_chrome`) for HTML-to-PDF rendering | See [`frontend.md`](./frontend.md#pdf-generation-pipeline). |
| i18n | **i18next** + **react-i18next** | French (`fr`) and Arabic (`ar`) locale bundles under `src/i18n/locales/`; Arabic drives RTL layout. |
| Theming | **next-themes** | Light/dark mode via a `class` attribute strategy; dark mode tokens exist in `index.css` but no UI toggle is wired up yet (per an in-code comment). |
| Charts | **Recharts** (via `@sordi/ui`'s `chart.tsx` wrapper) | Dashboard/analytics visualizations. |
| Backend runtime | **Rust**, edition 2021, `rust-version = "1.77.2"` | Compiled to a native binary via Tauri's build pipeline. |
| Database | **SQLite** via `rusqlite` (`bundled` feature — SQLite is statically compiled in, no system dependency) | Single file, `database.db`, stored in the OS app-data directory. |
| Other native crates | `chrono`, `uuid`, `image` (employee photo processing), `jsonwebtoken` + `sha2` (license token verification), `reqwest` (rustls-tls, license HTTP calls only), `lettre` (rustls-tls, outgoing email), `tauri-plugin-dialog`, `tauri-plugin-opener` | See `apps/desktop/src-tauri/Cargo.toml` for the full dependency list and the inline comments explaining each choice. |

## `packages/ui` — `@sordi/ui`

A standalone shadcn/Radix-based component library consumed by `apps/desktop` as a workspace dependency (`"@sordi/ui": "workspace:*"`). It has no knowledge of Sordi's business domain beyond a handful of purpose-built components (`StatusBadge`, `EmptyState`, `SearchInput`, `MultiSelect` — see the [component catalogue](../design-system/component-catalogue.md)) that encode UI conventions, not business logic.

## `apps/api`

A separate Node/TypeScript service, referenced from the desktop app's Rust license module (`src-tauri/src/license.rs`) as the counterpart that issues and verifies license tokens (`apps/api/src/routes/licenses.ts`, `services/licenseService.ts`). It is not required for the desktop app's core ERP/invoicing functionality to work — only for commercial license activation/renewal, which is itself bypassed entirely on this `omada-agency` branch via the `omada_bypass` Cargo feature (see [`backend.md`](./backend.md#license--feature-gating)). It runs against a local PostgreSQL instance in development (visible in this environment as a `postgres` process on port 5434).

## `packages/schema`

Shared schema/type definitions referenced across the monorepo (used to keep the desktop app's TypeScript types and the API's data contracts from drifting independently).

## Why Tauri instead of Electron

Although not stated explicitly in-repo, the architectural consequences are visible directly in the code: a single Rust binary with a bundled SQLite database and no Node.js/Chromium runtime bundled per-install gives a materially smaller install size and lower idle memory footprint than an Electron equivalent — relevant for a desktop tool expected to run all day on office hardware in a business where "just use a bigger cloud VM" isn't a viable failure mode (there's no cloud dependency to fall back on). The Rust backend also directly owns the SQLite connection (`rusqlite`, wrapped in a `Mutex` and injected as Tauri-managed state), so every business rule — tax calculation, license gating, numbering — is enforced in a single, statically-typed, memory-safe layer that the JavaScript frontend cannot bypass by construction (it can only ever call `invoke()` on a fixed, explicitly registered command list).
