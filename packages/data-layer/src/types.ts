/**
 * Unified data access contract for Sordi, implemented identically by every
 * adapter (desktop-local, cloud-remote, ...). UI code must depend only on
 * `DataClient` — never on fetch(), Tauri's invoke(), or a specific adapter.
 *
 * Every field/type here is verified directly against the real Rust structs
 * in src-tauri/src/commands.rs (not inferred from frontend usage) — see the
 * per-entity comments for what that confirmed and what it corrected.
 *
 * Domain terms: factures = invoices, livraisons = delivery notes,
 * commandes = orders, règlements = payments, charges = expenses.
 */

// ---------------------------------------------------------------------------
// Write metadata — required on every create/update now, so introducing real
// offline-to-cloud sync later is additive (a new adapter), not a rewrite of
// every call site.
// ---------------------------------------------------------------------------

export interface WriteMeta {
  /** Client-generated (e.g. crypto.randomUUID()), unique per write attempt.
   *  Retrying the same key with the same payload must be a no-op server-side
   *  once sync exists. LocalAdapter accepts but doesn't use it yet — today's
   *  Tauri commands have no concept of it. */
  idempotencyKey: string;
  /** ISO 8601 client wall-clock time the write was initiated. Reserved for
   *  last-write-wins conflict resolution — not enforced by any adapter yet. */
  clientTimestamp: string;
}

export type WriteInput<T> = T & WriteMeta;

// ---------------------------------------------------------------------------
// Generic per-entity CRUD contract
// ---------------------------------------------------------------------------

export interface EntityClient<TEntity, TCreate, TUpdate, TListParams = void> {
  list(params?: TListParams): Promise<TEntity[]>;
  get(id: string): Promise<TEntity | null>;
  create(input: WriteInput<TCreate>): Promise<TEntity>;
  update(id: string, input: WriteInput<TUpdate>): Promise<TEntity>;
  delete(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Clients
// Confirmed against Rust `Client`/`CreateClientData` (commands.rs:124-173).
// Corrected from the previous draft: added code, creditLimit,
// paymentTermsDays, isActive, initialBalance, advancePayment; renamed the
// invented `contact` field to `contactPerson` (matches Rust's contact_person
// — there is no field called `contact` in the real struct).
// `isActive` is returned but not accepted on create (Rust defaults it).
// ---------------------------------------------------------------------------

export interface Client {
  id: string;
  code?: string | null;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  wilaya?: string | null;
  nif?: string | null;
  nis?: string | null;
  rc?: string | null;
  secondaryRc?: string | null;
  secondaryAddress?: string | null;
  ai?: string | null;
  activite?: string | null;
  creditLimit?: number | null;
  paymentTermsDays?: number | null;
  notes?: string | null;
  isActive?: boolean | null;
  initialBalance?: number | null;
  advancePayment?: number | null;
  createdAt: string;
  updatedAt: string;
}
export interface CreateClientInput {
  name: string;
  code?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  wilaya?: string | null;
  nif?: string | null;
  nis?: string | null;
  rc?: string | null;
  secondaryRc?: string | null;
  secondaryAddress?: string | null;
  ai?: string | null;
  activite?: string | null;
  creditLimit?: number | null;
  paymentTermsDays?: number | null;
  notes?: string | null;
  initialBalance?: number | null;
  advancePayment?: number | null;
}
/** Rust's update_client takes the same CreateClientData as create — a full
 *  resend, not a partial patch. */
export type UpdateClientInput = CreateClientInput;

// ---------------------------------------------------------------------------
// Products
// Confirmed against Rust `Product`/`CreateProductData` (commands.rs:352-410).
// Unchanged from the previous draft — already matched.
// ---------------------------------------------------------------------------

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  unitPrice: number;
  tvaRate?: number | null;
  timbreExempt?: boolean | null;
  isActive?: boolean | null;
  displayOrder?: number | null;
  createdAt: string;
  updatedAt: string;
}
export interface CreateProductInput {
  code: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  unitPrice: number;
  tvaRate?: number | null;
  timbreExempt?: boolean | null;
  displayOrder?: number | null;
}
export type UpdateProductInput = CreateProductInput;

// ---------------------------------------------------------------------------
// Shared product-summary shape returned alongside line items
// (Rust's ProductInfo / ProductInfoWithUnit, commands.rs).
// ---------------------------------------------------------------------------

export interface LineItemProductInfo {
  code: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  unitPrice?: number | null;
}

// ---------------------------------------------------------------------------
// Invoices (factures)
// Confirmed against Rust `Invoice`/`CreateInvoiceData`/`InvoiceItemInput`/
// `InvoiceItemWithProduct` (commands.rs:560-993).
//
// Corrected from the previous draft:
//  - `Invoice` no longer embeds `items` — the real struct has no such field;
//    items live in a separate table, fetched via getInvoiceItems() below.
//  - `CreateInvoiceInput` no longer derives from `Invoice`. It's rebuilt to
//    match `CreateInvoiceData` exactly — subtotalHt/tvaAmount/timbre/totalTtc
//    are removed, since Rust computes and owns those internally
//    (recalculate_invoice_totals runs inside create_invoice/update_invoice,
//    before the response is returned) and never accepts them as input.
// ---------------------------------------------------------------------------

export interface InvoiceLineItemInput {
  productId: string;
  productDescription?: string | null;
  quantity: number;
  unitPrice: number;
  tvaRate?: number | null;
  timbreExempt?: boolean | null;
}

/** Returned by getInvoiceItems() — matches Rust's InvoiceItemWithProduct. */
export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  amount?: number | null;
  tvaRate?: number | null;
  timbreExempt?: boolean | null;
  products?: LineItemProductInfo | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  invoiceDate: string;
  dueDate?: string | null;
  monthPeriod?: string | null;
  subtotalHt?: number | null;
  tvaRate?: number | null;
  tvaAmount?: number | null;
  timbre?: number | null;
  totalTtc?: number | null;
  amountPaid?: number | null;
  balanceDue?: number | null;
  status?: string | null;
  invoiceType: "invoice" | "credit_note" | "proforma";
  originalInvoiceId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  headerNote?: string | null;
  discount?: number | null;
  discountType?: string | null;
  discountValue?: number | null;
  useSecondaryRegister?: boolean | null;
  selectedSecondaryRc?: string | null;
  selectedSecondaryAddress?: string | null;
  customTitle?: string | null;
  paymentMethod?: string | null;
}
export interface CreateInvoiceInput {
  clientId: string;
  invoiceDate: string;
  dueDate?: string | null;
  monthPeriod?: string | null;
  notes?: string | null;
  headerNote?: string | null;
  invoiceType?: Invoice["invoiceType"] | null;
  originalInvoiceId?: string | null;
  discount?: number | null;
  discountType?: string | null;
  discountValue?: number | null;
  useSecondaryRegister?: boolean | null;
  selectedSecondaryRc?: string | null;
  selectedSecondaryAddress?: string | null;
  customTitle?: string | null;
  invoiceNumber?: string | null;
  paymentMethod?: string | null;
  status?: string | null;
  amountPaid?: number | null;
  items: InvoiceLineItemInput[];
}
/** Rust's update_invoice takes the same CreateInvoiceData as create. */
export type UpdateInvoiceInput = CreateInvoiceInput;
export interface InvoiceListParams {
  status?: string;
  invoiceType?: Invoice["invoiceType"];
}

