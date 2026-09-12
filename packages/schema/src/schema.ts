/**
 * Postgres schema — translated from the SQLite schema in
 * src-tauri/src/database.rs (18 business tables), with an `orgId` added to
 * every business table for multi-tenancy. Column names/types follow the
 * SQLite source as closely as Postgres allows (REAL -> numeric, SQLite's
 * INTEGER-as-bool -> boolean, TEXT dates -> text, kept as ISO strings to
 * match what the existing frontend already sends/expects).
 *
 * `code TEXT UNIQUE` in the original single-tenant schema (e.g. products)
 * becomes unique *per organization* here, not globally.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  boolean,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ---------------------------------------------------------------------------
// Tenancy & accounts (new — did not exist in the single-user desktop app)
// ---------------------------------------------------------------------------

export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "accountant",
  "sales",
  "stock",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailUnique: uniqueIndex("users_email_idx").on(t.email),
}));

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: memberRoleEnum("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userOrgUnique: uniqueIndex("memberships_user_org_idx").on(t.userId, t.orgId),
  orgIdx: index("memberships_org_idx").on(t.orgId),
}));

// ---------------------------------------------------------------------------
// Business tables (from src-tauri/src/database.rs), each org-scoped
// ---------------------------------------------------------------------------

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  code: text("code"),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  wilaya: text("wilaya"),
  nif: text("nif"),
  nis: text("nis"),
  rc: text("rc"),
  secondaryRc: text("secondary_rc"),
  secondaryAddress: text("secondary_address"),
  ai: text("ai"),
  activite: text("activite"),
  creditLimit: numeric("credit_limit"),
  paymentTermsDays: integer("payment_terms_days"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  initialBalance: numeric("initial_balance"),
  advancePayment: numeric("advance_payment"),
  ...timestamps,
}, (t) => ({
  orgIdx: index("clients_org_idx").on(t.orgId),
}));

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  unit: text("unit").default("tonne"),
  unitPrice: numeric("unit_price").notNull().default("0"),
  tvaRate: numeric("tva_rate"),
  timbreExempt: boolean("timbre_exempt"),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").default(0),
  ...timestamps,
}, (t) => ({
  orgIdx: index("products_org_idx").on(t.orgId),
  orgCodeUnique: uniqueIndex("products_org_code_idx").on(t.orgId, t.code),
}));

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  invoiceNumber: text("invoice_number").notNull(),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  invoiceDate: text("invoice_date").notNull(),
  dueDate: text("due_date"),
  monthPeriod: text("month_period"),
  subtotalHt: numeric("subtotal_ht").default("0"),
  tvaRate: numeric("tva_rate").default("19.00"),
  tvaAmount: numeric("tva_amount").default("0"),
  timbre: numeric("timbre").default("0"),
  totalTtc: numeric("total_ttc").default("0"),
  amountPaid: numeric("amount_paid").default("0"),
  balanceDue: numeric("balance_due").default("0"),
  status: text("status").default("draft"),
  invoiceType: text("invoice_type").notNull().default("invoice"), // invoice | credit_note | proforma
  originalInvoiceId: uuid("original_invoice_id"),
  notes: text("notes"),
  headerNote: text("header_note"),
  discount: numeric("discount").default("0"),
  discountType: text("discount_type").default("percent"),
  discountValue: numeric("discount_value").default("0"),
  useSecondaryRegister: boolean("use_secondary_register").notNull().default(false),
  selectedSecondaryRc: text("selected_secondary_rc"),
  selectedSecondaryAddress: text("selected_secondary_address"),
  customTitle: text("custom_title"),
  paymentMethod: text("payment_method"),
  ...timestamps,
}, (t) => ({
  orgIdx: index("invoices_org_idx").on(t.orgId),
  orgNumberUnique: uniqueIndex("invoices_org_number_idx").on(t.orgId, t.invoiceNumber),
}));

export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  productDescription: text("product_description"),
  quantity: numeric("quantity").notNull().default("0"),
  unitPrice: numeric("unit_price").notNull(),
  amount: numeric("amount"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("invoice_items_org_idx").on(t.orgId),
  invoiceIdx: index("invoice_items_invoice_idx").on(t.invoiceId),
}));

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
  paymentDate: text("payment_date").notNull(),
  amount: numeric("amount").notNull(),
  paymentMethod: text("payment_method"),
  chequeNumber: text("cheque_number"),
  bankName: text("bank_name"),
  valueDate: text("value_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("payments_org_idx").on(t.orgId),
}));

export const clientDraftProducts = pgTable("client_draft_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  productDescription: text("product_description"),
  quantity: numeric("quantity").notNull().default("0"),
  unitPrice: numeric("unit_price").notNull(),
  amount: numeric("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("client_draft_products_org_idx").on(t.orgId),
}));

export const clientAdvances = pgTable("client_advances", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  amount: numeric("amount").notNull(),
  date: text("date").notNull(),
  paymentMode: text("payment_mode").notNull(),
  reference: text("reference"),
  bank: text("bank"),
  issuerName: text("issuer_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("client_advances_org_idx").on(t.orgId),
}));

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  orderNumber: text("order_number").notNull(),
  clientId: uuid("client_id").references(() => clients.id),
  supplierName: text("supplier_name"),
  supplierAddress: text("supplier_address"),
  supplierEmail: text("supplier_email"),
  supplierPhone: text("supplier_phone"),
  supplierRc: text("supplier_rc"),
  supplierNif: text("supplier_nif"),
  supplierNis: text("supplier_nis"),
  supplierAi: text("supplier_ai"),
  orderDate: text("order_date").notNull(),
  deliveryDate: text("delivery_date"),
  paymentTerms: text("payment_terms"),
  paymentMethod: text("payment_method"),
  status: text("status").default("draft"),
  subtotalHt: numeric("subtotal_ht").default("0"),
  tvaRate: numeric("tva_rate").default("19.0"),
  tvaAmount: numeric("tva_amount").default("0"),
  totalTtc: numeric("total_ttc").default("0"),
  notes: text("notes"),
  customTitle: text("custom_title"),
  monthPeriod: text("month_period"),
  ...timestamps,
}, (t) => ({
  orgIdx: index("orders_org_idx").on(t.orgId),
  orgNumberUnique: uniqueIndex("orders_org_number_idx").on(t.orgId, t.orderNumber),
}));

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id),
  productName: text("product_name"),
  productCode: text("product_code"),
  productDescription: text("product_description"),
  quantity: numeric("quantity").notNull().default("0"),
  unitPrice: numeric("unit_price").notNull(),
  tvaRate: numeric("tva_rate").default("19.0"),
  amount: numeric("amount"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("order_items_org_idx").on(t.orgId),
  orderIdx: index("order_items_order_idx").on(t.orderId),
}));

export const deliveryNotes = pgTable("delivery_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  deliveryNumber: text("delivery_number").notNull(),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  deliveryDate: text("delivery_date").notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  orderId: uuid("order_id").references(() => orders.id),
  truckPlate: text("truck_plate"),
  driverName: text("driver_name"),
  delivererName: text("deliverer_name"),
  delivererNin: text("deliverer_nin"),
  transporterName: text("transporter_name"),
  transporterNin: text("transporter_nin"),
  deliveryLocation: text("delivery_location"),
  clientReceivedDate: text("client_received_date"),
  clientSignature: text("client_signature"),
  supplierDeliveredDate: text("supplier_delivered_date"),
  isInvoiced: boolean("is_invoiced").notNull().default(false),
  notes: text("notes"),
  reserves: text("reserves"),
  customTitle: text("custom_title"),
  ...timestamps,
}, (t) => ({
  orgIdx: index("delivery_notes_org_idx").on(t.orgId),
  orgNumberUnique: uniqueIndex("delivery_notes_org_number_idx").on(t.orgId, t.deliveryNumber),
}));

export const deliveryNoteItems = pgTable("delivery_note_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  deliveryNoteId: uuid("delivery_note_id").notNull().references(() => deliveryNotes.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  productDescription: text("product_description"),
  quantity: numeric("quantity").notNull().default("0"),
  unitPrice: numeric("unit_price"),
  tvaRate: numeric("tva_rate").default("19.0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("delivery_note_items_org_idx").on(t.orgId),
  deliveryNoteIdx: index("delivery_note_items_delivery_note_idx").on(t.deliveryNoteId),
}));

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  expenseDate: text("expense_date").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  amount: numeric("amount").notNull(),
  paymentMethod: text("payment_method"),
  reference: text("reference"),
  notes: text("notes"),
  monthPeriod: text("month_period"),
  ...timestamps,
}, (t) => ({
  orgIdx: index("expenses_org_idx").on(t.orgId),
}));

export const productionLogs = pgTable("production_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  extraction: numeric("extraction").default("0"),
  waste: numeric("waste").default("0"),
  merchantProduct: numeric("merchant_product").default("0"),
  notes: text("notes"),
  ...timestamps,
}, (t) => ({
  orgIdx: index("production_logs_org_idx").on(t.orgId),
}));

export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
}, (t) => ({
  orgIdx: index("employees_org_idx").on(t.orgId),
}));

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  clientName: text("client_name"),
  teamMembers: text("team_members"),
  progress: integer("progress").notNull().default(0),
  status: text("status").default("En cours"),
  color: text("color"),
  ...timestamps,
}, (t) => ({
  orgIdx: index("projects_org_idx").on(t.orgId),
}));

export const employeeScores = pgTable("employee_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  month: text("month").notNull(),
  year: text("year").notNull(),
  feature: text("feature").notNull(),
  score: numeric("score").default("0"),
  notes: text("notes"),
  ...timestamps,
}, (t) => ({
  orgIdx: index("employee_scores_org_idx").on(t.orgId),
}));

// key/value company-profile & preference store — same shape as the SQLite
// `settings` table (src/pages/Settings.tsx), one row per (org, key) instead
// of one global row per key.
export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value").notNull(),
}, (t) => ({
  orgKeyUnique: uniqueIndex("settings_org_key_idx").on(t.orgId, t.key),
}));

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  description: text("description").notNull(),
  userId: uuid("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("activity_logs_org_idx").on(t.orgId),
}));

// ---------------------------------------------------------------------------
// Desktop app licensing — deliberately NOT orgId-scoped like the tables
// above. `organizations`/`users`/`memberships` are the web SaaS login
// concept; a license customer buys the desktop app and may never have a
// SaaS account at all. `organizationName` is a plain display string, same
// spirit as this app's `client.code` field, not a foreign key.
// ---------------------------------------------------------------------------

export const licenseStatusEnum = pgEnum("license_status", ["active", "expired", "revoked"]);

export const licenses = pgTable("licenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Human-readable, shown to the customer — e.g. "SORDI-A1B2C3".
  clientReferenceId: text("client_reference_id").notNull(),
  // The secret the customer types into the activation screen.
  licenseKey: text("license_key").notNull(),
  organizationName: text("organization_name").notNull(),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  maxDevices: integer("max_devices").notNull().default(2),
  status: licenseStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  clientReferenceIdUnique: uniqueIndex("licenses_client_reference_id_idx").on(t.clientReferenceId),
  licenseKeyUnique: uniqueIndex("licenses_license_key_idx").on(t.licenseKey),
}));

export const licenseActivations = pgTable("license_activations", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenseId: uuid("license_id").notNull().references(() => licenses.id, { onDelete: "cascade" }),
  // SHA-256 of a stable OS-level hardware identifier — never the raw ID.
  // See apps/desktop's license.rs for exactly what's hashed per platform.
  deviceFingerprint: text("device_fingerprint").notNull(),
  activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  licenseDeviceUnique: uniqueIndex("license_activations_license_device_idx").on(t.licenseId, t.deviceFingerprint),
  licenseIdx: index("license_activations_license_idx").on(t.licenseId),
}));

// ---------------------------------------------------------------------------
// Anonymous device telemetry registry — populated by the desktop app's
// unauthenticated POST /telemetry/heartbeat (telemetry.rs), and read by the
// admin-only POST /admin/licenses/issue to look up a device's fingerprint
// from its human-readable machine_id before signing it a license. Deliberately
// separate from `licenses`/`licenseActivations` above: a device can send
// heartbeats for weeks before ever buying a license (trial), and this table
// carries no PII (see telemetry.rs's payload — no company/contact info).
// ---------------------------------------------------------------------------

export const deviceStatusEnum = pgEnum("device_status", ["trial", "active", "expired"]);
export const licenseTypeEnum = pgEnum("license_type", ["yearly", "lifetime"]);

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Human-readable "SRD-XXXX-XXXX-XXXX" shown to the user and sent to
  // support/admin to issue a license — cryptographically unlinked from
  // deviceFingerprint below (see license.rs's compute_machine_id doc comment).
  machineId: text("machine_id").notNull(),
  // SHA-256 of the raw platform hardware id — what actually goes into the
  // signed JWT's deviceFingerprint claim.
  deviceFingerprint: text("device_fingerprint").notNull(),
  appVersion: text("app_version").notNull(),
  // Optional — not sent by the anonymous heartbeat itself (telemetry.rs
  // never collects PII), only ever set later by an admin manually editing a
  // device record after a sale/support conversation identifies the person.
  customerName: text("customer_name"),
  email: text("email"),
  // WhatsApp-format, e.g. "213555123456" (no "+", no spaces) — what
  // buildWhatsAppActivationUrl-style links are built from directly.
  phoneNumber: text("phone_number"),
  osPlatform: text("os_platform"),
  invoicesCount: integer("invoices_count").notNull().default(0),
  clientsCount: integer("clients_count").notNull().default(0),
  expensesCount: integer("expenses_count").notNull().default(0),
  status: deviceStatusEnum("status").notNull().default("trial"),
  licenseType: licenseTypeEnum("license_type"),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  // Set once, the first time this machine_id is ever seen (upsertHeartbeat
  // only sets it on insert) — distinct from lastSeenAt/createdAt: this is
  // specifically "when did this person's trial begin," used for cohort/
  // conversion reporting, not just bookkeeping.
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  machineIdUnique: uniqueIndex("devices_machine_id_idx").on(t.machineId),
  fingerprintIdx: index("devices_fingerprint_idx").on(t.deviceFingerprint),
}));

// ---------------------------------------------------------------------------
// Landing page lead capture (apps/web's download modal -> apps/api's
// POST /leads/download) — deliberately NOT linked to `devices` by a foreign
// key: a lead is captured the moment someone fills the download form,
// before the app is even installed, let alone before it has a machine_id
// (that only exists once the desktop app's first heartbeat fires). Matching
// a lead to its eventual device is a manual/reporting-time correlation
// (e.g. by phone number), not a schema-enforced relationship.
// ---------------------------------------------------------------------------

export const osTypeEnum = pgEnum("os_type", ["macos", "windows"]);

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // WhatsApp-format, e.g. "213555123456" — same convention as
  // devices.phoneNumber (no "+", no spaces).
  phone: text("phone").notNull(),
  company: text("company"),
  osType: osTypeEnum("os_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  createdAtIdx: index("leads_created_at_idx").on(t.createdAt),
}));
