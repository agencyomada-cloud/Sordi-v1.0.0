# End-to-End Data Flow Walkthroughs

Three concrete flows traced through the real code, from the UI action to the SQLite write and back.

## Flow 1: Creating an invoice

**UI**: `apps/desktop/src/pages/NewInvoice.tsx`, submitting the invoice builder form.

1. **Frontend form submit** — `NewInvoice.tsx` collects client, line items, dates, discount, and payment method into a `CreateInvoiceData` shape. Before submission it already runs a client-side `calculateTotals()` for the live preview (mirroring the Algerian tax rules — TVA per item, timbre only for cash payments), but this is a UI convenience only; the authoritative calculation happens in Rust after the write.
2. **`useCreateInvoice()`** (`src/hooks/useInvoices.ts`) is the mutation hook the form calls:
   ```ts
   mutationFn: async (data: CreateInvoiceData) => {
     const validated = createInvoiceSchema.parse(data);   // Zod validation
     return await db.invoices.create({ ...validated, company_id: activeCompanyId });
   }
   ```
   `activeCompanyId` comes from `useWorkspace()` — the invoice is always stamped with the currently active company workspace, not something the form itself has to track.
3. **`db.invoices.create()`** (`src/lib/database.ts`) calls `safeInvoke("create_invoice", data)`, which — inside the real Tauri app — resolves to `invoke("create_invoice", data)` from `@tauri-apps/api/core`. This serializes the JS object to JSON and sends it across the Tauri IPC bridge to the Rust side.
4. **`create_invoice` Tauri command** (`apps/desktop/src-tauri/src/commands.rs:1451`) runs, in order:
   - `crate::license::require_active_license()?` — the license gate; on this branch this is a no-op due to the `omada_bypass` feature (see [`backend.md`](./backend.md#license--feature-gating)).
   - Generates a UUID `invoice_id` and an invoice number via `generate_invoice_number(&conn)` (reading and incrementing the `sequences` table), unless the caller supplied a manual number, in which case it syncs the sequence to that value instead so future auto-numbers don't collide.
   - Applies type-specific number formatting: credit notes get prefixed `AV-<n>`, proformas get a timestamp-based `PRO-<ts>` number instead of the sequence at all.
   - Opens a SQL transaction, `INSERT`s the `invoices` row, then loops over `data.items` inserting one `invoice_items` row per line (computing `amount = quantity * unit_price` per line as it goes).
   - Calls `recalculate_invoice_totals(&tx, &invoice_id)` (`database.rs:2096`) — this is where the **real** tax math happens: it re-reads every item's `tva_rate`/`timbre_exempt`, computes `raw_subtotal_ht`, applies the invoice's discount, sums per-item TVA (`item_amount_ht * rate / 100`), and computes the timbre base as gross HT+TVA for every non-exempt item. Timbre is applied via `calculate_timbre()` (`database.rs:2242`, the 1%/1.5%/2% tiered calculation with a 5 DA floor) **only if** the invoice is not a credit note **and** the payment method is cash — otherwise timbre is forced to 0. The final `total_ttc = subtotal_ht + tva + timbre` is written back onto the `invoices` row, along with `balance_due` derived from `amount_paid`.
   - Commits the transaction.
   - Calls `log_activity(&conn, "CREATE", "INVOICE", ...)`, inserting an `activity_logs` row.
   - Re-fetches the just-created invoice via `get_invoice()` and returns it.
5. **Response round-trip**: the Rust `Result<Invoice, String>` becomes a resolved (or rejected) JS promise back at the `invoke()` call site. `db.invoices.create()` returns that `Invoice` object to `useCreateInvoice`'s `mutationFn`.
6. **`onSuccess`**: React Query's mutation success handler invalidates the `["invoices"]`, `["dashboard-stats"]`, and `["activity_logs"]` query keys (and `["client-products", invoice.client_id]` if a client is set), calls `db.history.log(...)` to also write a *frontend-observed* activity entry (distinct from the Rust-side `log_activity` call — both exist, serving the same History feed from two ends of the same action), and shows a `sonner` success toast ("Facture créée avec succès").
7. **UI update**: because `["invoices"]` and `["dashboard-stats"]` were invalidated, every mounted component subscribed to those query keys (the Invoices list, the Dashboard's KPI tiles and receivables table) automatically refetches and re-renders with the new invoice reflected — no manual cache-poking or prop drilling required.

## Flow 2: Creating a contract with milestone payments

**UI**: the "Nouveau Contrat" modal opened from `apps/desktop/src/pages/Contracts.tsx` or `ProjectDetail.tsx`.

1. The contract modal lets the user pick a client (and optionally a project), select one or more services from the catalogue (Forfait/Projet/TJM/Abonnement lines), and choose a `payment_split` — typically `"50_50"` (an upfront "Acompte" invoice plus a "Solde" invoice on delivery), though the schema supports arbitrary split identifiers for a finer multi-tranche structure. The modal computes `total_amount_ht`, `tva_amount` (at the standard 19% unless overridden), and `total_amount_ttc` for the full contract value, and builds an `invoices` array describing each milestone's invoice reference/amount.
2. **`useCreateContract()`** (`src/hooks/useContracts.ts`) calls `db.contracts.create(data)` → `safeInvoke("create_contract", data)` → the `create_contract` Tauri command.
3. **`create_contract`** (`commands.rs:6230`):
   - Calls `require_active_license()?`.
   - Computes a human-readable reference number via `next_contract_ref(&conn, &data.company_id, now.year())` — this does **not** use the shared `sequences` table; instead it runs `SELECT COUNT(*) FROM contracts WHERE company_id = ?1 AND contract_ref LIKE 'OM-CTR-{year}-%'` inside the same connection and formats the next value as `OM-CTR-{year}-{seq:03}`. The code comment explains this deliberate choice: contracts are low-volume enough that a simple count-based approach, computed inside the same transaction as the insert (so two concurrent creates can't collide), is simpler than extending the sequence-counter infrastructure for a twelfth document type.
   - Serializes `selected_services` and the `invoices` array to JSON strings (`selected_services`, `invoices_json` columns) and inserts the `contracts` row.
   - Logs the action via `log_activity(&conn, "CREATE", "CONTRACT", ...)`.
   - Re-fetches and returns the created `Contract` (via `map_contract_row`, which deserializes those two JSON columns back into structured data for the response).
4. Separately from `create_contract` itself, the milestone invoices referenced in `invoices_json` are created as ordinary invoices through the **same `create_invoice` flow described above** (each carrying its own share of the contract total, typically flagged with a note/header identifying it as an Acompte or Solde against the contract) — `create_contract` only persists the contract record and its manifest of linked invoice references; it is the calling UI code that orchestrates creating those invoices (before or alongside the contract row, depending on the modal's exact flow) and assembling the `invoices` array passed in.
5. **`onSuccess`** in `useCreateContract()` invalidates `["contracts"]`, so the Contracts list and any `ProjectDetail`'s "Factures liées"/contract section pick up the new record on next render.

## Flow 3: Factory reset

**UI**: Settings page, the destructive "reset to factory state" action, behind a typed-confirmation dialog.

1. **`useResetToFactoryState()`** (`src/hooks/useSystemReset.ts`) calls `db.system.resetToFactoryState(companyId)` → `safeInvoke("reset_company_to_factory_state", { company_id })` → the `reset_company_to_factory_state` Tauri command.
2. **`reset_company_to_factory_state`** (`commands.rs:263`):
   - `require_active_license()?`.
   - Opens one transaction and, for each of `payments, delivery_notes, contracts, invoices, projects, orders, expenses, clients, suppliers`, runs `DELETE FROM <table> WHERE company_id = ?1` — scoped strictly to the company being reset, leaving other workspaces in the same database file untouched.
   - `activity_logs` is deleted **without** a `company_id` filter — a deliberate, code-commented exception, because that table predates multi-company support and has no `company_id` column at all. Resetting one company's data therefore clears the *entire* shared activity log across every workspace in the installation; the comment flags this as acceptable for now (effectively single-company usage in practice) and something to revisit if per-company activity scoping is ever added.
   - Resets the `sequences` table's `invoice_number`, `delivery_note_number`, and `order_number` counters back to 0 for a clean numbering restart.
   - `UPDATE`s the `companies` row for that company, blanking every fiscal/profile field (name, logo, RC/NIF/NIS/AI, address, contact info, etc.) back to neutral placeholders (`name` becomes `'Ma Société'` since the column is `NOT NULL` and can't be blank). The code comment notes this line exists specifically because earlier versions of the reset only cleared the transactional tables above and left the company's own identity fields (and old NIF/NIS/RC/logo) intact — meaning a "factory reset" didn't actually look like a fresh install, since that data lives directly on the `companies` row rather than in any of the deletable child tables.
   - Deletes a fixed list of branding/asset keys from the global `settings` key-value table (`logo_data`, `stamp_data`, `signature_data`, `footer_logo_data`, `body_pattern_data`, `qr_code_data`, and the legacy `company_*` mirror keys) — again called out in-code as necessary because `settings` is not scoped by `company_id` at all, so nothing in the per-company DELETEs above would have touched it.
   - Re-inserts a handful of settings back to their defaults (`primary_color`, `logo_bg_color`, `logo_text_color`, `logo_size`, `company_info_size`, `stamp_size`, `signature_size`) via `INSERT ... ON CONFLICT DO UPDATE`, so the UI doesn't end up with missing/`undefined` values for controls that expect a value to always be present.
   - Commits the transaction.
3. **`onSuccess`**: `useResetToFactoryState()` calls a blanket `queryClient.invalidateQueries()` (no query key — invalidate everything), the same pattern `useWorkspace`'s `switchCompany` uses, since a factory reset touches essentially every domain in the app at once and enumerating each affected query key individually would be error-prone and easy to leave incomplete as new features are added.
4. **UI update**: every page currently mounted refetches its data on the next render pass — the Dashboard shows zeroed KPIs, the Clients/Invoices/Suppliers lists go empty, and Settings' company-identity fields revert to their blank/placeholder state, all without a full app reload.

This flow is a good illustration of a recurring theme in the codebase's own commit history/comments: **data that looks similar from the UI (all "company configuration") can live in structurally different places** (a `company_id`-scoped row in a business table, vs. a field on the `companies` row itself, vs. a key in the global un-scoped `settings` table), and a cross-cutting operation like a full reset has to explicitly account for all three rather than assuming one `DELETE ... WHERE company_id = ?` pass covers everything.
