# Sordi — Business & Product Overview

## What Sordi is

Sordi is an offline-first desktop ERP and invoicing application built for **Omada Agency**, an EURL (single-shareholder limited-liability company) providing marketing and digital services from **Sétif, Algeria**. It runs as a native desktop app (Tauri 2.9: a Rust backend with a bundled SQLite database, wrapped around a React/TypeScript UI) rather than a cloud SaaS product — a deliberate choice given the operating environment: Algerian small businesses frequently deal with unreliable or intermittent internet, and a locally-installed application with a local database keeps the business fully operational (creating invoices, recording payments, printing documents) with zero network dependency for its core workflows. The only features that reach the network are optional: license activation/verification and outgoing document emails.

The repository also contains an `apps/api` (a Node/Express-style service used for license issuance/verification — see `docs/architecture/backend.md`) and a shared `packages/ui` component library, but the product itself — the thing Omada Agency and its staff actually use day to day — is `apps/desktop`.

## Real company identity (as configured in this install)

The running application's own company record (the seller identity printed on every document it issues) is configured as:

| Field | Value |
|---|---|
| Name | EURL OMADA AGENCY |
| NIF | 002619006938460 |
| NIS | 002619010010761 |
| RC | 26 B 0096834 |

These are Omada Agency's own legal registration numbers, stored as plain configuration data in the local `companies` table of the app it uses for itself — not a fabricated example and not a third party's data. Where this document needs to describe fields generically (e.g. for a hypothetical second company workspace), it does so without inventing further specifics.

## Who it's for

Sordi is built specifically for how a small Algerian service agency operates, not for a generic retailer:

