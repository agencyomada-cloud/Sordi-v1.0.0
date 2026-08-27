# Full SQLite Schema Reference

This reflects the **final/current shape** of each table in `apps/desktop/src-tauri/src/database.rs`, after all `ALTER TABLE` migrations and `_new`-table recreations are applied — not the original `CREATE TABLE` statement in isolation. `PRAGMA foreign_keys = ON` is set on every connection (see `init_database()`).

## companies

Multi-workspace root: one row per registered company/business identity, each with its own fiscal info and invoice numbering prefix. All business tables carry a `company_id` FK back to this table for data isolation.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| name | TEXT | NOT NULL |
| logo_base64 | TEXT | |
| activity | TEXT | |
| rc | TEXT | Registre de commerce |
| nif | TEXT | |
| nis | TEXT | |
| article_imposition | TEXT | |
| address | TEXT | |
| phone | TEXT | |
| phones | TEXT | added via migration |
| email | TEXT | |
| website | TEXT | added via migration |
| capital | TEXT | added via migration |
| rib | TEXT | added via migration |
| bank_agency | TEXT | added via migration |
| extra_info | TEXT | added via migration |
| cnas_adherent | TEXT | added via migration |
| currency | TEXT | NOT NULL, DEFAULT 'DZD' |
| invoice_prefix | TEXT | NOT NULL, DEFAULT 'FAC-2026-' |
| created_at | TEXT | NOT NULL |

FK relationships: none (root table).

## clients

Customer records used across invoices, orders, delivery notes, and projects.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| code | TEXT | |
| name | TEXT | NOT NULL |
| contact_person | TEXT | |
| phone | TEXT | |
| email | TEXT | |
| address | TEXT | |
| city | TEXT | |
| wilaya | TEXT | |
| nif | TEXT | |
| nis | TEXT | |
| rc | TEXT | |
| secondary_rc | TEXT | added via migration |
| secondary_address | TEXT | added via migration |
| ai | TEXT | Article d'imposition |
| activite | TEXT | added via migration |
| credit_limit | REAL | |
| payment_terms_days | INTEGER | |
| notes | TEXT | |
| is_active | INTEGER | DEFAULT 1 |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| initial_balance | REAL | added via migration, DEFAULT 0 |
| advance_payment | REAL | added via migration, DEFAULT 0 |
| company_id | TEXT | REFERENCES companies(id) |

FK relationships: `company_id` → `companies(id)`.

## suppliers

Vendor/supplier records used by expenses and purchase orders.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| name | TEXT | NOT NULL |
| category | TEXT | |
| phone | TEXT | |
| email | TEXT | |
| address | TEXT | |
| city | TEXT | |
| rc | TEXT | |
| nif | TEXT | |
| nis | TEXT | |
| solde_du | REAL | DEFAULT 0 (amount owed) |
| notes | TEXT | |
| is_active | INTEGER | DEFAULT 1 |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| company_id | TEXT | REFERENCES companies(id) |

FK relationships: `company_id` → `companies(id)`.

## products

Product/service catalog used as line items across invoices, orders, and delivery notes. In this agency context these are typically service SKUs (Forfait/Projet/TJM/Abonnement) rather than physical stock.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| code | TEXT | UNIQUE, NOT NULL |
| name | TEXT | NOT NULL |
| description | TEXT | |
| unit | TEXT | DEFAULT 'tonne' |
| unit_price | REAL | NOT NULL, DEFAULT 0 |
| timbre_exempt | INTEGER | added via migration, DEFAULT 0 (boolean) |
| is_active | INTEGER | DEFAULT 1 |
| display_order | INTEGER | DEFAULT 0 |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| tva_rate | REAL | added via migration, DEFAULT 19.0 |
| company_id | TEXT | REFERENCES companies(id) |

FK relationships: `company_id` → `companies(id)`.

## invoices

