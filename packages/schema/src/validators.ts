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

// ---------------------------------------------------------------------------
// Licensing (apps/api/src/routes/licenses.ts)
// ---------------------------------------------------------------------------

export const licenseActivateSchema = z.object({
  licenseKey: z.string().min(1),
  deviceFingerprint: z.string().min(1),
});

export const licenseVerifySchema = z.object({
  signedToken: z.string().min(1),
});

// Internal admin-only endpoint — you call this by hand per sale, so it's
// deliberately not exposed to any UI. expiresAt is a plain ISO date string
// on the wire; maxDevices defaults to 2 to match the schema default.
export const licenseCreateSchema = z.object({
  organizationName: z.string().min(1),
  expiresAt: z.string().datetime(),
  maxDevices: z.number().int().positive().optional(),
});

// GET /licenses (admin dashboard's license table) — optional free-text
// search over organizationName, same limit cap as adminDeviceListQuerySchema
// below for consistency across the two admin list views.
export const licenseListQuerySchema = z.object({
  search: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

// PATCH /licenses/:id/revoke — no body; the id in the path is the only
// input. Kept as a named export anyway (rather than inlining a no-op check)
// so every admin route consistently validates via a schema, even a trivial
// empty one.
export const licenseRevokeSchema = z.object({});

// PATCH /licenses/:id/extend — adds `days` on top of the license's current
// expiresAt (not "set to N days from now"), so calling it twice compounds
// correctly instead of clobbering an earlier extension.
export const licenseExtendSchema = z.object({
  days: z.number().int().positive(),
});

// ---------------------------------------------------------------------------
// Device telemetry & admin license issuing (apps/api/src/routes/telemetry.ts,
// apps/api/src/routes/adminLicenses.ts)
// ---------------------------------------------------------------------------

// Mirrors telemetry.rs's HeartbeatPayload struct wire shape exactly — it has
// no #[serde(rename_all)] attribute, so it serializes with its literal
// snake_case Rust field names, not camelCase like the rest of this file's
// schemas. Anonymous only, no PII fields accepted even if a future client
// sent them.
export const telemetryHeartbeatSchema = z.object({
  machine_id: z.string().min(1),
  device_fingerprint: z.string().min(1),
  app_version: z.string().min(1),
  invoices_count: z.number().int().nonnegative(),
  clients_count: z.number().int().nonnegative(),
  expenses_count: z.number().int().nonnegative(),
  last_active_at: z.string().min(1).optional(),
  // Added alongside the admin dashboard's "OS Platform" column — an older
  // desktop build that hasn't rebuilt yet simply won't send this field, so
  // it stays optional rather than breaking that client's heartbeat.
  os_platform: z.string().min(1).optional(),
});

// Internal admin-only endpoint, same trust model as licenseCreateSchema
// above — called by hand per sale, never exposed to any UI. Body shape is
// plain camelCase (an admin/support tool request, not a wire-matched device
// payload like telemetryHeartbeatSchema above).
export const adminLicenseIssueSchema = z.object({
  machineId: z.string().min(1),
  validDays: z.number().int().positive(),
  licenseType: z.enum(["yearly", "lifetime"]).optional(),
});

// GET /admin/devices query params — the admin portal's device list/search
// and status-tab filter.
export const adminDeviceListQuerySchema = z.object({
  search: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  status: z.enum(["trial", "active", "expired"]).optional(),
});

// PATCH /admin/devices/:machineId — an admin manually attaching customer
// contact info to a device record after a sale/support conversation. Every
// field optional and independently settable; empty string clears a field
// (distinct from omitting it, which leaves the existing value untouched).
export const adminDeviceUpdateSchema = z.object({
  customerName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phoneNumber: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Landing page lead capture (apps/web's download modal -> apps/api's
// POST /leads/download)
// ---------------------------------------------------------------------------

// Accepts every real-world way an Algerian mobile number gets typed:
// national with leading 0 ("0553073909"), international with "+213"
// ("+213553073909"), international with a bare "213" prefix, or already
// just the bare 9-digit subscriber number the UI used to force via a fixed
// "+213" prefix chip. Algerian mobile subscriber numbers are always 9
// digits starting with 5, 6, or 7 (after any country code/leading zero is
// stripped) — validated and normalized to that bare 9-digit form so every
// stored phone number and every wa.me link built from it is consistent
// regardless of how the visitor typed it in.
const ALGERIAN_MOBILE_SUBSCRIBER = /^[567][0-9]{8}$/;

function normalizeAlgerianPhone(raw: string): string | null {
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("00213")) digits = digits.slice(5);
  else if (digits.startsWith("213")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return ALGERIAN_MOBILE_SUBSCRIBER.test(digits) ? digits : null;
}

export const leadDownloadSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  phone: z
    .string()
    .min(1, "Le numéro de téléphone est requis")
    .transform((val, ctx) => {
      const normalized = normalizeAlgerianPhone(val);
      if (!normalized) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Numéro de téléphone invalide" });
        return z.NEVER;
      }
      return normalized;
    }),
  company: z.string().optional(),
  osType: z.enum(["macos", "windows"]),
});