- **Primary user**: Omada Agency itself, plus any additional company "workspaces" it registers (the app supports multiple companies sharing one installation — see [Multi-company workspaces](#multi-company-workspaces--projects) below).
- **Day-to-day operators**: whoever in the agency issues invoices/quotes, tracks client payments, manages ongoing client projects and contracts, and runs monthly payroll.
- **External stakeholders who consume its output**: clients (who receive tax-compliant PDF invoices, delivery notes, and proformas by email or in person), the agency's accountant (who needs TVA/timbre-compliant documents and a clean activity trail), and any partners/associates who take profit withdrawals from the business.

## The problem it solves

### 1. Algerian tax-compliant invoicing, by default

Algerian commercial documents carry legal requirements that a generic invoicing tool doesn't enforce out of the box. Sordi bakes these in at the database and PDF-generation layer rather than leaving them to user discipline:

- **Legal identity fields** on both the seller (company) and buyer (client) sides: `NIF` (Numéro d'Identification Fiscale), `NIS` (Numéro d'Identification Statistique), `RC` (Registre du Commerce), and `AI`/`article_imposition` (Article d'Imposition). Clients can additionally carry a *secondary* RC/address (`secondary_rc`, `secondary_address` on the `clients` table) for businesses operating a registered secondary establishment, and an invoice can be issued against either register (`use_secondary_register` on `invoices`).
- **TVA (VAT)** at the standard Algerian rate of **19%**, with per-invoice-item override (`invoice_items.tva_rate`) to support the reduced 9% rate or full exemption, rather than one fixed rate for the whole document.
- **Droit de timbre (stamp duty)**, calculated automatically per the real Algerian tiers implemented in `calculate_timbre()` (`apps/desktop/src-tauri/src/database.rs`): 1% up to 30,000 DA, 1.5% between 30,000 and 100,000 DA, 2% above that, with a 5 DA floor. Consistent with Algerian rules, timbre is **only charged on cash-settled invoices** (`payment_method` containing "espèce"/"cash") and is **waived entirely on credit notes (avoirs)** — this conditional logic lives in `recalculate_invoice_totals()`, not left to manual judgment per document.
- **Sequential, gap-free, unique invoice numbering** via a dedicated `sequences` table, so numbering integrity (a legal requirement) survives concurrent use, manual number overrides, and edits.
- **Credit notes (factures d'avoir)** as a first-class invoice type (`invoice_type = "credit_note"`), auto-prefixed `AV-…`, referencing the original invoice via `original_invoice_id`.

A companion audit document at the repo root, `CONFORMITE_FACTURATION_ALGERIE.md`, walks through this compliance checklist against the actual code line-by-line and concludes the invoicing flow is compliant with 2025 Algerian invoicing requirements, while flagging optional future improvements (e.g. displaying payment method on the printed invoice, per-product default TVA rates, source withholding for certain service categories).

### 2. Offline-first, single-file operation

Everything the business needs day-to-day — creating and printing invoices, recording a payment, adding a client, running payroll — works with the app's own bundled SQLite database (`rusqlite`, `bundled` feature) stored under the OS's app-data directory. There is no server the desktop app depends on to function; the two features that do reach a network are opt-in and non-blocking (see [License & feature gating](#license-and-feature-gating)).

### 3. Agency-specific billing, not generic product inventory

Unlike a retail/inventory ERP, Sordi's `products` catalogue is a **service catalogue**. The billing "units" and structures reflect how a marketing/digital agency actually prices work, not stock-keeping units:

- **Forfait** (flat package price for a defined deliverable),
- **Projet** (a one-off project engagement),
- **TJM / Jour** (day rate — *Taux Journalier Moyen*, billing by the day, the classic freelance/agency consulting unit),
- **Abonnement Mensuel** (recurring monthly retainer/subscription).

This shapes the whole data model: `projects` link to `contracts` and to `invoices` (via `assign_invoice_to_project`), freelancer/subcontractor payments are tracked per project (`freelance_payments`), and project profitability (`get_project_profitability`) nets out both agency revenue and pass-through freelancer costs — none of which makes sense for a business selling physical goods off a shelf.

## Core business domains

| Domain | What it covers | Key tables / concepts |
|---|---|---|
| **Clients** | Client directory with full Algerian legal identity fields, credit limits, payment terms, activity sector, city/wilaya | `clients` |
| **Suppliers (Fournisseurs)** | Vendors the agency buys from; purchase totals tracked separately from expenses | `suppliers` |
| **Invoices / Quotes / Credit Notes / Proformas** | The whole `invoices` table is one polymorphic document type family, discriminated by `invoice_type`: `invoice` (real facture), `proforma` (quote, numbered `PRO-…`, convertible to a real invoice), `credit_note` (avoir, numbered `AV-…`, timbre-exempt) | `invoices`, `invoice_items`, `payments` |
| **Delivery notes (Bons de livraison)** | Goods/services delivered to a client, independent of invoicing timing; can later be batched into an invoice (`generate_invoice_from_delivery_notes`) | `delivery_notes`, `delivery_note_items` |
| **Orders (Commandes)** | Purchase/sales orders tracked through their own lifecycle before becoming deliveries or invoices | `orders`, `order_items` |
| **Projects** | Client engagements the agency runs — tasks, deliverables, linked invoices/contracts, freelancer cost tracking, profitability | `projects`, `project_tasks`, `project_deliverables` |
| **Contracts** | Formal client agreements tied to a project, with a **multi-tranche milestone payment schedule** (see below) | `contracts` |
| **Expenses (Charges)** | Business costs, optionally attributed to a specific project and a monthly period, for margin/profitability reporting | `expenses` |
| **Suppliers & purchases** | Vendor spend tracked distinctly from operating expenses | `suppliers`, purchase totals aggregation |
| **Payroll (Paie / Bulletin de paie)** | Employee records, punch-clock (pointeuse) imports, monthly payroll runs, salary advances | `employees`, `punch_records`, `payroll_runs`, `employee_advances` |
| **Partners / Withdrawals (Associés & Dividendes)** | Business partners/associates and their profit withdrawals — relevant to an EURL/SARL's internal capital accounting | `partners`, `partner_withdrawals` |
| **Multi-company workspaces** | One installation, several independent company profiles, each with isolated data and its own invoice numbering | `companies`, `company_id` foreign key present on nearly every business table |

### Contracts and the milestone payment system

Contracts are Sordi's mechanism for formal, multi-invoice client engagements. A contract (`contracts` table) belongs to a client and, optionally, a project, and carries:

- `selected_services` — a JSON array of the service-catalogue items (Forfait/Projet/TJM/Abonnement lines) the contract covers,
- `payment_split` — the milestone structure, e.g. `"50_50"` (half up front, half on delivery) or a finer multi-tranche split,
- `total_amount_ht` / `tva_amount` / `total_amount_ttc` — the contract's total value, computed the same TVA-aware way as an invoice,
- `invoices_json` — a JSON array referencing the individual invoices generated against each milestone/tranche of the contract.

Contracts get a distinct, human-readable reference number generated per company per year — `OM-CTR-{year}-{seq}` (see `next_contract_ref()` in `commands.rs`) — separate from the invoice numbering sequence, since contracts are comparatively low-volume documents.

## Multi-company workspaces & projects

The `WorkspaceProvider` (`apps/desktop/src/hooks/useWorkspace.tsx`) is the frontend mechanism for multi-company support: it holds the currently active `company_id` (persisted to `localStorage`), and every domain hook (`useClients`, `useInvoices`, etc.) scopes its TanStack Query key and its create/update calls to that active company. Switching companies invalidates the entire React Query cache in one call, guaranteeing no cross-workspace data ever lingers on screen. On the backend, nearly every business table carries a `company_id` foreign key back to `companies`, so data isolation between workspaces is enforced at the SQL level, not just in the UI.

## License & feature gating

Sordi ships a lightweight, offline-tolerant license system (`apps/desktop/src-tauri/src/license.rs`), server-verified by `apps/api`'s license routes using signed JWT-style tokens (Ed25519/EdDSA). Every state-mutating Tauri command (creating/editing an invoice, client, contract, etc.) calls `require_active_license()` as its first line; a lapsed or unactivated license blocks writes while still allowing viewing and exporting existing data — read access is never gated. This repository's `omada-agency` branch adds one addition on top of that: a Cargo feature flag, `omada_bypass`, that short-circuits `require_active_license()` to always succeed. It is off by default in a normal build and only takes effect when explicitly passed at build/dev time (`cargo build --features omada_bypass`, or via the `tauri:dev`/`tauri:build` npm scripts, which already include the flag) — meaning Omada Agency's own build of the app never hits the commercial license gate that a customer-facing Sordi build would. See `LICENSING.md` at the repo root for the broader licensing design.

## Why "agency-specific" matters architecturally

Because the product is scoped to a services business rather than a goods business, several design choices follow directly:
- No stock/quantity-on-hand tracking anywhere in the schema — `products` are billable line-item templates (name, code, default unit price, unit), not inventory-managed SKUs.
- Revenue and profitability reporting (`get_dashboard_stats`, `get_project_profitability`, `get_client_overview_stats`) are built around HT/TTC/TVA/timbre financial cuts and per-project/per-client cumulative views, not units-sold-by-SKU.
- Payroll and freelancer-payment tracking sit alongside client billing as first-class citizens, because for an agency, staff and subcontractor cost is the dominant cost driver — not cost-of-goods-sold.
- Partner withdrawals are modeled explicitly, reflecting that this is a small, closely-held company (EURL) where owner/associate profit-taking is a routine, trackable business event rather than an edge case.

## Related documents

- [`docs/architecture/`](./architecture/) — technical architecture, full command/schema reference, data-flow walkthroughs.
- [`docs/ui-ux/`](./ui-ux/) — screen-by-screen UI/UX documentation and design language.
- [`docs/design-system/`](./design-system/) — the `@sordi/ui` component catalogue.
- [`docs/showcase/`](./showcase/) — screenshot capture attempt and results.