Sales invoices, credit notes ("avoirs"), and proformas — the central billing document, discriminated by `invoice_type`.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| invoice_number | TEXT | UNIQUE, NOT NULL |
| client_id | TEXT | NOT NULL |
| invoice_date | TEXT | NOT NULL |
| due_date | TEXT | |
| month_period | TEXT | |
| subtotal_ht | REAL | DEFAULT 0 |
| tva_rate | REAL | DEFAULT 19.00 |
| tva_amount | REAL | DEFAULT 0 |
| timbre | REAL | DEFAULT 0 (droit de timbre / stamp duty) |
| total_ttc | REAL | DEFAULT 0 |
| amount_paid | REAL | DEFAULT 0 |
| balance_due | REAL | DEFAULT 0 |
| status | TEXT | DEFAULT 'draft' (draft/issued/paid/partial/overdue/cancelled) |
| invoice_type | TEXT | DEFAULT 'invoice' (invoice / credit_note / proforma) |
| original_invoice_id | TEXT | for credit notes, points to the original invoice (no declared FK constraint) |
| notes | TEXT | |
| header_note | TEXT | added via migration |
| discount | REAL | DEFAULT 0 (legacy discount amount) |
| discount_type | TEXT | DEFAULT 'percent' ('percent' or 'amount') |
| discount_value | REAL | DEFAULT 0 |
| use_secondary_register | BOOLEAN | DEFAULT 0 |
| selected_secondary_rc | TEXT | |
| selected_secondary_address | TEXT | |
| custom_title | TEXT | added via migration |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| project_id | TEXT | added via migration, REFERENCES projects(id) ON DELETE SET NULL |
| payment_method | TEXT | added via migration |
| company_id | TEXT | REFERENCES companies(id) |

FK relationships: `client_id` → `clients(id)`; `project_id` → `projects(id)` ON DELETE SET NULL; `company_id` → `companies(id)`.

## invoice_items

Line items belonging to an invoice; can reference a catalog product or be a free-form custom entry.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| invoice_id | TEXT | NOT NULL |
| product_id | TEXT | nullable (allows custom line items) |
| product_name | TEXT | used when product_id is NULL |
| product_code | TEXT | |
| product_description | TEXT | |
| quantity | REAL | NOT NULL, DEFAULT 0 |
| unit_price | REAL | NOT NULL |
| amount | REAL | |
| tva_rate | REAL | DEFAULT 19.0 |
| timbre_exempt | INTEGER | DEFAULT 0 |
| created_at | TEXT | NOT NULL |

FK relationships: `invoice_id` → `invoices(id)` ON DELETE CASCADE; `product_id` → `products(id)` (nullable).

## payments

Payments recorded against an invoice (cheque, transfer, cash, etc.).

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| invoice_id | TEXT | NOT NULL |
| payment_date | TEXT | NOT NULL |
| amount | REAL | NOT NULL |
| payment_method | TEXT | |
| cheque_number | TEXT | |
| bank_name | TEXT | |
| value_date | TEXT | |
| notes | TEXT | |
| created_at | TEXT | NOT NULL |
| employee_id | TEXT | "Encaissé par" — who collected the payment, REFERENCES employees(id) |
| company_id | TEXT | REFERENCES companies(id) |

FK relationships: `invoice_id` → `invoices(id)`; `employee_id` → `employees(id)`; `company_id` → `companies(id)`.

## client_draft_products

Per-client saved/draft product lines (a quick-add list for a given client), reused when building new invoices.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| client_id | TEXT | NOT NULL |
| product_id | TEXT | NOT NULL |
| product_description | TEXT | |
| quantity | REAL | NOT NULL, DEFAULT 0 |
| unit_price | REAL | NOT NULL |
| amount | REAL | NOT NULL |
| created_at | TEXT | NOT NULL |

FK relationships: `client_id` → `clients(id)` ON DELETE CASCADE; `product_id` → `products(id)`.

## client_advances

