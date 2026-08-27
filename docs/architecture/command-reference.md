# Full Tauri Command Reference

Every `#[tauri::command]` function in `apps/desktop/src-tauri/src/commands.rs`, grouped by domain in the same order they're registered in `apps/desktop/src-tauri/src/lib.rs`'s `invoke_handler![...]` list. Each is called from the frontend via `@tauri-apps/api/core`'s `invoke()`, wrapped by the `safeInvoke()` helper in `apps/desktop/src/lib/database.ts` (see [`frontend.md`](./frontend.md)).

Commands under **HR/Payroll**, **Projects**, **Contracts**, **Partners**, **Project Tasks**, and **Project Deliverables** are gated to the `omada-agency` branch only (per comments in `lib.rs`) — they are agency-specific extensions layered on top of the core Sordi ERP product, not part of the base product line.

Most mutating commands (create/update/delete on invoices, contracts, projects, payroll runs, and the factory-reset command) call `crate::license::require_active_license()` as their first line — see [`backend.md`](./backend.md#license--feature-gating) for what that gate does and how the `omada_bypass` feature affects it. Read-only `get_*` commands are never gated.

## Companies (multi-workspace)

| Command | Signature | Description |
|---|---|---|
| `get_companies` | `(db) -> Result<Vec<Company>, String>` | Lists all companies (workspaces) in the database. |
| `get_company` | `(db, id) -> Result<Option<Company>, String>` | Fetches a single company by ID. |
| `create_company` | `(db, data: CreateCompanyData) -> Result<Company, String>` | Creates a new company/workspace record. |
| `update_company` | `(db, id, data: CreateCompanyData) -> Result<Company, String>` | Updates a company's profile/fiscal fields. |

## Clients

| Command | Signature | Description |
|---|---|---|
| `get_clients` | `(db, company_id) -> Result<Vec<Client>, String>` | Lists all clients for a company. |
| `get_client` | `(db, id) -> Result<Option<Client>, String>` | Fetches a single client by ID. |
| `create_client` | `(db, data: CreateClientData) -> Result<Client, String>` | Creates a new client record. |
| `update_client` | `(db, id, data: CreateClientData) -> Result<Client, String>` | Updates a client's details. |
| `delete_client` | `(db, id) -> Result<(), String>` | Deletes a client. |

## Suppliers (Fournisseurs)

| Command | Signature | Description |
|---|---|---|
| `get_suppliers` | `(db, company_id) -> Result<Vec<Supplier>, String>` | Lists all suppliers for a company. |
| `get_supplier` | `(db, id) -> Result<Option<Supplier>, String>` | Fetches a single supplier by ID. |
| `create_supplier` | `(db, data: CreateSupplierData) -> Result<Supplier, String>` | Creates a new supplier record. |
| `update_supplier` | `(db, id, data: CreateSupplierData) -> Result<Supplier, String>` | Updates a supplier's details. |
| `delete_supplier` | `(db, id) -> Result<(), String>` | Deletes a supplier. |
| `get_supplier_purchase_totals` | `(db, company_id) -> Result<Vec<SupplierPurchaseTotal>, String>` | Sums expense amounts grouped by supplier (total purchases per supplier). |

## Products

| Command | Signature | Description |
|---|---|---|
| `get_products` | `(db, company_id) -> Result<Vec<Product>, String>` | Lists all products in the catalog for a company. |
| `create_product` | `(db, data: CreateProductData) -> Result<Product, String>` | Creates a new product/catalog item. |
| `update_product_price` | `(db, id, unit_price: f64) -> Result<Product, String>` | Updates only a product's unit price. |
| `update_product` | `(db, id, data: CreateProductData) -> Result<Product, String>` | Updates a product's full details. |
| `delete_product` | `(db, id) -> Result<(), String>` | Deletes a product. |
| `get_product_sales_stats` | `(db, company_id, year?, months?) -> Result<Vec<ProductSalesStat>, String>` | Aggregates quantity/amount sold per product from real invoices (excludes credit notes/proformas), optionally filtered by year/months. |
| `get_client_product_cumulatives` | `(db, company_id, year?, months?) -> Result<Vec<CumulativeSalesRecord>, String>` | Cross-tab of sales cumulatives by client x product for a period. |
| `get_client_cumulatives` | `(db, company_id, year?, months?) -> Result<Vec<ClientCumulativeRecord>, String>` | Per-client cumulative HT/TVA/timbre/TTC/quantity/invoice-count totals for a period, netting out credit notes. |
| `get_client_overview_stats` | `(db, company_id, client_id?) -> Result<Vec<ClientOverviewStats>, String>` | Per-client overview (revenue, invoice count, first/last invoice, payment behavior) computed from invoices + payments, optionally for one client. |
| `get_dashboard_stats` | `(db, company_id, year?, months?) -> Result<DashboardStats, String>` | Computes the main dashboard KPIs: receivables, period revenue/unpaid, HT cumulatives, expenses, net profit/margin, and YoY growth. |

## Invoices

| Command | Signature | Description |
|---|---|---|
| `get_invoices` | `(db, company_id, status?, invoice_type?) -> Result<Vec<Invoice>, String>` | Lists invoices for a company, optionally filtered by status/type. |
| `get_invoices_with_clients` | `(db, company_id, status?, invoice_type?) -> Result<Vec<InvoiceWithClient>, String>` | Same as `get_invoices` but joins client info into each row. |
| `get_invoice` | `(db, id) -> Result<Option<Invoice>, String>` | Fetches a single invoice by ID. |
| `get_invoice_items` | `(db, invoiceId) -> Result<Vec<InvoiceItemWithProduct>, String>` | Lists line items for an invoice, joined with product info. |
| `get_next_invoice_number` | `(db) -> Result<String, String>` | Previews the next auto-generated invoice number without consuming it. |
| `create_invoice` | `(db, data: CreateInvoiceData) -> Result<Invoice, String>` | Creates an invoice (auto-numbers by type: `AV-` for credit notes, `PRO-<ts>` for proformas), inserts items, and recalculates totals in a transaction. Requires an active license. |
| `update_invoice` | `(db, id, data: CreateInvoiceData) -> Result<Invoice, String>` | Updates an invoice's details/items and recalculates totals. Requires an active license. |
| `update_invoice_status` | `(db, id, status) -> Result<Invoice, String>` | Changes an invoice's status (e.g. issued/paid/cancelled). |
| `update_invoice_header` | `(db, id, invoice_number, custom_title?) -> Result<(), String>` | Updates just the invoice number and/or custom title header fields. |
| `delete_invoice` | `(db, id) -> Result<(), String>` | Deletes an invoice. |
| `convert_to_real_invoice` | `(db, id) -> Result<Invoice, String>` | Converts a `proforma` invoice into a real `invoice`: assigns a new real invoice number and sets status to `issued`. Requires an active license. |

## Payments

| Command | Signature | Description |
|---|---|---|
| `get_payments` | `(db, company_id, invoice_id?) -> Result<Vec<Payment>, String>` | Lists payments for a company, optionally filtered to one invoice. |
| `create_payment` | `(db, data: CreatePaymentData) -> Result<Payment, String>` | Records a new payment against an invoice. |
| `delete_payment` | `(db, id) -> Result<(), String>` | Deletes a payment record. |
| `add_payment_attachment` | `(db, payment_id, source_path, file_name) -> Result<PaymentAttachment, String>` | Attaches a copied file (e.g. scanned cheque/receipt) to a payment. |
| `get_payment_attachments` | `(db, payment_id) -> Result<Vec<PaymentAttachment>, String>` | Lists attachments for a payment. |
| `delete_payment_attachment` | `(db, id) -> Result<(), String>` | Deletes a payment attachment. |

## Orders

| Command | Signature | Description |
|---|---|---|
| `get_orders` | `(db, company_id) -> Result<Vec<Order>, String>` | Lists orders for a company. |
| `get_order` | `(db, id) -> Result<Option<Order>, String>` | Fetches a single order by ID. |
| `get_next_order_number` | `(db) -> Result<String, String>` | Previews the next auto-generated order number. |
| `get_order_items` | `(db, orderId) -> Result<Vec<OrderItemWithProduct>, String>` | Lists line items for an order, joined with product info. |
| `create_order` | `(db, data: CreateOrderData) -> Result<Order, String>` | Creates a new order with its line items. |
| `update_order` | `(db, id, data: CreateOrderData) -> Result<Order, String>` | Updates an order's details/items. |
| `update_order_status` | `(db, id, status) -> Result<Order, String>` | Changes an order's status. |
| `delete_order` | `(db, id) -> Result<(), String>` | Deletes an order. |

## Delivery Notes

| Command | Signature | Description |
|---|---|---|
| `get_delivery_notes` | `(db, company_id, client_id?, is_invoiced?) -> Result<Vec<DeliveryNote>, String>` | Lists delivery notes (bons de livraison), optionally filtered by client or invoiced status. |
| `get_delivery_note` | `(db, id) -> Result<Option<DeliveryNote>, String>` | Fetches a single delivery note by ID. |
| `get_delivery_note_items` | `(db, deliveryNoteId) -> Result<Vec<DeliveryNoteItemWithProduct>, String>` | Lists line items for a delivery note, joined with product info. |
| `create_delivery_note` | `(db, data: CreateDeliveryNoteData) -> Result<DeliveryNote, String>` | Creates a new delivery note with its items. |
| `update_delivery_note` | `(db, id, data: CreateDeliveryNoteData) -> Result<DeliveryNote, String>` | Updates a delivery note's details/items. |
| `set_delivery_status` | `(db, id, status) -> Result<DeliveryNote, String>` | Changes a delivery note's delivery status. |
| `delete_delivery_note` | `(db, id) -> Result<(), String>` | Deletes a delivery note. |
| `generate_invoice_from_delivery_notes` | `(db, delivery_note_ids: Vec<String>, invoice_date, due_date) -> Result<Invoice, String>` | Creates a draft invoice from one or more delivery notes: copies all items (re-fetching live product price/TVA/timbre for catalog items, keeping custom item values as-is), marks each note as invoiced, and recalculates totals. Requires an active license. |

## Expenses

| Command | Signature | Description |
|---|---|---|
| `get_expenses` | `(db, company_id, month_period?, project_id?) -> Result<Vec<Expense>, String>` | Lists expenses, optionally filtered by month or project. |
| `create_expense` | `(db, data: CreateExpenseData) -> Result<Expense, String>` | Records a new expense. |
| `delete_expense` | `(db, id) -> Result<(), String>` | Deletes an expense. |

## Letterhead

| Command | Signature | Description |
|---|---|---|
| `get_letterhead_image` | `() -> Result<Option<Vec<u8>>, String>` | Reads the letterhead image bytes from disk/config, if configured. |

## Client Products

| Command | Signature | Description |
|---|---|---|
| `get_client_products` | `(db, clientId, productId?, month?, year?) -> Result<Vec<ClientProductSummary>, String>` | Aggregates quantity/amount purchased per product by a client from real invoices, optionally filtered by product/month/year. |

## Client Draft Products

| Command | Signature | Description |
|---|---|---|
| `get_client_draft_products` | `(db, client_id) -> Result<Vec<ClientDraftProduct>, String>` | Lists a client's in-progress "draft" product selections (a scratchpad before creating an order/invoice). |
| `add_client_draft_product` | `(db, data: CreateClientDraftProductData) -> Result<ClientDraftProduct, String>` | Adds a product line to a client's draft list. |
| `update_client_draft_product_quantity` | `(db, data: UpdateClientDraftProductQuantityData) -> Result<ClientDraftProduct, String>` | Updates the quantity of a draft product line. |
| `delete_client_draft_product` | `(db, id) -> Result<(), String>` | Removes one draft product line. |
| `clear_client_draft_products` | `(db, client_id) -> Result<(), String>` | Clears all draft product lines for a client. |

## Client Advances

| Command | Signature | Description |
|---|---|---|
| `get_client_advances` | `(db, client_id) -> Result<Vec<ClientAdvance>, String>` | Lists advance payments recorded for a client. |
| `add_client_advance` | `(db, data: CreateClientAdvanceData) -> Result<ClientAdvance, String>` | Records a new client advance payment. |
| `update_client_advance` | `(db, data: UpdateClientAdvanceData) -> Result<ClientAdvance, String>` | Updates an existing client advance record. |
| `delete_client_advance` | `(db, id) -> Result<(), String>` | Deletes a client advance record. |

## Settings

| Command | Signature | Description |
|---|---|---|
| `get_settings` | `(db) -> Result<HashMap<String, String>, String>` | Returns all key-value settings (branding, theme, company mirror fields, etc.) as a map. |
| `update_setting` | `(db, key, value) -> Result<(), String>` | Upserts a single setting key. |
| `update_settings` | `(db, settings: HashMap<String, String>) -> Result<(), String>` | Upserts multiple settings at once. |

## Production Logs

| Command | Signature | Description |
|---|---|---|
| `get_production_logs` | `(db, month?, year?) -> Result<Vec<ProductionLog>, String>` | Lists production log entries, optionally filtered by month/year. |
| `create_production_log` | `(db, data: CreateProductionLogData) -> Result<ProductionLog, String>` | Creates a new production log entry. |
| `update_production_log` | `(db, id, data: CreateProductionLogData) -> Result<ProductionLog, String>` | Updates a production log entry. |
| `delete_production_log` | `(db, id) -> Result<(), String>` | Deletes a production log entry. |

## History

| Command | Signature | Description |
|---|---|---|
| `get_activity_logs` | `(db, limit?, entity_type?, action?, start_date?, end_date?) -> Result<Vec<ActivityLog>, String>` | Lists audit-trail entries recorded by `log_activity`, with optional filters. |
| `clear_activity_logs` | `(db) -> Result<(), String>` | Deletes all activity log entries. |
| `reset_company_to_factory_state` | `(db, company_id) -> Result<(), String>` | Wipes all transactional data (payments, delivery notes, contracts, invoices, projects, orders, expenses, clients, suppliers) for a company, clears the global activity log, blanks the company's fiscal/profile fields, and resets branding settings and number sequences to defaults. Requires an active license. |

## Employees

| Command | Signature | Description |
|---|---|---|
| `get_employees` | `(db, company_id) -> Result<Vec<Employee>, String>` | Lists employees for a company. |
| `create_employee` | `(db, data: CreateEmployeeData) -> Result<Employee, String>` | Creates a new employee record. |
| `update_employee` | `(db, id, data: CreateEmployeeData) -> Result<Employee, String>` | Updates an employee's details. |
| `delete_employee` | `(db, id) -> Result<(), String>` | Deletes an employee. |
| `set_employee_photo` | `(db, employee_id, source_path) -> Result<Employee, String>` | Copies a photo file in and sets it as the employee's photo. |
| `remove_employee_photo` | `(db, employee_id) -> Result<Employee, String>` | Removes an employee's photo. |
| `add_employee_document` | `(db, employee_id, source_path, name, doc_type?) -> Result<EmployeeDocument, String>` | Copies a file in and attaches it as a document on the employee's file. |
| `get_employee_documents` | `(db, employee_id) -> Result<Vec<EmployeeDocument>, String>` | Lists documents attached to an employee. |
| `delete_employee_document` | `(db, id) -> Result<(), String>` | Deletes an employee document. |
| `get_employee_task_workload` | `(db, company_id) -> Result<Vec<EmployeeTaskWorkload>, String>` | Counts open (non-`approuve`) project tasks assigned to each active employee, ranked by workload. |

## HR / Payroll (omada-agency branch only)

| Command | Signature | Description |
|---|---|---|
| `get_employee_absence_stats` | `(db, employee_id, month) -> Result<EmployeeAbsenceStats, String>` | Computes working days and absence days for an employee in a given month from punch records, using the agency's fixed Sat-Thu work week (Friday off). |
| `import_punch_records` | `(db, company_id, rows: Vec<PunchImportRow>) -> Result<PunchImportSummary, String>` | Bulk-imports attendance punch records, mapping each row's device `external_code` to an employee where known (unmatched codes are kept with a null employee_id, not dropped). |
| `get_unmapped_device_codes` | `(db, month?) -> Result<Vec<UnmappedDeviceCode>, String>` | Lists device codes from punch records that don't map to any known employee. |
| `create_employee_advance` | `(db, data: CreateEmployeeAdvanceData) -> Result<EmployeeAdvance, String>` | Records a salary advance given to an employee. |
| `get_employee_advances` | `(db, employee_id) -> Result<Vec<EmployeeAdvance>, String>` | Lists advances for an employee. |
| `get_employee_advance_totals` | `(db, employee_id) -> Result<EmployeeAdvanceTotals, String>` | Sums an employee's advance totals (deducted vs. outstanding). |
| `set_employee_advance_deducted` | `(db, id, deducted: bool) -> Result<EmployeeAdvance, String>` | Manually marks an advance as deducted (or not). |
| `save_pdf_backup` | `(root_dir, client_name, doc_number, pdf_bytes: Vec<u8>) -> Result<(), String>` | Writes a PDF copy to a per-client folder under a root backup directory, sanitizing path components. |
| `run_payroll` | `(db, employee_id, month, primes?) -> Result<PayrollRun, String>` | Calculates (or recalculates, if unpaid) a payroll run: derives a daily rate from base salary and working days, deducts absence days and any pending advances for that month, and computes net pay; blocks recalculation if already marked paid. Requires an active license. |
| `get_payroll_runs` | `(db, employee_id?, month?, paid?) -> Result<Vec<PayrollRun>, String>` | Lists payroll runs, optionally filtered by employee/month/paid status. |
| `update_payroll_paid` | `(db, id, paid: bool, paid_date?) -> Result<PayrollRun, String>` | Marks a payroll run as paid/unpaid with an optional paid date. |
| `update_payroll_run` | `(db, data: UpdatePayrollRunData) -> Result<PayrollRun, String>` | Updates fields on an existing payroll run. |
| `delete_payroll_run` | `(db, id) -> Result<(), String>` | Deletes a payroll run. |
| `get_payroll_dashboard_stats` | `(db, company_id, month) -> Result<PayrollDashboardStats, String>` | Aggregates payroll KPIs (total mass, paid/unpaid, etc.) for a company/month. |

## Projects (omada-agency branch only)

| Command | Signature | Description |
|---|---|---|
| `get_projects` | `(db, company_id) -> Result<Vec<Project>, String>` | Lists projects for a company. |
| `get_project` | `(db, id) -> Result<Option<Project>, String>` | Fetches a single project by ID. |
| `create_project` | `(db, data: CreateProjectData) -> Result<Project, String>` | Creates a new project. Requires an active license. |
| `update_project` | `(db, id, data: CreateProjectData) -> Result<Project, String>` | Updates a project's details. |
| `delete_project` | `(db, id) -> Result<(), String>` | Deletes a project. |
| `update_freelancer_payment_status` | `(db, project_id, statut_paiement, date_paiement?) -> Result<Project, String>` | Updates just the payment status/date for a project's assigned freelancer. |
| `assign_freelance_payment` | `(db, project_id, freelancer_id, montant_convenu: f64, statut_paiement, date_paiement?) -> Result<Project, String>` | Assigns a freelancer to a project with an agreed amount and payment status. Requires an active license. |
| `get_freelance_payments` | `(db, company_id) -> Result<Vec<FreelancePayment>, String>` | Lists every project with a freelancer assigned (unpaid first) for the agency's freelance-payment tracking view. |
| `get_project_stats` | `(db, company_id, project_id?) -> Result<Vec<ProjectStats>, String>` | Returns computed statistics per project (or one project). |
| `get_project_profitability` | `(db, project_id) -> Result<ProjectProfitability, String>` | Computes a project's net margin: revenue HT from real invoices/credit notes minus direct expenses tied to the project. |
| `assign_invoice_to_project` | `(db, invoice_id, project_id?) -> Result<(), String>` | Links (or unlinks, if `project_id` is `None`) an invoice to a project. |

## Contracts (omada-agency branch only)

| Command | Signature | Description |
|---|---|---|
| `create_contract` | `(db, data: CreateContractData) -> Result<Contract, String>` | Creates a new contract with an auto-generated yearly reference number, storing selected services and linked invoices as JSON. Requires an active license. |
| `get_all_contracts` | `(db, company_id) -> Result<Vec<Contract>, String>` | Lists all contracts for a company. |
| `get_project_contracts` | `(db, project_id) -> Result<Vec<Contract>, String>` | Lists contracts belonging to a specific project. |
| `delete_contract` | `(db, id) -> Result<(), String>` | Deletes a contract. |

## Partners

| Command | Signature | Description |
|---|---|---|
| `get_partners` | `(db, company_id, year?, months?) -> Result<Vec<PartnerFinancials>, String>` | Lists partners with computed equity-split financials: each partner's allocated profit share for the period plus their all-time withdrawn/remaining balance. |
| `get_monthly_partners_report` | `(db, company_id, year: i32, month: u32) -> Result<MonthlyBusinessReport, String>` | Builds a full monthly closing report: accrual revenue HT, cash actually collected via payments, operating expenses, and payroll mass paid for that month. |
| `create_partner` | `(db, data: CreatePartnerData) -> Result<Partner, String>` | Adds a new equity partner. |
| `update_partner` | `(db, id, data: UpdatePartnerData) -> Result<Partner, String>` | Updates a partner's details/equity percentage/active status. |
| `delete_partner` | `(db, id) -> Result<(), String>` | Deletes a partner. |
| `get_partner_withdrawals` | `(db, partner_id) -> Result<Vec<PartnerWithdrawal>, String>` | Lists a partner's recorded profit withdrawals. |
| `record_partner_withdrawal` | `(db, data: CreateWithdrawalData) -> Result<PartnerWithdrawal, String>` | Records a new withdrawal against a partner's allocated profit. |
| `delete_partner_withdrawal` | `(db, id) -> Result<(), String>` | Deletes a partner withdrawal record. |

## Project Tasks (omada-agency branch only)

| Command | Signature | Description |
|---|---|---|
| `get_project_tasks` | `(db, project_id) -> Result<Vec<ProjectTask>, String>` | Lists tasks belonging to a project. |
| `create_project_task` | `(db, data: CreateProjectTaskData) -> Result<ProjectTask, String>` | Creates a new project task. |
| `update_project_task` | `(db, id, data: UpdateProjectTaskData) -> Result<ProjectTask, String>` | Updates a project task's details. |
| `update_project_task_status` | `(db, id, status) -> Result<ProjectTask, String>` | Changes a task's status (e.g. to `approuve`). |
| `delete_project_task` | `(db, id) -> Result<(), String>` | Deletes a project task. |

## Project Deliverables (omada-agency branch only)

| Command | Signature | Description |
|---|---|---|
| `get_project_deliverables` | `(db, project_id) -> Result<Vec<ProjectDeliverable>, String>` | Lists deliverables belonging to a project. |
| `create_project_deliverable` | `(db, data: CreateProjectDeliverableData) -> Result<ProjectDeliverable, String>` | Creates a new project deliverable. |
| `update_project_deliverable` | `(db, id, data: UpdateProjectDeliverableData) -> Result<ProjectDeliverable, String>` | Updates a project deliverable. |
| `delete_project_deliverable` | `(db, id) -> Result<(), String>` | Deletes a project deliverable. |

## PDF

| Command | Signature | Description |
|---|---|---|
| `generate_pdf` | `async (html_content, paper_size?, landscape?) -> Result<String, String>` | Renders HTML content to a PDF and returns it (base64) for the caller to save/open. |
| `open_pdf` | `async (pdf_base64, file_name) -> Result<(), String>` | Decodes a base64 PDF, writes it to a temp/target location, and opens it with the OS default viewer. |
| `open_file_path` | `async (path) -> Result<(), String>` | Opens an existing file at the given path with the OS's default application (`open`/`explorer`/`xdg-open`). |
| `save_pdf` | `async (pdf_base64, file_name) -> Result<String, String>` | Decodes a base64 PDF and writes it to the user's Downloads folder, returning the saved path. |
| `save_pdf_to_path` | `async (path, pdf_base64) -> Result<(), String>` | Decodes a base64 PDF and writes it to an exact caller-chosen path (e.g. from a native save dialog). |

## Email

| Command | Signature | Description |
|---|---|---|
| `send_email_with_pdf` | `async (db, to, subject, body, pdf_base64, file_name) -> Result<(), String>` | Sends an email with a PDF attachment (decoded from base64) using configured SMTP/email settings. |

## Auth

| Command | Signature | Description |
|---|---|---|
| `has_password_set` | `(db) -> Result<bool, String>` | Checks whether an app-lock password has been configured. |
| `check_password` | `(db, password) -> Result<bool, String>` | Verifies a provided password against the stored one. |
| `set_password` | `(db, new_password) -> Result<(), String>` | Sets or changes the app-lock password. |

## Licensing

| Command | Signature | Description |
|---|---|---|
| `get_license_status` | `() -> LicenseStatus` | Returns the current cached license status. |
| `activate_license` | `async (license_key) -> Result<LicenseStatus, String>` | Activates the app with a license key. |
| `verify_license_background` | `async () -> LicenseStatus` | Re-verifies license validity in the background (e.g. against a remote server) and returns the refreshed status. |

## Global Search

| Command | Signature | Description |
|---|---|---|
| `search_global` | `(db, company_id, query) -> Result<GlobalSearchResults, String>` | Searches clients (by name/code) and invoices (by invoice number) for a company, returning up to 5 matches each. |

---

**Total: 151 commands.**
