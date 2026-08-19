/**
 * API-boundary Zod validators — moved verbatim out of server/src/routes/*.ts
 * (auth.ts, clients.ts, products.ts). Validation rules are unchanged; only
 * the money()-style helpers were renamed (from the same name "money" in two
 * different files) to avoid a collision now that they live together. Each
 * helper's behavior is preserved exactly as it was in its original file —
 * clientMoney() and productMoney()/productOptionalMoney() are NOT the same
 * function despite the similar names, and were never deduplicated.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth (server/src/routes/auth.ts)
// ---------------------------------------------------------------------------

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  organizationName: z.string().min(1, "Company name is required"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Clients (server/src/routes/clients.ts)
// ---------------------------------------------------------------------------

// Drizzle's `numeric` columns are typed as `string` (money stays exact,
// never a JS float) — the schema accepts a plain JS number from callers and
// converts it to that string right here, so no separate mapping step is
// needed before handing the parsed result to the repository.
const clientMoney = () => z.number().optional().transform((v) => (v === undefined ? undefined : String(v)));

export const clientInputSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  wilaya: z.string().optional(),
  nif: z.string().optional(),
  nis: z.string().optional(),
  rc: z.string().optional(),
  secondaryRc: z.string().optional(),
  secondaryAddress: z.string().optional(),
  ai: z.string().optional(),
  activite: z.string().optional(),
  creditLimit: clientMoney(),
  paymentTermsDays: z.number().int().optional(),
  notes: z.string().optional(),
  initialBalance: clientMoney(),
  advancePayment: clientMoney(),
});

// ---------------------------------------------------------------------------
// Products (server/src/routes/products.ts)
// ---------------------------------------------------------------------------

// See clientMoney() above for why numeric columns are converted to strings
// here. Kept as separate helpers (not merged with clientMoney) since the
// behavior genuinely differs: required vs. nullable-and-optional.
const productMoney = () => z.number().transform(String);
const productOptionalMoney = () =>
  z.number().nullable().optional().transform((v) => (v === undefined || v === null ? v : String(v)));

export const productInputSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  unit: z.string().optional(),
  unitPrice: productMoney(),
  tvaRate: productOptionalMoney(),
  timbreExempt: z.boolean().nullable().optional(),
  displayOrder: z.number().int().optional(),
});