Advance payments received from a client ahead of invoicing.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| client_id | TEXT | NOT NULL |
| amount | REAL | NOT NULL |
| date | TEXT | NOT NULL |
| payment_mode | TEXT | NOT NULL |
| reference | TEXT | |
| bank | TEXT | |
| issuer_name | TEXT | |
| notes | TEXT | |
| created_at | TEXT | NOT NULL |

FK relationships: `client_id` → `clients(id)` ON DELETE CASCADE.

## orders

Purchase/sales orders ("bons de commande"); `client_id` is nullable and supplier fields support supplier-facing orders. (Historically recreated once as `orders_new`/renamed to relax `client_id` and add payment fields — shape below is final.)

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| order_number | TEXT | UNIQUE, NOT NULL |
| client_id | TEXT | nullable |
| supplier_name | TEXT | |
| order_date | TEXT | NOT NULL |
| delivery_date | TEXT | |
| payment_terms | TEXT | |
| payment_method | TEXT | |
| status | TEXT | DEFAULT 'draft' |
| subtotal_ht | REAL | DEFAULT 0 |
| tva_rate | REAL | DEFAULT 19.0 |
| tva_amount | REAL | DEFAULT 0 |
| total_ttc | REAL | DEFAULT 0 |
| notes | TEXT | |
| month_period | TEXT | |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| custom_title | TEXT | |
| supplier_address | TEXT | |
| supplier_email | TEXT | |
| supplier_phone | TEXT | |
| supplier_rc | TEXT | |
| supplier_nif | TEXT | |
| supplier_nis | TEXT | |
| supplier_ai | TEXT | |
| company_id | TEXT | REFERENCES companies(id) |

FK relationships: `client_id` → `clients(id)` (implicit, no declared SQL constraint); `company_id` → `companies(id)`.

## order_items

Line items belonging to an order; product reference is nullable to allow custom/free-text lines. (Also historically recreated once as `order_items_new`/renamed — shape below is final.)

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| order_id | TEXT | NOT NULL |
| product_id | TEXT | nullable |
| product_name | TEXT | |
| product_code | TEXT | |
| product_description | TEXT | |
| quantity | REAL | NOT NULL, DEFAULT 0 |
| unit_price | REAL | NOT NULL |
| tva_rate | REAL | DEFAULT 19.0 |
| amount | REAL | |
| created_at | TEXT | NOT NULL |

FK relationships: `order_id` → `orders(id)` ON DELETE CASCADE.

## delivery_notes

Delivery notes ("bons de livraison") tracking goods/services delivered to a client, optionally linked to an order and/or invoice.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| delivery_number | TEXT | UNIQUE, NOT NULL |
| client_id | TEXT | NOT NULL |
| delivery_date | TEXT | NOT NULL |
| invoice_id | TEXT | nullable |
| order_id | TEXT | nullable |
| truck_plate | TEXT | |
| driver_name | TEXT | |
| deliverer_name | TEXT | |
| deliverer_nin | TEXT | |
| transporter_name | TEXT | |
| transporter_nin | TEXT | |
| delivery_location | TEXT | |
| client_received_date | TEXT | |
| client_signature | TEXT | |
| supplier_delivered_date | TEXT | |
| is_invoiced | INTEGER | DEFAULT 0 |
| notes | TEXT | |
| reserves | TEXT | |
| status | TEXT | NOT NULL, DEFAULT 'draft' |
| signed_at | TEXT | |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| custom_title | TEXT | |
| company_id | TEXT | REFERENCES companies(id) |

FK relationships: `client_id` → `clients(id)`; `invoice_id` → `invoices(id)`; `order_id` → `orders(id)`; `company_id` → `companies(id)`.

## delivery_note_items

Line items belonging to a delivery note; product reference is nullable to allow custom lines. (Also historically recreated once as `delivery_note_items_new`/renamed — shape below is final.)

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| delivery_note_id | TEXT | NOT NULL |
| product_id | TEXT | nullable |
| product_name | TEXT | |
| product_code | TEXT | |
| product_description | TEXT | |
| quantity | REAL | NOT NULL, DEFAULT 0 |
| unit_price | REAL | nullable |
| tva_rate | REAL | DEFAULT 19.0 |
| created_at | TEXT | NOT NULL |

