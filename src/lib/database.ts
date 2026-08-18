/**
 * Database Service Layer
 * Abstracts Tauri commands to replace Supabase calls
 */

import { invoke } from "@tauri-apps/api/core";


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
  invoice_type?: string;
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
}

export interface CreateEmployeeData {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  address?: string;
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

// ============= PROJECTS =============

export interface Project {
  id: string;
  name: string;
  client_name: string | null;
  team_members: string | null;
  progress: number;
  status: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectData {
  name: string;
  client_name?: string;
  team_members?: string;
  progress: number;
  status?: string;
  color?: string;
}

// ============= SCORES =============

export interface EmployeeScore {
  id: string;
  employee_id: string;
  project_id: string | null;
  month: string;
  year: string;
  feature: string;
  score: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateScoreData {
  employee_id: string;
  project_id?: string | null;
  month: string;
  year: string;
  feature: string;
  score: number;
  notes?: string;
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
  // History
  history: {
    getLogs: (limit?: number, entity_type?: string, action?: string, start_date?: string, end_date?: string) =>
      invoke<ActivityLog[]>("get_activity_logs", { limit, entityType: entity_type, action, startDate: start_date, endDate: end_date }),
  },
  // Clients
  clients: {
    getAll: (): Promise<Client[]> => invoke("get_clients"),
    getById: (id: string): Promise<Client | null> => invoke("get_client", { id }),
    create: (data: CreateClientData): Promise<Client> => invoke("create_client", { data }),
    update: (id: string, data: CreateClientData): Promise<Client> => invoke("update_client", { id, data }),
    delete: (id: string): Promise<void> => invoke("delete_client", { id }),
    getProducts: (client_id: string, productId?: string, month?: string, year?: number): Promise<any[]> =>
      invoke("get_client_products", { clientId: client_id, productId, month, year }),
  },

  // Client Draft Products
  clientDrafts: {
    getAll: (client_id: string): Promise<ClientDraftProduct[]> =>
      invoke("get_client_draft_products", { clientId: client_id }),
    create: (data: CreateClientDraftProductData): Promise<ClientDraftProduct> =>
      invoke("add_client_draft_product", { data }),
    updateQuantity: (id: string, quantity: number): Promise<ClientDraftProduct> =>
      invoke("update_client_draft_product_quantity", { data: { id, quantity } }),
    delete: (id: string): Promise<void> =>
      invoke("delete_client_draft_product", { id }),
    clear: (client_id: string): Promise<void> =>
      invoke("clear_client_draft_products", { clientId: client_id }),
  },

  // Client Advances
  clientAdvances: {
    getAll: (client_id: string): Promise<ClientAdvance[]> =>
      invoke("get_client_advances", { clientId: client_id }),
    create: (data: CreateClientAdvanceData): Promise<ClientAdvance> =>
      invoke("add_client_advance", { data }),
    update: (data: UpdateClientAdvanceData): Promise<ClientAdvance> =>
      invoke("update_client_advance", { data }),
    delete: (id: string): Promise<void> =>
      invoke("delete_client_advance", { id }),
  },

  // Products
  products: {
    getAll: (): Promise<Product[]> => invoke("get_products"),
    create: (data: CreateProductData): Promise<Product> => invoke("create_product", { data }),
    updatePrice: (id: string, unit_price: number): Promise<Product> => invoke("update_product_price", { id, unit_price }),
    update: (id: string, data: CreateProductData): Promise<Product> => invoke("update_product", { id, data }),
    delete: (id: string): Promise<void> => invoke("delete_product", { id }),
    getSalesStats: (year?: number, months?: string[]): Promise<any[]> => invoke("get_product_sales_stats", { year, months }),
  },

  // Invoices
  invoices: {
    getAll: async (status?: string, invoiceType?: string) => {
      console.log("Fetching invoices with status:", status);
      return invoke<Invoice[]>("get_invoices", { status, invoiceType });
    },
    getAllWithClients: async (status?: string, invoiceType?: string) => {
      console.log("Fetching invoices with clients (optimized)");
      return invoke<InvoiceWithClient[]>("get_invoices_with_clients", { status, invoiceType });
    },
    getById: async (id: string) => invoke<Invoice | null>("get_invoice", { id }),
    getItems: (invoice_id: string): Promise<any[]> => invoke("get_invoice_items", { invoiceId: invoice_id }),
    getNextNumber: (): Promise<string> => invoke("get_next_invoice_number"),
    create: (data: CreateInvoiceData): Promise<Invoice> => invoke("create_invoice", { data }),
    update: (id: string, data: CreateInvoiceData): Promise<Invoice> => invoke("update_invoice", { id, data }),
    updateStatus: (id: string, status: string) => invoke("update_invoice_status", { id, status }),
    updateHeader: (id: string, invoiceNumber: string, customTitle: string | null) =>
      invoke("update_invoice_header", { id, invoiceNumber, customTitle }),
    delete: (id: string) => invoke("delete_invoice", { id }),
    convertProforma: (id: string): Promise<Invoice> => invoke("convert_to_real_invoice", { id }),
  },

  // Payments
  payments: {
    getAll: (invoice_id?: string): Promise<Payment[]> => invoke("get_payments", { invoice_id }),
    create: (data: CreatePaymentData): Promise<Payment> => invoke("create_payment", { data }),
    update: (id: string, data: CreatePaymentData): Promise<Payment> => invoke("update_payment", { id, data }),
    delete: (id: string): Promise<void> => invoke("delete_payment", { id }),
  },

  // Orders
  orders: {
    getAll: (): Promise<Order[]> => invoke("get_orders"),
    getById: (id: string): Promise<Order | null> => invoke("get_order", { id }),
    getItems: (order_id: string): Promise<any[]> => invoke("get_order_items", { orderId: order_id }),
    create: (data: CreateOrderData): Promise<Order> => invoke("create_order", { data }),
    update: (id: string, data: CreateOrderData): Promise<Order> => invoke("update_order", { id, data }),
    updateStatus: (id: string, status: string): Promise<Order> => invoke("update_order_status", { id, status }),
    delete: (id: string): Promise<void> => invoke("delete_order", { id }),
  },

  // Delivery Notes
  deliveryNotes: {
    getAll: (client_id?: string, is_invoiced?: boolean): Promise<DeliveryNote[]> => invoke("get_delivery_notes", { client_id, is_invoiced }),
    getById: (id: string): Promise<DeliveryNote | null> => invoke("get_delivery_note", { id }),
    getItems: (deliveryNoteId: string): Promise<any[]> => invoke("get_delivery_note_items", { deliveryNoteId }),
    create: (data: CreateDeliveryNoteData): Promise<DeliveryNote> => invoke("create_delivery_note", { data }),
    update: (id: string, data: CreateDeliveryNoteData): Promise<DeliveryNote> => invoke("update_delivery_note", { id, data }),
  },

  // Expenses
  expenses: {
    getAll: (month_period?: string): Promise<Expense[]> => invoke("get_expenses", { month_period }),
    create: (data: CreateExpenseData): Promise<Expense> => invoke("create_expense", { data }),
    delete: (id: string): Promise<void> => invoke("delete_expense", { id }),
  },

  // Dashboard
  dashboard: {
    getStats: (year?: number, months?: string[]): Promise<DashboardStats> => invoke("get_dashboard_stats", { year, months }),
    getClientProductCumulatives: (year?: number, months?: string[]): Promise<any[]> => invoke("get_client_product_cumulatives", { year, months }),
    getClientCumulatives: (year?: number, months?: string[]): Promise<ClientCumulativeRecord[]> => invoke("get_client_cumulatives", { year, months }),
  },

  // Production Logs
  production: {
    getAll: (month?: number, year?: number): Promise<ProductionLog[]> => invoke("get_production_logs", { month, year }),
    create: (data: CreateProductionLogData): Promise<ProductionLog> => invoke("create_production_log", { data }),
    update: (id: string, data: CreateProductionLogData): Promise<ProductionLog> => invoke("update_production_log", { id, data }),
    delete: (id: string): Promise<void> => invoke("delete_production_log", { id }),
  },

  // Employees
  employees: {
    getAll: (): Promise<Employee[]> => invoke("get_employees"),
    create: (data: CreateEmployeeData): Promise<Employee> => invoke("create_employee", { data }),
    update: (id: string, data: CreateEmployeeData): Promise<Employee> => invoke("update_employee", { id, data }),
    delete: (id: string): Promise<void> => invoke("delete_employee", { id }),
  },

  // Projects
  projects: {
    getAll: (): Promise<Project[]> => invoke("get_projects"),
    create: (data: CreateProjectData): Promise<Project> => invoke("create_project", { data }),
    update: (id: string, data: CreateProjectData): Promise<Project> => invoke("update_project", { id, data }),
    delete: (id: string): Promise<void> => invoke("delete_project", { id }),
  },

  // Scores
  scores: {
    getByPeriod: (month: string, year: string): Promise<EmployeeScore[]> => invoke("get_employee_scores", { month, year }),
    upsert: (data: CreateScoreData): Promise<EmployeeScore> => invoke("upsert_employee_score", { data }),
    delete: (id: string): Promise<void> => invoke("delete_employee_score", { id }),
  },
};

