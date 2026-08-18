import { z } from 'zod';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().trim().email({ message: "Email invalide" }),
  password: z.string().min(6, { message: "Le mot de passe doit contenir au moins 6 caractères" }),
});

export const signupSchema = z.object({
  email: z.string().trim().email({ message: "Email invalide" }),
  password: z.string().min(6, { message: "Le mot de passe doit contenir au moins 6 caractères" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

// Client schema
export const clientSchema = z.object({
  name: z.string().trim().min(1, { message: "Le nom est requis" }).max(255),
  code: z.string().trim().max(50).nullable().optional().or(z.literal('')),
  contact_person: z.string().trim().max(255).nullable().optional().or(z.literal('')),
  phone: z.string().trim().max(50).nullable().optional().or(z.literal('')),
  email: z.string().trim().email({ message: "Email invalide" }).nullable().optional().or(z.literal('')),
  address: z.string().trim().max(500).nullable().optional().or(z.literal('')),
  city: z.string().trim().max(100).nullable().optional().or(z.literal('')),
  wilaya: z.string().trim().max(100).nullable().optional().or(z.literal('')),
  nif: z.string().trim().max(50).nullable().optional().or(z.literal('')),
  nis: z.string().trim().max(50).nullable().optional().or(z.literal('')),
  rc: z.string().trim().max(50).nullable().optional().or(z.literal('')),
  secondary_rc: z.string().trim().nullable().optional().or(z.literal('')),
  secondary_address: z.string().trim().max(200).nullable().optional().or(z.literal('')),
  ai: z.string().trim().max(50).nullable().optional().or(z.literal('')),
  activite: z.string().trim().max(255).nullable().optional().or(z.literal('')),
  credit_limit: z.coerce.number().min(0).nullable().optional(),
  payment_terms_days: z.coerce.number().int().min(0).max(365).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional().or(z.literal('')),
  initial_balance: z.coerce.number().optional(),
  advance_payment: z.coerce.number().optional(),
});

// Invoice schema
export const invoiceItemSchema = z.object({
  product_id: z.string().uuid({ message: "Produit invalide" }),
  quantity: z.coerce.number().positive({ message: "La quantité doit être positive" }),
  unit_price: z.coerce.number().positive({ message: "Le prix doit être positif" }),
  tva_rate: z.coerce.number().optional().nullable(),
  timbre_exempt: z.boolean().optional().nullable(),
});

export const createInvoiceSchema = z.object({
  client_id: z.string().uuid({ message: "Client invalide" }),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format de date invalide" }),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  month_period: z.string().max(7).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  header_note: z.string().trim().max(2000).optional().or(z.literal('')),
  invoice_type: z.enum(['invoice', 'credit_note', 'proforma']).optional(),
  original_invoice_id: z.string().uuid().optional().or(z.literal('')),
  discount: z.coerce.number().min(0).optional(),
  discount_type: z.enum(['percent', 'amount']).optional(),
  discount_value: z.coerce.number().min(0).optional(),
  use_secondary_register: z.boolean().optional().default(false),
  selected_secondary_rc: z.string().nullable().optional(),
  selected_secondary_address: z.string().nullable().optional(),
  custom_title: z.string().nullable().optional().or(z.literal('')),
  invoice_number: z.string().optional().or(z.literal('')),
  payment_method: z.string().optional().or(z.literal('')),
  status: z.string().optional().or(z.literal('')),
  amount_paid: z.coerce.number().min(0).optional(),
  items: z.array(invoiceItemSchema).min(1, { message: "Au moins un article est requis" }),
});

// Payment schema
export const paymentSchema = z.object({
  invoice_id: z.string().uuid({ message: "Facture invalide" }),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format de date invalide" }),
  amount: z.coerce.number().positive({ message: "Le montant doit être positif" }),
  payment_method: z.string().max(50).optional().or(z.literal('')),
  cheque_number: z.string().max(50).optional().or(z.literal('')),
  bank_name: z.string().max(100).optional().or(z.literal('')),
  value_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

// Expense schema
export const expenseSchema = z.object({
  category: z.string().trim().min(1, { message: "La catégorie est requise" }).max(100),
  amount: z.coerce.number().positive({ message: "Le montant doit être positif" }),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format de date invalide" }),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  payment_method: z.string().max(50).optional().or(z.literal('')),
  reference: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

// Delivery note schema
export const deliveryNoteItemSchema = z.object({
  product_id: z.string().uuid({ message: "Produit invalide" }),
  quantity: z.coerce.number().min(0, { message: "La quantité ne peut pas être négative" }),
});

export const createDeliveryNoteSchema = z.object({
  client_id: z.string().uuid({ message: "Client invalide" }),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format de date invalide" }),
  order_id: z.string().uuid().optional().or(z.literal('')),
  truck_plate: z.string().trim().max(20).optional().or(z.literal('')),
  driver_name: z.string().trim().max(100).optional().or(z.literal('')),
  deliverer_name: z.string().trim().max(200).optional().or(z.literal('')),
  deliverer_nin: z.string().trim().max(50).optional().or(z.literal('')),
  transporter_name: z.string().trim().max(200).optional().or(z.literal('')),
  transporter_nin: z.string().trim().max(50).optional().or(z.literal('')),
  delivery_location: z.string().trim().max(500).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  reserves: z.string().trim().max(1000).optional().or(z.literal('')),
  custom_title: z.string().optional().or(z.literal('')),
  delivery_number: z.string().optional().or(z.literal('')),
  items: z.array(deliveryNoteItemSchema).min(1, { message: "Au moins un article est requis" }),
});

// Product schema
export const productSchema = z.object({
  code: z.string().trim().min(1, { message: "Le code est requis" }).max(50),
  name: z.string().trim().min(1, { message: "Le nom est requis" }).max(255),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  unit: z.string().trim().max(50).optional().or(z.literal('')),
  unit_price: z.coerce.number().min(0, { message: "Le prix ne peut pas être négatif" }),
  is_active: z.boolean().optional(),
  display_order: z.coerce.number().int().min(0).optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type CreateDeliveryNoteInput = z.infer<typeof createDeliveryNoteSchema>;
export type ProductInput = z.infer<typeof productSchema>;