FK relationships: `delivery_note_id` → `delivery_notes(id)` ON DELETE CASCADE; `product_id` → `products(id)` (nullable).

## expenses

General business expenses/outflows (Charges), optionally linked to a project and/or supplier, with optional recurrence metadata.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| expense_date | TEXT | NOT NULL |
| category | TEXT | NOT NULL |
| description | TEXT | |
| amount | REAL | NOT NULL |
| payment_method | TEXT | |
| reference | TEXT | |
| notes | TEXT | |
| month_period | TEXT | |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| project_id | TEXT | REFERENCES projects(id) ON DELETE SET NULL |
| is_recurring | INTEGER | DEFAULT 0 |
| recurrence_interval | TEXT | |
| supplier_id | TEXT | REFERENCES suppliers(id) ON DELETE SET NULL |
| company_id | TEXT | REFERENCES companies(id) |

FK relationships: `project_id` → `projects(id)` ON DELETE SET NULL; `supplier_id` → `suppliers(id)` ON DELETE SET NULL; `company_id` → `companies(id)`.

## sequences

Single-row-per-counter table backing the auto-generated document numbering system (see below).

| Column | Type | Constraints/Notes |
|---|---|---|
| name | TEXT | PRIMARY KEY (e.g. `'invoice_number'`, `'delivery_note_number'`, `'order_number'`) |
| value | INTEGER | NOT NULL, DEFAULT 0 |

FK relationships: none.

## production_logs

Daily production tracking (extraction/waste/merchant product volumes) — an operations log, independent of billing.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| date | TEXT | NOT NULL |
| extraction | REAL | DEFAULT 0 |
| waste | REAL | DEFAULT 0 |
| merchant_product | REAL | DEFAULT 0 |
| notes | TEXT | |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

FK relationships: none.

## employees

Staff roster, extended over time with payroll, HR-document, and attendance-import fields.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| name | TEXT | NOT NULL |
| role | TEXT | |
| email | TEXT | |
| phone | TEXT | |
| address | TEXT | |
| is_active | INTEGER | DEFAULT 1 |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| base_salary | REAL | |
| hire_date | TEXT | |
| contract_type | TEXT | |
| rib | TEXT | |
| external_code | TEXT | maps a punch/attendance device's numeric employee ID onto this row |
| photo_path | TEXT | path relative to app_data_dir |
| company_id | TEXT | REFERENCES companies(id) |

FK relationships: `company_id` → `companies(id)`.

## punch_records

Raw attendance/time-clock punches imported from an external device; `employee_id` may be unresolved (NULL) until mapped by `external_code`.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| external_code | TEXT | NOT NULL — raw device employee number, real dedup key |
| employee_id | TEXT | nullable — resolved via `employees.external_code` |
| punch_time | TEXT | NOT NULL |
| created_at | TEXT | NOT NULL |
| — | — | UNIQUE (external_code, punch_time) |

FK relationships: `employee_id` → `employees(id)` ON DELETE SET NULL.

## payroll_runs

One computed payroll result per employee per month.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| employee_id | TEXT | NOT NULL |
| month | TEXT | NOT NULL |
| base_salary | REAL | NOT NULL |
| working_days_in_month | REAL | NOT NULL |
| absence_days | REAL | NOT NULL |
| daily_rate | REAL | NOT NULL |
| absence_deduction | REAL | NOT NULL |
| primes | REAL | DEFAULT 0 |
| avance_deduction | REAL | DEFAULT 0 |
| net_a_payer | REAL | NOT NULL |
| paid | INTEGER | DEFAULT 0 |
| paid_date | TEXT | |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| — | — | UNIQUE (employee_id, month) |

FK relationships: `employee_id` → `employees(id)` ON DELETE CASCADE.

## employee_advances

