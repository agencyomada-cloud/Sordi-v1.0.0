# 📊 Project State & Deep Technical Audit Report
**Project Name:** Mobino Accounting / Omada Invoicing  
**Version:** 4.0.0  
**Repository:** `mobinov3-main`  
**Date:** August 10, 2026  
**Target Market:** Algeria / North Africa (SME Commercial, Trading & Industrial Enterprises)  

---

## Executive Summary

**Mobino Accounting (v4.0.0)** is an offline-first, high-performance hybrid SaaS and native Desktop ERP/Accounting solution. It is specifically designed to meet **2025 Algerian Financial, Tax & Commercial Regulations**, bridging the gap between generic Western accounting software (which lacks local compliance) and local business needs.

The application operates as a standalone Tauri desktop application with an embedded Rust-powered SQLite database, coupled with a modern React/TypeScript user interface.

---

## 📐 Technology Stack & Systems Architecture

| Layer | Technology | Status / Role |
| :--- | :--- | :--- |
| **Desktop Core Runtime** | **Tauri 2.9** + **Rust** | Zero-latency native desktop wrapper with system FFI and process control |
| **Database & Storage** | **SQLite** (`rusqlite`) | Embedded relational DB delivering 100% offline persistence (`database.sqlite`) |
| **Frontend Framework** | **React 18.3** + **TypeScript 5.8** | Strongly-typed single page web client architecture |
| **Build System & Tooling**| **Vite 5.4** + `@vitejs/plugin-react-swc` | SWC-compiled lightning-fast bundler |
| **Styling & Components** | **Tailwind CSS 3.4** + **Shadcn UI / Radix UI** | Modern dark/light responsive interface |
| **Typography & Icons** | **Space Grotesk** + **Lucide React** | Modern financial & tabular typography |
| **State & Async Caching** | **TanStack React Query v5.83** | Async query management, mutation pipelines, local cache synchronization |
| **Forms & Validation** | **React Hook Form 7.61** + **Zod 3.25** | Form state tracking and schema-based legal validation |
| **Document Generation** | `jspdf` + `html2canvas` + **PDF Web Worker** | Client-side & background web worker PDF engine for commercial invoices/slips |
| **Data Interoperability** | **SheetJS (`xlsx`)** + **Python (`pandas`)** | Excel importer/exporter for legacy accounting ledgers |
| **Mobile Target Platform**| **Tauri Android scripts** | Pre-configured shell scripts for cross-compilation to Android (aarch64, armv7) |

---

## 🛠️ Functional Modules Analysis

```
                       ┌──────────────────────────────────────────┐
                       │          Mobino Accounting v4.0.0         │
                       └────────────────────┬─────────────────────┘
                                            │
        ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
        ▼                   ▼                               ▼                   ▼
┌──────────────┐    ┌──────────────┐                ┌──────────────┐    ┌──────────────┐
│  Commercial  │    │ CRM & Ledger │                │ Logistical   │    │  Production  │
│   Workflow   │    │  Management  │                │ & Inventory  │    │ & Management │
└───────┬──────┘    └───────┬──────┘                └───────┬──────┘    └───────┬──────┘
        │                   │                               │                   │
        ├─ Proformas        ├─ Client Ledger                ├─ Deliveries (BL)  ├─ Raw Extraction
        ├─ Invoices (Fact)  ├─ Debit/Credit Balance         ├─ Vehicle & NIN    ├─ Output Yield
        ├─ Credit Notes     ├─ Advances & Check Receipts    ├─ Orders (BC)      ├─ HR & Scores
        └─ Custom Titles    └─ Secondary RC/Address         └─ Product Catalog  └─ Expense Ledger
```

### 1. Sales & Commercial Document Pipeline
- **Proforma Invoices (`NewProforma.tsx`)**: Price estimation and quotation workflows.
- **Purchase Orders (`Orders.tsx`, `NewOrder.tsx`)**: Commitment tracking between buyers and suppliers.
- **Delivery Slips (`Deliveries.tsx`, `NewDelivery.tsx`)**: Logistics tracking driver details, NIN/CNI numbers, vehicle registration numbers, and destination sites.
- **Invoices (`Invoices.tsx`, `NewInvoice.tsx`)**: Full legal invoice issuing, partial payment linkage, custom title override, secondary RC assignment.
- **Credit Notes (`NewCreditNote.tsx`)**: Sequential `AV-XXX` numbering linked directly to parent invoices for commercial returns and adjustments.

