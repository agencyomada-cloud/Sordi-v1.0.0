/**
 * Database Service Layer
 * Abstracts Tauri commands to replace Supabase calls
 */

import { invoke } from "@tauri-apps/api/core";
import { mockStore } from "./mockStore";

const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

async function safeInvoke<T>(cmd: string, args?: Record<string, any>, fallbackFn?: () => T | Promise<T>): Promise<T> {
  if (!isTauri) {
    if (fallbackFn) return fallbackFn();
    throw new Error(`Command ${cmd} not available in web mode`);
  }
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.warn(`Tauri invoke "${cmd}" failed, using fallback:`, err);
    if (fallbackFn) return fallbackFn();
    throw err;
  }
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
}

export interface TimePointStats {
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
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

// ============= CLIENTS =============

export interface Client {
  id: string;
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

// Type definitions for other entities
export interface Product {
  id: string;
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

export interface Invoice {
  id: string;
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
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithClient extends Invoice {
  clients?: {
    name: string;
    email: string | null;
  };
}

export interface CreateInvoiceData {
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
  items: { product_id: string; quantity: number; unit_price: number; tva_rate?: number | null; timbre_exempt?: boolean }[];
}

// ============= PAYMENTS =============

export interface Payment {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  cheque_number: string | null;
  bank_name: string | null;
  value_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreatePaymentData {
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method?: string;
  cheque_number?: string;
  bank_name?: string;
  value_date?: string;
  notes?: string;
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
  created_at: string;
  updated_at: string;
}

export interface CreateDeliveryNoteData {
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
  items: { product_id: string; quantity: number }[];
}

// ============= EXPENSES =============

export interface Expense {
  id: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  month_period: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateExpenseData {
  expense_date: string;
  category: string;
  description?: string;
  amount: number;
  payment_method?: string;
  reference?: string;
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

export interface PunchImportRow {
  external_code: string;
  punch_time: string;
}

export interface PunchImportSummary {
  imported: number;
  skipped_duplicates: number;
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
}

export interface PayrollDashboardStats {
  month: string;
  total_payroll_cost: number;
  flagged_employee_count: number;
  pending_payroll_count: number;
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

export interface Project {
  id: string;
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
}

export interface CreateProjectData {
  client_id: string;
  name: string;
  service_categories: string[];
  responsible_person?: string | null;
  start_date?: string | null;
  deadline?: string | null;
  planned_budget: number;
  freelancer_id?: string | null;
  montant_convenu?: number | null;
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
    verifyBackground: (): Promise<LicenseStatus> =>
      safeInvoke("verify_license_background", undefined, () => ({ state: "active", client_reference_id: null, expires_at: null })),
  },
  // Global search (Phase 1: clients + invoices — see search_global in commands.rs)
  search: {
    global: (query: string): Promise<GlobalSearchResults> =>
      safeInvoke("search_global", { query }, () => ({ clients: [], invoices: [] })),
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
  // Clients
  clients: {
    getAll: (): Promise<Client[]> => safeInvoke("get_clients", undefined, () => mockStore.getClients()),
    getById: (id: string): Promise<Client | null> => safeInvoke("get_client", { id }, () => mockStore.getClient(id)),
    create: (data: CreateClientData): Promise<Client> => safeInvoke("create_client", { data }, () => mockStore.createClient(data)),
    update: (id: string, data: CreateClientData): Promise<Client> => safeInvoke("update_client", { id, data }, () => mockStore.updateClient(id, data)),
    delete: (id: string): Promise<void> => safeInvoke("delete_client", { id }, () => mockStore.deleteClient(id)),
    getProducts: (client_id: string, productId?: string, month?: string, year?: number): Promise<any[]> =>
      safeInvoke("get_client_products", { clientId: client_id, productId, month, year }, () => mockStore.getClientProductCumulatives(year, month ? [month] : undefined)),
    // client_id omitted -> stats for every client in one call (clients list badge).
    // client_id set -> just that client (client detail "Aperçu" section).
    getOverviewStats: (client_id?: string): Promise<ClientOverviewStats[]> =>
      safeInvoke("get_client_overview_stats", { clientId: client_id }, () => []),
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
    getAll: (): Promise<Product[]> => safeInvoke("get_products", undefined, () => mockStore.getProducts()),
    create: (data: CreateProductData): Promise<Product> => safeInvoke("create_product", { data }, () => mockStore.createProduct(data)),
    updatePrice: (id: string, unit_price: number): Promise<Product> => safeInvoke("update_product_price", { id, unit_price }, () => mockStore.updateProduct(id, { code: "", name: "", unit_price })),
    update: (id: string, data: CreateProductData): Promise<Product> => safeInvoke("update_product", { id, data }, () => mockStore.updateProduct(id, data)),
    delete: (id: string): Promise<void> => safeInvoke("delete_product", { id }, () => mockStore.deleteProduct(id)),
    getSalesStats: (year?: number, months?: string[]): Promise<any[]> => safeInvoke("get_product_sales_stats", { year, months }, () => mockStore.getDashboardStats(year, months).product_stats),
  },

  // Invoices
  invoices: {
    getAll: async (status?: string, invoiceType?: string) => {
      return safeInvoke<Invoice[]>("get_invoices", { status, invoiceType }, () => mockStore.getInvoices(status, invoiceType));
    },
    getAllWithClients: async (status?: string, invoiceType?: string) => {
      return safeInvoke<InvoiceWithClient[]>("get_invoices_with_clients", { status, invoiceType }, () => mockStore.getInvoicesWithClients(status, invoiceType));
    },
    getById: async (id: string) => safeInvoke<Invoice | null>("get_invoice", { id }, () => mockStore.getInvoice(id)),
    getItems: (invoice_id: string): Promise<any[]> => safeInvoke("get_invoice_items", { invoiceId: invoice_id }, () => mockStore.getInvoiceItems(invoice_id)),
    getNextNumber: (): Promise<string> => safeInvoke("get_next_invoice_number", undefined, () => mockStore.getNextInvoiceNumber()),
    create: (data: CreateInvoiceData): Promise<Invoice> => safeInvoke("create_invoice", { data }, () => mockStore.createInvoice(data)),
    update: (id: string, data: CreateInvoiceData): Promise<Invoice> => safeInvoke("update_invoice", { id, data }, () => mockStore.updateInvoice(id, data)),
    updateStatus: (id: string, status: string) => safeInvoke("update_invoice_status", { id, status }, () => mockStore.updateInvoiceStatus(id, status)),
    updateHeader: (id: string, invoiceNumber: string, customTitle: string | null) =>
      safeInvoke("update_invoice_header", { id, invoiceNumber, customTitle }, () => {}),
    delete: (id: string) => safeInvoke("delete_invoice", { id }, () => mockStore.deleteInvoice(id)),
    convertProforma: (id: string): Promise<Invoice> => safeInvoke("convert_to_real_invoice", { id }, () => mockStore.getInvoice(id)!),
  },

  // Payments
  payments: {
    getAll: (invoice_id?: string): Promise<Payment[]> => safeInvoke("get_payments", { invoice_id }, () => mockStore.getPayments(invoice_id)),
    create: (data: CreatePaymentData): Promise<Payment> => safeInvoke("create_payment", { data }, () => mockStore.createPayment(data)),
    update: (id: string, data: CreatePaymentData): Promise<Payment> => safeInvoke("update_payment", { id, data }, () => mockStore.createPayment(data)),
    delete: (id: string): Promise<void> => safeInvoke("delete_payment", { id }, () => {}),
  },

  // Orders
  orders: {
    getAll: (): Promise<Order[]> => safeInvoke("get_orders", undefined, () => mockStore.getOrders()),
    getById: (id: string): Promise<Order | null> => safeInvoke("get_order", { id }, () => mockStore.getOrder(id)),
    getItems: (order_id: string): Promise<any[]> => safeInvoke("get_order_items", { orderId: order_id }, () => []),
    create: (data: CreateOrderData): Promise<Order> => safeInvoke("create_order", { data }, () => mockStore.createOrder(data)),
    update: (id: string, data: CreateOrderData): Promise<Order> => safeInvoke("update_order", { id, data }, () => mockStore.updateOrder(id, data)),
    updateStatus: (id: string, status: string): Promise<Order> => safeInvoke("update_order_status", { id, status }, () => ({} as any)),
    delete: (id: string): Promise<void> => safeInvoke("delete_order", { id }, () => {}),
  },

  // Delivery Notes
  deliveryNotes: {
    getAll: (client_id?: string, is_invoiced?: boolean): Promise<DeliveryNote[]> => safeInvoke("get_delivery_notes", { client_id, is_invoiced }, () => mockStore.getDeliveryNotes(client_id)),
    getById: (id: string): Promise<DeliveryNote | null> => safeInvoke("get_delivery_note", { id }, () => mockStore.getDeliveryNote(id)),
    getItems: (deliveryNoteId: string): Promise<any[]> => safeInvoke("get_delivery_note_items", { deliveryNoteId }, () => []),
    create: (data: CreateDeliveryNoteData): Promise<DeliveryNote> => safeInvoke("create_delivery_note", { data }, () => mockStore.createDeliveryNote(data)),
    update: (id: string, data: CreateDeliveryNoteData): Promise<DeliveryNote> => safeInvoke("update_delivery_note", { id, data }, () => mockStore.updateDeliveryNote(id, data)),
  },

  // Expenses
  expenses: {
    getAll: (month_period?: string): Promise<Expense[]> => safeInvoke("get_expenses", { month_period }, () => mockStore.getExpenses(month_period)),
    create: (data: CreateExpenseData): Promise<Expense> => safeInvoke("create_expense", { data }, () => mockStore.createExpense(data)),
    delete: (id: string): Promise<void> => safeInvoke("delete_expense", { id }, () => mockStore.deleteExpense(id)),
  },

  // Dashboard
  dashboard: {
    getStats: (year?: number, months?: string[]): Promise<DashboardStats> => safeInvoke("get_dashboard_stats", { year, months }, () => mockStore.getDashboardStats(year, months)),
    getClientProductCumulatives: (year?: number, months?: string[]): Promise<any[]> => safeInvoke("get_client_product_cumulatives", { year, months }, () => mockStore.getClientProductCumulatives(year, months)),
    getClientCumulatives: (year?: number, months?: string[]): Promise<ClientCumulativeRecord[]> => safeInvoke("get_client_cumulatives", { year, months }, () => mockStore.getClientCumulatives(year, months)),
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
    getAll: (): Promise<Employee[]> => safeInvoke("get_employees", undefined, () => mockStore.getEmployees()),
    create: (data: CreateEmployeeData): Promise<Employee> => safeInvoke("create_employee", { data }, () => mockStore.createEmployee(data)),
    update: (id: string, data: CreateEmployeeData): Promise<Employee> => safeInvoke("update_employee", { id, data }, () => ({} as any)),
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
    getAll: (): Promise<EmployeeTaskWorkload[]> => safeInvoke("get_employee_task_workload", undefined, () => []),
  },

  // HR / Payroll (omada-agency branch only)
  attendance: {
    import: (rows: PunchImportRow[]): Promise<PunchImportSummary> => safeInvoke("import_punch_records", { rows }),
    getUnmappedCodes: (): Promise<UnmappedDeviceCode[]> => safeInvoke("get_unmapped_device_codes", undefined, () => []),
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
    run: (employee_id: string, month: string, primes?: number): Promise<PayrollRun> =>
      safeInvoke("run_payroll", { employeeId: employee_id, month, primes }),
    getRuns: (employee_id?: string, month?: string, paid?: boolean): Promise<PayrollRun[]> =>
      safeInvoke("get_payroll_runs", { employeeId: employee_id, month, paid }, () => []),
    setPaid: (id: string, paid: boolean, paid_date: string | null): Promise<PayrollRun> =>
      safeInvoke("update_payroll_paid", { id, paid, paidDate: paid_date }),
    getDashboardStats: (month: string): Promise<PayrollDashboardStats> =>
      safeInvoke("get_payroll_dashboard_stats", { month }, () => ({ month, total_payroll_cost: 0, flagged_employee_count: 0, pending_payroll_count: 0 })),
  },

  // Projects (omada-agency branch only)
  projects: {
    getAll: (): Promise<Project[]> => safeInvoke("get_projects", undefined, () => []),
    getById: (id: string): Promise<Project | null> => safeInvoke("get_project", { id }, () => null),
    create: (data: CreateProjectData): Promise<Project> => safeInvoke("create_project", { data }),
    update: (id: string, data: CreateProjectData): Promise<Project> => safeInvoke("update_project", { id, data }),
    delete: (id: string): Promise<void> => safeInvoke("delete_project", { id }),
    setFreelancerPaymentStatus: (project_id: string, statut_paiement: FreelancePaymentStatus, date_paiement: string | null): Promise<Project> =>
      safeInvoke("update_freelancer_payment_status", { projectId: project_id, statutPaiement: statut_paiement, datePaiement: date_paiement }),
    getFreelancePayments: (): Promise<FreelancePayment[]> => safeInvoke("get_freelance_payments", undefined, () => []),
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
    getStats: (project_id?: string): Promise<ProjectStats[]> => safeInvoke("get_project_stats", { projectId: project_id }, () => []),
    assignInvoice: (invoice_id: string, project_id: string | null): Promise<void> =>
      safeInvoke("assign_invoice_to_project", { invoiceId: invoice_id, projectId: project_id }),
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
};