Salary advances taken by an employee, to be deducted from a future payroll run.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| employee_id | TEXT | NOT NULL |
| amount | REAL | NOT NULL |
| date_taken | TEXT | NOT NULL |
| month_to_deduct | TEXT | NOT NULL |
| deducted | INTEGER | DEFAULT 0 |
| deducted_in_payroll_run_id | TEXT | nullable |
| created_at | TEXT | NOT NULL |

FK relationships: `employee_id` → `employees(id)` ON DELETE CASCADE; `deducted_in_payroll_run_id` → `payroll_runs(id)` ON DELETE SET NULL.

## projects

Client-linked project management unit; can optionally be run by a freelancer with its own payment terms.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| client_id | TEXT | NOT NULL |
| name | TEXT | NOT NULL |
| service_categories | TEXT | NOT NULL |
| responsible_person | TEXT | free text, not linked to employees |
| start_date | TEXT | |
| deadline | TEXT | |
| planned_budget | REAL | DEFAULT 0 |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| freelancer_id | TEXT | REFERENCES employees(id) ON DELETE SET NULL |
| montant_convenu | REAL | agreed lump-sum amount for the freelancer |
| statut_paiement | TEXT | DEFAULT 'non_paye' |
| date_paiement | TEXT | |
| company_id | TEXT | REFERENCES companies(id) |

FK relationships: `client_id` → `clients(id)`; `freelancer_id` → `employees(id)` ON DELETE SET NULL; `company_id` → `companies(id)`.

## project_tasks

Individual tasks/work items within a project, optionally assigned to an employee.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| project_id | TEXT | NOT NULL |
| title | TEXT | NOT NULL |
| assigned_resource_id | TEXT | nullable |
| status | TEXT | NOT NULL, DEFAULT 'à_faire' (à_faire / en_cours / en_revision_interne / envoye_client / approuve) |
| revision_count | INTEGER | NOT NULL, DEFAULT 0 |
| due_date | TEXT | |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

FK relationships: `project_id` → `projects(id)` ON DELETE CASCADE; `assigned_resource_id` → `employees(id)` ON DELETE SET NULL.

## project_deliverables

Files/outputs delivered as part of a project, with client-delivery and approval tracking.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| project_id | TEXT | NOT NULL |
| name | TEXT | NOT NULL |
| type | TEXT | |
| link_or_path | TEXT | |
| delivered_to_client | INTEGER | DEFAULT 0 |
| approved | INTEGER | DEFAULT 0 |
| created_at | TEXT | NOT NULL |

FK relationships: `project_id` → `projects(id)` ON DELETE CASCADE.

## contracts

Bespoke client contracts (typically 50/50 milestone billing, or a finer multi-tranche split), built from a project's Acompte/Solde invoices. Recreated once to relax `project_id` from `NOT NULL` to nullable — shape below is final.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| company_id | TEXT | NOT NULL, REFERENCES companies(id) |
| project_id | TEXT | nullable, REFERENCES projects(id) ON DELETE SET NULL |
| client_id | TEXT | NOT NULL, REFERENCES clients(id) |
| contract_ref | TEXT | NOT NULL, UNIQUE (format `OM-CTR-{year}-{seq}`) |
| selected_services | TEXT | NOT NULL, DEFAULT '[]' (JSON array of service-catalogue lines) |
| payment_split | TEXT | NOT NULL, DEFAULT '50_50' |
| total_amount_ht | REAL | NOT NULL |
| tva_rate | REAL | NOT NULL, DEFAULT 19.0 |
| tva_amount | REAL | NOT NULL |
| total_amount_ttc | REAL | NOT NULL |
| invoices_json | TEXT | NOT NULL (JSON array referencing invoices generated per milestone) |
| created_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

FK relationships: `company_id` → `companies(id)`; `project_id` → `projects(id)` ON DELETE SET NULL; `client_id` → `clients(id)`.

## settings

Generic application key/value configuration store (branding, defaults, embedded assets like logo/stamp/signature images, theme colors).

