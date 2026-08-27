# Sordi Documentation

This folder documents **Sordi**, the offline-first Algerian ERP/invoicing desktop app built for **Omada Agency** (a marketing & digital solutions agency in Sétif, Algeria). It was written by reading the actual source code in this repository — real Tauri commands, real SQL schema, real React components — rather than describing the product in the abstract.

## Where to start

| Document | Covers |
|---|---|
| [`00-overview.md`](./00-overview.md) | What Sordi is, who it's for, the business problem it solves (Algerian tax compliance, offline-first operation, agency-specific billing), and the core business domains it manages. **Start here.** |

## Architecture — `architecture/`

Deep technical reference, grounded in the real Rust/TypeScript code.

| Document | Covers |
|---|---|
| [`00-stack-overview.md`](./architecture/00-stack-overview.md) | The pnpm workspace layout, and the full technology stack for `apps/desktop`, `apps/api`, and `packages/ui`. |
| [`frontend.md`](./architecture/frontend.md) | Page routing, the hooks-layer pattern, the `db`/`safeInvoke` abstraction, multi-company workspace context, the dual PDF generation pipeline, i18n. |
| [`backend.md`](./architecture/backend.md) | The Tauri command pattern, database initialization/migrations, the license/feature-gating system (including the `omada_bypass` Cargo feature), and document-numbering sequences. |
| [`data-flows.md`](./architecture/data-flows.md) | Three full end-to-end traces: creating an invoice, creating a contract with milestone payments, and the factory-reset flow — from UI click to SQL write and back. |
| [`command-reference.md`](./architecture/command-reference.md) | Every one of the 151 `#[tauri::command]` functions, grouped by domain, with signatures and descriptions. |
| [`schema-reference.md`](./architecture/schema-reference.md) | Every SQLite table (31 tables), their final columns/types/constraints, and foreign key relationships, plus how the document-numbering sequence system works. |
| [`hooks-reference.md`](./architecture/hooks-reference.md) | Every file in `src/hooks/` (36 hooks), one line each on what it manages and which query/mutation hooks it exposes. |

## UI/UX — `ui-ux/`

| Document | Covers |
|---|---|
| [`pages.md`](./ui-ux/pages.md) | Screen-by-screen descriptions of the app's pages — Dashboard, Invoices, Contracts, Clients, Settings, Auth, Projects, Payroll, Partners, and the rest — read directly from the page components. |
| [`design-language.md`](./ui-ux/design-language.md) | Brand colors (the "Crimson/Coral Red" `#EB3B48` accent), light/dark theme tokens, typography, and the sidebar's navigation groups/structure — all sourced from `index.css` and `Sidebar.tsx`. |

## Design system — `design-system/`

| Document | Covers |
|---|---|
| [`component-catalogue.md`](./design-system/component-catalogue.md) | Every component in the shared `@sordi/ui` package (49 files) — what it's for, and its real variant/prop values read from source. |

## Showcase — `showcase/`

| Document | Covers |
|---|---|
| [`README.md`](./showcase/README.md) | Real sample PDFs (an invoice and a full milestone contract) rendered directly from the app's actual `InvoicePDFDocument`/`ContractPDFDocument` components — plus the live-app screenshot attempt: what was tried, why it wasn't possible in this environment (no macOS Screen Recording/Accessibility permission granted, no existing GUI automation harness), and where to look instead for accurate written descriptions of every screen. |
| [`pdfs/`](./showcase/pdfs/) | The rendered sample PDFs themselves — `sample-invoice.pdf`, `sample-contract.pdf`. |
| [`screenshots/`](./showcase/screenshots/) | PNG previews of the sample PDFs' pages. |

## Scope note

This branch (`omada-agency`) layers agency-specific features — Projects, Contracts, Payroll, Partners, Project Tasks/Deliverables — on top of a base Sordi ERP product, and also bypasses the commercial license gate for Omada Agency's own use via the `omada_bypass` Cargo feature. Both are called out explicitly wherever relevant throughout this documentation rather than presented as if they were universal, always-on product behavior.
