/**
 * Database Service Layer
 * Abstracts Tauri commands to replace Supabase calls
 */

import { invoke } from "@tauri-apps/api/core";
import { mockStore } from "./mockStore";

export const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

/**
 * The mock/demo fallback exists for exactly one situation: the app isn't
 * running inside Tauri at all (a plain browser preview, where no real
 * `invoke()` exists to call). It must NOT also apply when a real Tauri
 * command genuinely fails — a validation error, a foreign-key constraint,
 * a bug — because that turns a real, actionable error into a silent fake
 * success: the UI shows "created"/"deleted"/"saved" while nothing actually
 * happened to the real database. That exact confusion is what caused
 * invoices, settings saves, and client deletes to all appear broken in the
 * same way — the real error was there the whole time, just never shown.
 * A failure inside the real Tauri app must always surface as a real error.
 */
async function safeInvoke<T>(cmd: string, args?: Record<string, any>, fallbackFn?: () => T | Promise<T>): Promise<T> {
  if (!isTauri) {
    if (fallbackFn) return fallbackFn();
    throw new Error(`Command ${cmd} not available in web mode`);
  }
  return await invoke<T>(cmd, args);
}


// ============= STATS =============

export interface PeriodStats {
  revenue: number;
  expenses: number;
  profit: number;
}

export interface PaymentStats {
  paid: number;
  unpaid: number;
  initial_debt: number;
  total_receivables: number;
  outstanding_invoice_count: number;
}

export interface TimePointStats {
  label: string;
  revenue: number;
  /** Combined total (expenses_only + payroll_amount). */
  expenses: number;
  profit: number;
  /** `expenses` table only, no payroll folded in. */
  expenses_only: number;
  /** Settled payroll for this period — always 0 in daily_data. */
  payroll_amount: number;
}

export interface ProductSalesStat {
  product_id: string;
  product_name: string;
  product_code: string;
  total_quantity: number;
  total_amount: number;
}

export interface DashboardStats {
  current_month: PeriodStats;
  yearly: PeriodStats;
  payments: PaymentStats;
  sales_cumulatives: SalesCumulativeStats;
  monthly_data: TimePointStats[];
  daily_data: TimePointStats[];
  product_stats: ProductSalesStat[];
  growth: number;
  invoice_count: number;
  is_month_view: boolean;
  /** True operating profitability (HT basis) — distinct from `yearly`, which
   *  stays cash-basis/TTC and keeps feeding the existing chart unchanged. */
  revenue_ht: number;
  expense_count: number;
  net_profit_ht: number;
  margin_percentage_ht: number;
  /** Period-scoped unpaid balance on invoices issued in this period. */
  outstanding_receivables: number;
}

export interface SalesCumulativeStats {
  total_ht: number;
  total_ttc: number;
  total_tva: number;
  total_timbre: number;
}

export interface ClientCumulativeRecord {
  client_name: string;
  total_ht: number;
  total_tva: number;
  total_timbre: number;
  total_ttc: number;
  total_quantity: number;
  invoice_count: number;
}

// Raw ingredients for the client "Aperçu" section and the clients-list status
// badge — computed at query time in Rust (get_client_overview_stats), never
// stored. See src/lib/clientOverview.ts for how these become display labels.
export interface ClientOverviewStats {
  client_id: string;
  total_revenue: number;
  client_since: string;
  invoice_count: number;
  last_invoice_date: string | null;
  recent_payment_delays_days: number[];
  recent_purchase_gaps_days: number[];
  payment_terms_days: number | null;
  has_overdue_unpaid: boolean;
}

// "active" = full access. "read_only"/"not_activated" both mean
// business-data writes are gated server (Rust) side — same UI treatment
// for both, no need to distinguish "expired" from "never activated" here.
export interface LicenseStatus {
  state: "active" | "read_only" | "not_activated";
  client_reference_id: string | null;
  expires_at: string | null;
}

export interface TelemetryStatus {
  enabled: boolean;
  lastSentAt: string | null;
}

export interface ClientSearchHit {
  id: string;
  name: string;
  code: string | null;
}

export interface InvoiceSearchHit {
  id: string;
  invoice_number: string;
  client_name: string | null;
  total_ttc: number;
}

export interface GlobalSearchResults {
  clients: ClientSearchHit[];
  invoices: InvoiceSearchHit[];
}

// ============= COMPANIES (Multi-workspace) =============

export interface Company {
  id: string;
  name: string;
  logo_base64: string | null;
  activity: string | null;
  /** Algerian legal form — EURL, SARL, SPA, SNC, Auto-entrepreneur, Personne physique / Établissement individuel. */
  legal_form: string | null;
  rc: string | null;
  nif: string | null;
  nis: string | null;
  article_imposition: string | null;
  address: string | null;
  phone: string | null;
  /** JSON-encoded array of additional phone numbers. */
  phones: string | null;
  email: string | null;
  website: string | null;
  capital: string | null;
  rib: string | null;
  bank_agency: string | null;
  /** JSON-encoded array of free-form extra info lines. */
  extra_info: string | null;
  cnas_adherent: string | null;
  currency: string;
  invoice_prefix: string;
  created_at: string;
}

export interface CreateCompanyData {
  name: string;
  logo_base64?: string | null;
  activity?: string | null;
  legal_form?: string | null;
  rc?: string | null;
  nif?: string | null;
  nis?: string | null;
  article_imposition?: string | null;
  address?: string | null;
  phone?: string | null;
  phones?: string | null;
  email?: string | null;
  website?: string | null;
  capital?: string | null;
  rib?: string | null;
  bank_agency?: string | null;
  extra_info?: string | null;
  cnas_adherent?: string | null;
  currency?: string;
  invoice_prefix?: string;
}

// ============= CLIENTS =============