| Column | Type | Constraints/Notes |
|---|---|---|
| key | TEXT | PRIMARY KEY |
| value | TEXT | NOT NULL |

FK relationships: none.

## activity_logs

Audit trail of user actions across entities, powering the History page.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| action | TEXT | NOT NULL |
| entity_type | TEXT | NOT NULL |
| entity_id | TEXT | nullable |
| description | TEXT | NOT NULL |
| user_id | TEXT | nullable, not declared as FK |
| created_at | TEXT | NOT NULL |

FK relationships: none declared. Note: this table has no `company_id` column (it predates multi-company support), so it is shared/global across all workspaces in one installation — `reset_company_to_factory_state` clears it entirely rather than per-company.

## users

Application login accounts. In practice the app supports a single admin/app-lock user.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| username | TEXT | UNIQUE, NOT NULL |
| password_hash | TEXT | NOT NULL |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

FK relationships: none.

## partners

Business partners/shareholders and their equity split (Associés & Dividendes).

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| name | TEXT | NOT NULL |
| email | TEXT | |
| phone | TEXT | |
| role | TEXT | |
| equity_percentage | REAL | NOT NULL, DEFAULT 0 |
| is_active | INTEGER | NOT NULL, DEFAULT 1 |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |
| company_id | TEXT | REFERENCES companies(id) |

FK relationships: `company_id` → `companies(id)`.

## partner_withdrawals

Cash withdrawals/distributions taken by a partner against their equity share.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| partner_id | TEXT | NOT NULL |
| withdrawal_date | TEXT | NOT NULL |
| amount | REAL | NOT NULL |
| payment_method | TEXT | |
| notes | TEXT | |
| created_at | TEXT | NOT NULL |

FK relationships: `partner_id` → `partners(id)` ON DELETE CASCADE.

## employee_documents

HR documents (contracts, ID scans, certificates, etc.) attached to an employee.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| employee_id | TEXT | NOT NULL, REFERENCES employees(id) ON DELETE CASCADE |
| name | TEXT | NOT NULL |
| doc_type | TEXT | |
| file_path | TEXT | NOT NULL — path relative to app_data_dir |
| created_at | TEXT | NOT NULL |

FK relationships: `employee_id` → `employees(id)` ON DELETE CASCADE.

## payment_attachments

Proof-of-payment scans (receipts, bank slips, cheque copies) attached to a payment.

| Column | Type | Constraints/Notes |
|---|---|---|
| id | TEXT | PRIMARY KEY |
| payment_id | TEXT | NOT NULL, REFERENCES payments(id) ON DELETE CASCADE |
| file_name | TEXT | NOT NULL |
| file_path | TEXT | NOT NULL — path relative to app_data_dir |
| created_at | TEXT | NOT NULL |

FK relationships: `payment_id` → `payments(id)` ON DELETE CASCADE.

---

## The sequence-numbering system

The `sequences` table holds one row per document-number counter (`invoice_number`, `delivery_note_number`, `order_number`), each a simple integer starting at 0. On startup, the database sync logic scans existing `invoices`/`delivery_notes`/`orders` rows and bumps each counter up to the highest numeric suffix already in use (handling prefixed formats like `AV-001`, `BL-0001`, `BC-0001`), so numbering never collides even on a database migrated from an older version. Document creation calls `generate_invoice_number`/`generate_delivery_note_number`/`generate_order_number`, which atomically increment the relevant counter and format it (`{:03}` for invoices, `BL-{:04}` for delivery notes, `{:06}` for orders); `get_next_invoice_number` (the Tauri command) previews the next value without incrementing, and a resync helper recomputes a counter from the digits still present in its table after deletions, so removing records doesn't leave the counter permanently ahead of what actually exists. Contracts use a separate, simpler per-company-per-year scheme (`OM-CTR-{year}-{seq}`, a plain `COUNT(*) + 1` inside the insert transaction) rather than extending this table, since contract volume is low.