// ---------------------------------------------------------------------------
// Delivery notes (livraisons)
// Confirmed against Rust `DeliveryNote`/`CreateDeliveryNoteData`/
// `DeliveryNoteItemInput`/`DeliveryNoteItemWithProduct` (commands.rs:1607-1992).
// Same `items` correction as Invoice, plus: no delete command exists for
// this entity today (see LocalAdapter.ts).
// ---------------------------------------------------------------------------

export interface DeliveryNoteLineItemInput {
  productId: string;
  quantity: number;
  productDescription?: string | null;
}

/** Returned by getDeliveryNoteItems() — matches DeliveryNoteItemWithProduct. */
export interface DeliveryNoteItem {
  id: string;
  deliveryNoteId: string;
  productId: string;
  quantity: number;
  unitPrice?: number | null;
  tvaRate?: number | null;
  productDescription?: string | null;
  products?: LineItemProductInfo | null;
}

export interface DeliveryNote {
  id: string;
  deliveryNumber: string;
  clientId: string;
  deliveryDate: string;
  invoiceId?: string | null;
  orderId?: string | null;
  truckPlate?: string | null;
  driverName?: string | null;
  delivererName?: string | null;
  delivererNin?: string | null;
  transporterName?: string | null;
  transporterNin?: string | null;
  deliveryLocation?: string | null;
  clientReceivedDate?: string | null;
  clientSignature?: string | null;
  supplierDeliveredDate?: string | null;
  isInvoiced?: boolean | null;
  notes?: string | null;
  reserves?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CreateDeliveryNoteInput {
  clientId: string;
  deliveryDate: string;
  orderId?: string | null;
  truckPlate?: string | null;
  driverName?: string | null;
  delivererName?: string | null;
  delivererNin?: string | null;
  transporterName?: string | null;
  transporterNin?: string | null;
  deliveryLocation?: string | null;
  notes?: string | null;
  reserves?: string | null;
  customTitle?: string | null;
  deliveryNumber?: string | null;
  items: DeliveryNoteLineItemInput[];
}
export type UpdateDeliveryNoteInput = CreateDeliveryNoteInput;
export interface DeliveryNoteListParams {
  clientId?: string;
  isInvoiced?: boolean;
}

// ---------------------------------------------------------------------------
// Orders (commandes)
// Confirmed against Rust `Order`/`CreateOrderData`/`OrderItemInput`/
// `OrderItemWithProduct` (commands.rs:1224-1523). Same `items` correction.
// Note productId is nullable on the order-item input, matching Rust.
// ---------------------------------------------------------------------------

export interface OrderLineItemInput {
  productId?: string | null;
  productName?: string | null;
  productCode?: string | null;
  productDescription?: string | null;
  quantity: number;
  unitPrice: number;
  tvaRate?: number | null;
}

/** Returned by getOrderItems() — matches Rust's OrderItemWithProduct. */
export interface OrderItem {
  id: string;
  orderId: string;
  productId?: string | null;
  quantity: number;
  unitPrice: number;
  tvaRate?: number | null;
  amount?: number | null;
  products?: LineItemProductInfo | null;
  productName?: string | null;
  productCode?: string | null;
  productDescription?: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  clientId?: string | null;
  supplierName?: string | null;
  orderDate: string;
  deliveryDate?: string | null;
  paymentTerms?: string | null;
  paymentMethod?: string | null;
  supplierAddress?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  supplierRc?: string | null;
  supplierNif?: string | null;
  supplierNis?: string | null;
  supplierAi?: string | null;
  status?: string | null;
  subtotalHt?: number | null;
  tvaRate?: number | null;
  tvaAmount?: number | null;
  totalTtc?: number | null;
  notes?: string | null;
  monthPeriod?: string | null;
  createdAt: string;
  updatedAt: string;
  customTitle?: string | null;
}
export interface CreateOrderInput {
  clientId?: string | null;
  supplierName?: string | null;
  orderDate: string;
  deliveryDate?: string | null;
  paymentTerms?: string | null;
  paymentMethod?: string | null;
  supplierAddress?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  supplierRc?: string | null;
  supplierNif?: string | null;
  supplierNis?: string | null;
  supplierAi?: string | null;
  notes?: string | null;
  customTitle?: string | null;
  orderNumber?: string | null;
  items: OrderLineItemInput[];
}
export type UpdateOrderInput = CreateOrderInput;

// ---------------------------------------------------------------------------
// Payments (règlements)
// Confirmed against Rust `Payment`/`CreatePaymentData` (commands.rs:1133-1156).
// Corrected: added valueDate. Flagged (not silently fixed): only
// get_payments/create_payment exist as Tauri commands — there is no
// update_payment, delete_payment, or single-item get_payment today. See
// LocalAdapter.ts for how update/delete/get are handled for this entity.
// ---------------------------------------------------------------------------

export interface Payment {
  id: string;
  invoiceId: string;
  paymentDate: string;
  amount: number;
  paymentMethod?: string | null;
  chequeNumber?: string | null;
  bankName?: string | null;
  valueDate?: string | null;
  notes?: string | null;
  createdAt: string;
}
export interface CreatePaymentInput {
  invoiceId: string;
  paymentDate: string;
  amount: number;
  paymentMethod?: string | null;
  chequeNumber?: string | null;
  bankName?: string | null;
  valueDate?: string | null;
  notes?: string | null;
}
/** No Rust update_payment command exists today — kept in the interface for
 *  shape consistency; LocalAdapter's update() rejects clearly rather than
 *  attempting a doomed invoke(). */
export type UpdatePaymentInput = CreatePaymentInput;
export interface PaymentListParams {
  invoiceId?: string;
}

// ---------------------------------------------------------------------------
// Expenses (charges)
// Confirmed against Rust `Expense`/`CreateExpenseData` (commands.rs:1996-2020).
// Corrected: added monthPeriod, updatedAt. Flagged: no update_expense
// command exists — see LocalAdapter.ts.
// ---------------------------------------------------------------------------

export interface Expense {
  id: string;
  expenseDate: string;
  category: string;
  description?: string | null;
  amount: number;
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
  monthPeriod?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CreateExpenseInput {
  expenseDate: string;
  category: string;
  description?: string | null;
  amount: number;
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
}
/** No Rust update_expense command exists today — see LocalAdapter.ts. */
export type UpdateExpenseInput = CreateExpenseInput;
export interface ExpenseListParams {
  monthPeriod?: string;
}

// ---------------------------------------------------------------------------
// The unified interface
// ---------------------------------------------------------------------------

export interface DataClient {
  clients: EntityClient<Client, CreateClientInput, UpdateClientInput>;
  products: EntityClient<Product, CreateProductInput, UpdateProductInput>;
  invoices: EntityClient<Invoice, CreateInvoiceInput, UpdateInvoiceInput, InvoiceListParams>;
  getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]>;

  deliveryNotes: EntityClient<DeliveryNote, CreateDeliveryNoteInput, UpdateDeliveryNoteInput, DeliveryNoteListParams>;
  getDeliveryNoteItems(deliveryNoteId: string): Promise<DeliveryNoteItem[]>;

  orders: EntityClient<Order, CreateOrderInput, UpdateOrderInput>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;

  payments: EntityClient<Payment, CreatePaymentInput, UpdatePaymentInput, PaymentListParams>;
  expenses: EntityClient<Expense, CreateExpenseInput, UpdateExpenseInput, ExpenseListParams>;
}