export interface Client {
  id: string;
  company_id: string | null;
  code: string | null;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  wilaya: string | null;
  nif: string | null;
  nis: string | null;
  rc: string | null;
  secondary_rc: string | null;
  secondary_address: string | null;
  ai: string | null;
  activite: string | null;
  credit_limit: number | null;
  payment_terms_days: number | null;
  notes: string | null;
  is_active: boolean | null;
  initial_balance: number | null;
  advance_payment: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateClientData {
  company_id: string;
  name: string;
  code?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  wilaya?: string;
  nif?: string;
  nis?: string;
  rc?: string;
  secondary_rc?: string;
  secondary_address?: string;
  ai?: string;
  activite?: string;
  credit_limit?: number;
  payment_terms_days?: number;
  notes?: string;
  initial_balance?: number;
  advance_payment?: number;
}

// ============= SUPPLIERS (Fournisseurs) =============

export interface Supplier {
  id: string;
  company_id: string | null;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  rc: string | null;
  nif: string | null;
  nis: string | null;
  /** Manually tracked unpaid balance — distinct from the live-computed
   *  "Total Achats" (see SupplierPurchaseTotal / get_supplier_purchase_totals). */
  solde_du: number | null;
  notes: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplierData {
  company_id: string;
  name: string;
  category?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  rc?: string;
  nif?: string;
  nis?: string;
  solde_du?: number;
  notes?: string;
}

export interface SupplierPurchaseTotal {
  supplier_id: string;
  total_achats: number;
}

// Type definitions for other entities
export interface Product {
  id: string;
  company_id: string | null;
  code: string;
  name: string;
  description: string | null;
  unit: string | null;
  unit_price: number;
  tva_rate: number | null;
  timbre_exempt: boolean | null;
  is_active: boolean | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductInfo {
  code: string;
  name: string;
  description: string | null;
  unit?: string | null;
}

export interface CreateProductData {
  company_id: string;
  code: string;
  name: string;
  description?: string;
  unit?: string;
  unit_price: number;
  tva_rate?: number | null;
  timbre_exempt?: boolean | null;
  display_order?: number;
}

// ============= INVOICES =============

/**
 * "standard" — each line keeps its own catalog TVA rate (default 19%).
 * "exempt" — every line's tva_rate is forced to 0 ("Hors Taxe / Sans TVA").
 * "ttc_direct" — unit prices are entered as TTC and back-computed to HT
 * before being stored; invoice_items still hold HT unit_price like every
 * other mode, so recalculate_invoice_totals (Rust) never needs to know
 * which mode produced them.
 */
export type InvoiceTaxMode = "standard" | "exempt" | "ttc_direct";

export interface Invoice {
  id: string;
  company_id: string | null;
  invoice_number: string;
  client_id: string;
  invoice_date: string;
  due_date: string | null;
  month_period: string | null;
  subtotal_ht: number | null;
  tva_rate: number | null;
  tva_amount: number | null;
  timbre: number | null;
  total_ttc: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  status: string | null;
  invoice_type: "invoice" | "credit_note" | "proforma";
  original_invoice_id: string | null;
  notes: string | null;
  header_note: string | null;
  discount?: number | null;
  discount_type?: "percent" | "amount" | null;
  discount_value?: number | null;
  use_secondary_register?: boolean;
  selected_secondary_rc?: string;
  selected_secondary_address?: string;
  custom_title?: string | null;
  payment_method?: string | null;
  /** omada-agency branch only — which project (if any) this invoice's revenue counts toward. */
  project_id?: string | null;
  /** Defaults to "standard" on the Rust side for any row created before this column existed. */
  tax_mode?: InvoiceTaxMode;
  /** Set once a proforma has been converted — points at the invoice it became. */
  converted_to_invoice_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithClient extends Invoice {
  clients?: {
    name: string;
    email: string | null;
  };
  projects?: {
    name: string;
    service_categories: string | null;
  };
}

export interface CreateInvoiceData {
  company_id: string;
  client_id: string;
  invoice_date: string;
  due_date?: string;
  month_period?: string;
  notes?: string;
  header_note?: string;
  invoice_type?: "invoice" | "credit_note" | "proforma";
  original_invoice_id?: string;
  discount?: number;
  discount_type?: "percent" | "amount";
  discount_value?: number;
  use_secondary_register?: boolean;
  selected_secondary_rc?: string | null;
  selected_secondary_address?: string | null;
  custom_title?: string;
  invoice_number?: string;
  payment_method?: string;
  status?: string;
  amount_paid?: number;
  tax_mode?: InvoiceTaxMode;
  /** omada-agency branch only — which project (if any) this invoice's revenue counts toward. */
  project_id?: string | null;
  items: {
    product_id?: string;
    /** Only meaningful when product_id is absent — a custom/one-off item. */
    product_name?: string;
    product_code?: string;
    product_description?: string;
    quantity: number;
    unit_price: number;
    tva_rate?: number | null;
    timbre_exempt?: boolean;
  }[];
}

// ============= PAYMENTS =============

export interface Payment {
  id: string;
  company_id: string | null;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  cheque_number: string | null;
  bank_name: string | null;
  value_date: string | null;
  notes: string | null;
  created_at: string;
  /** "Encaissé par" — nullable, most existing rows predate this field. References employees.id. */
  employee_id: string | null;
}

export interface CreatePaymentData {
  company_id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method?: string;
  cheque_number?: string;
  bank_name?: string;
  value_date?: string;
  notes?: string;
  employee_id?: string;
}

export interface UpdatePaymentData {
  id: string;
  payment_date: string;
  amount: number;
  payment_method?: string;
  cheque_number?: string;
  bank_name?: string;
  value_date?: string;
  employee_id?: string;
}

/** A proof-of-payment scan (receipt, bank slip, cheque copy) attached to one payment. */
export interface PaymentAttachment {
  id: string;
  payment_id: string;
  file_name: string;
  /** Relative to app_data_dir, e.g. "payment_attachments/<payment_id>/<file>". */
  file_path: string;
  created_at: string;
}

export interface ClientAdvance {
  id: string;
  client_id: string;
  amount: number;
  date: string;
  payment_mode: string;
  reference?: string;
  bank?: string;
  issuer_name?: string;
  notes?: string;
  created_at: string;
}

export interface CreateClientAdvanceData {
  client_id: string;
  amount: number;
  date: string;
  payment_mode: string;
  reference?: string;
  bank?: string;
  issuer_name?: string;
  notes?: string;
}

export interface UpdateClientAdvanceData {
  id: string;
  amount: number;
  date: string;
  payment_mode: string;
  reference?: string;
  bank?: string;
  issuer_name?: string;
  notes?: string;
}

// ============= ORDERS =============

export interface Order {
  id: string;
  company_id: string | null;
  order_number: string;
  client_id: string;
  supplier_name: string | null;
  supplier_address: string | null;
  supplier_email: string | null;
  supplier_phone: string | null;
  supplier_rc: string | null;
  supplier_nif: string | null;
  supplier_nis: string | null;
  supplier_ai: string | null;
  order_date: string;
  delivery_date: string | null;
  payment_terms: string | null;
  payment_method: string | null;
  status: string | null;
  subtotal_ht: number | null;
  tva_rate: number | null;
  tva_amount: number | null;
  total_ttc: number | null;
  notes: string | null;
  custom_title: string | null;
  month_period: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderData {
  company_id: string;
  client_id?: string | null;
  supplier_name?: string | null;
  supplier_address?: string | null;
  supplier_email?: string | null;
  supplier_phone?: string | null;
  supplier_rc?: string | null;
  supplier_nif?: string | null;
  supplier_nis?: string | null;
  supplier_ai?: string | null;
  order_date: string;
  delivery_date?: string;
  payment_terms?: string;
  payment_method?: string;
  notes?: string;
  custom_title?: string;
  order_number?: string;
  items: {
    product_id?: string | null;
    product_name?: string | null;
    product_code?: string | null;
    quantity: number;
    unit_price: number
  }[];
}

// ============= DELIVERY NOTES =============

export interface DeliveryNote {
  id: string;
  company_id: string | null;
  delivery_number: string;
  client_id: string;
  delivery_date: string;
  invoice_id: string | null;
  order_id: string | null;
  truck_plate: string | null;
  driver_name: string | null;
  deliverer_name: string | null;
  deliverer_nin: string | null;
  transporter_name: string | null;
  transporter_nin: string | null;
  delivery_location: string | null;
  client_received_date: string | null;
  client_signature: string | null;
  supplier_delivered_date: string | null;
  is_invoiced: boolean | null;
  notes: string | null;
  reserves: string | null;
  custom_title?: string | null;
  /** Digital delivery-tracking status — see set_delivery_status. */
  status: DeliveryNoteStatus;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DeliveryNoteStatus = "draft" | "printed" | "signed";

export interface CreateDeliveryNoteData {
  company_id: string;
  client_id: string;
  delivery_date: string;
  order_id?: string;
  truck_plate?: string;
  driver_name?: string;
  deliverer_name?: string;
  deliverer_nin?: string;
  transporter_name?: string;
  transporter_nin?: string;
  delivery_location?: string;
  notes?: string;
  reserves?: string;
  custom_title?: string;
  delivery_number?: string;
  supplier_delivered_date?: string;
  client_received_date?: string;
  /** "Nom du réceptionnaire" — a plain text field despite the column name. */
  client_signature?: string;
  items: {
    product_id?: string;
    /** Only meaningful when product_id is absent — a custom/one-off item. */
    product_name?: string;
    product_code?: string;
    quantity: number;
    unit_price?: number;
    tva_rate?: number;
  }[];
}

// ============= EXPENSES =============

export interface Expense {
  id: string;
  company_id: string | null;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  month_period: string | null;
  project_id?: string | null;
  /** Denormalized by the backend — the linked project's name, if any. */
  project_name?: string | null;
  supplier_id?: string | null;
  /** Denormalized by the backend — the linked supplier's name, if any. */
  supplier_name?: string | null;
  is_recurring?: boolean | null;
  recurrence_interval?: string | null;
  /** Payment-completion flag for the Charges & Dépenses page's STATUT
   *  column — true (the default) means the cash was actually disbursed,
   *  false means a recorded commitment still "à payer". */
  is_paid: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateExpenseData {
  company_id: string;
  expense_date: string;
  category: string;
  description?: string;
  amount: number;
  payment_method?: string;
  reference?: string;
  notes?: string;
  project_id?: string;
  supplier_id?: string;
  is_recurring?: boolean;
  recurrence_interval?: string;
  is_paid?: boolean;
}

export interface UpdateExpenseData {
  id: string;
  expense_date: string;
  category: string;
  description?: string;
  amount: number;
  payment_method?: string;
  project_id?: string;
  is_paid: boolean;
}

// ============= ACTIVITÉS & RAPPELS =============
// Odoo-chatter-style follow-up tasks attached to any record — distinct from
// ActivityLog (the read-only audit trail behind History.tsx).

export type ActivityEntityType = "invoice" | "client" | "supplier" | "quote";
export type ActivityKind = "call" | "email" | "meeting" | "todo";

export interface Activity {
  id: string;
  company_id: string | null;
  entity_type: ActivityEntityType;
  entity_id: string;
  title: string;
  activity_type: ActivityKind;
  due_date: string;
  done_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateActivityData {
  company_id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  title: string;
  activity_type: ActivityKind;
  due_date: string;
  notes?: string;
}


// ============= PRODUCTION =============

export interface ProductionLog {
  id: string;
  date: string;
  extraction: number;
  waste: number;
  merchant_product: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductionLogData {
  date: string;
  extraction: number;
  waste: number;
  merchant_product: number;
  notes?: string;
}

// ============= EMPLOYEES =============

export interface Employee {
  id: string;
  company_id: string | null;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  // omada-agency branch only — HR/payroll fields.
  base_salary: number | null;
  hire_date: string | null;
  contract_type: string | null;
  rib: string | null;
  external_code: string | null;
  /** Relative to app_data_dir, e.g. "employee_photos/<id>.jpg" — resolve with useAppDataDir + convertFileSrc. */
  photo_path: string | null;
}

export interface CreateEmployeeData {
  company_id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  address?: string;
  base_salary?: number | null;
  hire_date?: string | null;
  contract_type?: string | null;
  rib?: string | null;
  external_code?: string | null;
  /** Only consulted by the update path — creating an employee always
   *  starts them active. */
  is_active?: boolean;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  name: string;
  doc_type: string | null;
  /** Relative to app_data_dir — resolve with useAppDataDir + convertFileSrc/openPath. */
  file_path: string;
  created_at: string;
}

export interface EmployeeTaskWorkload {
  employee_id: string;
  employee_name: string;
  task_count: number;
  photo_path: string | null;
}

// ============= HR / PAYROLL (omada-agency branch only) =============
// Not part of the core Sordi product. See PROJECT_STATE.md.

export interface EmployeeAbsenceStats {
  employee_id: string;
  month: string;
  working_days_in_month: number;
  absence_days: number;
  flagged: boolean;
}

export type DayAttendanceStatus = "present" | "late" | "absent" | "weekend";

export interface DayAttendance {
  date: string;
  status: DayAttendanceStatus;
  arrival_time: string | null;
  late_minutes: number | null;
}

export interface EmployeeDailyAttendance {
  employee_id: string;
  month: string;
  days: DayAttendance[];
  present_count: number;
  late_count: number;
  absent_count: number;
}

export interface PunchImportRow {
  external_code: string;
  punch_time: string;
}

export interface PunchImportSummary {
  imported: number;
  skipped_duplicates: number;
  invalid_format: number;
  unmatched_employee_codes: string[];
}

export interface UnmappedDeviceCode {
  external_code: string;
  punch_count: number;
  last_punch_time: string;
}

export interface EmployeeAdvance {
  id: string;
  employee_id: string;
  amount: number;
  date_taken: string;
  month_to_deduct: string;
  deducted: boolean;
  deducted_in_payroll_run_id: string | null;
  created_at: string;
}

export interface CreateEmployeeAdvanceData {
  employee_id: string;
  amount: number;
  date_taken: string;
}

export interface EmployeeAdvanceTotals {
  total_taken: number;
  total_pending: number;
}

export interface PayrollRun {
  id: string;
  employee_id: string;
  month: string;
  base_salary: number;
  working_days_in_month: number;
  absence_days: number;
  daily_rate: number;
  absence_deduction: number;
  primes: number;
  avance_deduction: number;
  net_a_payer: number;
  paid: boolean;
  paid_date: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
}

export interface PayrollDashboardStats {
  month: string;
  total_payroll_cost: number;
  flagged_employee_count: number;
  pending_payroll_count: number;
}

export interface EmployeeHrStats {
  active_count: number;
  inactive_count: number;
  monthly_payroll: number;
  total_paid_year: number;
}

export interface EmployeePayrollSummary {
  employee_id: string;
  total_paid: number;
  last_paid_month: string | null;
  last_paid_amount: number | null;
}

export interface UpdatePayrollRunData {
  id: string;
  base_salary: number;
  working_days_in_month: number;
  absence_days: number;
  daily_rate: number;
  absence_deduction: number;
  primes: number;
  avance_deduction: number;
  net_a_payer: number;
  notes?: string | null;
}

// ============= CLIENT DRAFT PRODUCTS =============

export interface ClientDraftProduct {
  id: string;
  client_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
  product_code?: string;
  product_name?: string;
  tva_rate?: number;
  timbre_exempt?: boolean;
}

export interface CreateClientDraftProductData {
  client_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
}

// ============= PROJECTS (omada-agency branch only) =============
// Agency project-management module — client-linked, invoice-derived budget.
// Not part of the core Sordi product.

export type FreelancePaymentStatus = "non_paye" | "paye";

/** Explicit, manually-set operational lifecycle status — never computed
 *  from payment/task data. See PROJECT_STATUS_STYLES in projectOverview.ts
 *  for the label/tone each one renders as. */
export type ProjectLifecycleStatus = "en_cours" | "termine" | "en_pause";

export interface Project {
  id: string;
  company_id: string | null;
  client_id: string;
  name: string;
  service_categories: string[];
  responsible_person: string | null;
  start_date: string | null;
  deadline: string | null;
  planned_budget: number;
  created_at: string;
  updated_at: string;
  // omada-agency branch only — freelancer lump-sum payment tracking.
  freelancer_id: string | null;
  montant_convenu: number | null;
  statut_paiement: FreelancePaymentStatus;
  date_paiement: string | null;
  status: ProjectLifecycleStatus;
}

export interface CreateProjectData {
  company_id: string;
  client_id: string;
  name: string;
  service_categories: string[];
  responsible_person?: string | null;
  start_date?: string | null;
  deadline?: string | null;
  planned_budget: number;
  freelancer_id?: string | null;
  montant_convenu?: number | null;
  status?: ProjectLifecycleStatus;
}

export interface FreelancePayment {
  project_id: string;
  project_name: string;
  freelancer_id: string;
  freelancer_name: string;
  montant_convenu: number | null;
  statut_paiement: FreelancePaymentStatus;
  date_paiement: string | null;
}

/** Raw aggregation only (mirrors ClientOverviewStats) — every status/
 *  threshold rule lives in src/lib/projectOverview.ts, not here. */
export interface ProjectStats {
  project_id: string;
  planned_budget: number;
  budget_facture: number;
  budget_paye: number;
  task_count: number;
  tasks_approved_count: number;
  start_date: string | null;
  deadline: string | null;
}

/** Real net profitability (HT revenue minus direct costs) — distinct from
 *  ProjectStats above, which tracks planned-budget consumption on a TTC
 *  basis. See get_project_profitability. */
export interface ProjectProfitability {
  project_id: string;
  revenue_ht: number;
  /** SUM(payments.amount) across every invoice linked to this project. */
  total_collected: number;
  direct_expenses: number;
  net_margin: number;
  margin_percentage: number;
}

// ============= CONTRACTS (bespoke multi-service client contracts) =============

/** Keys into CONTRACT_SERVICE_CATALOG (see lib/contractServices.ts). */
export type ContractServiceKey =
  | "branding"
  | "web_vitrine"
  | "ecommerce"
  | "marketing"
  | "media_shooting"
  | "video_ads";

/** Keys into CONTRACT_PAYMENT_SPLITS (see lib/contractServices.ts). */
export type ContractPaymentSplit = "50_50" | "100" | "30_40_30";

export interface ContractInvoiceRef {
  id: string;
  invoice_number: string;
  amount_ttc: number;
  /** Which payment milestone this line covers — "acompte", "tranche_2", or "solde". */
  role: "acompte" | "tranche_2" | "solde";
}

export interface Contract {
  id: string;
  company_id: string;
  /** Optional — a contract can stand alone without a linked project. */
  project_id: string | null;
  client_id: string;
  contract_ref: string;
  selected_services: ContractServiceKey[];
  payment_split: ContractPaymentSplit;
  total_amount_ht: number;
  tva_rate: number;
  tva_amount: number;
  total_amount_ttc: number;
  invoices: ContractInvoiceRef[];
  created_at: string;
}

export interface CreateContractData {
  company_id: string;
  project_id?: string | null;
  client_id: string;
  selected_services: ContractServiceKey[];
  payment_split: ContractPaymentSplit;
  total_amount_ht: number;
  tva_rate: number;
  tva_amount: number;
  total_amount_ttc: number;
  invoices: ContractInvoiceRef[];
}

// ============= PARTNERS & EQUITY DISTRIBUTION =============

export interface Partner {
  id: string;
  company_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  equity_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePartnerData {
  company_id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  equity_percentage: number;
}

export interface UpdatePartnerData {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  equity_percentage: number;
  is_active: boolean;
}

/** A partner plus its computed distribution breakdown for a given period —
 *  what db.partners.getAll returns. total_withdrawn/remaining_balance are
 *  all-time, not period-scoped (see get_partners). */
export interface PartnerFinancials {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  equity_percentage: number;
  is_active: boolean;
  allocated_profit: number;
  total_withdrawn: number;
  remaining_balance: number;
  created_at: string;
  updated_at: string;
}

export interface PartnerWithdrawal {
  id: string;
  partner_id: string;
  withdrawal_date: string;
  amount: number;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateWithdrawalData {
  partner_id: string;
  withdrawal_date: string;
  amount: number;
  payment_method?: string;
  notes?: string;
}

/** One row of the "Rapport Mensuel d'Activité & Clôture" partner
 *  distribution table — strictly month-scoped, unlike PartnerFinancials'
 *  all-time withdrawal figures. See get_monthly_partners_report. */
export interface MonthlyReportPartnerRow {
  id: string;
  name: string;
  role: string | null;
  equity_percentage: number;
  quote_part_benefice: number;
  prelevements_du_mois: number;
  solde_net_a_verser: number;
}

/** A project whose deadline falls within the report month, with its
 *  all-time margin (there is no per-month project profitability in the
 *  schema — see MonthlyBusinessReport.projets_clotures doc on the Rust side). */
export interface MonthlyReportProjectRow {
  id: string;
  name: string;
  client_name: string;
  deadline: string;
  revenue_ht: number;
  net_margin: number;
  margin_percentage: number;
}

export interface MonthlyBusinessReport {
  month: string;
  year: number;
  month_num: number;
  /** Derived running cash total, not a real bank balance — see the Rust
   *  doc comment on MonthlyBusinessReport::solde_initial. Always label this
   *  as calculated in any UI/PDF that shows it. */
  solde_initial: number;
  recettes_ht: number;
  recettes_encaissees: number;
  charges_operationnelles: number;
  masse_salariale: number;
  solde_final: number;
  benefice_net: number;
  partners: MonthlyReportPartnerRow[];
  total_prelevements_mois: number;
  employes_actifs_count: number;
  total_jours_travailles: number;
  masse_salariale_payee: number;
  masse_salariale_en_attente: number;
  projets_clotures: MonthlyReportProjectRow[];
  generated_at: string;
}

export type ProjectTaskStatus = "à_faire" | "en_cours" | "en_revision_interne" | "envoye_client" | "approuve";

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  assigned_resource_id: string | null;
  status: ProjectTaskStatus;
  revision_count: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectTaskData {
  project_id: string;
  title: string;
  assigned_resource_id?: string | null;
  due_date?: string | null;
}

export interface UpdateProjectTaskData {
  title: string;
  assigned_resource_id?: string | null;
  due_date?: string | null;
}

export interface ProjectDeliverable {
  id: string;
  project_id: string;
  name: string;
  type: string | null;
  link_or_path: string | null;
  delivered_to_client: boolean;
  approved: boolean;
  created_at: string;
}

export interface CreateProjectDeliverableData {
  project_id: string;
  name: string;
  type?: string | null;
  link_or_path?: string | null;
}

export interface UpdateProjectDeliverableData {
  name: string;
  type?: string | null;
  link_or_path?: string | null;
  delivered_to_client: boolean;
  approved: boolean;
}

// ============= HISTORY =============

export interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  user_id: string | null;
  created_at: string;
}

export const db = {
  // Licensing
  license: {
    getStatus: (): Promise<LicenseStatus> =>
      safeInvoke("get_license_status", undefined, () => ({ state: "active", client_reference_id: null, expires_at: null })),
    // No fallback on purpose: safeInvoke's catch block calls the fallback
    // on ANY invoke failure in Tauri mode too, not just web-mode — for
    // every other command here that's a harmless degrade, but activate
    // MUST surface a real "invalid license key" rejection from Rust/the
    // API as-is, not have it silently replaced by a fallback message.
    activate: (license_key: string): Promise<LicenseStatus> => safeInvoke("activate_license", { licenseKey: license_key }),
    // Same "no silent fallback" rule as activate above — a failed trial
    // request (e.g. unreachable API) must surface as a real error to
    // SetupWizard's Step 4, not silently pretend to succeed.
    requestTrial: (input: { organizationName: string; phone: string; email: string }): Promise<LicenseStatus> =>
      safeInvoke("request_trial", {
        organizationName: input.organizationName,
        phone: input.phone,
        email: input.email,
      }),
    verifyBackground: (): Promise<LicenseStatus> =>
      safeInvoke("verify_license_background", undefined, () => ({ state: "active", client_reference_id: null, expires_at: null })),
    // Human-readable "SRD-XXXX-XXXX-XXXX" code for manual activation (see
    // license.rs's compute_machine_id) — distinct from the opaque device
    // fingerprint embedded in the license token itself, which is never
    // exposed to the frontend at all.
    getMachineId: (): Promise<string> => safeInvoke("get_machine_id", undefined, () => "SRD-0000-0000-0000"),
  },
  // Anonymous diagnostic heartbeat status/toggle — see telemetry.rs. The
  // actual send is entirely background/Rust-side (fired once from
  // lib.rs's setup(), never invoked from the frontend); these two just
  // read/change the disclosed opt-out preference shown in Settings.
  telemetry: {
    getStatus: (): Promise<TelemetryStatus> =>
      safeInvoke("get_telemetry_status", undefined, () => ({ enabled: true, lastSentAt: null })),
    setEnabled: (enabled: boolean): Promise<void> => safeInvoke("set_telemetry_enabled", { enabled }, () => {}),
  },
  // Global search (Phase 1: clients + invoices — see search_global in commands.rs)
  search: {
    global: (company_id: string, query: string): Promise<GlobalSearchResults> =>
      safeInvoke("search_global", { companyId: company_id, query }, () => ({ clients: [], invoices: [] })),
  },
  // History
  history: {
    getLogs: (limit?: number, entity_type?: string, action?: string, start_date?: string, end_date?: string) =>
      safeInvoke<ActivityLog[]>("get_activity_logs", { limit, entityType: entity_type, action, startDate: start_date, endDate: end_date }, () => mockStore.getActivityLogs(limit, entity_type, action, start_date, end_date)),
    log: (data: { action: string; entity_type: string; entity_id?: string | null; description: string }): Promise<void> =>
      safeInvoke("log_activity", { data }, () => mockStore.logActivity(data)),
    // No fallback on purpose, same reasoning as license.activate: this is
    // destructive and license-gated — a real rejection (e.g. read-only
    // mode) must reach the UI as-is, not be replaced by a silent no-op.
    clear: (): Promise<void> => safeInvoke("clear_activity_logs"),
  },
  system: {
    // No fallback on purpose — same reasoning as history.clear, this is
    // destructive and license-gated, a real rejection must reach the UI as-is.
    resetToFactoryState: (company_id: string): Promise<void> =>
      safeInvoke("reset_company_to_factory_state", { companyId: company_id }),
  },
  // Companies (multi-workspace) — no mock fallback beyond an empty/default
  // list, since web-preview mode has no concept of switching workspaces.
  companies: {
    getAll: (): Promise<Company[]> => safeInvoke("get_companies", undefined, () => mockStore.getCompanies()),
    getById: (id: string): Promise<Company | null> => safeInvoke("get_company", { id }, () => mockStore.getCompany(id)),
    create: (data: CreateCompanyData): Promise<Company> => safeInvoke("create_company", { data }, () => mockStore.createCompany(data)),
    update: (id: string, data: CreateCompanyData): Promise<Company> => safeInvoke("update_company", { id, data }, () => mockStore.updateCompany(id, data)),
  },

  // Clients
  clients: {
    getAll: (company_id: string): Promise<Client[]> => safeInvoke("get_clients", { companyId: company_id }, () => mockStore.getClients()),
    getById: (id: string): Promise<Client | null> => safeInvoke("get_client", { id }, () => mockStore.getClient(id)),
    create: (data: CreateClientData): Promise<Client> => safeInvoke("create_client", { data }, () => mockStore.createClient(data)),
    update: (id: string, data: Omit<CreateClientData, "company_id">): Promise<Client> => safeInvoke("update_client", { id, data }, () => mockStore.updateClient(id, data as CreateClientData)),
    delete: (id: string): Promise<void> => safeInvoke("delete_client", { id }, () => mockStore.deleteClient(id)),
    getProducts: (client_id: string, productId?: string, month?: string, year?: number): Promise<any[]> =>
      safeInvoke("get_client_products", { clientId: client_id, productId, month, year }, () => mockStore.getClientProductCumulatives(year, month ? [month] : undefined)),
    // client_id omitted -> stats for every client in one call (clients list badge).
    // client_id set -> just that client (client detail "Aperçu" section).
    getOverviewStats: (company_id: string, client_id?: string): Promise<ClientOverviewStats[]> =>
      safeInvoke("get_client_overview_stats", { companyId: company_id, clientId: client_id }, () => []),
  },

  // Suppliers (Fournisseurs)
  suppliers: {
    getAll: (company_id: string): Promise<Supplier[]> => safeInvoke("get_suppliers", { companyId: company_id }, () => mockStore.getSuppliers()),
    getById: (id: string): Promise<Supplier | null> => safeInvoke("get_supplier", { id }, () => mockStore.getSupplier(id)),
    create: (data: CreateSupplierData): Promise<Supplier> => safeInvoke("create_supplier", { data }, () => mockStore.createSupplier(data)),
    update: (id: string, data: Omit<CreateSupplierData, "company_id">): Promise<Supplier> => safeInvoke("update_supplier", { id, data }, () => mockStore.updateSupplier(id, data as CreateSupplierData)),
    delete: (id: string): Promise<void> => safeInvoke("delete_supplier", { id }, () => mockStore.deleteSupplier(id)),
    getPurchaseTotals: (company_id: string): Promise<SupplierPurchaseTotal[]> =>
      safeInvoke("get_supplier_purchase_totals", { companyId: company_id }, () => mockStore.getSupplierPurchaseTotals()),
  },

  // Client Draft Products
  clientDrafts: {
    getAll: (client_id: string): Promise<ClientDraftProduct[]> =>
      safeInvoke("get_client_draft_products", { clientId: client_id }, () => []),
    create: (data: CreateClientDraftProductData): Promise<ClientDraftProduct> =>
      safeInvoke("add_client_draft_product", { data }, () => ({ id: "draft-" + Date.now(), client_id: data.client_id, product_id: data.product_id, quantity: data.quantity, unit_price: data.unit_price, amount: data.quantity * data.unit_price, created_at: new Date().toISOString() })),
    updateQuantity: (id: string, quantity: number): Promise<ClientDraftProduct> =>
      safeInvoke("update_client_draft_product_quantity", { data: { id, quantity } }, () => ({} as any)),
    delete: (id: string): Promise<void> =>
      safeInvoke("delete_client_draft_product", { id }, () => {}),
    clear: (client_id: string): Promise<void> =>
      safeInvoke("clear_client_draft_products", { clientId: client_id }, () => {}),
  },

  // Client Advances
  clientAdvances: {
    getAll: (client_id: string): Promise<ClientAdvance[]> =>
      safeInvoke("get_client_advances", { clientId: client_id }, () => mockStore.getClientAdvances(client_id)),
    create: (data: CreateClientAdvanceData): Promise<ClientAdvance> =>
      safeInvoke("add_client_advance", { data }, () => mockStore.createClientAdvance(data)),
    update: (data: UpdateClientAdvanceData): Promise<ClientAdvance> =>
      safeInvoke("update_client_advance", { data }, () => mockStore.updateClientAdvance(data)),
    delete: (id: string): Promise<void> =>
      safeInvoke("delete_client_advance", { id }, () => mockStore.deleteClientAdvance(id)),
  },

  // Products
  products: {
    getAll: (company_id: string): Promise<Product[]> => safeInvoke("get_products", { companyId: company_id }, () => mockStore.getProducts()),
    create: (data: CreateProductData): Promise<Product> => safeInvoke("create_product", { data }, () => mockStore.createProduct(data)),
    updatePrice: (id: string, unit_price: number): Promise<Product> => safeInvoke("update_product_price", { id, unit_price }, () => mockStore.updateProduct(id, { code: "", name: "", unit_price } as CreateProductData)),
    update: (id: string, data: Omit<CreateProductData, "company_id">): Promise<Product> => safeInvoke("update_product", { id, data }, () => mockStore.updateProduct(id, data as CreateProductData)),
    delete: (id: string): Promise<void> => safeInvoke("delete_product", { id }, () => mockStore.deleteProduct(id)),
    getSalesStats: (company_id: string, year?: number, months?: string[]): Promise<any[]> => safeInvoke("get_product_sales_stats", { companyId: company_id, year, months }, () => mockStore.getDashboardStats(year, months).product_stats),
  },

  // Invoices
  invoices: {
    getAll: async (company_id: string, status?: string, invoiceType?: string) => {
      return safeInvoke<Invoice[]>("get_invoices", { companyId: company_id, status, invoiceType }, () => mockStore.getInvoices(status, invoiceType));
    },
    getAllWithClients: async (company_id: string, status?: string, invoiceType?: string) => {
      return safeInvoke<InvoiceWithClient[]>("get_invoices_with_clients", { companyId: company_id, status, invoiceType }, () => mockStore.getInvoicesWithClients(status, invoiceType));
    },
    getById: async (id: string) => safeInvoke<Invoice | null>("get_invoice", { id }, () => mockStore.getInvoice(id)),
    getItems: (invoice_id: string): Promise<any[]> => safeInvoke("get_invoice_items", { invoiceId: invoice_id }, () => mockStore.getInvoiceItems(invoice_id)),
    getNextNumber: (): Promise<string> => safeInvoke("get_next_invoice_number", undefined, () => mockStore.getNextInvoiceNumber()),
    create: (data: CreateInvoiceData): Promise<Invoice> => safeInvoke("create_invoice", { data }, () => mockStore.createInvoice(data)),
    update: (id: string, data: Omit<CreateInvoiceData, "company_id">): Promise<Invoice> => safeInvoke("update_invoice", { id, data }, () => mockStore.updateInvoice(id, data as CreateInvoiceData)),
    updateStatus: (id: string, status: string) => safeInvoke("update_invoice_status", { id, status }, () => mockStore.updateInvoiceStatus(id, status)),
    updateHeader: (id: string, invoiceNumber: string, customTitle: string | null) =>
      safeInvoke("update_invoice_header", { id, invoiceNumber, customTitle }, () => mockStore.updateInvoiceHeader(id, invoiceNumber, customTitle)),
    delete: (id: string) => safeInvoke("delete_invoice", { id }, () => mockStore.deleteInvoice(id)),
    // Clones the proforma into a brand-new invoice (its own number, today's
    // date) and marks the source proforma "converted" — it stays visible,
    // linked to the invoice it became, rather than being mutated in place.
    convertProforma: (id: string): Promise<Invoice> => safeInvoke("convert_proforma_to_invoice", { id }, () => mockStore.getInvoice(id)!),
  },

  // Payments
  payments: {
    getAll: (company_id: string, invoice_id?: string): Promise<Payment[]> => safeInvoke("get_payments", { companyId: company_id, invoice_id }, () => mockStore.getPayments(invoice_id)),
    create: (data: CreatePaymentData): Promise<Payment> => safeInvoke("create_payment", { data }, () => mockStore.createPayment(data)),
    update: (data: UpdatePaymentData): Promise<Payment> => safeInvoke("update_payment", { data }),
    delete: (id: string): Promise<void> => safeInvoke("delete_payment", { id }, () => mockStore.deletePayment(id)),
  },

  // Payment attachments (proof of payment — receipt, bank slip, cheque
  // copy). Files are copied to app_data_dir, same convention as employee
  // documents — no mock fallback, same as those, since web preview has no
  // filesystem to copy into.
  paymentAttachments: {
    getAll: (payment_id: string): Promise<PaymentAttachment[]> =>
      safeInvoke("get_payment_attachments", { paymentId: payment_id }, () => []),
    add: (payment_id: string, source_path: string, file_name: string): Promise<PaymentAttachment> =>
      safeInvoke("add_payment_attachment", { paymentId: payment_id, sourcePath: source_path, fileName: file_name }),
    delete: (id: string): Promise<void> => safeInvoke("delete_payment_attachment", { id }),
  },

  // Orders
  orders: {
    getAll: (company_id: string): Promise<Order[]> => safeInvoke("get_orders", { companyId: company_id }, () => mockStore.getOrders()),
    getById: (id: string): Promise<Order | null> => safeInvoke("get_order", { id }, () => mockStore.getOrder(id)),
    getItems: (order_id: string): Promise<any[]> => safeInvoke("get_order_items", { orderId: order_id }, () => []),
    create: (data: CreateOrderData): Promise<Order> => safeInvoke("create_order", { data }, () => mockStore.createOrder(data)),
    update: (id: string, data: Omit<CreateOrderData, "company_id">): Promise<Order> => safeInvoke("update_order", { id, data }, () => mockStore.updateOrder(id, data as CreateOrderData)),
    updateStatus: (id: string, status: string): Promise<Order> => safeInvoke("update_order_status", { id, status }, () => ({} as any)),
    delete: (id: string): Promise<void> => safeInvoke("delete_order", { id }, () => {}),
  },

  // Delivery Notes
  deliveryNotes: {
    getAll: (company_id: string, client_id?: string, is_invoiced?: boolean): Promise<DeliveryNote[]> => safeInvoke("get_delivery_notes", { companyId: company_id, client_id, is_invoiced }, () => mockStore.getDeliveryNotes(client_id)),
    getById: (id: string): Promise<DeliveryNote | null> => safeInvoke("get_delivery_note", { id }, () => mockStore.getDeliveryNote(id)),
    getItems: (deliveryNoteId: string): Promise<any[]> => safeInvoke("get_delivery_note_items", { deliveryNoteId }, () => []),
    create: (data: CreateDeliveryNoteData): Promise<DeliveryNote> => safeInvoke("create_delivery_note", { data }, () => mockStore.createDeliveryNote(data)),
    update: (id: string, data: Omit<CreateDeliveryNoteData, "company_id">): Promise<DeliveryNote> => safeInvoke("update_delivery_note", { id, data }, () => mockStore.updateDeliveryNote(id, data as CreateDeliveryNoteData)),
    updateStatus: (id: string, status: DeliveryNoteStatus): Promise<DeliveryNote> => safeInvoke("set_delivery_status", { id, status }, () => ({} as any)),
    delete: (id: string): Promise<void> => safeInvoke("delete_delivery_note", { id }, () => {}),
  },

  // Expenses
  expenses: {
    getAll: (company_id: string, month_period?: string, project_id?: string): Promise<Expense[]> =>
      safeInvoke("get_expenses", { companyId: company_id, month_period, project_id }, () => mockStore.getExpenses(month_period, project_id)),
    create: (data: CreateExpenseData): Promise<Expense> => safeInvoke("create_expense", { data }, () => mockStore.createExpense(data)),
    update: (data: UpdateExpenseData): Promise<Expense> => safeInvoke("update_expense", { data }, () => mockStore.updateExpense(data)),
    delete: (id: string): Promise<void> => safeInvoke("delete_expense", { id }, () => mockStore.deleteExpense(id)),
  },

  activities: {
    list: (company_id: string, entity_type?: ActivityEntityType, entity_id?: string): Promise<Activity[]> =>
      safeInvoke("list_activities", { companyId: company_id, entityType: entity_type, entityId: entity_id }, () => []),
    create: (data: CreateActivityData): Promise<Activity> => safeInvoke("create_activity", { data }, () => ({ ...data, id: crypto.randomUUID(), done_at: null, notes: data.notes ?? null, created_at: new Date().toISOString() } as Activity)),
    complete: (id: string): Promise<Activity> => safeInvoke("complete_activity", { id }, () => { throw new Error("complete_activity not available in web mode"); }),
    delete: (id: string): Promise<void> => safeInvoke("delete_activity", { id }, () => {}),
  },

  // Dashboard
  dashboard: {
    getStats: (company_id: string, year?: number, months?: string[]): Promise<DashboardStats> => safeInvoke("get_dashboard_stats", { companyId: company_id, year, months }, () => mockStore.getDashboardStats(year, months)),
    getClientProductCumulatives: (company_id: string, year?: number, months?: string[]): Promise<any[]> => safeInvoke("get_client_product_cumulatives", { companyId: company_id, year, months }, () => mockStore.getClientProductCumulatives(year, months)),
    getClientCumulatives: (company_id: string, year?: number, months?: string[]): Promise<ClientCumulativeRecord[]> => safeInvoke("get_client_cumulatives", { companyId: company_id, year, months }, () => mockStore.getClientCumulatives(year, months)),
  },

  // Production Logs
  production: {
    getAll: (month?: number, year?: number): Promise<ProductionLog[]> => safeInvoke("get_production_logs", { month, year }, () => []),
    create: (data: CreateProductionLogData): Promise<ProductionLog> => safeInvoke("create_production_log", { data }, () => ({} as any)),
    update: (id: string, data: CreateProductionLogData): Promise<ProductionLog> => safeInvoke("update_production_log", { id, data }, () => ({} as any)),
    delete: (id: string): Promise<void> => safeInvoke("delete_production_log", { id }, () => {}),
  },

  // Employees
  employees: {
    getAll: (company_id: string): Promise<Employee[]> => safeInvoke("get_employees", { companyId: company_id }, () => mockStore.getEmployees()),
    create: (data: CreateEmployeeData): Promise<Employee> => safeInvoke("create_employee", { data }, () => mockStore.createEmployee(data)),
    update: (id: string, data: Omit<CreateEmployeeData, "company_id">): Promise<Employee> => safeInvoke("update_employee", { id, data }, () => ({} as any)),
    delete: (id: string): Promise<void> => safeInvoke("delete_employee", { id }, () => {}),
    setPhoto: (employee_id: string, source_path: string): Promise<Employee> =>
      safeInvoke("set_employee_photo", { employeeId: employee_id, sourcePath: source_path }),
    removePhoto: (employee_id: string): Promise<Employee> => safeInvoke("remove_employee_photo", { employeeId: employee_id }),
  },

  // Employee documents (omada-agency branch only)
  employeeDocuments: {
    getAll: (employee_id: string): Promise<EmployeeDocument[]> => safeInvoke("get_employee_documents", { employeeId: employee_id }, () => []),
    add: (employee_id: string, source_path: string, name: string, doc_type: string | null): Promise<EmployeeDocument> =>
      safeInvoke("add_employee_document", { employeeId: employee_id, sourcePath: source_path, name, docType: doc_type }),
    delete: (id: string): Promise<void> => safeInvoke("delete_employee_document", { id }),
  },
  employeeTaskWorkload: {
    getAll: (company_id: string): Promise<EmployeeTaskWorkload[]> => safeInvoke("get_employee_task_workload", { companyId: company_id }, () => []),
  },

  // HR / Payroll (omada-agency branch only)
  attendance: {
    import: (company_id: string, rows: PunchImportRow[]): Promise<PunchImportSummary> => safeInvoke("import_punch_records", { companyId: company_id, rows }),
    getUnmappedCodes: (month?: string): Promise<UnmappedDeviceCode[]> => safeInvoke("get_unmapped_device_codes", { month }, () => []),
  },
  employeeAdvances: {
    getAll: (employee_id: string): Promise<EmployeeAdvance[]> => safeInvoke("get_employee_advances", { employeeId: employee_id }, () => []),
    getTotals: (employee_id: string): Promise<EmployeeAdvanceTotals> =>
      safeInvoke("get_employee_advance_totals", { employeeId: employee_id }, () => ({ total_taken: 0, total_pending: 0 })),
    create: (data: CreateEmployeeAdvanceData): Promise<EmployeeAdvance> => safeInvoke("create_employee_advance", { data }),
    setDeducted: (id: string, deducted: boolean): Promise<EmployeeAdvance> => safeInvoke("set_employee_advance_deducted", { id, deducted }),
  },
  payroll: {
    getAbsenceStats: (employee_id: string, month: string): Promise<EmployeeAbsenceStats> =>
      safeInvoke("get_employee_absence_stats", { employeeId: employee_id, month }),
    getDailyAttendance: (employee_id: string, month: string): Promise<EmployeeDailyAttendance> =>
      safeInvoke("get_employee_daily_attendance", { employeeId: employee_id, month }),
    run: (employee_id: string, month: string, primes?: number): Promise<PayrollRun> =>
      safeInvoke("run_payroll", { employeeId: employee_id, month, primes }),
    getRuns: (employee_id?: string, month?: string, paid?: boolean): Promise<PayrollRun[]> =>
      safeInvoke("get_payroll_runs", { employeeId: employee_id, month, paid }, () => []),
    setPaid: (id: string, paid: boolean, paid_date: string | null): Promise<PayrollRun> =>
      safeInvoke("update_payroll_paid", { id, paid, paidDate: paid_date }),
    update: (data: UpdatePayrollRunData): Promise<PayrollRun> => safeInvoke("update_payroll_run", { data }),
    delete: (id: string): Promise<void> => safeInvoke("delete_payroll_run", { id }),
    getDashboardStats: (company_id: string, month: string): Promise<PayrollDashboardStats> =>
      safeInvoke("get_payroll_dashboard_stats", { companyId: company_id, month }, () => ({ month, total_payroll_cost: 0, flagged_employee_count: 0, pending_payroll_count: 0 })),
    getHrStats: (company_id: string, year: string): Promise<EmployeeHrStats> =>
      safeInvoke("get_employee_hr_stats", { companyId: company_id, year }, () => ({ active_count: 0, inactive_count: 0, monthly_payroll: 0, total_paid_year: 0 })),
    getEmployeeSummaries: (company_id: string): Promise<EmployeePayrollSummary[]> =>
      safeInvoke("get_employee_payroll_summaries", { companyId: company_id }, () => []),
  },

  // Projects (omada-agency branch only)
  projects: {
    getAll: (company_id: string): Promise<Project[]> => safeInvoke("get_projects", { companyId: company_id }, () => mockStore.getProjects()),
    getById: (id: string): Promise<Project | null> => safeInvoke("get_project", { id }, () => mockStore.getProject(id)),
    create: (data: CreateProjectData): Promise<Project> => safeInvoke("create_project", { data }),
    update: (id: string, data: Omit<CreateProjectData, "company_id">): Promise<Project> => safeInvoke("update_project", { id, data }),
    delete: (id: string): Promise<void> => safeInvoke("delete_project", { id }),
    updateStatus: (id: string, status: ProjectLifecycleStatus): Promise<Project> => safeInvoke("update_project_status", { id, status }),
    setFreelancerPaymentStatus: (project_id: string, statut_paiement: FreelancePaymentStatus, date_paiement: string | null): Promise<Project> =>
      safeInvoke("update_freelancer_payment_status", { projectId: project_id, statutPaiement: statut_paiement, datePaiement: date_paiement }),
    getFreelancePayments: (company_id: string): Promise<FreelancePayment[]> => safeInvoke("get_freelance_payments", { companyId: company_id }, () => []),
    assignFreelancePayment: (
      project_id: string,
      freelancer_id: string,
      montant_convenu: number,
      statut_paiement: FreelancePaymentStatus,
      date_paiement: string | null
    ): Promise<Project> =>
      safeInvoke("assign_freelance_payment", {
        projectId: project_id,
        freelancerId: freelancer_id,
        montantConvenu: montant_convenu,
        statutPaiement: statut_paiement,
        datePaiement: date_paiement,
      }),
    // project_id omitted -> stats for every project (list page). Set -> just
    // that project (detail page overview), same split as clients' overview stats.
    getStats: (company_id: string, project_id?: string): Promise<ProjectStats[]> => safeInvoke("get_project_stats", { companyId: company_id, projectId: project_id }, () => mockStore.getProjectStats(project_id)),
    getProfitability: (project_id: string): Promise<ProjectProfitability> =>
      safeInvoke("get_project_profitability", { projectId: project_id }, () => mockStore.getProjectProfitability(project_id)),
    assignInvoice: (invoice_id: string, project_id: string | null): Promise<void> =>
      safeInvoke("assign_invoice_to_project", { invoiceId: invoice_id, projectId: project_id }),
  },

  contracts: {
    getAll: (company_id: string): Promise<Contract[]> =>
      safeInvoke("get_all_contracts", { companyId: company_id }, () => []),
    getForProject: (project_id: string): Promise<Contract[]> =>
      safeInvoke("get_project_contracts", { projectId: project_id }, () => []),
    create: (data: CreateContractData): Promise<Contract> => safeInvoke("create_contract", { data }),
    delete: (id: string): Promise<void> => safeInvoke("delete_contract", { id }),
  },

  partners: {
    getAll: (company_id: string, year?: number, months?: string[]): Promise<PartnerFinancials[]> =>
      safeInvoke("get_partners", { companyId: company_id, year, months }, () => mockStore.getPartners(year, months)),
    create: (data: CreatePartnerData): Promise<Partner> => safeInvoke("create_partner", { data }, () => mockStore.createPartner(data)),
    update: (id: string, data: UpdatePartnerData): Promise<Partner> => safeInvoke("update_partner", { id, data }, () => mockStore.updatePartner(id, data)),
    delete: (id: string): Promise<void> => safeInvoke("delete_partner", { id }, () => mockStore.deletePartner(id)),
    getWithdrawals: (partner_id: string): Promise<PartnerWithdrawal[]> =>
      safeInvoke("get_partner_withdrawals", { partnerId: partner_id }, () => mockStore.getPartnerWithdrawals(partner_id)),
    recordWithdrawal: (data: CreateWithdrawalData): Promise<PartnerWithdrawal> =>
      safeInvoke("record_partner_withdrawal", { data }, () => mockStore.recordPartnerWithdrawal(data)),
    deleteWithdrawal: (id: string): Promise<void> => safeInvoke("delete_partner_withdrawal", { id }, () => mockStore.deletePartnerWithdrawal(id)),
    getMonthlyReport: (company_id: string, year: number, month: number): Promise<MonthlyBusinessReport> =>
      safeInvoke("get_monthly_partners_report", { companyId: company_id, year, month }, () => mockStore.getMonthlyPartnersReport(year, month)),
  },

  // Project tasks
  projectTasks: {
    getAll: (project_id: string): Promise<ProjectTask[]> => safeInvoke("get_project_tasks", { projectId: project_id }, () => []),
    create: (data: CreateProjectTaskData): Promise<ProjectTask> => safeInvoke("create_project_task", { data }),
    update: (id: string, data: UpdateProjectTaskData): Promise<ProjectTask> => safeInvoke("update_project_task", { id, data }),
    updateStatus: (id: string, status: ProjectTaskStatus): Promise<ProjectTask> => safeInvoke("update_project_task_status", { id, status }),
    delete: (id: string): Promise<void> => safeInvoke("delete_project_task", { id }),
  },

  // Project deliverables
  projectDeliverables: {
    getAll: (project_id: string): Promise<ProjectDeliverable[]> => safeInvoke("get_project_deliverables", { projectId: project_id }, () => []),
    create: (data: CreateProjectDeliverableData): Promise<ProjectDeliverable> => safeInvoke("create_project_deliverable", { data }),
    update: (id: string, data: UpdateProjectDeliverableData): Promise<ProjectDeliverable> => safeInvoke("update_project_deliverable", { id, data }),
    delete: (id: string): Promise<void> => safeInvoke("delete_project_deliverable", { id }),
  },

  // Settings
  settings: {
    get: (): Promise<Record<string, string>> => safeInvoke("get_settings", undefined, () => mockStore.getSettings()),
    update: (key: string, value: string): Promise<void> => safeInvoke("update_setting", { key, value }, () => mockStore.updateSetting(key, value)),
    updateAll: (settings: Record<string, string>): Promise<void> => safeInvoke("update_settings", { settings }, () => mockStore.updateSettings(settings)),
  },

  // PDF backup (omada-agency branch only)
  pdfBackup: {
    save: (rootDir: string, clientName: string, docNumber: string, pdfBytes: Uint8Array): Promise<void> =>
      safeInvoke("save_pdf_backup", { rootDir, clientName, docNumber, pdfBytes: Array.from(pdfBytes) }, () => undefined),
  },

  // Database backup — VACUUM INTO snapshot of the live SQLite file.
  // Returns the absolute path the backup was written to. Omit destPath to
  // let the backend write a timestamped file under <app_data_dir>/backups/.
  database: {
    backup: (destPath?: string): Promise<string> =>
      safeInvoke("backup_database", { destPath }, () => Promise.reject(new Error("Database backup is not available outside the desktop app"))),
    // [timestamp (RFC 3339), size in bytes] for the newest backup on disk
    // (rolling or manual, whichever is newer), or null if none exists yet.
    getLastBackupInfo: (): Promise<[string, number] | null> =>
      safeInvoke("get_last_backup_info", undefined, () => Promise.resolve(null)),
    // Stages `sourcePath` for restore and restarts the app to apply it (see
    // the Rust command's doc comment) — the promise may never resolve since
    // the process exits shortly after the backend accepts the request.
    restore: (sourcePath: string): Promise<void> =>
      safeInvoke("restore_database", { sourcePath }, () => Promise.reject(new Error("Database restore is not available outside the desktop app"))),
  },
};