### 2. Client CRM & Financial Ledger
- Real-time tracking of **Invoiced Total**, **Payments Collected**, and **Outstanding Receivables**.
- **Client Advances Ledger (`useClientAdvances.ts`)**: Manage upfront payments, bank check numbers, check deposit dates, and bank names.
- **Dual Commercial Register Support**: Ability to attach secondary address and secondary Register of Commerce (RC) per client or invoice.

### 3. Regulatory & Fiscal Compliance (2025 Algerian Law)
- **Tax Identification Metadata**: Enforces validation for **NIF** (*Numéro d'Identification Fiscale*), **NIS** (*Numéro d'Identification Statistique*), **RC** (*Registre du Commerce*), and **AI** (*Article d'Imposition*).
- **Progressive Droit de Timbre (Stamp Duty)**:
  - Total <= 30,000 DA: **1%**
  - 30,001 DA – 100,000 DA: **1.5%**
  - Total > 100,000 DA: **2%** (Minimum fee: 5 DA).
- **Dynamic TVA (VAT)**: Supports 19% standard, 9% reduced, and 0% tax-exempt modes with legal exemption notices.
- **Spelling Numbers to Words**: Automated transformation of legal financial totals into words in French (`numberToWords.ts`).

### 4. Treasury, Expenses & Production
- **Treasury Register (`Expenses.tsx`)**: Operating expense tracking affecting net cash flow calculations.
- **Industrial Log (`production` schema)**: Extraction logs, waste ratio tracking, and net merchantable production statistics.
- **HR & Management Matrix (`src/pages/management`)**: Employee records (`Employees.tsx`), project tracking (`Projects.tsx`), and scorecards (`Score.tsx`).

---

## 🔍 Code Health & Technical Quality Audit

### 1. TypeScript Strictness (`tsc --noEmit`)
- **Status:** **PASSING (0 Errors)**
- All imports, module references, and component props compile cleanly without missing type declarations or broken signatures.

### 2. ESLint Diagnostics
- **Status:** **192 Problems Detected (178 Errors, 14 Warnings)**
- **Main Findings:**
  - High frequency of `@typescript-eslint/no-explicit-any` errors in form components (`NewInvoice.tsx`, `NewOrder.tsx`, `NewProforma.tsx`, `Payments.tsx`) and web worker (`pdf.worker.ts`).
  - Missing dependencies in `useEffect` and `useMemo` hooks (`react-hooks/exhaustive-deps`).
  - CommonJS `require()` usage in `tailwind.config.ts` (`@typescript-eslint/no-require-imports`).
  - Mutable `let` declarations that are never reassigned (`prefer-const`).

### 3. Storage & Data Access Architecture
- **Desktop (Tauri)**: Synchronous high-speed Rust-to-SQLite operations via `invoke()`.
- **Web Fallback**: Web-compatible state handlers allowing in-browser preview without crashing.

---

## ⚠️ Risks, Bottlenecks & Technical Debt

1. **Explicit `any` Usage:** Extensive loose typing in complex financial calculations risks runtime null/undefined errors during edge-case form edits.
2. **Hook Dependency Safety:** Stale closure risks in `NewInvoice.tsx` and `NewOrder.tsx` due to missing reactive state dependencies.
3. **Canvas PDF Generation Overhead:** Client-side HTML canvas rendering can lead to high memory consumption on large multi-page invoice outputs.
4. **Single-User Local Storage:** DB operations are currently localized to single device SQLite instances; multi-user real-time sync is not yet enabled.

---

## 🚀 Recommended Action Plan & Future Roadmap

### Short-Term Fixes (Technical Maintenance)
1. **Type Hardening:** Replace all 178 `any` lint errors with strong Zod / TypeScript interfaces.
2. **React Hook Cleanup:** Pass necessary reactive dependencies (`draftData`, `headerNote`) to `useEffect` / `useMemo` hooks across pages.
3. **Lint Rule Fixes:** Replace `require()` in `tailwind.config.ts` with standard ESM imports.

### Mid-Term Goals (Product Enhancement)
1. **Hybrid Cloud Sync:** Implement optional Postgres / Supabase database sync to allow multi-device operational access.
2. **Android Mobile Companion Build:** Complete testing of `build_android.sh` to produce an APK for on-site delivery drivers.
3. **Automated Tax Reporting (G50 Export):** Add automated monthly G50 tax summary reports for Algerian corporate tax submission.
